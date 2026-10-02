// Formulir fungsional tambahan, gelombang kedua: IKDC, VISA-P/A, CAIT, HAQ-DI,
// Fugl-Meyer, SCIM III, CSI, Tinetti, PRTEE. Butir adalah parafrase bahasa
// Indonesia; skor mengikuti struktur resmi tiap instrumen.
import { formHelpers } from './functionalFormsExtra';

const { opts, range, numScale, round, totalForm, band, itemsOf } = formHelpers;
const O = (pairs) => ({ options: opts(pairs) });
const withItems = (labels, o, group) => labels.map((label) => ({ label, ...O(o), ...(group ? { group } : {}) }));

// Skor total ditampilkan sebagai persen dari skor maksimum jawaban yang terisi.
const pctOfMax = ({ id, name, items, minAnswered, bands }) => {
  const maxOf = (it) => Math.max(...(it.options || it.scale.options).map((o) => o.value));
  const calc = (answers) => {
    const idx = items.map((_, i) => i).filter((i) => answers[i] !== undefined);
    if (!idx.length) return null;
    const got = idx.reduce((s, i) => s + answers[i], 0);
    const max = idx.reduce((s, i) => s + maxOf(items[i]), 0);
    return round((got / max) * 100);
  };
  const fin = (v) => ({ value: v, summary: `${v}/100`, interpretation: bands ? bands(v) : '' });
  return {
    id, name, items, minAnswered,
    manual: { label: 'Skor total (0-100)', min: 0, max: 100 },
    compute: (answers) => { const v = calc(answers); return v === null ? null : fin(v); },
    fromManual: (v) => fin(v),
    text: (r) => `${name} ${r.summary}${r.interpretation ? ` (${r.interpretation})` : ''}`,
  };
};

// ───────── IKDC Subjective Knee Form ─────────
const LEVEL = [[4, 'Sangat berat (basket, sepak bola)'], [3, 'Berat (tenis, kerja fisik berat)'], [2, 'Sedang (kerja fisik sedang, lari ringan)'], [1, 'Ringan (jalan, pekerjaan rumah)'], [0, 'Tidak mampu melakukan aktivitas ringan']];
const DIFF = [[4, 'Tanpa kesulitan'], [3, 'Sedikit sulit'], [2, 'Cukup sulit'], [1, 'Sangat sulit'], [0, 'Tidak mampu']];
const IKDC = pctOfMax({
  id: 'ikdc', name: 'IKDC', minAnswered: 14,
  items: [
    { label: 'Aktivitas tertinggi tanpa nyeri lutut bermakna', ...O(LEVEL), group: 'Gejala' },
    { label: 'Frekuensi nyeri (4 minggu terakhir)', group: 'Gejala', scale: numScale('0 = terus-menerus · 10 = tidak pernah', range(0, 10)) },
    { label: 'Beratnya nyeri', group: 'Gejala', scale: numScale('0 = nyeri terberat · 10 = tidak ada nyeri', range(0, 10)) },
    { label: 'Kaku atau bengkak', group: 'Gejala', ...O([[4, 'Tidak sama sekali'], [3, 'Sedikit'], [2, 'Cukup'], [1, 'Sangat'], [0, 'Sangat sekali']]) },
    { label: 'Aktivitas tertinggi tanpa bengkak', ...O(LEVEL), group: 'Gejala' },
    { label: 'Lutut terkunci / tersangkut', group: 'Gejala', ...O([[1, 'Tidak'], [0, 'Ya']]) },
    { label: 'Lutut goyah / "giving way"', group: 'Gejala', ...O([[1, 'Tidak'], [0, 'Ya']]) },
    { label: 'Aktivitas tertinggi tanpa lutut goyah', ...O(LEVEL), group: 'Gejala' },
    { label: 'Aktivitas olahraga tertinggi yang bisa dilakukan', ...O(LEVEL), group: 'Olahraga' },
    ...['Naik tangga', 'Turun tangga', 'Berlutut', 'Jongkok', 'Duduk dengan lutut ditekuk', 'Bangun dari kursi', 'Berlari lurus', 'Melompat dan mendarat pada kaki yang cedera', 'Berhenti dan mulai mendadak'].map((label) => ({ label, ...O(DIFF), group: 'Fungsi' })),
    { label: 'Fungsi lutut saat ini', group: 'Fungsi', scale: numScale('0 = tidak bisa beraktivitas harian · 10 = fungsi normal', range(0, 10)) },
  ],
  bands: band([[50, 'fungsi lutut rendah'], [70, 'fungsi lutut sedang'], [85, 'fungsi lutut cukup baik'], [100, 'fungsi lutut baik']]),
});

// ───────── VISA-P / VISA-A ─────────
const VISA_Q7 = { label: 'Partisipasi olahraga saat ini', options: opts([[0, 'Tidak berolahraga'], [4, 'Latihan / kompetisi termodifikasi'], [7, 'Latihan penuh, belum kompetisi'], [10, 'Berkompetisi seperti sebelum cedera']]) };
const VISA_Q8 = { label: 'Lama bisa berolahraga tanpa nyeri (jalur A)', options: opts([[0, 'Tidak mampu'], [7, '1-5 menit'], [14, '6-10 menit'], [21, '11-15 menit'], [30, '> 15 menit']]) };
const visa = (id, name, labels) => totalForm({
  id, name, max: 100, minAnswered: 8,
  items: [
    ...labels.map((label) => ({ label, scale: numScale('0 = nyeri terberat / sangat kaku · 10 = tanpa nyeri / tanpa kaku', range(0, 10)) })),
    VISA_Q7,
    VISA_Q8,
  ],
  bands: band([[59, 'gejala berat'], [79, 'gejala sedang'], [100, 'gejala ringan / tanpa gejala']]),
});
const VISA_P = visa('visap', 'VISA-P', ['Kaku di lutut setelah bangun tidur', 'Nyeri saat menumpu penuh dan lutut diluruskan', 'Nyeri saat menuruni tangga dengan pola jalan normal', 'Nyeri saat lunge menumpu penuh', 'Kesulitan jongkok', 'Nyeri saat / setelah 10 lompatan satu kaki']);
const VISA_A = visa('visaa', 'VISA-A', ['Kaku di tumit / Achilles setelah bangun tidur', 'Nyeri saat peregangan Achilles (dorsofleksi penuh)', 'Nyeri saat berjalan di permukaan datar 30 menit', 'Nyeri saat berjalan turun tangga (pola normal)', 'Nyeri saat / setelah 10 berjinjit satu kaki', 'Nyeri saat / setelah 10 lompatan satu kaki']);

// ───────── CAIT ─────────
const CAIT = totalForm({
  id: 'cait', name: 'CAIT', max: 30,
  items: [
    ['Nyeri pada pergelangan kaki', [[5, 'Tidak pernah'], [4, 'Saat berolahraga'], [3, 'Berlari di permukaan tidak rata'], [2, 'Berlari di permukaan rata'], [1, 'Berjalan di permukaan tidak rata'], [0, 'Berjalan di permukaan rata']]],
    ['Terasa tidak stabil', [[4, 'Tidak pernah'], [3, 'Kadang saat olahraga'], [2, 'Sering saat olahraga'], [1, 'Kadang saat aktivitas harian'], [0, 'Sering saat aktivitas harian']]],
    ['Tidak stabil saat berbelok tajam', [[3, 'Tidak pernah'], [2, 'Kadang saat berlari'], [1, 'Sering saat berlari'], [0, 'Saat berjalan']]],
    ['Tidak stabil saat menuruni tangga', [[3, 'Tidak pernah'], [2, 'Bila terburu-buru'], [1, 'Kadang-kadang'], [0, 'Selalu']]],
    ['Tidak stabil saat berdiri satu kaki', [[2, 'Tidak pernah'], [1, 'Pada ujung kaki'], [0, 'Dengan telapak rata']]],
    ['Tidak stabil saat melompat-lompat', [[3, 'Tidak pernah'], [2, 'Kadang'], [1, 'Sering'], [0, 'Selalu']]],
    ['Tidak stabil saat berlari di permukaan tidak rata', [[4, 'Tidak pernah'], [3, 'Kadang'], [2, 'Sering'], [1, 'Hampir selalu'], [0, 'Selalu']]],
    ['Tidak stabil saat berjalan di permukaan tidak rata', [[3, 'Tidak pernah'], [2, 'Kadang'], [1, 'Sering'], [0, 'Selalu']]],
    ['Pulih normal setelah terkilir', [[3, 'Hampir segera'], [2, '< 1 hari'], [1, '1-2 hari'], [0, '> 2 hari']]],
  ].map(([label, o]) => ({ label, ...O(o) })),
  bands: (t) => (t <= 25 ? 'mendukung instabilitas pergelangan kaki kronis' : 'stabil'),
});

// ───────── HAQ-DI ─────────
const HAQ_OPTS = [[0, 'Tanpa kesulitan'], [1, 'Sedikit sulit'], [2, 'Sangat sulit'], [3, 'Tidak mampu']];
const HAQ_AID = [[0, 'Tidak'], [2, 'Ya, pakai alat bantu / dibantu orang']];
const HAQ_CATS = [
  ['Berpakaian & berdandan', ['Berpakaian sendiri, termasuk mengikat tali sepatu dan mengancing baju', 'Mencuci rambut']],
  ['Bangkit', ['Berdiri dari kursi tanpa sandaran lengan', 'Naik / turun tempat tidur']],
  ['Makan', ['Memotong daging', 'Mengangkat cangkir / gelas penuh ke mulut', 'Membuka kotak susu baru']],
  ['Berjalan', ['Berjalan di luar rumah pada permukaan datar', 'Menaiki 5 anak tangga']],
  ['Kebersihan', ['Mencuci dan mengeringkan seluruh badan', 'Mandi berendam', 'Duduk dan berdiri dari toilet']],
  ['Menjangkau', ['Meraih benda 2 kg di atas kepala', 'Membungkuk mengambil pakaian dari lantai']],
  ['Menggenggam', ['Membuka pintu mobil', 'Membuka toples yang sudah pernah dibuka', 'Memutar keran']],
  ['Aktivitas', ['Berbelanja / urusan di luar', 'Naik / turun mobil', 'Pekerjaan rumah (menyapu, berkebun)']],
];
const HAQ_ITEMS = [];
const HAQ_SLICES = [];
HAQ_CATS.forEach(([cat, labels]) => {
  const start = HAQ_ITEMS.length;
  labels.forEach((label) => HAQ_ITEMS.push({ label, ...O(HAQ_OPTS), group: cat }));
  HAQ_ITEMS.push({ label: `Alat bantu / bantuan orang untuk ${cat.toLowerCase()}`, ...O(HAQ_AID), group: cat });
  HAQ_SLICES.push({ cat, start, aid: start + labels.length });
});
const haqScore = (a) => {
  const scores = HAQ_SLICES.map(({ start, aid }) => {
    const v = range(start, aid - 1).map((i) => a[i]).filter((x) => x !== undefined);
    if (!v.length) return null;
    return Math.max(Math.max(...v), a[aid] && Math.max(...v) < 2 ? a[aid] : 0);
  }).filter((x) => x !== null);
  return scores.length ? { scores, mean: round(scores.reduce((s, x) => s + x, 0) / scores.length) } : null;
};
const haqBand = (v) => (v <= 1 ? 'disabilitas ringan-sedang' : v <= 2 ? 'disabilitas sedang-berat' : 'disabilitas berat-sangat berat');
const HAQDI = {
  id: 'haqdi',
  name: 'HAQ-DI',
  items: HAQ_ITEMS,
  minAnswered: 20,
  manual: { label: 'Skor (0-3)', min: 0, max: 3 },
  compute: (a) => {
    const r = haqScore(a);
    return r ? { value: r.mean, summary: `${r.mean}/3`, interpretation: haqBand(r.mean) } : null;
  },
  fromManual: (v) => ({ value: v, summary: `${v}/3`, interpretation: haqBand(v) }),
  text: (r) => `HAQ-DI ${r.summary} (${r.interpretation})`,
};

// ───────── Fugl-Meyer (motorik) ─────────
const FM_OPTS = [[2, 'Penuh'], [1, 'Sebagian'], [0, 'Tidak bisa']];
const FM_UE = [
  ['Refleks', ['Refleks fleksor (bisep / fleksor jari)', 'Refleks ekstensor (trisep)']],
  ['Sinergi fleksor', ['Retraksi bahu', 'Elevasi bahu', 'Abduksi bahu', 'Rotasi eksternal bahu', 'Fleksi siku', 'Supinasi lengan bawah']],
  ['Sinergi ekstensor', ['Adduksi / rotasi internal bahu', 'Ekstensi siku', 'Pronasi lengan bawah']],
  ['Gabungan sinergi', ['Tangan ke punggung bawah', 'Fleksi bahu 0-90°, siku lurus', 'Pronasi-supinasi, siku 90°']],
  ['Di luar sinergi', ['Abduksi bahu 0-90°, siku lurus', 'Fleksi bahu 90-180°, siku lurus', 'Pronasi-supinasi, siku lurus']],
  ['Refleks normal', ['Refleks normal (bisep, trisep, fleksor jari)']],
  ['Pergelangan tangan', ['Stabilitas, siku 90°', 'Fleksi-ekstensi, siku 90°', 'Stabilitas, siku lurus', 'Fleksi-ekstensi, siku lurus', 'Sirkumduksi']],
  ['Tangan', ['Fleksi massal jari', 'Ekstensi massal jari', 'Genggam kait', 'Genggam ibu jari (jepit kertas)', 'Genggam jepit (pinset)', 'Genggam silinder', 'Genggam bola']],
  ['Koordinasi & kecepatan', ['Tremor', 'Dismetria', 'Kecepatan']],
];
const FM_LE = [
  ['Refleks', ['Refleks lutut', 'Refleks Achilles']],
  ['Sinergi fleksor', ['Fleksi pinggul', 'Fleksi lutut', 'Dorsofleksi pergelangan kaki']],
  ['Sinergi ekstensor', ['Ekstensi pinggul', 'Adduksi pinggul', 'Ekstensi lutut', 'Plantarfleksi pergelangan kaki']],
  ['Gabungan sinergi', ['Fleksi lutut > 90° (duduk)', 'Dorsofleksi (duduk)']],
  ['Di luar sinergi', ['Fleksi lutut (berdiri, pinggul 0°)', 'Dorsofleksi (berdiri)']],
  ['Refleks normal', ['Refleks normal (lutut, Achilles, fleksor lutut)']],
  ['Koordinasi & kecepatan', ['Tremor', 'Dismetria', 'Kecepatan']],
];
const FM_ITEMS = [
  ...FM_UE.flatMap(([g, ls]) => withItems(ls, FM_OPTS, `Ekstremitas atas · ${g}`)),
  ...FM_LE.flatMap(([g, ls]) => withItems(ls, FM_OPTS, `Ekstremitas bawah · ${g}`)),
];
const FM_UE_N = FM_UE.reduce((s, [, l]) => s + l.length, 0);
const fmSum = (a, from, to) => range(from, to - 1).reduce((s, i) => s + (a[i] ?? 0), 0);
const fmAny = (a, from, to) => range(from, to - 1).some((i) => a[i] !== undefined);
const FUGL = {
  id: 'fugl',
  name: 'Fugl-Meyer',
  items: FM_ITEMS,
  minAnswered: 3,
  manual: null,
  compute: (a) => {
    const total = FM_ITEMS.length;
    const parts = [];
    if (fmAny(a, 0, FM_UE_N)) parts.push(`motorik ekstremitas atas ${fmSum(a, 0, FM_UE_N)}/66`);
    if (fmAny(a, FM_UE_N, total)) parts.push(`motorik ekstremitas bawah ${fmSum(a, FM_UE_N, total)}/34`);
    return parts.length ? { value: parts, summary: parts.join(', '), interpretation: 'semakin tinggi semakin baik' } : null;
  },
  fromManual: () => null,
  text: (r) => `Fugl-Meyer ${r.summary}`,
};

// ───────── SCIM III ─────────
const AMB = [[8, 'Berjalan tanpa alat bantu'], [7, 'Perlu ortosis tungkai saja'], [6, 'Berjalan dengan satu tongkat'], [5, 'Kruk / dua tongkat (resiprokal)'], [4, 'Walker / kruk (ayun)'], [3, 'Berjalan dengan pengawasan'], [2, 'Kursi roda manual mandiri'], [1, 'Kursi roda elektrik / dibantu'], [0, 'Bantuan total']];
const SCIM = totalForm({
  id: 'scim', name: 'SCIM III', max: 100, minAnswered: 19,
  items: [
    ['Makan', 'Perawatan diri', [[3, 'Mandiri penuh'], [2, 'Mandiri dengan alat bantu / dibantu memotong'], [1, 'Bantuan parsial'], [0, 'Parenteral / bantuan total']]],
    ['Mandi badan atas', 'Perawatan diri', [[3, 'Mandiri tanpa alat'], [2, 'Mandiri dengan alat / setting khusus'], [1, 'Bantuan parsial'], [0, 'Bantuan total']]],
    ['Mandi badan bawah', 'Perawatan diri', [[3, 'Mandiri tanpa alat'], [2, 'Mandiri dengan alat / setting khusus'], [1, 'Bantuan parsial'], [0, 'Bantuan total']]],
    ['Berpakaian badan atas', 'Perawatan diri', [[4, 'Mandiri tanpa alat'], [3, 'Mandiri hanya pakaian tanpa kancing'], [2, 'Mandiri dengan alat'], [1, 'Bantuan parsial'], [0, 'Bantuan total']]],
    ['Berpakaian badan bawah', 'Perawatan diri', [[4, 'Mandiri tanpa alat'], [3, 'Mandiri hanya pakaian sederhana'], [2, 'Mandiri dengan alat'], [1, 'Bantuan parsial'], [0, 'Bantuan total']]],
    ['Berdandan (grooming)', 'Perawatan diri', [[3, 'Mandiri penuh'], [2, 'Mandiri dengan alat'], [1, 'Bantuan parsial'], [0, 'Bantuan total']]],
    ['Pernapasan', 'Pernapasan & sfingter', [[10, 'Normal'], [8, 'Perlu sedikit bantuan batuk'], [6, 'Bantuan batuk / masker / oksigen'], [2, 'Trakeostomi, napas spontan'], [0, 'Ventilator']]],
    ['Kandung kemih', 'Pernapasan & sfingter', [[15, 'Kontinen, tanpa alat'], [13, 'Residu < 100 cc, alat eksternal'], [11, 'Kateter intermiten mandiri, kontinen'], [9, 'Kateter intermiten mandiri + alat eksternal'], [6, 'Residu < 100 cc / kateter intermiten dibantu'], [3, 'Residu > 100 cc / dibantu'], [0, 'Kateter menetap']]],
    ['Usus', 'Pernapasan & sfingter', [[10, 'Teratur, tanpa bantuan, tanpa kecelakaan'], [8, 'Teratur tanpa bantuan, jarang kecelakaan'], [5, 'Teratur dengan bantuan, jarang kecelakaan'], [0, 'Tidak teratur / sangat jarang']]],
    ['Penggunaan toilet', 'Pernapasan & sfingter', [[5, 'Mandiri tanpa adaptasi'], [4, 'Mandiri dengan alat / setting khusus'], [2, 'Bantuan parsial, membersihkan sendiri'], [1, 'Bantuan parsial, tidak membersihkan sendiri'], [0, 'Bantuan total']]],
    ['Mobilitas di tempat tidur & pelepasan tekanan', 'Mobilitas', [[6, 'Semua mandiri tanpa alat'], [4, 'Semua mandiri dengan alat'], [2, 'Dua-tiga aktivitas mandiri'], [1, 'Satu aktivitas mandiri'], [0, 'Semua perlu bantuan']]],
    ['Transfer tempat tidur - kursi roda', 'Mobilitas', [[2, 'Mandiri'], [1, 'Pengawasan / bantuan parsial'], [0, 'Bantuan total']]],
    ['Transfer kursi roda - toilet - bak mandi', 'Mobilitas', [[2, 'Mandiri'], [1, 'Pengawasan / bantuan parsial'], [0, 'Bantuan total']]],
    ['Mobilitas dalam ruangan', 'Mobilitas', AMB],
    ['Mobilitas jarak sedang (10-100 m)', 'Mobilitas', AMB],
    ['Mobilitas luar ruangan (> 100 m)', 'Mobilitas', AMB],
    ['Naik / turun tangga', 'Mobilitas', [[3, 'Tanpa dukungan / pengawasan'], [2, 'Dengan pegangan / kruk'], [1, 'Dengan dukungan orang lain'], [0, 'Tidak mampu']]],
    ['Transfer kursi roda - mobil', 'Mobilitas', [[2, 'Mandiri'], [1, 'Pengawasan / bantuan parsial'], [0, 'Bantuan total']]],
    ['Transfer lantai - kursi roda', 'Mobilitas', [[1, 'Mandiri'], [0, 'Perlu bantuan']]],
  ].map(([label, group, o]) => ({ label, group, ...O(o) })),
  bands: () => '0-100, semakin tinggi semakin mandiri',
  detail: (a) => `perawatan diri ${fmSum(a, 0, 6)}/20, pernapasan & sfingter ${fmSum(a, 6, 10)}/40, mobilitas ${fmSum(a, 10, 19)}/40`,
});

// ───────── CSI (Bagian A) ─────────
const CSI_SCALE = numScale('0 = tidak pernah · 1 = jarang · 2 = kadang · 3 = sering · 4 = selalu', range(0, 4));
const CSI = totalForm({
  id: 'csi', name: 'CSI', max: 100,
  items: itemsOf(['Bangun tidur terasa tidak segar', 'Otot kaku dan nyeri', 'Serangan cemas', 'Menggertakkan / mengatupkan gigi', 'Diare atau sembelit', 'Perlu bantuan untuk aktivitas harian', 'Sensitif terhadap cahaya terang', 'Mudah lelah saat aktif secara fisik', 'Nyeri di seluruh tubuh', 'Sakit kepala', 'Tidak nyaman di kandung kemih / nyeri saat berkemih', 'Tidur tidak nyenyak', 'Sulit berkonsentrasi', 'Masalah kulit (kering, gatal, ruam)', 'Stres memperberat gejala fisik', 'Merasa sedih atau depresi', 'Tenaga rendah', 'Ketegangan otot leher dan bahu', 'Nyeri rahang', 'Bau tertentu (misalnya parfum) membuat pusing / mual', 'Sering buang air kecil', 'Kaki tidak nyaman / gelisah saat mencoba tidur', 'Sulit mengingat', 'Pernah mengalami trauma (masa kecil / dewasa)', 'Nyeri di area panggul'], CSI_SCALE),
  bands: band([[29, 'subklinis'], [39, 'ringan'], [49, 'sedang'], [59, 'berat'], [100, 'ekstrem']]),
});

// ───────── Tinetti POMA ─────────
const TINETTI = totalForm({
  id: 'tinetti', name: 'Tinetti', max: 28,
  items: [
    ['Keseimbangan · Duduk', 'Keseimbangan', [[1, 'Stabil, aman'], [0, 'Condong / merosot']]],
    ['Keseimbangan · Bangkit dari kursi', 'Keseimbangan', [[2, 'Tanpa bantuan tangan'], [1, 'Memakai tangan'], [0, 'Tidak mampu tanpa bantuan']]],
    ['Keseimbangan · Percobaan bangkit', 'Keseimbangan', [[2, 'Satu kali'], [1, 'Lebih dari satu kali'], [0, 'Tidak mampu']]],
    ['Keseimbangan · Berdiri 5 detik pertama', 'Keseimbangan', [[2, 'Stabil tanpa alat'], [1, 'Stabil dengan walker / alat'], [0, 'Tidak stabil']]],
    ['Keseimbangan · Berdiri tegak', 'Keseimbangan', [[2, 'Sempit, tanpa pegangan'], [1, 'Stabil tapi kaki melebar / berpegangan'], [0, 'Tidak stabil']]],
    ['Keseimbangan · Didorong ringan di dada', 'Keseimbangan', [[2, 'Stabil'], [1, 'Terhuyung tapi bisa menahan'], [0, 'Mulai jatuh']]],
    ['Keseimbangan · Mata tertutup', 'Keseimbangan', [[1, 'Stabil'], [0, 'Tidak stabil']]],
    ['Keseimbangan · Berputar 360° (kontinuitas)', 'Keseimbangan', [[1, 'Langkah berkesinambungan'], [0, 'Langkah terputus']]],
    ['Keseimbangan · Berputar 360° (kestabilan)', 'Keseimbangan', [[1, 'Stabil'], [0, 'Tidak stabil']]],
    ['Keseimbangan · Duduk kembali', 'Keseimbangan', [[2, 'Aman, halus'], [1, 'Memakai tangan / tidak halus'], [0, 'Tidak aman']]],
    ['Gaya jalan · Memulai berjalan', 'Gaya jalan', [[1, 'Tanpa ragu'], [0, 'Ragu / beberapa percobaan']]],
    ['Gaya jalan · Kaki kanan melewati kaki kiri', 'Gaya jalan', [[1, 'Ya'], [0, 'Tidak']]],
    ['Gaya jalan · Kaki kanan terangkat dari lantai', 'Gaya jalan', [[1, 'Ya'], [0, 'Tidak']]],
    ['Gaya jalan · Kaki kiri melewati kaki kanan', 'Gaya jalan', [[1, 'Ya'], [0, 'Tidak']]],
    ['Gaya jalan · Kaki kiri terangkat dari lantai', 'Gaya jalan', [[1, 'Ya'], [0, 'Tidak']]],
    ['Gaya jalan · Simetri langkah', 'Gaya jalan', [[1, 'Kanan-kiri sama'], [0, 'Tidak sama']]],
    ['Gaya jalan · Kontinuitas langkah', 'Gaya jalan', [[1, 'Berkesinambungan'], [0, 'Berhenti / terputus']]],
    ['Gaya jalan · Jalur', 'Gaya jalan', [[2, 'Lurus tanpa alat'], [1, 'Sedikit deviasi / memakai alat'], [0, 'Deviasi nyata']]],
    ['Gaya jalan · Batang tubuh', 'Gaya jalan', [[2, 'Tanpa goyang, tanpa alat'], [1, 'Tanpa goyang tapi menekuk lutut / punggung / merentang lengan'], [0, 'Goyang nyata / memakai walker']]],
    ['Gaya jalan · Sikap berjalan', 'Gaya jalan', [[1, 'Tumit hampir bersentuhan'], [0, 'Tumit berjauhan']]],
  ].map(([label, group, o]) => ({ label, group, ...O(o) })),
  bands: (t) => (t >= 25 ? 'risiko jatuh rendah' : t >= 19 ? 'risiko jatuh sedang' : 'risiko jatuh tinggi'),
  detail: (a) => `keseimbangan ${fmSum(a, 0, 10)}/16, gaya jalan ${fmSum(a, 10, 20)}/12`,
});

// ───────── PRTEE ─────────
const PRTEE_SCALE = numScale('0 = tidak nyeri / tidak sulit · 10 = nyeri terberat / tidak mampu', range(0, 10));
const PRTEE_PAIN = ['Nyeri saat istirahat', 'Nyeri saat gerakan lengan berulang', 'Nyeri saat membawa kantong belanja', 'Nyeri saat paling ringan', 'Nyeri saat paling berat'];
const PRTEE_FUNC = ['Memutar gagang pintu / kunci', 'Membawa kantong belanja / tas dengan pegangan', 'Mengangkat cangkir penuh ke mulut', 'Membuka toples', 'Menarik celana ke atas', 'Memeras kain basah', 'Perawatan diri (berpakaian, mandi)', 'Pekerjaan rumah (membersihkan, perawatan)', 'Pekerjaan (pekerjaan harian)', 'Rekreasi atau olahraga'];
const prteeCalc = (a) => {
  const pain = sumRange(a, 0, 5);
  const func = sumRange(a, 5, 15);
  return { pain, func: round(func / 2), total: round(pain + func / 2) };
};
function sumRange(a, from, to) { return range(from, to - 1).reduce((s, i) => s + (a[i] ?? 0), 0); }
const prteeBand = (v) => (v < 20 ? 'ringan' : v < 50 ? 'sedang' : 'berat');
const PRTEE = {
  id: 'prtee',
  name: 'PRTEE',
  items: [
    ...PRTEE_PAIN.map((label) => ({ label, scale: PRTEE_SCALE, group: 'Nyeri' })),
    ...PRTEE_FUNC.map((label, i) => ({ label, scale: PRTEE_SCALE, group: i < 6 ? 'Fungsi · aktivitas spesifik' : 'Fungsi · aktivitas sehari-hari' })),
  ],
  minAnswered: 15,
  manual: { label: 'Skor total (0-100)', min: 0, max: 100 },
  compute: (a) => {
    if (!range(0, 14).some((i) => a[i] !== undefined)) return null;
    const c = prteeCalc(a);
    return { value: c.total, summary: `${c.total}/100`, interpretation: `${prteeBand(c.total)}; nyeri ${c.pain}/50, fungsi ${c.func}/50` };
  },
  fromManual: (v) => ({ value: v, summary: `${v}/100`, interpretation: prteeBand(v) }),
  text: (r) => `PRTEE ${r.summary} (${r.interpretation}; skor lebih tinggi = lebih berat)`,
};

export const MORE_FORMS = { ikdc: IKDC, visap: VISA_P, visaa: VISA_A, cait: CAIT, haqdi: HAQDI, fugl: FUGL, scim: SCIM, csi: CSI, tinetti: TINETTI, prtee: PRTEE };
