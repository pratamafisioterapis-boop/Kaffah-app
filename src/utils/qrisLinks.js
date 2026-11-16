// Tautan transaksi Laporan QRIS (qris_report_transactions) ke pembayaran di aplikasi.
//
// Satu transaksi bisa menaut ke beberapa "item": recap pasien (matched_recap_id +
// extra_recap_ids) dan pemasukan lain-lain admin (extra_income_ids). Di UI keduanya
// disatukan sebagai "kunci": id recap apa adanya, id pemasukan diberi awalan "inc:".

import { nameOverlap, timeGap } from '@/utils/qrisMatcher';

export const INCOME_PREFIX = 'inc:';
export const incomeKey = (id) => `${INCOME_PREFIX}${id}`;
export const isIncomeKey = (k) => String(k).startsWith(INCOME_PREFIX);

export const keysOfTrx = (t) =>
  [t.matched_recap_id, ...(t.extra_recap_ids || []), ...(t.extra_income_ids || []).map(incomeKey)].filter(Boolean);

export const isLinked = (t) => keysOfTrx(t).length > 0;

const splitKeys = (keys) => {
  const recapIds = keys.filter((k) => !isIncomeKey(k));
  const incomeIds = keys.filter(isIncomeKey).map((k) => String(k).slice(INCOME_PREFIX.length));
  return { recapIds, incomeIds };
};

// Tautan manual baru (menimpa tautan lama transaksi itu).
export const linkPatch = (keys, { userId = null, now = new Date().toISOString() } = {}) => {
  const { recapIds, incomeIds } = splitKeys(keys);
  return {
    matched_recap_id: recapIds[0] || null,
    extra_recap_ids: recapIds.slice(1),
    extra_income_ids: incomeIds,
    auto_match_blocked: false,
    match_method: 'manual',
    matched_at: now,
    matched_by: userId,
  };
};

// Lepas semua tautan. auto_match_blocked: transaksi yang sengaja dilepas tidak dicocokkan otomatis lagi.
export const clearPatch = () => ({
  matched_recap_id: null,
  extra_recap_ids: [],
  extra_income_ids: [],
  auto_match_blocked: true,
  match_method: null,
  matched_at: null,
  matched_by: null,
});

// Keluarkan beberapa item dari transaksi lain (dipakai saat admin "memindahkan" item ke transaksi ini).
export const detachPatch = (t, removeKeys) => {
  const remove = removeKeys instanceof Set ? removeKeys : new Set(removeKeys);
  const remaining = keysOfTrx(t).filter((k) => !remove.has(k));
  if (remaining.length === 0) return clearPatch();
  const { recapIds, incomeIds } = splitKeys(remaining);
  return { matched_recap_id: recapIds[0] || null, extra_recap_ids: recapIds.slice(1), extra_income_ids: incomeIds };
};

/**
 * Urutkan pilihan manual untuk satu transaksi: tanggal sama dulu, lalu nama mirip,
 * lalu yang tercatat QRIS, lalu jam terdekat.
 * @param pool [{ key, kind, name, date, time, payAt, amount, isQris }]
 */
export const rankPool = (t, pool) =>
  pool
    .map((p) => ({ p, name: nameOverlap(t.customer_name, p.name), gap: timeGap(t, p), sameDay: p.date === t.trx_date }))
    .sort((a, b) =>
      Number(b.sameDay) - Number(a.sameDay)
      || b.name - a.name
      || Number(b.p.isQris) - Number(a.p.isQris)
      || a.gap - b.gap);

/**
 * Status penutupan per pembayaran, dihitung per "kelompok tertaut" (transaksi dan item yang saling terhubung).
 * Satu kelompok bisa banyak-ke-banyak: mis. 2 transaksi pembayar yang sama (330rb + 25rb) untuk 2 pasien
 * (205rb + 150rb). Kelompok tertutup bila jumlah transaksi >= jumlah pembayaran di kelompok itu;
 * bila kurang, semua pembayaran di kelompok itu berstatus "kurang" dengan kekurangan yang sama.
 * Kelompok yang tertaut ke item di luar daftar (hari lain / pemasukan non-QRIS) dianggap tertutup.
 * @returns { [key]: { trxs, covered, deficit } }
 */
export const coverageOf = (transactions, portions) => {
  const parent = new Map();
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const add = (x) => { if (!parent.has(x)) parent.set(x, x); };
  const union = (a, b) => { add(a); add(b); parent.set(find(a), find(b)); };
  const inList = new Set(portions.map((p) => p.recapId));
  transactions.forEach((t) => {
    const keys = keysOfTrx(t);
    if (!keys.length) return;
    add(`t:${t.id}`);
    keys.forEach((k) => union(`t:${t.id}`, `k:${k}`));
  });
  const comp = {};
  transactions.forEach((t) => {
    if (!isLinked(t)) return;
    const c = (comp[find(`t:${t.id}`)] ||= { trxs: [], keys: new Set(), foreign: false });
    c.trxs.push(t);
    keysOfTrx(t).forEach((k) => { c.keys.add(k); if (!inList.has(k)) c.foreign = true; });
  });
  const amountOf = Object.fromEntries(portions.map((p) => [p.recapId, Math.round(p.amount)]));
  const out = {};
  Object.values(comp).forEach((c) => {
    const bank = c.trxs.reduce((s, t) => s + Math.round(Number(t.amount)), 0);
    const keys = [...c.keys].filter((k) => inList.has(k));
    const need = keys.reduce((s, k) => s + amountOf[k], 0);
    const deficit = c.foreign ? 0 : Math.max(0, need - bank);
    keys.forEach((k) => {
      out[k] = { trxs: c.trxs, covered: deficit ? Math.round(amountOf[k] * bank / need) : amountOf[k], deficit };
    });
  });
  return out;
};
