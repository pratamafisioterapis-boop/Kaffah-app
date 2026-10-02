// Menyusun satu edukasi pasien yang utuh dari template beberapa diagnosa.
//
// Template per diagnosa (tabel diagnosis_education + education_lists) berisi:
// apa itu, penyebab, daftar yang perlu dilakukan, yang dihindari, perkiraan
// pemulihan, dan tanda bahaya. Bila pasien punya lebih dari satu diagnosa
// (mis. diagnosa di regio yang sama), isi yang sama atau mirip tidak diulang:
//   - daftar (dilakukan / dihindari / tanda bahaya) digabung, butir yang sama
//     atau hampir sama hanya tampil sekali;
//   - teks tunggal (apa itu, penyebab, pemulihan) yang sama/mirip antar
//     diagnosa dikelompokkan menjadi satu butir dengan nama-nama diagnosanya.

const STOP = new Set([
  'yang', 'dan', 'atau', 'dengan', 'di', 'ke', 'untuk', 'pada', 'saat', 'bila', 'agar', 'sampai', 'hingga',
  'secara', 'dari', 'itu', 'ini', 'sesuai', 'lebih', 'tidak', 'dapat', 'akan', 'sebelum', 'setelah', 'oleh',
  'karena', 'serta', 'juga', 'dalam', 'ada', 'adalah', 'anda', 'mu', 'nya',
]);

const tokens = (s) => new Set(
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 2 && !STOP.has(w))
);

// Mirip bila Jaccard >= 0,6, atau satu teks hampir seluruhnya tercakup oleh yang lain.
export const isSimilar = (a, b) => {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return String(a).trim() === String(b).trim();
  let inter = 0;
  ta.forEach((w) => { if (tb.has(w)) inter += 1; });
  const union = ta.size + tb.size - inter;
  const small = Math.min(ta.size, tb.size);
  return inter / union >= 0.6 || (small >= 4 && inter / small >= 0.85);
};

// Gabungkan beberapa daftar butir; butir mirip hanya dipakai sekali (yang lebih lengkap menang).
export const mergeLists = (lists) => {
  const out = [];
  lists.flat().forEach((item) => {
    const text = String(item).trim();
    if (!text) return;
    const idx = out.findIndex((o) => isSimilar(o, text));
    if (idx === -1) out.push(text);
    else if (text.length > out[idx].length) out[idx] = text;
  });
  return out;
};

// Kelompokkan teks tunggal yang sama/mirip: [{ names: [...], text }]
const groupTexts = (entries, field) => {
  const groups = [];
  entries.forEach((e) => {
    const text = String(e[field] || '').trim();
    if (!text) return;
    const g = groups.find((x) => isSimilar(x.text, text));
    if (g) {
      if (!g.names.includes(e.name)) g.names.push(e.name);
      if (text.length > g.text.length) g.text = text;
    } else {
      groups.push({ names: [e.name], text });
    }
  });
  return groups;
};

const joinNames = (names) => (names.length <= 2 ? names.join(' dan ') : `${names.slice(0, -1).join(', ')}, dan ${names[names.length - 1]}`);

const sentenceBlock = (entries, field) => {
  const groups = groupTexts(entries, field);
  if (!groups.length) return [];
  // Satu kelompok yang mencakup semua diagnosa: tampil tanpa nama.
  if (groups.length === 1 && groups[0].names.length === entries.length) return [groups[0].text];
  return groups.map((g) => `• ${joinNames(g.names)}: ${g.text}`);
};

const bullets = (items) => items.map((i) => `• ${i}`);

/**
 * entries: [{ name, what, cause, recovery, do: [], avoid: [], red: [] }]
 * homeExercises: ["Nama latihan (dosis)", ...] yang dicentang pada Plan (opsional)
 */
export const buildEducationText = (entries, homeExercises = []) => {
  const list = (entries || []).filter(Boolean);
  if (!list.length) return '';
  const names = list.map((e) => e.name);
  const lines = [list.length === 1 ? `EDUKASI PASIEN - ${names[0]}` : 'EDUKASI PASIEN'];
  if (list.length > 1) lines.push('', `Kondisi yang Anda alami: ${names.join('; ')}.`);

  const add = (title, body) => {
    if (body.length) lines.push('', `${title}:`, ...body);
  };
  add('Apa itu', sentenceBlock(list, 'what'));
  add('Penyebab atau pemicu', sentenceBlock(list, 'cause'));
  add('Yang perlu dilakukan', bullets(mergeLists(list.map((e) => e.do || []))));
  add('Yang sebaiknya dihindari', bullets(mergeLists(list.map((e) => e.avoid || []))));
  add('Latihan di rumah', [
    homeExercises.length
      ? `Ikuti program latihan dari terapis (${homeExercises.slice(0, 4).join('; ')}). Lakukan teratur dan naikkan bertahap.`
      : 'Ikuti program latihan dari terapis. Lakukan teratur dan naikkan bertahap.',
  ]);
  add('Perkiraan pemulihan', sentenceBlock(list, 'recovery'));
  add('Segera kontrol atau ke dokter bila', bullets(mergeLists(list.map((e) => e.red || []))));
  lines.push('', 'Setiap orang berbeda. Tanyakan pada terapis bila ada keluhan baru atau ragu.');
  return lines.join('\n');
};
