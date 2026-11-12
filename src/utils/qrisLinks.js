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
