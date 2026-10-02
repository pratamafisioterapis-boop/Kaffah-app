// Formulir fungsional tambahan (lihat functionalForms.js untuk konvensi).
// Butir adalah parafrase bahasa Indonesia dari instrumen bakunya.

const opts = (pairs) => pairs.map(([value, label]) => ({ value, label: label ?? String(value) }));
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const numScale = (note, values) => ({ note, options: values.map((v) => ({ value: v, label: String(v) })) });
const round = (n) => Math.round(n * 10) / 10;
const sumOf = (answers, n) => Array.from({ length: n }).reduce((acc, _, i) => acc + (answers[i] ?? 0), 0);
const countOf = (answers, n) => Array.from({ length: n }).filter((_, i) => answers[i] !== undefined).length;

// Formulir "jumlah skor" generik: total = jumlah jawaban.
const totalForm = ({ id, name, items, max, min = 0, minAnswered, bands, detail, unit = '' }) => ({
  id,
  name,
  items,
  minAnswered: minAnswered ?? items.length,
  manual: { label: `Skor total (${min}-${max})`, min, max },
  compute: (answers) => {
    if (!countOf(answers, items.length)) return null;
    const t = sumOf(answers, items.length);
    return {
      value: t,
      summary: `${t}/${max}${unit}`,
      interpretation: bands ? bands(t) : '',
      extra: detail ? detail(answers) : '',
    };
  },
  fromManual: (v) => ({ value: v, summary: `${v}/${max}${unit}`, interpretation: bands ? bands(v) : '', extra: '' }),
  text: (r) => {
    const bits = [r.interpretation, r.extra].filter(Boolean).join('; ');
    return `${name} ${r.summary}${bits ? ` (${bits})` : ''}`;
  },
});

const band = (list) => (t) => list.find(([max]) => t <= max)?.[1] || '';
const itemsOf = (labels, scale) => labels.map((label) => ({ label, scale }));

// ───────── Skala umum ─────────
const WOMAC_SCALE = numScale('0 = tidak ada · 1 = ringan · 2 = sedang · 3 = berat · 4 = sangat berat', range(0, 4));
const KOOS_SCALE = numScale('0 = tidak ada / tidak pernah · 1 = ringan · 2 = sedang · 3 = berat · 4 = sangat berat / selalu / tidak mampu', range(0, 4));
const FAAM_SCALE = numScale('4 = tanpa kesulitan · 3 = sedikit sulit · 2 = cukup sulit · 1 = sangat sulit · 0 = tidak mampu (lewati bila tidak berlaku)', [4, 3, 2, 1, 0]);
const LIKERT_0_4 = numScale('0 = tidak sama sekali · 1 = sedikit · 2 = cukup · 3 = banyak · 4 = selalu', range(0, 4));
const FSS_SCALE = numScale('1 = sangat tidak setuju · 7 = sangat setuju', range(1, 7));
const CHALDER_SCALE = numScale('0 = lebih baik dari biasa · 1 = sama seperti biasa · 2 = lebih buruk dari biasa · 3 = jauh lebih buruk', range(0, 3));
const SCALE_0_5 = numScale('0 = tidak ada · 5 = sangat berat', range(0, 5));
const SCALE_0_10 = numScale('0 = tidak ada keluhan · 10 = terberat', range(0, 10));
const SCALE_0_2 = numScale('2 = normal · 1 = sedang · 0 = berat / tidak mampu', [2, 1, 0]);
const SCALE_MRC = numScale('0 = tidak ada kontraksi · 5 = kekuatan normal', range(0, 5));
const YES_NO = { note: 'Ya / Tidak', options: opts([[1, 'Ya'], [0, 'Tidak']]) };

// ───────── KOOS (5 subskala) ─────────
const KOOS_GROUPS = [
  ['Gejala', ['Bengkak pada lutut', 'Bunyi gesek / klik saat lutut bergerak', 'Lutut tersangkut / terkunci', 'Sulit meluruskan lutut penuh', 'Sulit menekuk lutut penuh', 'Kaku di pagi hari', 'Kaku setelah duduk / istirahat']],
  ['Nyeri', ['Seberapa sering nyeri lutut', 'Nyeri saat memutar / berputar', 'Nyeri saat meluruskan lutut penuh', 'Nyeri saat menekuk lutut penuh', 'Nyeri saat berjalan di permukaan datar', 'Nyeri saat naik / turun tangga', 'Nyeri malam hari di tempat tidur', 'Nyeri saat duduk / berbaring', 'Nyeri saat berdiri tegak']],
  ['Aktivitas sehari-hari (ADL)', ['Turun tangga', 'Naik tangga', 'Bangun dari duduk', 'Berdiri', 'Membungkuk ke lantai / mengambil benda', 'Berjalan di permukaan datar', 'Masuk / keluar mobil', 'Berbelanja', 'Memakai kaus kaki', 'Bangun dari tempat tidur', 'Melepas kaus kaki', 'Berbaring di tempat tidur (berguling, menahan lutut)', 'Masuk / keluar bak mandi', 'Duduk', 'Duduk / bangun dari toilet', 'Pekerjaan rumah berat', 'Pekerjaan rumah ringan']],
  ['Olahraga & rekreasi', ['Jongkok', 'Berlari', 'Melompat', 'Memutar / berputar pada lutut yang cedera', 'Berlutut']],
  ['Kualitas hidup', ['Seberapa sering menyadari masalah lutut', 'Mengubah gaya hidup untuk menghindari aktivitas yang merusak lutut', 'Seberapa besar kurang percaya diri pada lutut', 'Kesulitan umum akibat lutut']],
];
const KOOS_ITEMS = KOOS_GROUPS.flatMap(([group, labels]) => labels.map((label) => ({ label, scale: KOOS_SCALE, group })));
const KOOS_SLICES = (() => {
  let start = 0;
  return KOOS_GROUPS.map(([name, labels]) => {
    const slice = { name, start, end: start + labels.length };
    start += labels.length;
    return slice;
  });
})();
const koosScores = (answers) => KOOS_SLICES.map(({ name, start, end }) => {
  const vals = range(start, end - 1).map((i) => answers[i]).filter((v) => v !== undefined);
  return vals.length ? { name, score: Math.round(100 - (vals.reduce((a, b) => a + b, 0) / vals.length) * 25) } : null;
}).filter(Boolean);

const KOOS = {
  id: 'koos',
  name: 'KOOS',
  items: KOOS_ITEMS,
  minAnswered: 4,
  manual: null,
  compute: (answers) => {
    const scores = koosScores(answers);
    if (!scores.length) return null;
    return { value: scores, summary: scores.map((s) => `${s.name} ${s.score}`).join(', '), interpretation: '100 = tanpa keluhan, 0 = keluhan terberat' };
  },
  fromManual: () => null,
  text: (r) => `KOOS: ${r.summary} (${r.interpretation})`,
};

// ───────── WOMAC ─────────
const WOMAC_PAIN = ['Nyeri saat berjalan', 'Nyeri saat naik / turun tangga', 'Nyeri malam hari di tempat tidur', 'Nyeri saat istirahat', 'Nyeri saat menumpu beban'];
const WOMAC_STIFF = ['Kaku di pagi hari', 'Kaku setelah duduk / berbaring / istirahat'];
const WOMAC_FUNC = ['Turun tangga', 'Naik tangga', 'Bangun dari duduk', 'Berdiri', 'Membungkuk ke lantai', 'Berjalan di permukaan datar', 'Masuk / keluar mobil', 'Berbelanja', 'Memakai kaus kaki', 'Bangun dari tempat tidur', 'Melepas kaus kaki', 'Berbaring di tempat tidur', 'Masuk / keluar bak mandi', 'Duduk', 'Duduk / bangun dari toilet', 'Pekerjaan rumah berat', 'Pekerjaan rumah ringan'];
const WOMAC_ITEMS = [
  ...WOMAC_PAIN.map((label) => ({ label, scale: WOMAC_SCALE, group: 'Nyeri' })),
  ...WOMAC_STIFF.map((label) => ({ label, scale: WOMAC_SCALE, group: 'Kekakuan' })),
  ...WOMAC_FUNC.map((label) => ({ label, scale: WOMAC_SCALE, group: 'Fungsi fisik' })),
];
const WOMAC = totalForm({
  id: 'womac', name: 'WOMAC', items: WOMAC_ITEMS, max: 96, minAnswered: 24,
  bands: (t) => `${round((t / 96) * 100)}% disabilitas`,
  detail: (a) => `nyeri ${sumOf(a, 5)}/20, kekakuan ${range(5, 6).reduce((s, i) => s + (a[i] ?? 0), 0)}/8, fungsi ${range(7, 23).reduce((s, i) => s + (a[i] ?? 0), 0)}/68`,
});

// ───────── FAAM-ADL ─────────
const FAAM_ITEMS = ['Berdiri', 'Berjalan di permukaan datar', 'Berjalan di permukaan datar tanpa sepatu', 'Berjalan naik tanjakan', 'Berjalan turun tanjakan', 'Naik tangga', 'Turun tangga', 'Berjalan di permukaan tidak rata', 'Naik-turun trotoar', 'Jongkok', 'Berjinjit', 'Langkah pertama saat mulai berjalan', 'Berjalan ≤ 5 menit', 'Berjalan ± 10 menit', 'Berjalan ≥ 15 menit', 'Tanggung jawab rumah tangga', 'Aktivitas sehari-hari', 'Perawatan diri', 'Pekerjaan ringan-sedang', 'Pekerjaan berat', 'Aktivitas rekreasi'];
const FAAM = {
  id: 'faam',
  name: 'FAAM-ADL',
  items: itemsOf(FAAM_ITEMS, FAAM_SCALE),
  minAnswered: 16,
  manual: { label: 'Skor total (%)', min: 0, max: 100 },
  compute: (answers) => {
    const n = countOf(answers, FAAM_ITEMS.length);
    if (!n) return null;
    const pct = round((sumOf(answers, FAAM_ITEMS.length) / (n * 4)) * 100);
    return { value: pct, summary: `${pct}%`, interpretation: '100% = fungsi normal' };
  },
  fromManual: (v) => ({ value: v, summary: `${v}%`, interpretation: '100% = fungsi normal' }),
  text: (r) => `FAAM-ADL ${r.summary} (${r.interpretation})`,
};

// ───────── Kujala ─────────
const KUJALA = [
  ['Pincang', [[5, 'Tidak ada'], [3, 'Kadang-kadang'], [0, 'Terus-menerus']]],
  ['Menumpu berat badan', [[5, 'Penuh'], [3, 'Nyeri'], [0, 'Tidak mampu']]],
  ['Berjalan', [[5, 'Tak terbatas'], [3, '> 2 km'], [2, '1-2 km'], [0, 'Tidak mampu']]],
  ['Tangga', [[10, 'Tanpa kesulitan'], [8, 'Nyeri ringan saat turun'], [5, 'Nyeri naik & turun'], [0, 'Tidak mampu']]],
  ['Jongkok', [[5, 'Tanpa kesulitan'], [4, 'Nyeri berulang'], [3, 'Nyeri tiap kali'], [2, 'Menumpu sebagian'], [0, 'Tidak mampu']]],
  ['Berlari', [[10, 'Tanpa kesulitan'], [8, 'Nyeri setelah > 2 km'], [6, 'Nyeri sejak awal'], [3, 'Nyeri berat'], [0, 'Tidak mampu']]],
  ['Melompat', [[10, 'Tanpa kesulitan'], [7, 'Sedikit kesulitan'], [2, 'Sangat sulit'], [0, 'Tidak mampu']]],
  ['Duduk lama (lutut ditekuk)', [[10, 'Tanpa kesulitan'], [8, 'Nyeri setelah olahraga'], [6, 'Nyeri tiap kali'], [4, 'Nyeri memaksa meluruskan lutut'], [0, 'Tidak mampu']]],
  ['Nyeri', [[10, 'Tidak ada'], [8, 'Ringan, sesekali'], [6, 'Mengganggu tidur sesekali'], [3, 'Mengganggu tidur teratur'], [0, 'Terus-menerus & berat']]],
  ['Bengkak', [[10, 'Tidak ada'], [8, 'Setelah aktivitas berat'], [6, 'Setelah aktivitas sehari-hari'], [4, 'Setiap malam'], [0, 'Terus-menerus']]],
  ['Gerak patella abnormal', [[10, 'Tidak ada'], [6, 'Kadang saat aktivitas'], [4, 'Sering saat aktivitas'], [0, 'Subluksasi / lepas']]],
  ['Atrofi paha', [[5, 'Tidak ada'], [3, 'Ringan'], [0, 'Berat']]],
  ['Defisit fleksi lutut', [[5, 'Tidak ada'], [3, 'Ringan'], [0, 'Berat']]],
].map(([label, o]) => ({ label, options: opts(o) }));
const kujalaBand = band([[54, 'fungsi buruk'], [69, 'fungsi sedang'], [84, 'fungsi cukup baik'], [100, 'fungsi baik']]);
const KUJALA_FORM = totalForm({ id: 'kujala', name: 'Kujala Score', items: KUJALA, max: 100, bands: kujalaBand });

// ───────── DHI ─────────
const DHI_ITEMS = ['Menengadah memperberat masalah', 'Merasa frustrasi karena masalah ini', 'Membatasi bepergian', 'Berjalan di lorong supermarket memperberat masalah', 'Sulit naik / turun tempat tidur', 'Sangat membatasi kegiatan sosial', 'Sulit membaca', 'Aktivitas berat (olahraga, menari, pekerjaan rumah) memperberat masalah', 'Takut keluar rumah tanpa ditemani', 'Merasa malu di depan orang lain', 'Gerakan kepala cepat memperberat masalah', 'Menghindari tempat tinggi', 'Berguling di tempat tidur memperberat masalah', 'Sulit melakukan pekerjaan rumah / halaman yang berat', 'Takut dikira mabuk', 'Sulit berjalan-jalan sendirian', 'Berjalan di trotoar memperberat masalah', 'Sulit berkonsentrasi', 'Sulit berjalan di dalam rumah saat gelap', 'Takut tinggal sendirian di rumah', 'Merasa cacat / terhambat', 'Masalah ini membebani hubungan dengan keluarga / teman', 'Merasa depresi', 'Mengganggu pekerjaan / tanggung jawab rumah', 'Membungkuk memperberat masalah'];
const DHI = totalForm({
  id: 'dhi', name: 'Dizziness Handicap Inventory',
  items: DHI_ITEMS.map((label) => ({ label, options: opts([[4, 'Ya'], [2, 'Kadang-kadang'], [0, 'Tidak']]) })),
  max: 100, minAnswered: 23,
  bands: band([[14, 'gangguan minimal'], [30, 'gangguan ringan'], [60, 'gangguan sedang'], [100, 'gangguan berat']]),
});

// ───────── Kelelahan, napas, nyeri kepala ─────────
const FSS_ITEMS = ['Motivasi saya menurun saat lelah', 'Olahraga membuat saya lelah', 'Saya mudah lelah', 'Kelelahan mengganggu fungsi fisik saya', 'Kelelahan sering menimbulkan masalah', 'Kelelahan menghalangi fungsi fisik berkelanjutan', 'Kelelahan mengganggu tugas dan tanggung jawab tertentu', 'Kelelahan termasuk tiga gejala paling melumpuhkan', 'Kelelahan mengganggu pekerjaan, keluarga, atau kehidupan sosial'];
const FSS = totalForm({
  id: 'fss', name: 'Fatigue Severity Scale', items: itemsOf(FSS_ITEMS, FSS_SCALE), max: 63, min: 9, minAnswered: 9,
  bands: (t) => (t / 9 >= 4 ? 'kelelahan bermakna' : 'kelelahan tidak bermakna'),
  detail: (a) => `rerata ${round(sumOf(a, 9) / 9)}`,
});
const CHALDER = totalForm({
  id: 'chalder', name: 'Chalder Fatigue Scale', max: 33,
  items: itemsOf(['Merasa lelah', 'Perlu istirahat lebih banyak', 'Merasa mengantuk / lesu', 'Sulit memulai sesuatu', 'Kurang tenaga', 'Otot kurang kuat', 'Merasa lemah', 'Sulit berkonsentrasi', 'Salah bicara', 'Sulit menemukan kata yang tepat', 'Daya ingat'], CHALDER_SCALE),
  bands: band([[10, 'kelelahan ringan'], [20, 'kelelahan sedang'], [33, 'kelelahan berat']]),
});
const CAT = totalForm({
  id: 'cat', name: 'CAT (COPD Assessment Test)', max: 40, minAnswered: 8,
  items: itemsOf(['Batuk', 'Dahak', 'Dada terasa berat / sesak', 'Sesak saat naik tanjakan / tangga', 'Keterbatasan aktivitas di rumah', 'Percaya diri keluar rumah', 'Tidur', 'Tenaga'], SCALE_0_5),
  bands: band([[9, 'dampak rendah'], [20, 'dampak sedang'], [30, 'dampak tinggi'], [40, 'dampak sangat tinggi']]),
});
const HIT6_OPTS = opts([[6, 'Tidak pernah'], [8, 'Jarang'], [10, 'Kadang-kadang'], [11, 'Sangat sering'], [13, 'Selalu']]);
const HIT6 = totalForm({
  id: 'hit6', name: 'HIT-6', max: 78, min: 36,
  items: ['Seberapa sering nyeri kepala terasa berat', 'Seberapa sering nyeri kepala membatasi aktivitas harian', 'Ingin berbaring saat nyeri kepala', 'Merasa terlalu lelah untuk bekerja / beraktivitas', 'Merasa jengkel / kesal karena nyeri kepala', 'Nyeri kepala membatasi kemampuan berkonsentrasi'].map((label) => ({ label, options: HIT6_OPTS })),
  bands: band([[49, 'dampak sedikit / tidak ada'], [55, 'dampak ringan'], [59, 'dampak cukup berat'], [78, 'dampak sangat berat']]),
});
const PCS = totalForm({
  id: 'pcs', name: 'Pain Catastrophizing Scale', max: 52,
  items: itemsOf(['Saya khawatir terus apakah nyeri akan hilang', 'Saya merasa tidak sanggup lagi', 'Nyeri ini mengerikan dan tidak akan membaik', 'Nyeri ini terasa menguasai saya', 'Saya merasa tidak tahan lagi', 'Saya takut nyeri bertambah buruk', 'Saya terus memikirkan kejadian nyeri lainnya', 'Saya sangat ingin nyeri segera hilang', 'Saya tidak bisa mengalihkan pikiran dari nyeri', 'Saya terus memikirkan betapa sakitnya', 'Saya terus memikirkan betapa ingin nyeri berhenti', 'Tidak ada yang bisa saya lakukan untuk mengurangi nyeri', 'Saya bertanya-tanya apakah sesuatu yang serius akan terjadi'], LIKERT_0_4),
  bands: (t) => (t >= 30 ? 'katastrofisasi bermakna secara klinis' : 'di bawah ambang klinis'),
});

// ───────── Spondyloarthritis ─────────
const basdai = (a) => {
  const v = range(0, 5).map((i) => a[i]);
  if (v.some((x) => x === undefined)) return null;
  return round((v[0] + v[1] + v[2] + v[3] + (v[4] + v[5]) / 2) / 5);
};
const BASDAI = {
  id: 'basdai',
  name: 'BASDAI',
  items: itemsOf(['Kelelahan / kelemahan', 'Nyeri leher, punggung, atau pinggul', 'Nyeri / bengkak pada sendi lain', 'Nyeri tekan / sensitif pada area tertentu', 'Beratnya kaku pagi (sejak bangun)', 'Lama kaku pagi (0 = 0 menit, 10 = ≥ 2 jam)'], SCALE_0_10),
  minAnswered: 6,
  manual: { label: 'Skor (0-10)', min: 0, max: 10 },
  compute: (a) => {
    const v = basdai(a);
    return v === null ? null : { value: v, summary: `${v}/10`, interpretation: v >= 4 ? 'penyakit aktif' : 'penyakit tidak aktif' };
  },
  fromManual: (v) => ({ value: v, summary: `${v}/10`, interpretation: v >= 4 ? 'penyakit aktif' : 'penyakit tidak aktif' }),
  text: (r) => `BASDAI ${r.summary} (${r.interpretation})`,
};
const BASFI_ITEMS = ['Memakai kaus kaki tanpa bantuan', 'Membungkuk mengambil pulpen dari lantai tanpa bantuan', 'Meraih rak tinggi tanpa bantuan', 'Bangun dari kursi tanpa sandaran lengan tanpa tangan', 'Bangun dari lantai (berbaring telentang) tanpa bantuan', 'Berdiri tanpa bantuan selama 10 menit', 'Naik 12-15 anak tangga tanpa pegangan', 'Menoleh ke belakang tanpa memutar badan', 'Aktivitas fisik berat (fisioterapi, berkebun, olahraga)', 'Aktivitas penuh sehari (di rumah / di tempat kerja)'];
const BASFI = {
  id: 'basfi',
  name: 'BASFI',
  items: itemsOf(BASFI_ITEMS, numScale('0 = mudah · 10 = tidak mampu', range(0, 10))),
  minAnswered: 10,
  manual: { label: 'Skor (0-10)', min: 0, max: 10 },
  compute: (a) => {
    const n = countOf(a, 10);
    if (!n) return null;
    const v = round(sumOf(a, 10) / n);
    return { value: v, summary: `${v}/10`, interpretation: '0 = tanpa gangguan fungsi' };
  },
  fromManual: (v) => ({ value: v, summary: `${v}/10`, interpretation: '0 = tanpa gangguan fungsi' }),
  text: (r) => `BASFI ${r.summary} (${r.interpretation})`,
};

// ───────── Stroke, ataksia, kesadaran ─────────
const NIHSS_ARM = [[0, 'Tidak jatuh'], [1, 'Drift'], [2, 'Ada usaha melawan gravitasi'], [3, 'Tidak ada usaha melawan gravitasi'], [4, 'Tidak ada gerakan']];
const NIHSS = totalForm({
  id: 'nihss', name: 'NIHSS', max: 42,
  items: [
    ['1a. Tingkat kesadaran', [[0, 'Waspada'], [1, 'Mengantuk'], [2, 'Butuh rangsang berulang'], [3, 'Tidak responsif']]],
    ['1b. Pertanyaan (bulan, usia)', [[0, 'Keduanya benar'], [1, 'Satu benar'], [2, 'Tidak ada benar']]],
    ['1c. Perintah (buka-tutup mata, genggam)', [[0, 'Keduanya benar'], [1, 'Satu benar'], [2, 'Tidak ada benar']]],
    ['2. Gerak mata konjugat', [[0, 'Normal'], [1, 'Palsi parsial'], [2, 'Deviasi paksa']]],
    ['3. Lapang pandang', [[0, 'Normal'], [1, 'Hemianopia parsial'], [2, 'Hemianopia lengkap'], [3, 'Buta bilateral']]],
    ['4. Paresis wajah', [[0, 'Normal'], [1, 'Minor'], [2, 'Parsial'], [3, 'Lengkap']]],
    ['5a. Motorik lengan kiri', NIHSS_ARM],
    ['5b. Motorik lengan kanan', NIHSS_ARM],
    ['6a. Motorik tungkai kiri', NIHSS_ARM],
    ['6b. Motorik tungkai kanan', NIHSS_ARM],
    ['7. Ataksia anggota gerak', [[0, 'Tidak ada'], [1, 'Satu anggota gerak'], [2, 'Dua anggota gerak']]],
    ['8. Sensorik', [[0, 'Normal'], [1, 'Ringan-sedang'], [2, 'Berat / hilang total']]],
    ['9. Bahasa', [[0, 'Normal'], [1, 'Afasia ringan-sedang'], [2, 'Afasia berat'], [3, 'Mute / afasia global']]],
    ['10. Disartria', [[0, 'Normal'], [1, 'Ringan-sedang'], [2, 'Berat / mute']]],
    ['11. Neglect / ekstingsi', [[0, 'Tidak ada'], [1, 'Satu modalitas'], [2, 'Lebih dari satu modalitas']]],
  ].map(([label, o]) => ({ label, options: opts(o) })),
  bands: band([[0, 'tanpa defisit'], [4, 'stroke ringan'], [15, 'stroke sedang'], [20, 'sedang-berat'], [42, 'berat']]),
});
const SARA = totalForm({
  id: 'sara', name: 'SARA', max: 40,
  items: [
    ['Gaya berjalan (0-8)', 8], ['Berdiri (0-6)', 6], ['Duduk (0-4)', 4], ['Bicara (0-6)', 6],
    ['Mengikuti jari (0-4, rata-rata kanan-kiri)', 4], ['Tunjuk hidung-jari (0-4, rata-rata)', 4],
    ['Gerak tangan bergantian cepat (0-4, rata-rata)', 4], ['Tumit-tulang kering (0-4, rata-rata)', 4],
  ].map(([label, mx]) => ({ label, scale: numScale('0 = normal · semakin tinggi semakin berat', range(0, mx)) })),
  bands: () => '0 = normal, 40 = ataksia terberat',
});
const GCS_E = [[4, 'Spontan'], [3, 'Terhadap suara'], [2, 'Terhadap nyeri'], [1, 'Tidak ada']];
const GCS_V = [[5, 'Orientasi baik'], [4, 'Bingung'], [3, 'Kata-kata tidak tepat'], [2, 'Suara tidak berarti'], [1, 'Tidak ada']];
const GCS_M = [[6, 'Mengikuti perintah'], [5, 'Melokalisir nyeri'], [4, 'Menarik (withdrawal)'], [3, 'Fleksi abnormal'], [2, 'Ekstensi abnormal'], [1, 'Tidak ada']];
const GCS = {
  id: 'gcs',
  name: 'GCS',
  items: [
    { label: 'Membuka mata (Eye)', options: opts(GCS_E) },
    { label: 'Respons verbal (Verbal)', options: opts(GCS_V) },
    { label: 'Respons motorik (Motor)', options: opts(GCS_M) },
  ],
  minAnswered: 3,
  manual: { label: 'Skor total (3-15)', min: 3, max: 15 },
  compute: (a) => {
    if (countOf(a, 3) < 3) return null;
    const t = a[0] + a[1] + a[2];
    return { value: t, summary: `${t}`, interpretation: t >= 14 ? 'cedera ringan' : t >= 9 ? 'cedera sedang' : 'cedera berat', extra: `E${a[0]} V${a[1]} M${a[2]}` };
  },
  fromManual: (v) => ({ value: v, summary: `${v}`, interpretation: v >= 14 ? 'cedera ringan' : v >= 9 ? 'cedera sedang' : 'cedera berat', extra: '' }),
  text: (r) => `GCS ${r.summary}${r.extra ? ` (${r.extra})` : ''}, ${r.interpretation}`,
};

// ───────── Keseimbangan & mobilitas ─────────
const SPPB = totalForm({
  id: 'sppb', name: 'SPPB', max: 12,
  items: [
    { label: 'Tes keseimbangan', options: opts([[0, 'Tak mampu berdiri kaki rapat 10 detik'], [1, 'Kaki rapat 10 detik'], [2, 'Semi-tandem 10 detik'], [3, 'Tandem 3-9 detik'], [4, 'Tandem ≥ 10 detik']]) },
    { label: 'Kecepatan jalan 4 m', options: opts([[0, 'Tidak mampu'], [1, '> 8,7 detik'], [2, '6,21-8,70 detik'], [3, '4,82-6,20 detik'], [4, '< 4,82 detik']]) },
    { label: 'Bangkit dari kursi 5 kali', options: opts([[0, 'Tidak mampu / > 60 detik'], [1, '≥ 16,7 detik'], [2, '13,7-16,6 detik'], [3, '11,2-13,6 detik'], [4, '≤ 11,1 detik']]) },
  ],
  bands: band([[3, 'performa sangat rendah'], [6, 'performa rendah'], [9, 'performa sedang'], [12, 'performa baik']]),
});
const MINIBEST = totalForm({
  id: 'minibest', name: 'Mini-BESTest', max: 28,
  items: itemsOf(['Duduk ke berdiri', 'Berjinjit', 'Berdiri satu kaki (sisi terburuk)', 'Langkah kompensasi ke depan', 'Langkah kompensasi ke belakang', 'Langkah kompensasi ke samping (sisi terburuk)', 'Berdiri mata terbuka, permukaan keras', 'Berdiri mata tertutup, permukaan busa', 'Berdiri di bidang miring, mata tertutup', 'Mengubah kecepatan jalan', 'Berjalan sambil menoleh', 'Berjalan sambil berputar', 'Melangkahi rintangan', 'TUG dengan tugas ganda'], SCALE_0_2),
  bands: (t) => (t <= 19 ? 'risiko jatuh tinggi' : 'risiko jatuh lebih rendah'),
});
const BRADEN = totalForm({
  id: 'braden', name: 'Braden Scale', max: 23, min: 6,
  items: [
    ['Persepsi sensorik', [[1, 'Tidak responsif'], [2, 'Hanya respons nyeri'], [3, 'Respons verbal, terbatas'], [4, 'Tidak ada gangguan']]],
    ['Kelembapan kulit', [[1, 'Selalu lembap'], [2, 'Sangat lembap'], [3, 'Kadang lembap'], [4, 'Jarang lembap']]],
    ['Aktivitas', [[1, 'Terbaring'], [2, 'Duduk di kursi'], [3, 'Kadang berjalan'], [4, 'Sering berjalan']]],
    ['Mobilitas', [[1, 'Tidak bergerak'], [2, 'Sangat terbatas'], [3, 'Sedikit terbatas'], [4, 'Tanpa batasan']]],
    ['Nutrisi', [[1, 'Sangat buruk'], [2, 'Kurang adekuat'], [3, 'Adekuat'], [4, 'Sangat baik']]],
    ['Gesekan & geseran', [[1, 'Bermasalah'], [2, 'Potensial bermasalah'], [3, 'Tidak ada masalah']]],
  ].map(([label, o]) => ({ label, options: opts(o) })),
  bands: band([[9, 'risiko sangat tinggi'], [12, 'risiko tinggi'], [14, 'risiko sedang'], [18, 'risiko ringan'], [23, 'tanpa risiko']]),
});

// ───────── Lain-lain ─────────
const ICIQ = totalForm({
  id: 'iciq', name: 'ICIQ-UI SF', max: 21,
  items: [
    { label: 'Seberapa sering Anda mengompol', options: opts([[0, 'Tidak pernah'], [1, '≤ 1x / minggu'], [2, '2-3x / minggu'], [3, '1x / hari'], [4, 'Beberapa kali / hari'], [5, 'Terus-menerus']]) },
    { label: 'Jumlah kebocoran urin', options: opts([[0, 'Tidak ada'], [2, 'Sedikit'], [4, 'Sedang'], [6, 'Banyak']]) },
    { label: 'Gangguan pada kehidupan sehari-hari', scale: numScale('0 = tidak mengganggu · 10 = sangat mengganggu', range(0, 10)) },
  ],
  bands: band([[0, 'tanpa inkontinensia'], [5, 'ringan'], [12, 'sedang'], [18, 'berat'], [21, 'sangat berat']]),
});
const BEIGHTON = totalForm({
  id: 'beighton', name: 'Beighton Score', max: 9,
  items: ['Kelingking kanan ekstensi pasif > 90°', 'Kelingking kiri ekstensi pasif > 90°', 'Ibu jari kanan menyentuh lengan bawah', 'Ibu jari kiri menyentuh lengan bawah', 'Siku kanan hiperekstensi > 10°', 'Siku kiri hiperekstensi > 10°', 'Lutut kanan hiperekstensi > 10°', 'Lutut kiri hiperekstensi > 10°', 'Telapak tangan menyentuh lantai (lutut lurus)'].map((label) => ({ label, scale: { note: 'Positif (1) / negatif (0)', options: opts([[1, 'Positif'], [0, 'Negatif']]) } })),
  bands: (t) => (t >= 5 ? 'mendukung hipermobilitas generalisata (dewasa)' : t >= 4 ? 'batas hipermobilitas' : 'tidak hipermobil'),
});
const MRCSS = totalForm({
  id: 'mrcss', name: 'MRC Sum Score', max: 60,
  items: ['Abduksi bahu kanan', 'Abduksi bahu kiri', 'Fleksi siku kanan', 'Fleksi siku kiri', 'Ekstensi pergelangan kanan', 'Ekstensi pergelangan kiri', 'Fleksi pinggul kanan', 'Fleksi pinggul kiri', 'Ekstensi lutut kanan', 'Ekstensi lutut kiri', 'Dorsofleksi kanan', 'Dorsofleksi kiri'].map((label) => ({ label, scale: SCALE_MRC })),
  bands: (t) => (t < 48 ? 'kelemahan didapat di ICU' : 'tanpa kelemahan bermakna'),
});
const VSS = totalForm({
  id: 'vss', name: 'Vancouver Scar Scale', max: 13,
  items: [
    ['Pigmentasi', [[0, 'Normal'], [1, 'Hipopigmentasi'], [2, 'Hiperpigmentasi']]],
    ['Vaskularisasi', [[0, 'Normal'], [1, 'Merah muda'], [2, 'Merah'], [3, 'Ungu']]],
    ['Kelenturan', [[0, 'Normal'], [1, 'Lentur'], [2, 'Menurut (yielding)'], [3, 'Kaku'], [4, 'Berupa pita'], [5, 'Kontraktur']]],
    ['Tinggi parut', [[0, 'Rata'], [1, '< 2 mm'], [2, '2-5 mm'], [3, '> 5 mm']]],
  ].map(([label, o]) => ({ label, options: opts(o) })),
  bands: () => '0 = normal, 13 = parut terburuk',
});
const DN4 = totalForm({
  id: 'dn4', name: 'DN4', max: 10,
  items: ['Nyeri seperti terbakar', 'Sensasi dingin yang menyakitkan', 'Seperti tersengat listrik', 'Kesemutan', 'Seperti ditusuk jarum', 'Baal / mati rasa', 'Gatal', 'Berkurangnya sensasi sentuhan', 'Berkurangnya sensasi tusukan', 'Nyeri bertambah saat digosok ringan'].map((label) => ({ label, scale: YES_NO })),
  bands: (t) => (t >= 4 ? 'mendukung nyeri neuropatik' : 'kurang mendukung nyeri neuropatik'),
});

export const EXTRA_FORMS = {
  koos: KOOS,
  womac: WOMAC,
  faam: FAAM,
  kujala: KUJALA_FORM,
  dhi: DHI,
  fss: FSS,
  chalder: CHALDER,
  cat: CAT,
  hit6: HIT6,
  pcs: PCS,
  basdai: BASDAI,
  basfi: BASFI,
  nihss: NIHSS,
  sara: SARA,
  gcs: GCS,
  sppb: SPPB,
  minibest: MINIBEST,
  braden: BRADEN,
  iciq: ICIQ,
  beighton: BEIGHTON,
  mrcss: MRCSS,
  vss: VSS,
  dn4: DN4,
};
