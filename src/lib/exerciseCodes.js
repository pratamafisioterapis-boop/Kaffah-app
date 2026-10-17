// Kode latihan Plan SOAP: awalan huruf (kelompok bagian tubuh/kondisi, mis. KN, CX) + nomor berurut
// dua digit (KN19, CX18). Nomor berikutnya = nomor terbesar yang ada + 1, jadi celah (mis. CX17 yang
// kosong) tidak dipakai ulang dan kode lama tidak pernah berubah.
export const CODE_PATTERN = /^([A-Z]{2,3})(\d+)$/;
export const PREFIX_PATTERN = /^[A-Z]{2,3}$/;

export const prefixOf = (id) => CODE_PATTERN.exec(id)?.[1] || null;

export const nextExerciseCode = (prefix, ids) => {
  let max = 0;
  ids.forEach((id) => {
    const m = CODE_PATTERN.exec(id);
    if (m && m[1] === prefix) max = Math.max(max, Number(m[2]));
  });
  return `${prefix}${String(max + 1).padStart(2, '0')}`;
};

// Ringkasan awalan yang sudah ada: [{ prefix, count, samples: [nama, nama] }], urut abjad.
export const summarizePrefixes = (exercises) => {
  const map = new Map();
  exercises.forEach((e) => {
    const p = prefixOf(e.id);
    if (!p) return;
    const row = map.get(p) || { prefix: p, count: 0, samples: [] };
    row.count += 1;
    if (row.samples.length < 2) row.samples.push(e.name);
    map.set(p, row);
  });
  return [...map.values()].sort((a, b) => a.prefix.localeCompare(b.prefix));
};
