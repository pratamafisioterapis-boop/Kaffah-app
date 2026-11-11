// Pencocokan transaksi di laporan QRIS bank dengan pembayaran QRIS di daily_recaps.
//
// Syarat wajib : tanggal sama + nominal sama persis.
// Petunjuk     : (1) kemiripan nama pelanggan bank dengan nama pasien,
//                (2) kedekatan jam transaksi bank dengan jam AKHIR sesi/slot pasien.
// Bila petunjuk tidak cukup jelas, transaksi dibiarkan "belum cocok" agar admin memilih
// manual — lebih baik tidak menebak daripada salah mencocokkan uang.

const norm = (s) =>
  String(s || '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);

// Gelar/sapaan tidak ikut dihitung sebagai bagian nama.
const STOP = new Set(['DR', 'DRG', 'BPK', 'IBU', 'MR', 'MRS', 'MS', 'BAPAK', 'SDR', 'SDRI', 'NY', 'TN', 'AN', 'PT', 'CV']);

const editDistance = (a, b) => {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
};

// Dua token dianggap sama bila persis sama, salah satu singkatan dari yang lain (>=3 huruf,
// mis. "MUH" ~ "MUHAMMAD", "DAN" ~ "DANISH"), atau beda satu huruf pada kata panjang.
const sameToken = (x, y) => {
  if (x === y) return true;
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  if (s.length >= 3 && l.startsWith(s)) return true;
  return s.length >= 5 && l.length >= 5 && editDistance(x, y) <= 1;
};

// Berapa token nama yang sama (pelanggan e-wallet/bank belum tentu sama dengan nama pasien,
// mis. dibayar oleh keluarga, jadi ini hanya petunjuk, bukan syarat).
export const nameOverlap = (a, b) => {
  const A = norm(a).filter((t) => !STOP.has(t));
  const B = norm(b).filter((t) => !STOP.has(t));
  const used = new Set();
  let n = 0;
  B.forEach((tb) => {
    const i = A.findIndex((ta, idx) => !used.has(idx) && sameToken(ta, tb));
    if (i >= 0) { used.add(i); n += 1; }
  });
  return n;
};

const minutesOf = (hhmm) => {
  const m = String(hhmm || '').match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
};

// Jam akhir sesi pasien (menit sejak 00:00). Dipakai payAt (akhir sesi, cadangan: mulai/dibuat).
const endMinutesOf = (p) => {
  if (p.payAt instanceof Date && !Number.isNaN(p.payAt.getTime())) return p.payAt.getHours() * 60 + p.payAt.getMinutes();
  return minutesOf(p.endTime) ?? minutesOf(p.time);
};

// Selisih menit antara jam transaksi bank dan jam akhir sesi (Infinity bila salah satunya tidak ada).
export const timeGap = (t, p) => {
  const a = minutesOf(t.trx_time);
  const b = endMinutesOf(p);
  return a != null && b != null ? Math.abs(a - b) : Infinity;
};

// Pembayaran QRIS dari satu recap: bila ada split, jumlahkan split QRIS saja
// (mis. tagihan 250rb = 200rb QRIS + 50rb cash -> 200rb); kalau tidak ada split,
// pakai seluruh nominal bila payment_method-nya QRIS.
export const qrisPortionOfRecap = (recap, isQrisMethod) => {
  const splits = Array.isArray(recap.payment_splits) ? recap.payment_splits : [];
  if (splits.length > 0) {
    return splits
      .filter((s) => isQrisMethod(s.payment_method))
      .reduce((sum, s) => sum + Number(s.amount || 0), 0);
  }
  return isQrisMethod(recap.payment_method) ? Number(recap.amount || 0) : 0;
};

const NEAR_MIN = 180; // pasien bisa bayar lebih awal atau jauh setelah slot: dianggap "dekat" bila selisih <= 3 jam
const CLEAR_MARGIN = 10; // pemenang harus unggul >= 10 menit dari runner-up

// Skor satu pasangan transaksi–pembayaran.
export const scorePair = (t, p) => ({ name: nameOverlap(t.customer_name, p.name), gap: timeGap(t, p) });

// Urutkan kandidat (nama mirip dulu, lalu jam terdekat). Dipakai juga untuk saran di tampilan manual.
export const rankCandidates = (t, portions) =>
  portions
    .map((p) => ({ p, ...scorePair(t, p) }))
    .sort((a, b) => b.name - a.name || a.gap - b.gap);

// Apakah `a` jelas lebih baik dari `b` untuk transaksi yang sama?
const clearlyBetter = (a, b) => {
  if (a.name !== b.name) return a.name > b.name;
  return a.gap <= NEAR_MIN && a.gap + CLEAR_MARGIN <= b.gap;
};

// Cari gabungan 2-3 pembayaran QRIS yang jumlahnya persis sama dengan satu transaksi bank
// (satu scan untuk beberapa pasien). Diurutkan: nama mirip, lalu satu admin, lalu jam terdekat.
export const findCombos = (t, portions, { maxSize = 3, limit = 5 } = {}) => {
  const target = Math.round(Number(t.amount));
  const pool = portions.filter((p) => Math.round(p.amount) > 0 && Math.round(p.amount) < target).slice(0, 40);
  const found = [];
  const walk = (start, picked, sum) => {
    if (picked.length >= 2 && sum === target) { found.push([...picked]); return; }
    if (picked.length >= maxSize) return;
    for (let i = start; i < pool.length; i += 1) {
      const next = sum + Math.round(pool[i].amount);
      if (next <= target) walk(i + 1, [...picked, pool[i]], next);
    }
  };
  walk(0, [], 0);
  return found
    .map((items) => {
      const scores = items.map((p) => scorePair(t, p));
      return {
        items,
        name: scores.reduce((s, x) => s + x.name, 0),
        gap: Math.max(...scores.map((x) => x.gap)),
        sameAdmin: new Set(items.map((p) => p.cashierId)).size === 1,
      };
    })
    .sort((a, b) => b.name - a.name || Number(b.sameAdmin) - Number(a.sameAdmin) || a.gap - b.gap)
    .slice(0, limit);
};

// Satu pasien membayar QRIS dua kali (mis. 200rb lalu 25rb) tetapi di recap hanya tercatat sekali (225rb).
// Cocokkan 2-3 transaksi dengan nama pelanggan mirip nama pasien yang jumlahnya pas dengan recap.
// Hanya dipakai bila gabungannya tunggal (tidak ambigu).
export const autoMatchSplits = (transactions, portions, { maxParts = 3 } = {}) => {
  const takenTx = new Set();
  const matches = [];
  for (const p of portions) {
    const target = Math.round(p.amount);
    const pool = transactions
      .filter((t) => !takenTx.has(t.id) && t.trx_date === p.date && Math.round(t.amount) > 0 && Math.round(t.amount) < target && nameOverlap(t.customer_name, p.name) > 0)
      .slice(0, 20);
    if (pool.length < 2) continue;
    const found = [];
    const walk = (start, picked, sum) => {
      if (picked.length >= 2 && sum === target) { found.push([...picked]); return; }
      if (picked.length >= maxParts) return;
      for (let i = start; i < pool.length; i += 1) {
        const next = sum + Math.round(pool[i].amount);
        if (next <= target) walk(i + 1, [...picked, pool[i]], next);
      }
    };
    walk(0, [], 0);
    if (found.length !== 1) continue;
    found[0].forEach((t) => { takenTx.add(t.id); matches.push({ transactionId: t.id, recapId: p.recapId }); });
  }
  return matches;
};

/**
 * @param transactions [{ id, trx_date, trx_time, amount, customer_name }] yang belum dicocokkan
 * @param portions     [{ recapId, date, amount, name, time, payAt }] pembayaran QRIS di recap yang belum terpakai
 * @returns { matches: [{ transactionId, recapId }], ambiguous: Set<transactionId> }
 */
export const autoMatchQris = (transactions, portions) => {
  const taken = new Set();
  const matches = [];
  const ambiguous = new Set();
  const ordered = [...transactions].sort((a, b) =>
    `${a.trx_date} ${a.trx_time || ''}`.localeCompare(`${b.trx_date} ${b.trx_time || ''}`)
  );

  const candidatesOf = (t) =>
    portions.filter(
      (p) => !taken.has(p.recapId) && p.date === t.trx_date && Math.round(p.amount) === Math.round(t.amount)
    );

  const pending = new Map(ordered.map((t) => [t.id, t]));
  let progress = true;
  while (progress) {
    progress = false;
    for (const t of ordered) {
      if (!pending.has(t.id)) continue;
      const cands = candidatesOf(t);
      if (cands.length === 0) continue;

      // Transaksi lain (belum cocok) dengan nominal & tanggal sama ikut berebut kandidat.
      const rivals = [...pending.values()].filter(
        (o) => o.id !== t.id && o.trx_date === t.trx_date && Math.round(o.amount) === Math.round(t.amount)
      );

      let pick = null;
      if (cands.length === 1) {
        pick = cands[0];
        if (rivals.length > 0) {
          // Satu pembayaran diperebutkan beberapa transaksi: hanya cocok bila transaksi ini jelas yang terbaik.
          const mine = scorePair(t, pick);
          const beatsAll = rivals.every((o) => clearlyBetter(mine, scorePair(o, pick)));
          if (!beatsAll) pick = null;
        }
      } else {
        const [first, second] = rankCandidates(t, cands);
        if (clearlyBetter(first, second)) {
          pick = first.p;
          // Jangan ambil bila transaksi saingan lebih pantas untuk pembayaran ini.
          const mine = scorePair(t, pick);
          if (rivals.some((o) => clearlyBetter(scorePair(o, pick), mine))) pick = null;
        }
      }

      if (pick) {
        matches.push({ transactionId: t.id, recapId: pick.recapId });
        taken.add(pick.recapId);
        pending.delete(t.id);
        progress = true;
      }
    }
  }

  for (const t of pending.values()) {
    if (candidatesOf(t).length > 0) ambiguous.add(t.id);
  }
  return { matches, ambiguous };
};
