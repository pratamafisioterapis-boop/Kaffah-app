// Formulir fungsional (alat ukur multi-item) yang dibuka sebagai pop-up dari
// template Objective lewat token {{form:kode}}. Terapis mengisi per item; skor
// dan interpretasinya otomatis dirangkai menjadi teks untuk bagian Objective.
//
// Butir pertanyaan adalah parafrase bahasa Indonesia dari instrumen bakunya.
// Skor total selalu bisa diisi langsung lewat kolom "skor total" bila alat ukur
// sudah diisi di lembar resmi.

const SCALE_NDI = {
  note: '0 = tidak ada gangguan · 5 = gangguan terberat / tidak mampu sama sekali',
  options: [0, 1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) })),
};
const SCALE_1_5 = {
  note: '1 = tidak ada kesulitan · 2 = sedikit · 3 = sedang · 4 = sangat sulit · 5 = tidak mampu',
  options: [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) })),
};
const SCALE_LEFS = {
  note: '0 = sangat sulit / tidak mampu · 4 = tidak ada kesulitan',
  options: [0, 1, 2, 3, 4].map((v) => ({ value: v, label: String(v) })),
};
const SCALE_BERG = {
  note: '4 = mandiri & aman · 3 = mandiri, butuh waktu/pengawasan · 2 = mampu dengan batasan · 1 = butuh bantuan minimal · 0 = tidak mampu',
  options: [4, 3, 2, 1, 0].map((v) => ({ value: v, label: String(v) })),
};
const SCALE_0_10 = {
  note: '0 = tidak ada keluhan / tidak sulit · 10 = terberat / tidak mampu',
  options: Array.from({ length: 11 }, (_, v) => ({ value: v, label: String(v) })),
};
const SCALE_FESI = {
  note: '1 = tidak khawatir sama sekali · 2 = sedikit · 3 = cukup · 4 = sangat khawatir',
  options: [1, 2, 3, 4].map((v) => ({ value: v, label: String(v) })),
};

const sum = (answers, items) => items.reduce((acc, it, i) => acc + (answers[i] ?? 0), 0);
const answered = (answers, items) => items.filter((_, i) => answers[i] !== undefined).length;
const round = (n) => Math.round(n * 10) / 10;

const pctForm = ({ id, name, items, scale, maxPerItem, minAnswered, bands, manualLabel }) => ({
  id,
  name,
  items: items.map((label) => ({ label, scale })),
  minAnswered,
  manual: { label: manualLabel || 'Skor total (%)', min: 0, max: 100 },
  compute: (answers) => {
    const n = answered(answers, items);
    if (!n) return null;
    const pct = round((sum(answers, items) / (n * maxPerItem)) * 100);
    return { value: pct, summary: `${pct}%`, interpretation: bands(pct) };
  },
  fromManual: (v) => ({ value: v, summary: `${v}%`, interpretation: bands(v) }),
  text: (r) => `${name} ${r.summary}${r.interpretation ? ` (${r.interpretation})` : ''}`,
});

const disabilityBands = (labels) => (pct) => labels.find(([max]) => pct <= max)[1];

// ───────── Barthel Index ─────────
const BARTHEL = [
  { label: 'Makan', options: [[0, 'Tidak mampu'], [5, 'Butuh bantuan (memotong, mengoles)'], [10, 'Mandiri']] },
  { label: 'Mandi', options: [[0, 'Tergantung orang lain'], [5, 'Mandiri']] },
  { label: 'Perawatan diri (wajah, rambut, gigi, cukur)', options: [[0, 'Butuh bantuan'], [5, 'Mandiri']] },
  { label: 'Berpakaian', options: [[0, 'Tergantung'], [5, 'Butuh bantuan sebagian'], [10, 'Mandiri']] },
  { label: 'BAB', options: [[0, 'Inkontinensia / butuh enema'], [5, 'Kadang tak terkontrol'], [10, 'Kontinen']] },
  { label: 'BAK', options: [[0, 'Inkontinensia / kateter'], [5, 'Kadang tak terkontrol'], [10, 'Kontinen']] },
  { label: 'Penggunaan toilet', options: [[0, 'Tergantung'], [5, 'Butuh bantuan sebagian'], [10, 'Mandiri']] },
  { label: 'Transfer (kursi ↔ tempat tidur)', options: [[0, 'Tidak mampu'], [5, 'Bantuan besar, bisa duduk'], [10, 'Bantuan kecil'], [15, 'Mandiri']] },
  { label: 'Mobilitas (jalan datar)', options: [[0, 'Tidak mampu'], [5, 'Kursi roda mandiri'], [10, 'Jalan dengan bantuan orang'], [15, 'Mandiri (boleh tongkat)']] },
  { label: 'Naik-turun tangga', options: [[0, 'Tidak mampu'], [5, 'Butuh bantuan'], [10, 'Mandiri']] },
].map((it) => ({ label: it.label, options: it.options.map(([value, label]) => ({ value, label })) }));

const barthelBand = (t) => {
  if (t <= 20) return 'ketergantungan total';
  if (t <= 60) return 'ketergantungan berat';
  if (t <= 90) return 'ketergantungan sedang';
  if (t < 100) return 'ketergantungan ringan';
  return 'mandiri';
};

// ───────── Berg Balance Scale ─────────
const BERG_ITEMS = [
  'Duduk ke berdiri', 'Berdiri tanpa pegangan', 'Duduk tanpa sandaran', 'Berdiri ke duduk',
  'Transfer', 'Berdiri mata tertutup', 'Berdiri kaki rapat', 'Meraih ke depan dengan lengan terulur',
  'Mengambil benda dari lantai', 'Menoleh ke belakang (kiri & kanan)', 'Berputar 360 derajat',
  'Menaruh kaki bergantian pada step', 'Berdiri tandem (satu kaki di depan)', 'Berdiri satu kaki',
];
const bergBand = (t) => (t <= 20 ? 'risiko jatuh tinggi' : t <= 40 ? 'risiko jatuh sedang' : 'risiko jatuh rendah');

// ───────── DASH / QuickDASH ─────────
const DASH_ITEMS = [
  'Membuka tutup toples yang rapat', 'Menulis', 'Memutar anak kunci', 'Menyiapkan makanan',
  'Mendorong pintu yang berat', 'Menaruh benda di rak di atas kepala', 'Pekerjaan rumah tangga berat (mengepel, mencuci dinding)',
  'Berkebun / pekerjaan halaman', 'Merapikan tempat tidur', 'Membawa tas belanja / tas kerja',
  'Membawa benda berat (>5 kg)', 'Mengganti bola lampu di atas kepala', 'Mencuci / mengeringkan rambut',
  'Mencuci punggung', 'Memakai baju kaus / sweter', 'Memotong makanan dengan pisau',
  'Aktivitas rekreasi dengan sedikit tenaga (kartu, merajut)', 'Aktivitas rekreasi dengan tenaga / benturan pada lengan (tenis, palu)',
  'Aktivitas rekreasi dengan gerak lengan bebas (badminton, frisbee)', 'Mengatur kebutuhan transportasi',
  'Aktivitas seksual', 'Gangguan lengan/bahu/tangan pada kegiatan sosial', 'Keterbatasan pada pekerjaan / kegiatan harian',
  'Nyeri lengan, bahu, atau tangan', 'Nyeri saat melakukan aktivitas tertentu', 'Kesemutan lengan, bahu, atau tangan',
  'Kelemahan lengan, bahu, atau tangan', 'Kekakuan lengan, bahu, atau tangan', 'Kesulitan tidur karena nyeri',
  'Merasa kurang mampu / kurang percaya diri / kurang berguna',
];
const QUICKDASH_ITEMS = [
  'Membuka tutup toples yang rapat', 'Pekerjaan rumah tangga berat', 'Membawa tas belanja / tas kerja',
  'Mencuci punggung', 'Memotong makanan dengan pisau', 'Aktivitas rekreasi dengan tenaga / benturan pada lengan',
  'Gangguan pada kegiatan sosial', 'Keterbatasan pada pekerjaan / kegiatan harian', 'Nyeri lengan, bahu, atau tangan',
  'Kesemutan lengan, bahu, atau tangan', 'Kesulitan tidur karena nyeri',
];
const dashForm = (id, name, items, minAnswered) => ({
  id,
  name,
  items: items.map((label) => ({ label, scale: SCALE_1_5 })),
  minAnswered,
  manual: { label: 'Skor (0-100)', min: 0, max: 100 },
  compute: (answers) => {
    const n = answered(answers, items);
    if (!n) return null;
    const v = round((sum(answers, items) / n - 1) * 25);
    return { value: v, summary: `${v}/100`, interpretation: '0 = tanpa disabilitas, 100 = disabilitas terberat' };
  },
  fromManual: (v) => ({ value: v, summary: `${v}/100`, interpretation: '' }),
  text: (r) => `${name} ${r.summary}`,
});

// ───────── LEFS ─────────
const LEFS_ITEMS = [
  'Pekerjaan / rumah tangga / sekolah seperti biasa', 'Hobi, rekreasi, atau olahraga seperti biasa',
  'Masuk / keluar bak mandi', 'Berjalan antar ruangan', 'Memakai sepatu / kaus kaki', 'Jongkok',
  'Mengangkat benda (tas belanja) dari lantai', 'Aktivitas ringan di rumah', 'Aktivitas berat di rumah',
  'Masuk / keluar mobil', 'Berjalan 2 blok (± 400 m)', 'Berjalan 1,5 km', 'Naik-turun 10 anak tangga',
  'Berdiri 1 jam', 'Duduk 1 jam', 'Berlari di permukaan rata', 'Berlari di permukaan tidak rata',
  'Berbelok tajam saat berlari cepat', 'Melompat', 'Berguling di tempat tidur',
];

// ───────── SPADI ─────────
const SPADI_PAIN = [
  'Nyeri terburuk', 'Nyeri saat tidur menindih sisi yang sakit', 'Nyeri saat meraih rak tinggi',
  'Nyeri saat menyentuh tengkuk', 'Nyeri saat mendorong dengan lengan yang sakit',
];
const SPADI_DISABILITY = [
  'Mencuci rambut', 'Mencuci punggung', 'Memakai kaus dalam / baju lewat kepala', 'Memakai baju berkancing depan',
  'Memakai celana', 'Menaruh benda di rak tinggi', 'Membawa benda berat (± 5 kg)', 'Mengambil sesuatu dari saku belakang',
];

// ───────── FES-I ─────────
const FESI_ITEMS = [
  'Membersihkan rumah', 'Berpakaian / melepas pakaian', 'Menyiapkan makanan sederhana', 'Mandi',
  'Berbelanja', 'Duduk / bangun dari kursi', 'Naik-turun tangga', 'Berjalan di sekitar lingkungan rumah',
  'Meraih sesuatu di atas kepala / di lantai', 'Mengangkat telepon sebelum berhenti berdering',
  'Berjalan di permukaan licin', 'Mengunjungi teman / kerabat', 'Berjalan di tempat ramai',
  'Berjalan di permukaan tidak rata', 'Berjalan naik / turun tanjakan', 'Menghadiri acara sosial',
];

const NDI_ITEMS = [
  'Intensitas nyeri', 'Perawatan diri (mandi, berpakaian)', 'Mengangkat beban', 'Membaca', 'Sakit kepala',
  'Konsentrasi', 'Pekerjaan', 'Mengemudi', 'Tidur', 'Rekreasi',
];
const ODI_ITEMS = [
  'Intensitas nyeri', 'Perawatan diri (mandi, berpakaian)', 'Mengangkat beban', 'Berjalan', 'Duduk', 'Berdiri',
  'Tidur', 'Kehidupan seksual', 'Kehidupan sosial', 'Bepergian',
];

export const FUNCTIONAL_FORMS = {
  barthel: {
    id: 'barthel',
    name: 'Barthel Index',
    items: BARTHEL,
    minAnswered: 10,
    manual: { label: 'Skor total (0-100)', min: 0, max: 100 },
    compute: (answers) => {
      const n = answered(answers, BARTHEL);
      if (!n) return null;
      const t = sum(answers, BARTHEL);
      return { value: t, summary: `${t}/100`, interpretation: barthelBand(t) };
    },
    fromManual: (v) => ({ value: v, summary: `${v}/100`, interpretation: barthelBand(v) }),
    text: (r) => `Barthel Index ${r.summary} (${r.interpretation})`,
  },
  berg: {
    id: 'berg',
    name: 'Berg Balance Scale',
    items: BERG_ITEMS.map((label) => ({ label, scale: SCALE_BERG })),
    minAnswered: 14,
    manual: { label: 'Skor total (0-56)', min: 0, max: 56 },
    compute: (answers) => {
      if (!answered(answers, BERG_ITEMS)) return null;
      const t = sum(answers, BERG_ITEMS);
      return { value: t, summary: `${t}/56`, interpretation: bergBand(t) };
    },
    fromManual: (v) => ({ value: v, summary: `${v}/56`, interpretation: bergBand(v) }),
    text: (r) => `Berg Balance Scale ${r.summary} (${r.interpretation})`,
  },
  ndi: pctForm({
    id: 'ndi', name: 'Neck Disability Index', items: NDI_ITEMS, scale: SCALE_NDI, maxPerItem: 5, minAnswered: 9,
    bands: disabilityBands([[8, 'tanpa disabilitas'], [28, 'disabilitas ringan'], [48, 'disabilitas sedang'], [68, 'disabilitas berat'], [100, 'disabilitas total']]),
  }),
  odi: pctForm({
    id: 'odi', name: 'Oswestry Disability Index', items: ODI_ITEMS, scale: SCALE_NDI, maxPerItem: 5, minAnswered: 9,
    bands: disabilityBands([[20, 'disabilitas minimal'], [40, 'disabilitas sedang'], [60, 'disabilitas berat'], [80, 'sangat berat'], [100, 'lumpuh / terbaring']]),
  }),
  dash: dashForm('dash', 'DASH', DASH_ITEMS, 27),
  quickdash: dashForm('quickdash', 'QuickDASH', QUICKDASH_ITEMS, 10),
  lefs: {
    id: 'lefs',
    name: 'LEFS',
    items: LEFS_ITEMS.map((label) => ({ label, scale: SCALE_LEFS })),
    minAnswered: 18,
    manual: { label: 'Skor total (0-80)', min: 0, max: 80 },
    compute: (answers) => {
      if (!answered(answers, LEFS_ITEMS)) return null;
      const t = sum(answers, LEFS_ITEMS);
      return { value: t, summary: `${t}/80`, interpretation: `${Math.round((t / 80) * 100)}% fungsi maksimal` };
    },
    fromManual: (v) => ({ value: v, summary: `${v}/80`, interpretation: `${Math.round((v / 80) * 100)}% fungsi maksimal` }),
    text: (r) => `LEFS ${r.summary} (${r.interpretation})`,
  },
  spadi: {
    id: 'spadi',
    name: 'SPADI',
    items: [
      ...SPADI_PAIN.map((label) => ({ label, scale: SCALE_0_10, group: 'Subskala nyeri' })),
      ...SPADI_DISABILITY.map((label) => ({ label, scale: SCALE_0_10, group: 'Subskala disabilitas' })),
    ],
    minAnswered: 13,
    manual: { label: 'Skor total (%)', min: 0, max: 100 },
    compute: (answers) => {
      const painAns = SPADI_PAIN.map((_, i) => answers[i]).filter((v) => v !== undefined);
      const disAns = SPADI_DISABILITY.map((_, i) => answers[SPADI_PAIN.length + i]).filter((v) => v !== undefined);
      if (!painAns.length && !disAns.length) return null;
      const pain = painAns.length ? (painAns.reduce((a, b) => a + b, 0) / (painAns.length * 10)) * 100 : null;
      const dis = disAns.length ? (disAns.reduce((a, b) => a + b, 0) / (disAns.length * 10)) * 100 : null;
      const parts = [pain, dis].filter((v) => v !== null);
      const total = round(parts.reduce((a, b) => a + b, 0) / parts.length);
      return {
        value: total,
        summary: `${total}%`,
        interpretation: `nyeri ${pain === null ? '-' : `${round(pain)}%`}, disabilitas ${dis === null ? '-' : `${round(dis)}%`}`,
      };
    },
    fromManual: (v) => ({ value: v, summary: `${v}%`, interpretation: '' }),
    text: (r) => `SPADI ${r.summary}${r.interpretation ? ` (${r.interpretation})` : ''}`,
  },
  fesi: {
    id: 'fesi',
    name: 'FES-I',
    items: FESI_ITEMS.map((label) => ({ label, scale: SCALE_FESI })),
    minAnswered: 16,
    manual: { label: 'Skor total (16-64)', min: 16, max: 64 },
    compute: (answers) => {
      if (!answered(answers, FESI_ITEMS)) return null;
      const t = sum(answers, FESI_ITEMS);
      return { value: t, summary: `${t}/64`, interpretation: `kekhawatiran jatuh ${t <= 19 ? 'rendah' : t <= 27 ? 'sedang' : 'tinggi'}` };
    },
    fromManual: (v) => ({ value: v, summary: `${v}/64`, interpretation: `kekhawatiran jatuh ${v <= 19 ? 'rendah' : v <= 27 ? 'sedang' : 'tinggi'}` }),
    text: (r) => `FES-I ${r.summary} (${r.interpretation})`,
  },
};

// Opsi tiap item: skala bersama (scale) atau daftar khusus (options).
export const itemOptions = (item) => (item.options || item.scale.options);
export const itemNote = (item) => item.scale?.note;

export const buildFormResult = (form, answers, manualValue) => {
  const r = manualValue !== undefined && manualValue !== null && manualValue !== ''
    ? form.fromManual(Number(manualValue))
    : form.compute(answers);
  return r ? { ...r, text: form.text(r) } : null;
};

export const FORM_LIST = Object.values(FUNCTIONAL_FORMS).map((f) => ({ id: f.id, name: f.name }));
