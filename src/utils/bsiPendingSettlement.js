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
//
// Sumber kebenaran QRIS = "Laporan Transaksi QRIS" BSI Merchant yang sudah diunggah dan
// dicocokkan ke recap di halaman admin (tabel qris_report_transactions: matched_recap_id +
// extra_recap_ids). Satu transaksi laporan = satu uang masuk di bank (nominal net), dan
// pembayaran gabungan (keluarga) sudah tercatat di sana. Recap QRIS yang BELUM ada di laporan
// (belum diunggah / belum cocok) tetap dicocokkan dari nominal recap, ditandai "belum terverifikasi".
// Transfer dan debit dicocokkan otomatis dari recap.

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

const hhmmJakarta = (ts) => {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false });
};
const toMin = (hhmm) => {
  const m = String(hhmm || '').match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const addMinutes = (hhmm, n) => {
  const t = toMin(hhmm);
  if (t == null) return null;
  const v = (t + n + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};

/**
 * Ubah baris database menjadi unit pembayaran non-tunai.
 * @param recaps  daily_recaps  {id, recap_date, revenue_date, payment_method, amount, goods_amount, tips_amount, full_name, guest_name, end_time, status}
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
    const tBank = hhmmJakarta(r.end_time); // mutasi bank memakai jam WIB
    const sp = splitsByRecap.get(r.id);
    if (sp && sp.length > 0) {
      sp.forEach((s) => {
        const method = methodOf(s.payment_method);
        const amount = Number(s.amount) || 0;
        if (method && amount > 0) units.push({ id: `${r.id}:${s.id}`, recapId: r.id, kind: 'pasien', date, time, tBank, method, amount, name });
      });
      return;
    }
    // Total yang benar-benar dibayar pasien = terapi + penjualan barang + tips (semuanya mengikuti
    // metode bayar recap), bukan hanya kolom amount.
    const method = methodOf(r.payment_method);
    const amount = (Number(r.amount) || 0) + (Number(r.goods_amount) || 0) + (Number(r.tips_amount) || 0);
    if (method && amount > 0) units.push({ id: r.id, recapId: r.id, kind: 'pasien', date, time, tBank, method, amount, name });
  });

  incomes.forEach((i) => {
    const method = methodOf(i.payment_method);
    const amount = Number(i.amount) || 0;
    if (!method || amount <= 0) return;
    const label = [i.sub_category, i.description].filter(Boolean).join(' - ') || 'Pemasukan lain';
    units.push({ id: `inc:${i.id}`, recapId: null, kind: 'lainnya', date: i.date, time: hhmmWita(i.created_at), tBank: hhmmJakarta(i.created_at), method, amount, name: label });
  });
  return units;
};

const nameHit = (u, c) => {
  const hay = String(c.desc || '').toUpperCase();
  return String(u.name || '').toUpperCase().split(/[^A-Z]+/).some((t) => t.length >= 4 && hay.includes(t));
};

// Urutan pilihan unit untuk satu kredit: nama cocok > metode sama > tanggal terdekat > yang lebih dulu.
const feasible = (u, c) => {
  if (c.dateStr !== u.date || !u.tBank || !c.time) return true;
  return toMin(c.time) >= toMin(u.tBank) - 10;
};
const rankFor = (c) => (a, b) => {
  const nh = Number(nameHit(b, c)) - Number(nameHit(a, c));
  if (nh) return nh;
  const fe = Number(feasible(b, c)) - Number(feasible(a, c));
  if (fe) return fe;
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

// Cari himpunan bagian (ukuran minSize..maxSize) dari pool yang jumlah val()-nya = target.
const findSubset = (pool, target, val, minSize, maxSize) => {
  const cand = pool.filter((u) => val(u) <= target + TOL).slice(0, MAX_COMBO_POOL);
  for (let size = minSize; size <= maxSize; size += 1) {
    const pick = [];
    const dfs = (start, sum) => {
      if (pick.length === size) return Math.abs(sum - target) <= TOL;
      for (let i = start; i < cand.length; i += 1) {
        if (sum + val(cand[i]) > target + TOL) continue;
        pick.push(cand[i]);
        if (dfs(i + 1, sum + val(cand[i]))) return true;
        pick.pop();
      }
      return false;
    };
    if (dfs(0, 0)) return [...pick];
  }
  return null;
};

// Kombinasi 2..MAX_COMBO unit yang jumlah net-nya = nominal kredit.
const findCombo = (pool, target) => findSubset(pool.filter((u) => u.method !== 'debit'), target, (u) => u.net, 2, MAX_COMBO);

const tokenHit = (a, b) => {
  const B = String(b || '').toUpperCase();
  return String(a || '').toUpperCase().split(/[^A-Z]+/).some((t) => t.length >= 4 && B.includes(t));
};

/**
 * Gabungkan Laporan Transaksi QRIS (qris_report_transactions) ke daftar unit.
 *
 * Tiap transaksi laporan menjadi SATU unit "laporan" (nominal net = uang yang masuk ke bank).
 * Recap yang sudah dicocokkan admin ke transaksi itu (matched_recap_id + extra_recap_ids)
 * "dilebur" ke unit tersebut, jadi tidak dihitung dua kali. Bila transaksi belum dicocokkan,
 * dicoba dicocokkan otomatis dengan recap QRIS yang belum terpakai (tanggal sama, nominal sama).
 * Selisih nominal (mis. kinesiotape yang dibayar bersama terapi) diserap dari pemasukan
 * QRIS lain pada tanggal itu.
 *
 * @param gatewayTrx {id, trx_date, trx_time(WIB), customer_name, issuer, amount, net_amount, matched_recap_id, extra_recap_ids}
 */
export const applyGatewayReport = ({ units, gatewayTrx = [] }) => {
  const covered = new Set();
  const byRecap = new Map();
  units.forEach((u) => {
    if (!u.recapId) return;
    if (!byRecap.has(u.recapId)) byRecap.set(u.recapId, []);
    byRecap.get(u.recapId).push(u);
  });
  const freeQris = (date) => units.filter((u) => !covered.has(u.id) && u.method === 'qris' && u.date === date);
  const sumAmt = (arr) => arr.reduce((t, u) => t + u.amount, 0);

  const trxs = [...gatewayTrx].sort((a, b) => `${a.trx_date}${a.trx_time || ''}`.localeCompare(`${b.trx_date}${b.trx_time || ''}`));
  const prepared = trxs.map((t) => {
    const ids = [t.matched_recap_id, ...(t.extra_recap_ids || [])].filter(Boolean);
    const linked = ids.flatMap((id) => byRecap.get(id) || []).filter((u) => !covered.has(u.id));
    linked.forEach((u) => covered.add(u.id));
    return { t, ids, linked, how: ids.length ? 'admin' : null };
  });

  // Selisih nominal pada transaksi yang sudah dicocokkan admin -> serap dari pemasukan QRIS lain.
  prepared.filter((p) => p.how === 'admin').forEach((p) => {
    const residual = Number(p.t.amount) - sumAmt(p.linked);
    if (residual <= TOL) return;
    const hit = findSubset(freeQris(p.t.trx_date), residual, (u) => u.amount, 1, 2);
    if (hit) { hit.forEach((u) => covered.add(u.id)); p.linked.push(...hit); }
  });

  // Transaksi yang belum dicocokkan admin -> cocokkan otomatis dengan recap QRIS yang belum terpakai.
  prepared.filter((p) => !p.how).forEach((p) => {
    const pool = freeQris(p.t.trx_date);
    const single = pool.filter((u) => Math.abs(u.amount - Number(p.t.amount)) <= TOL);
    const one = single.find((u) => tokenHit(u.name, p.t.customer_name)) || single[0];
    const pick = one ? [one] : findSubset(pool, Number(p.t.amount), (u) => u.amount, 2, 3);
    if (pick) { pick.forEach((u) => covered.add(u.id)); p.linked.push(...pick); p.how = 'auto'; }
  });

  const gwUnits = prepared.map(({ t, linked, how }) => ({
    id: `gw:${t.id}`,
    recapId: null,
    kind: 'laporan',
    date: t.trx_date,
    time: addMinutes(t.trx_time, 60), // tampilan WITA, seperti recap
    tBank: t.trx_time || null,
    method: 'qris',
    amount: Number(t.amount) || 0,
    net: Number(t.net_amount) || 0,
    name: linked.length ? linked.map((u) => u.name).join(' + ') : (t.customer_name || '-'),
    verified: true,
    gateway: { customer: t.customer_name || '', issuer: t.issuer || '', time: t.trx_time || '', how, recapCount: linked.length },
  }));

  return {
    units: [...units.filter((u) => !covered.has(u.id)), ...gwUnits],
    stats: {
      trxCount: trxs.length,
      linkedByAdmin: prepared.filter((p) => p.how === 'admin').length,
      linkedAuto: prepared.filter((p) => p.how === 'auto').length,
      unlinked: prepared.filter((p) => !p.how).length,
      firstDate: trxs.length ? trxs[0].trx_date : null,
      lastDate: trxs.length ? trxs[trxs.length - 1].trx_date : null,
    },
  };
};

/**
 * @param credits     hasil parseMutasiPdf().credits
 * @param units       hasil buildUnits()
 * @param periodStart awal periode mutasi (YYYY-MM-DD). Unit SEBELUM tanggal ini dianggap sudah masuk.
 * @param asOf        tanggal terakhir yang dicakup mutasi (YYYY-MM-DD), untuk menghitung umur
 */
export const reconcileSettlement = ({ credits, units, periodStart, asOf }) => {
  const free = units.map((u) => ({ ...u, net: u.net ?? netOf(u.method, u.amount), taken: false })).sort(byDateTime);
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

  // Setoran yang tidak cocok: sarankan pembayaran yang belum masuk dengan nominal mirip tetapi
  // metodenya beda (mis. debit yang tercatat "Transfer"). Hanya saran, tidak dicocokkan otomatis.
  const pendingIds = new Set(pending.map((p) => p.id));
  const suggestFor = (c) =>
    free
      .filter((u) => pendingIds.has(u.id) && !u.verified)
      .filter((u) => {
        const lag = daysBetween(u.date, c.dateStr);
        if (lag < -1 || lag > 10) return false;
        const asDebit = c.amount <= u.amount + TOL && c.amount >= u.amount * (1 - DEBIT_MAX_MDR) - TOL;
        return asDebit || Math.abs(u.net - c.amount) <= TOL;
      })
      .sort(rankFor(c))
      .slice(0, 3)
      .map((u) => ({ id: u.id, name: u.name, date: u.date, method: u.method, amount: u.amount }));

  // Kode QR di mutasi tidak memuat nama: bila ada transaksi lain dengan tanggal & nominal sama,
  // pasangan nama-nya bisa tertukar (uangnya tetap benar).
  matches.forEach((m) => {
    m.ambiguous = m.units.some((u) => free.some((o) => o.id !== u.id && o.date === u.date && o.method === u.method && Math.abs(o.net - u.net) <= TOL));
  });

  const unmatchedCredits = creds
    .filter((c) => !matched.has(c.id))
    .map((c) => ({
      ...c,
      beforePeriod: Boolean(periodStart && c.qrDateStr && c.qrDateStr < periodStart),
      suggestions: suggestFor(c),
    }));

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
    unverifiedQrisCount: inScope.filter((u) => u.method === 'qris' && !u.verified).length,
    unverifiedQrisGross: sum(inScope.filter((u) => u.method === 'qris' && !u.verified), (u) => u.amount),
    unverifiedQrisPending: pending.filter((u) => u.method === 'qris' && !u.verified).length,
    gatewayUnlinkedCount: inScope.filter((u) => u.kind === 'laporan' && !u.gateway.how).length,
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
