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

// Awalan baru dibuat otomatis dari nama latihan, tanpa diketik. Urutan percobaan, memakai yang pertama
// belum dipakai: dua huruf pertama kata pertama (Bridging -> BR), inisial dua kata pertama
// (Bridging dua kaki -> BD), huruf pertama nama + huruf-huruf berikutnya (BI, BD, BG...), lalu
// AA, AB, ... sampai ketemu yang bebas. Hasilnya selalu 2 huruf besar dan tidak bentrok dengan
// awalan yang sudah ada, jadi kode lama tidak terpengaruh.
export const generatePrefix = (name, usedPrefixes) => {
  const used = usedPrefixes instanceof Set ? usedPrefixes : new Set(usedPrefixes);
  const clean = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const words = clean.split(/[^A-Z]+/).filter(Boolean);
  const letters = words.join('');
  const candidates = [];
  if (words[0]?.length >= 2) candidates.push(words[0].slice(0, 2));
  if (words.length >= 2) candidates.push(words[0][0] + words[1][0]);
  for (let i = 1; i < letters.length; i += 1) candidates.push(letters[0] + letters[i]);
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const a of A) for (const b of A) candidates.push(a + b);
  return candidates.find((c) => c.length === 2 && !used.has(c)) || null;
};
