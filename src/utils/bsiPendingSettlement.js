// "Uang belum masuk rekening": cocokkan pembayaran non-tunai (QRIS, debit, transfer) di
// aplikasi dengan uang masuk di mutasi rekening BSI, lalu tampilkan sisanya.
//
// Yang dicocokkan adalah UANG NYATA yang dibayar pasien (bukan pengakuan pendapatan per sesi):
//  - unit  = satu pembayaran di daily_recaps (atau split-nya) / pemasukan lain-lain admin.
//  - kredit = satu baris uang masuk di mutasi.
//
// Pola bank yang sudah dibuktikan dari data Kaffah (Nov 2026):
//  - Kode "QR ddmmyy xxxx" = TANGGAL TRANSAKSI, bukan tanggal masuk. Uang bisa masuk sore hari
//    yang sama atau pagi hari berikutnya, jadi QRIS dicocokkan per tanggal transaksi.
//  - Pasien satu keluarga yang bayar sekaligus muncul sebagai SATU setoran (mis. 100rb + 150rb
//    = 250rb), dan pemasukan lain-lain (mis. kinesiotape) ikut dalam satu setoran dengan
//    terapinya (225rb + 100rb = 325rb). Karena itu satu kredit bisa cocok dengan 2-4 unit.
//  - QRIS di atas Rp500.000 kena MDR 0,3%; debit sekitar 0,15% -> yang masuk lebih kecil.
//  - QRIS dari m-banking BSI masuk sebagai "TRF Dari" tanpa kode QR.

const TOL = 2; // toleransi pembulatan (Rp)
export const QRIS_MDR_THRESHOLD = 500000;
export const QRIS_MDR_RATE = 0.003;
export const DEBIT_MDR_RATE = 0.0015;
const DEBIT_MAX_MDR = 0.015; // debit: terima potongan sampai 1,5% supaya tidak terlalu kaku
const MAX_COMBO = 4;
const MAX_COMBO_POOL = 18;

export const netOf = (method, amount) => {
  const a = Number(amount) || 0;
  if (method === 'qris') return a > QRIS_MDR_THRESHOLD ? a - Math.round(a * QRIS_MDR_RATE) : a;
  if (method === 'debit') return a - Math.round(a * DEBIT_MDR_RATE);
  return a;
};

export const methodOf = (label) => {
  const s = String(label || '').toLowerCase();
  if (s.includes('qris')) return 'qris';
  if (s.includes('debit')) return 'debit';
  if (s.includes('transfer')) return 'transfer';
  return null; // cash, package, dll: bukan urusan rekening
};

const dayNum = (ymd) => {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};
export const daysBetween = (fromYmd, toYmd) => dayNum(toYmd) - dayNum(fromYmd);
export const addDays = (ymd, n) => {
  const t = new Date((dayNum(ymd) + n) * 86400000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
};

const hhmmWita = (ts) => {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false });
};

/**
 * Ubah baris database menjadi unit pembayaran non-tunai.
 * @param recaps  daily_recaps  {id, recap_date, revenue_date, payment_method, amount, full_name, guest_name, end_time, status}
 * @param splits  daily_recap_payment_splits {id, recap_id, payment_method, amount}
 * @param incomes admin_income  {id, date, amount, payment_method, description, sub_category, created_at}
 */
export const buildUnits = ({ recaps = [], splits = [], incomes = [] }) => {
  const splitsByRecap = new Map();
  splits.forEach((s) => {
    if (!splitsByRecap.has(s.recap_id)) splitsByRecap.set(s.recap_id, []);
    splitsByRecap.get(s.recap_id).push(s);
  });

  const units = [];
  recaps.forEach((r) => {
    if (r.status === 'cancelled') return;
    const date = r.revenue_date || r.recap_date;
    const name = (r.full_name || r.guest_name || '-').trim();
    const time = hhmmWita(r.end_time);
    const sp = splitsByRecap.get(r.id);
    if (sp && sp.length > 0) {
      sp.forEach((s) => {
        const method = methodOf(s.payment_method);
        const amount = Number(s.amount) || 0;
        if (method && amount > 0) units.push({ id: `${r.id}:${s.id}`, kind: 'pasien', date, time, method, amount, name });
      });
      return;
    }
    const method = methodOf(r.payment_method);
    const amount = Number(r.amount) || 0;
    if (method && amount > 0) units.push({ id: r.id, kind: 'pasien', date, time, method, amount, name });
  });

  incomes.forEach((i) => {
    const method = methodOf(i.payment_method);
    const amount = Number(i.amount) || 0;
    if (!method || amount <= 0) return;
    const label = [i.sub_category, i.description].filter(Boolean).join(' - ') || 'Pemasukan lain';
    units.push({ id: `inc:${i.id}`, kind: 'lainnya', date: i.date, time: hhmmWita(i.created_at), method, amount, name: label });
  });
  return units;
};

const nameHit = (u, c) => {
  const hay = String(c.desc || '').toUpperCase();
  return String(u.name || '').toUpperCase().split(/[^A-Z]+/).some((t) => t.length >= 4 && hay.includes(t));
};

// Urutan pilihan unit untuk satu kredit: nama cocok > metode sama > tanggal terdekat > yang lebih dulu.
const rankFor = (c) => (a, b) => {
  const nh = Number(nameHit(b, c)) - Number(nameHit(a, c));
  if (nh) return nh;
  const sameM = (u) => Number(u.method === c.type || (c.type === 'transfer' && u.method === 'transfer'));
  if (sameM(a) !== sameM(b)) return sameM(b) - sameM(a);
  const lag = (u) => Math.abs(daysBetween(u.date, c.qrDateStr || c.dateStr));
  if (lag(a) !== lag(b)) return lag(a) - lag(b);
  return byDateTime(a, b);
};

const byDateTime = (a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`);

const unitFits = (u, credit) =>
  u.method === 'debit'
    ? credit <= u.amount + TOL && credit >= u.amount * (1 - DEBIT_MAX_MDR) - TOL
    : Math.abs(u.net - credit) <= TOL;

// Cari kombinasi 2..MAX_COMBO unit yang jumlah net-nya = nominal kredit.
const findCombo = (pool, target) => {
  const cand = pool.filter((u) => u.method !== 'debit' && u.net < target + TOL).slice(0, MAX_COMBO_POOL);
  for (let size = 2; size <= MAX_COMBO; size += 1) {
    const pick = [];
    const dfs = (start, sum) => {
      if (pick.length === size) return Math.abs(sum - target) <= TOL;
      for (let i = start; i < cand.length; i += 1) {
        if (sum + cand[i].net > target + TOL) continue;
        pick.push(cand[i]);
        if (dfs(i + 1, sum + cand[i].net)) return true;
        pick.pop();
      }
      return false;
    };
    if (dfs(0, 0)) return [...pick];
  }
  return null;
};

/**
 * @param credits     hasil parseMutasiPdf().credits
 * @param units       hasil buildUnits()
 * @param periodStart awal periode mutasi (YYYY-MM-DD). Unit SEBELUM tanggal ini dianggap sudah masuk.
 * @param asOf        tanggal terakhir yang dicakup mutasi (YYYY-MM-DD), untuk menghitung umur
 */
export const reconcileSettlement = ({ credits, units, periodStart, asOf }) => {
  const free = units.map((u) => ({ ...u, net: netOf(u.method, u.amount), taken: false })).sort(byDateTime);
  const creds = [...credits].sort((a, b) => `${a.dateStr}${a.time || ''}`.localeCompare(`${b.dateStr}${b.time || ''}`));
  const matched = new Set();
  const matches = [];

  const take = (c, us, how) => {
    us.forEach((u) => { u.taken = true; });
    matched.add(c.id);
    matches.push({ credit: c, units: us, how });
  };

  // Jendela kandidat. strict = aturan ketat per jenis; relaxed = longgar (cadangan).
  const inWindow = (u, c, relaxed) => {
    if (c.type === 'qris' && c.qrDateStr) {
      const gap = Math.abs(daysBetween(u.date, c.qrDateStr));
      return relaxed ? (u.method !== 'debit' && gap <= 2) : (u.method === 'qris' && gap === 0);
    }
    const lag = daysBetween(u.date, c.dateStr); // hari sejak transaksi sampai uang masuk
    if (c.type === 'debit') return u.method === 'debit' && lag >= 0 && lag <= 10;
    if (c.type === 'transfer') {
      return (u.method === 'transfer' || u.method === 'qris') && lag >= (relaxed ? -1 : 0) && lag <= (relaxed ? 5 : 3);
    }
    return lag >= -1 && lag <= (u.method === 'debit' ? 10 : 5);
  };

  const pass = (relaxed, combos) => {
    creds.forEach((c) => {
      if (matched.has(c.id)) return;
      const pool = free.filter((u) => !u.taken && inWindow(u, c, relaxed)).sort(rankFor(c));
      if (pool.length === 0) return;
      if (!combos) {
        const hit = pool.find((u) => unitFits(u, c.amount));
        if (hit) take(c, [hit], relaxed ? 'single-relaxed' : 'single');
        return;
      }
      // Kombinasi hanya untuk unit pada tanggal yang sama (satu keluarga / satu kunjungan).
      const groups = new Map();
      pool.forEach((u) => {
        if (!groups.has(u.date)) groups.set(u.date, []);
        groups.get(u.date).push(u);
      });
      const sets = c.type === 'qris' && c.qrDateStr && !relaxed ? [pool] : [...groups.values()];
      for (const g of sets) {
        const combo = findCombo(g, c.amount);
        if (combo) { take(c, combo, relaxed ? 'combo-relaxed' : 'combo'); return; }
      }
    });
  };
  pass(false, false);
  pass(false, true);
  pass(true, false);
  pass(true, true);

  // Sisa unit = belum masuk (kecuali sebelum periode mutasi: dianggap sudah masuk).
  const pending = [];
  const assumed = [];
  free.filter((u) => !u.taken).forEach((u) => {
    if (periodStart && u.date < periodStart) { assumed.push(u); return; }
    const age = asOf ? daysBetween(u.date, asOf) : 0;
    const twin = free.some((o) => o.taken && o.date === u.date && o.method === u.method && Math.abs(o.net - u.net) <= TOL);
    pending.push({ ...u, ageDays: age, overdue: age >= (u.method === 'debit' ? 8 : 3), ambiguous: twin });
  });

  const unmatchedCredits = creds
    .filter((c) => !matched.has(c.id))
    .map((c) => ({ ...c, beforePeriod: Boolean(periodStart && c.qrDateStr && c.qrDateStr < periodStart) }));

  // Ringkasan per tanggal transaksi (hanya yang dalam periode).
  const inScope = free.filter((u) => !periodStart || u.date >= periodStart);
  const perDay = new Map();
  inScope.forEach((u) => {
    if (!perDay.has(u.date)) perDay.set(u.date, { date: u.date, expectedNet: 0, receivedNet: 0, pendingNet: 0, pendingGross: 0, count: 0, pendingCount: 0 });
    const d = perDay.get(u.date);
    d.count += 1;
    d.expectedNet += u.net;
    if (u.taken) d.receivedNet += u.net;
    else { d.pendingNet += u.net; d.pendingGross += u.amount; d.pendingCount += 1; }
  });

  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const summary = {
    expectedCount: inScope.length,
    expectedGross: sum(inScope, (u) => u.amount),
    expectedNet: sum(inScope, (u) => u.net),
    receivedNet: sum(inScope.filter((u) => u.taken), (u) => u.net),
    pendingCount: pending.length,
    pendingGross: sum(pending, (u) => u.amount),
    pendingNet: sum(pending, (u) => u.net),
    pendingOverdueCount: pending.filter((u) => u.overdue).length,
    unmatchedCreditCount: unmatchedCredits.filter((c) => !c.beforePeriod).length,
    unmatchedCreditSum: sum(unmatchedCredits.filter((c) => !c.beforePeriod), (c) => c.amount),
    beforePeriodCreditSum: sum(unmatchedCredits.filter((c) => c.beforePeriod), (c) => c.amount),
    assumedCount: assumed.length,
    assumedGross: sum(assumed, (u) => u.amount),
  };

  return {
    summary,
    pending,
    unmatchedCredits,
    matches,
    assumed,
    perDay: [...perDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
};
