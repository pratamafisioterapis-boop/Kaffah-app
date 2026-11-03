// Pencocokan transaksi di laporan QRIS bank dengan pembayaran QRIS di daily_recaps.

const norm = (s) =>
  String(s || '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);

// Berapa token nama yang sama (pelanggan e-wallet/bank belum tentu sama dengan nama pasien,
// mis. dibayar oleh keluarga, jadi ini hanya dipakai sebagai petunjuk, bukan syarat).
export const nameOverlap = (a, b) => {
  const A = new Set(norm(a));
  const B = norm(b);
  return B.filter((t) => A.has(t)).length;
};

const minutesOf = (hhmm) => {
  const m = String(hhmm || '').match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
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

/**
 * @param transactions [{ id, trx_date, trx_time, amount, customer_name }] yang belum dicocokkan
 * @param portions     [{ recapId, date, amount, name, time }] pembayaran QRIS di recap yang belum terpakai
 * @returns { matches: [{ transactionId, recapId }], ambiguous: Set<transactionId> }
 *
 * Aturan: tanggal sama + nominal sama persis. Bila lebih dari satu kandidat, dipilih yang
 * namanya cocok; jika tidak ada petunjuk nama, dipilih yang jam-nya terdekat hanya kalau
 * kandidat tunggal terbaik. Selebihnya dibiarkan "ambigu" untuk dipilih admin manual —
 * lebih baik tidak menebak daripada salah mencocokkan uang.
 */
export const autoMatchQris = (transactions, portions) => {
  const taken = new Set();
  const matches = [];
  const ambiguous = new Set();
  const ordered = [...transactions].sort((a, b) =>
    `${a.trx_date} ${a.trx_time || ''}`.localeCompare(`${b.trx_date} ${b.trx_time || ''}`)
  );

  // Putaran 1: transaksi dengan tepat satu kandidat (tidak ambigu) dikunci dulu,
  // sehingga kandidat ganda di putaran 2 makin sedikit.
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
      if (cands.length === 1) {
        // Satu kandidat, tapi pastikan transaksi lain dengan nominal sama tidak berebut kandidat ini.
        const rivals = [...pending.values()].filter(
          (o) => o.id !== t.id && o.trx_date === t.trx_date && Math.round(o.amount) === Math.round(t.amount)
        );
        if (rivals.length > 0) {
          const best = [t, ...rivals].sort(
            (a, b) => nameOverlap(b.customer_name, cands[0].name) - nameOverlap(a.customer_name, cands[0].name)
          );
          const top = nameOverlap(best[0].customer_name, cands[0].name);
          const second = nameOverlap(best[1].customer_name, cands[0].name);
          if (!(top > second)) continue; // berebut tanpa petunjuk -> ambigu
          if (best[0].id !== t.id) continue; // bukan giliran transaksi ini
        }
        matches.push({ transactionId: t.id, recapId: cands[0].recapId });
        taken.add(cands[0].recapId);
        pending.delete(t.id);
        progress = true;
      } else if (cands.length > 1) {
        const scored = cands
          .map((c) => ({
            c,
            name: nameOverlap(t.customer_name, c.name),
            gap:
              minutesOf(t.trx_time) != null && minutesOf(c.time) != null
                ? Math.abs(minutesOf(t.trx_time) - minutesOf(c.time))
                : Infinity,
          }))
          .sort((a, b) => b.name - a.name || a.gap - b.gap);
        const [first, second] = scored;
        const clearByName = first.name > 0 && first.name > second.name;
        if (clearByName) {
          matches.push({ transactionId: t.id, recapId: first.c.recapId });
          taken.add(first.c.recapId);
          pending.delete(t.id);
          progress = true;
        }
      }
    }
  }

  for (const t of pending.values()) {
    if (candidatesOf(t).length > 1) ambiguous.add(t.id);
  }
  return { matches, ambiguous };
};
