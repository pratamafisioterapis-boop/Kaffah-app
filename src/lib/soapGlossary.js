// Kamus istilah fisioterapi untuk PDF SOAP pasien (klinik Kaffah).
// Tujuan: istilah medis tetap dipakai apa adanya, tetapi selalu disertai arti dalam bahasa awam.
// keys: kata kunci huruf kecil yang dicari di teks SOAP. test: true = tes pemeriksaan (hasil Positif/Negatif).

const G = (term, keys, lay, extra = {}) => ({ term, keys, lay, ...extra });

export const GLOSSARY = [
  // Pemeriksaan umum
  G('Anamnesis', ['anamnesis'], 'Wawancara awal tentang keluhan, riwayat, dan kebiasaan Anda.'),
  G('Inspeksi', ['inspeksi'], 'Pemeriksaan dengan melihat langsung postur, bentuk, dan warna kulit.'),
  G('Palpasi', ['palpasi'], 'Pemeriksaan dengan perabaan untuk menilai ketegangan otot, nyeri tekan, dan suhu kulit.'),
  G('ROM (Range of Motion)', ['rom', 'range of motion', 'lingkup gerak sendi'], 'Seberapa luas sendi Anda dapat digerakkan.'),
  G('End feel', ['end feel', 'endfeel'], 'Sensasi yang dirasakan terapis di ujung gerakan sendi, untuk menilai penyebab keterbatasan gerak.'),
  G('Kekuatan otot (MMT)', ['mmt', 'kekuatan otot', 'muscle strength'], 'Pengukuran kekuatan otot dengan skala 0-5 (5 = kekuatan normal).'),
  G('Skala nyeri (VAS/NRS)', ['vas', 'nrs'], 'Skala 0-10 untuk menyatakan tingkat nyeri (0 = tidak nyeri, 10 = nyeri terberat).'),
  G('Nyeri tekan', ['nyeri tekan'], 'Nyeri yang timbul saat area tersebut ditekan.'),
  G('Tightness', ['tightness', 'muscle tightness'], 'Otot terasa kencang/kaku sehingga kurang lentur.'),
  G('Spasme otot', ['spasme', 'spasm'], 'Otot menegang dan berkontraksi tanpa disengaja.'),
  G('Trigger point', ['trigger point'], 'Titik tegang di otot yang nyeri bila ditekan dan dapat menjalar ke area lain.'),
  G('Parestesia / baal / kesemutan', ['parestesia', 'kesemutan', 'baal'], 'Gangguan rasa pada kulit (kesemutan atau mati rasa), dapat menandakan saraf ikut terganggu.'),
  G('Radikulopati', ['radikulopati'], 'Gangguan akar saraf, biasanya nyeri atau kesemutan yang menjalar sepanjang lengan atau tungkai.'),
  G('Dermatom', ['dermatom'], 'Area kulit yang dipersarafi oleh satu akar saraf tertentu.'),
  G('Refleks', ['refleks patella', 'refleks achilles', 'refleks'], 'Respon otomatis tubuh yang dipakai untuk menilai kerja saraf.'),

  // Postur
  G('Forward head posture', ['forward head posture', 'fhp'], 'Posisi kepala condong ke depan dari garis tubuh, sering akibat duduk lama menunduk.'),
  G('Protracted shoulder', ['protracted shoulder', 'protraksi bahu', 'round shoulder'], 'Bahu tertarik ke depan (membulat), membuat otot dada memendek dan otot punggung atas tertarik.'),
  G('Kifosis', ['kifosis'], 'Lengkung punggung atas yang terlalu membungkuk.'),
  G('Lordosis', ['lordosis', 'hiperlordosis', 'hipolordosis'], 'Lengkung alami tulang belakang (leher/pinggang); bisa terlalu melengkung atau terlalu lurus.'),
  G('Skoliosis', ['skoliosis'], 'Tulang belakang melengkung ke samping.'),
  G('Lateral shift', ['lateral shift'], 'Tubuh bergeser ke satu sisi, sering terjadi karena nyeri pinggang.'),
  G('Antalgik', ['antalgik'], 'Cara berjalan/bergerak yang berubah untuk menghindari nyeri.'),
  G('Asimetris', ['asimetris'], 'Kiri dan kanan tampak tidak seimbang.'),
  G('Postural dysfunction', ['postural dysfunction', 'disfungsi postural'], 'Gangguan akibat postur atau kebiasaan sikap tubuh yang kurang baik dalam waktu lama.'),
  G('Overuse', ['overuse'], 'Beban pada jaringan terlalu sering atau terlalu berat sehingga tubuh belum sempat pulih.'),
  G('Ergonomi', ['ergonomi', 'ergonomis'], 'Pengaturan posisi kerja dan alat agar tubuh tidak terbebani.'),

  // Kondisi / struktur
  G('Myofascial Pain Syndrome', ['myofascial pain', 'mps'], 'Nyeri otot dan selaput otot (fascia) akibat titik-titik tegang pada otot.'),
  G('Tendinitis', ['tendinitis', 'tendinopati'], 'Peradangan atau iritasi pada tendon (tali penghubung otot ke tulang).'),
  G('Supraspinatus', ['supraspinatus'], 'Salah satu otot rotator cuff di puncak bahu yang membantu mengangkat lengan.'),
  G('Rotator cuff', ['rotator cuff'], 'Kelompok empat otot kecil yang menstabilkan sendi bahu.'),
  G('Upper trapezius', ['upper trapezius', 'upper trap'], 'Otot di sisi leher hingga puncak bahu; sering tegang saat stres atau duduk lama.'),
  G('Levator scapulae', ['levator scapulae'], 'Otot di samping belakang leher yang menarik tulang belikat ke atas.'),
  G('Pectoralis', ['pectoralis'], 'Otot dada; bila memendek akan menarik bahu ke depan.'),
  G('Shoulder girdle', ['shoulder girdle'], 'Rangkaian tulang belikat, tulang selangka, dan otot di sekitar bahu.'),
  G('Labrum', ['labrum'], 'Bantalan tulang rawan di tepi mangkuk sendi bahu yang menjaga kestabilan sendi.'),
  G('Impingement', ['impingement'], 'Jaringan lunak terjepit di dalam sendi saat bergerak (mis. bahu).'),
  G('HNP (Hernia Nukleus Pulposus)', ['hnp', 'hernia nukleus pulposus'], 'Bantalan antar-ruas tulang belakang menonjol dan dapat menekan saraf.'),
  G('Cervical / lumbal / thorakal', ['cervical', 'lumbal', 'thorakal'], 'Tulang belakang bagian leher (cervical), punggung atas (thorakal), dan pinggang (lumbal).'),
  G('Paraspinal', ['paraspinal'], 'Otot-otot yang berjalan di kiri dan kanan tulang belakang.'),
  G('SIJ (Sacroiliac Joint)', ['sij', 'sacroiliac'], 'Sendi di antara tulang panggul dan tulang ekor.'),
  G('Inflamasi', ['inflamasi'], 'Peradangan; tanda umumnya nyeri, bengkak, merah, dan hangat.'),
  G('Edema', ['edema', 'pembengkakan'], 'Penumpukan cairan sehingga area tampak bengkak.'),
  G('Hipomobilitas', ['hipomobilitas'], 'Pergerakan sendi lebih kaku dari seharusnya.'),
  G('Stabilitas sendi', ['stabilitas'], 'Kemampuan sendi dan otot sekitarnya menahan sendi tetap pada tempatnya.'),

  // Tes khusus
  G('Empty can test', ['empty can'], 'Menilai kondisi tendon supraspinatus bahu.', { test: true }),
  G('Hawkins-Kennedy test', ['hawkin', 'hawkins'], 'Menilai ada tidaknya jepitan jaringan di bahu (impingement).', { test: true }),
  G('Spurling test', ['spurling'], 'Menilai apakah akar saraf leher tertekan.', { test: true }),
  G('ULTT (Upper Limb Tension Test)', ['ultt'], 'Menilai ketegangan atau gangguan saraf pada lengan.', { test: true }),
  G('SLR (Straight Leg Raise)', ['slr', 'straight leg raise', 'lasegue'], 'Mengangkat tungkai lurus untuk menilai apakah saraf pinggang-tungkai tertekan.', { test: true }),
  G('Bragard test', ['bragard'], 'Pelengkap SLR untuk menilai ketegangan saraf tungkai.', { test: true }),
  G('Slump test', ['slump'], 'Menilai ketegangan saraf dari punggung hingga tungkai.', { test: true }),
  G('Neer test', ['neer'], 'Menilai jepitan jaringan di bahu.', { test: true }),
  G('Drop arm test', ['drop arm'], 'Menilai robekan rotator cuff pada bahu.', { test: true }),
  G('Phalen / Tinel test', ['phalen', 'tinel'], 'Menilai gangguan saraf di pergelangan tangan (carpal tunnel).', { test: true }),
  G('Finkelstein test', ['finkelstein'], 'Menilai radang tendon di sisi ibu jari pergelangan tangan.', { test: true }),
  G('Thomas test', ['thomas test'], 'Menilai kekakuan otot di depan panggul.', { test: true }),
  G('FABER / Patrick test', ['faber', 'patrick'], 'Menilai gangguan pada sendi panggul atau sendi sacroiliac.', { test: true }),
  G('Lachman / Anterior drawer test', ['lachman', 'anterior drawer'], 'Menilai kestabilan ligamen lutut (ACL) atau pergelangan kaki.', { test: true }),
  G('McMurray test', ['mcmurray'], 'Menilai kondisi bantalan (meniskus) lutut.', { test: true }),
  G('Valgus / varus stress test', ['valgus stress', 'varus stress'], 'Menilai kestabilan ligamen samping lutut.', { test: true }),
  G('Cervical Rotation / CRS', ['crs'], 'Tes gerak leher untuk melihat keterbatasan atau nyeri saat menoleh.', { test: true }),

  // Tindakan
  G('Ultrasound Therapy (US)', ['ultrasound', 'ultrasonik'], 'Gelombang suara frekuensi tinggi yang menghangatkan jaringan dalam, melancarkan sirkulasi, dan membantu penyembuhan.'),
  G('TENS', ['tens', 'transcutaneous electrical'], 'Aliran listrik ringan lewat bantalan di kulit untuk mengurangi nyeri; terasa seperti getaran/kesemutan halus.'),
  G('Interferensial (IFC)', ['ifc', 'interferensial', 'interferential'], 'Arus listrik ringan yang menembus lebih dalam untuk meredakan nyeri dan mengendurkan otot.'),
  G('Short Wave Diathermy (SWD)', ['swd', 'short wave', 'shortwave'], 'Pemanasan jaringan dalam dengan gelombang elektromagnetik untuk melemaskan otot dan melancarkan sirkulasi.'),
  G('Laser Therapy', ['laser'], 'Sinar berenergi rendah untuk membantu perbaikan jaringan dan mengurangi nyeri.'),
  G('Infrared (IR)', ['infrared', 'infra red'], 'Penghangat dengan sinar inframerah untuk merilekskan otot dan mengurangi nyeri.'),
  G('Hot pack / kompres hangat', ['hot pack', 'hotpack', 'kompres hangat'], 'Kompres hangat untuk melemaskan otot dan melancarkan aliran darah.'),
  G('Kompres dingin (cold pack)', ['cold pack', 'kompres dingin', 'icing'], 'Pendinginan area yang nyeri atau meradang untuk meredakan nyeri dan bengkak.'),
  G('Dry needling', ['dry needling'], 'Jarum steril halus pada titik tegang otot untuk melepas ketegangan dan mengurangi nyeri.'),
  G('Soft Tissue Release', ['soft tissue release'], 'Teknik manual menekan dan meregangkan jaringan lunak untuk melepas otot yang tegang.'),
  G('Myofascial Release', ['myofascial release'], 'Teknik manual lembut pada selaput otot (fascia) untuk mengurangi kekakuan.'),
  G('Mobilisasi sendi', ['mobilisasi', 'mulligan', 'maitland'], 'Gerakan lembut yang dilakukan terapis untuk melancarkan gerak sendi yang kaku.'),
  G('Traksi', ['traksi', 'traction'], 'Tarikan lembut pada tulang belakang untuk mengurangi tekanan pada saraf dan sendi.'),
  G('Taping / kinesio taping', ['taping', 'kinesio'], 'Plester elastis pada kulit untuk menopang otot/sendi dan mengurangi nyeri saat beraktivitas.'),
  G('Stretching', ['stretching', 'peregangan'], 'Latihan peregangan untuk memanjangkan otot yang kaku.'),
  G('Strengthening', ['strengthening', 'penguatan'], 'Latihan untuk menguatkan otot agar sendi lebih stabil dan terlindungi.'),
  G('Core stability', ['core stability', 'core stabilization'], 'Latihan penguat otot inti (perut dan punggung) untuk menopang tulang belakang.'),
  G('Mobility exercise', ['mobility exercise', 'latihan mobilitas'], 'Latihan gerak untuk menjaga atau meningkatkan keluasan gerak sendi.'),
  G('Postural exercise', ['postural exercise', 'latihan postur'], 'Latihan untuk memperbaiki sikap tubuh saat duduk, berdiri, dan beraktivitas.'),
  G('Home program', ['home program', 'latihan di rumah'], 'Latihan yang dilakukan sendiri di rumah sebagai kelanjutan terapi di klinik.'),
  G('Elektrofisis (EPA)', ['elektrofisis', 'epa'], 'Terapi dengan alat bantu listrik, panas, atau gelombang (mis. TENS, ultrasound).'),
];

const isWordChar = (c) => !!c && /[a-z0-9]/i.test(c);

const containsKey = (hay, key) => {
  const k = key.trim();
  let from = 0;
  for (;;) {
    const idx = hay.indexOf(k, from);
    if (idx === -1) return false;
    const before = hay[idx - 1];
    const after = hay[idx + k.length];
    if (!isWordChar(before) && !isWordChar(after)) return true;
    from = idx + 1;
  }
};

const norm = (text) => String(text || '').toLowerCase();

export const findGlossaryEntry = (text) => {
  const hay = norm(text);
  if (!hay) return null;
  return GLOSSARY.find((g) => g.keys.some((k) => containsKey(hay, k))) || null;
};

// Semua istilah yang muncul pada kumpulan teks, urut sesuai kamus.
export const collectGlossary = (texts) => {
  const hay = norm((texts || []).filter(Boolean).join('\n'));
  if (!hay) return [];
  return GLOSSARY.filter((g) => g.keys.some((k) => containsKey(hay, k)));
};

// Arti hasil tes untuk pasien awam.
export const explainTestResult = (value) => {
  const v = norm(value);
  if (/^\s*positif/.test(v)) return 'Positif: ditemukan tanda yang dicari pada tes ini.';
  if (/^\s*negatif/.test(v)) return 'Negatif: tanda yang dicari tidak ditemukan (kondisi baik).';
  return '';
};
