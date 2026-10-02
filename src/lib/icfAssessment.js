// Penyusun Assessment otomatis berformat ICF (International Classification of
// Functioning, Disability and Health, WHO 2001) dari teks Subjective + Objective.
//
// Cara kerja (deterministik, tanpa AI/jaringan, hasil selalu sama untuk teks sama):
//   1. Teks S & O dipecah per bagian ("Keluhan Utama: ...") lalu per klausa.
//   2. Setiap klausa dicocokkan dengan kamus kata kunci klinis -> kode ICF
//      (b = fungsi tubuh, s = struktur tubuh, d = aktivitas & partisipasi,
//      e = faktor lingkungan). Klausa yang dinegasikan ("tidak ada", "(-)",
//      "normal", "penuh") tidak menghasilkan kode.
//   3. Kualifier ICF (angka setelah titik, mis. b280.3) dihitung hanya bila ada
//      data yang mendukung, memakai pita persentase baku WHO:
//        0 = tidak ada (0-4%)  1 = ringan (5-24%)  2 = sedang (25-49%)
//        3 = berat (50-95%)    4 = lengkap (96-100%)
//      Skala nyeri 0-10 dan MMT 0-5 dikonversi ke persen defisit; skor
//      fungsional (NDI, ODI, SPADI, Barthel, LEFS, WOMAC) memakai persen
//      disabilitasnya. Tanpa data, kode ditampilkan tanpa kualifier.
//   4. Hasil berupa teks biasa yang bisa diedit terapis (Assessment tetap
//      keputusan klinis terapis; ini hanya draf berstruktur).
//
// Kode mengacu pada katalog resmi ICF WHO (tabel icf_codes di database, 1424
// kode). Hasil sengaja ringkas: hanya kode spesifik (tingkat 3-4) yang punya
// bukti langsung di teks S/O, maksimal 6 fungsi tubuh, 3 struktur, 5 aktivitas
// dan 2 faktor lingkungan. Judul kode memakai judul resmi dari database
// (parameter `titles`); bila belum termuat dipakai label bawaan di bawah.

// ───────────────────────── Kualifier ─────────────────────────

export const pctQualifier = (pct) => {
  if (pct == null || Number.isNaN(pct)) return null;
  if (pct < 5) return 0;
  if (pct < 25) return 1;
  if (pct < 50) return 2;
  if (pct < 96) return 3;
  return 4;
};

export const QUALIFIER_WORDS = ['tidak ada', 'ringan', 'sedang', 'berat', 'lengkap'];

const painQualifier = (nprs) => pctQualifier(nprs * 10);
// MMT 5 normal (0%), 4 (20%), 3 (40%), 2 (60%), 1 (80%), 0 (100%) defisit kekuatan.
const mmtQualifier = (mmt) => pctQualifier(((5 - mmt) / 5) * 100);
// Modified Ashworth 0..4 dipetakan langsung (1+ dianggap 1).
const ashworthQualifier = (v) => Math.max(0, Math.min(4, v));

// ───────────────────────── Wilayah tubuh ─────────────────────────
// painCode: kode b2801x. structs: [kode, nama] struktur tubuh (s).

const REGIONS = [
  { id: 'neck', label: 'leher', re: /\b(leher|servikal|cervical|tengkuk|nuchal)\b/i, pain: 'b28010', structs: [['s76000', 'Kolumna vertebralis servikal']] },
  { id: 'head', label: 'kepala', re: /\b(kepala|sefalgia|cephalgia|migrain|migraine|pelipis|dahi)\b/i, pain: 'b28010', structs: [['s710', 'Regio kepala & leher']] },
  { id: 'jaw', label: 'rahang/TMJ', re: /\b(rahang|tmj|temporomandibular)\b/i, pain: 'b28010', structs: [['s7103', 'Sendi regio kepala & leher']] },
  { id: 'shoulder', label: 'bahu', re: /\b(bahu|shoulder|skapula|scapula|rotator cuff|klavikula|supraspinatus)\b/i, pain: 'b28014', structs: [['s720', 'Regio bahu']] },
  { id: 'arm', label: 'lengan', re: /\blengan(?: atas| bawah)?\b/i, pain: 'b28014', structs: [['s730', 'Ekstremitas atas']] },
  { id: 'elbow', label: 'siku', re: /\b(siku|elbow|epikondil\w*|epicondyl\w*)\b/i, pain: 'b28014', structs: [['s73001', 'Sendi siku']] },
  { id: 'wrist', label: 'pergelangan tangan', re: /\b(pergelangan tangan|wrist|karpal|carpal)\b/i, pain: 'b28014', structs: [['s73011', 'Sendi pergelangan tangan']] },
  { id: 'hand', label: 'tangan/jari', re: /(?<!pergelangan )(?<!lengan )\b(tangan|telapak tangan|jari tangan|jempol tangan|hand|finger)\b|\bjari(?! kaki)\b/i, pain: 'b28014', structs: [['s7302', 'Tangan']] },
  { id: 'thoracic', label: 'punggung atas', re: /\b(thorak\w*|thorac\w*|toraks|torakal|punggung atas)\b/i, pain: 'b28013', structs: [['s76001', 'Kolumna vertebralis torakal']] },
  { id: 'lumbar', label: 'punggung bawah', re: /\b(pinggang|lumbal|lumbar|punggung bawah|lbp|low back)\b/i, pain: 'b28013', structs: [['s76002', 'Kolumna vertebralis lumbal']] },
  { id: 'sacral', label: 'sakrum', re: /\b(sakrum|sacrum|sakral)\b/i, pain: 'b28013', structs: [['s76003', 'Kolumna vertebralis sakral']] },
  { id: 'sij', label: 'sendi sakroiliaka', re: /\b(sakroiliaka|sacroiliac|sij)\b/i, pain: 'b28013', structs: [['s7401', 'Sendi regio pelvis']] },
  { id: 'coccyx', label: 'tulang ekor', re: /\b(tulang ekor|koksigeus|coccyx|coccydynia)\b/i, pain: 'b28013', structs: [['s76004', 'Kolumna vertebralis koksigeal']] },
  { id: 'back', label: 'punggung', re: /\bpunggung\b(?! (?:atas|bawah))/i, pain: 'b28013', structs: [['s760', 'Struktur batang tubuh']] },
  { id: 'pelvis', label: 'panggul', re: /\b(panggul|pelvis|pelvic|bokong|selangkangan|groin)\b/i, pain: 'b28012', structs: [['s740', 'Regio pelvis']] },
  { id: 'hip', label: 'pinggul', re: /\b(pinggul|hip|gluteal|glute)\b/i, pain: 'b28015', structs: [['s75001', 'Sendi panggul (hip)']] },
  { id: 'thigh', label: 'paha', re: /\b(paha|thigh|hamstring|quadriceps|kuadrisep|kuadriseps)\b/i, pain: 'b28015', structs: [['s7500', 'Paha']] },
  { id: 'knee', label: 'lutut', re: /\b(lutut|knee|patella|meniskus|menisci|meniscus)\b/i, pain: 'b28015', structs: [['s75011', 'Sendi lutut']] },
  { id: 'leg', label: 'tungkai bawah', re: /\b(betis|tungkai bawah|tibia|tulang kering|shin)\b/i, pain: 'b28015', structs: [['s7501', 'Tungkai bawah']] },
  { id: 'ankle', label: 'pergelangan kaki', re: /\b(pergelangan kaki|ankle|mata kaki|malleolus|malleolar)\b/i, pain: 'b28015', structs: [['s75021', 'Sendi pergelangan kaki']] },
  { id: 'foot', label: 'kaki', re: /(?<!pergelangan )\b(kaki|telapak kaki|tumit|plantar|jari kaki|foot|heel)\b/i, pain: 'b28015', structs: [['s7502', 'Pergelangan & telapak kaki']] },
  { id: 'leglimb', label: 'tungkai', re: /\btungkai\b(?! bawah)/i, pain: 'b28015', structs: [['s750', 'Ekstremitas bawah']] },
  { id: 'chest', label: 'dada', re: /\b(dada|rusuk|iga|thorax)\b/i, pain: 'b28011', structs: [] },
  { id: 'abdomen', label: 'perut', re: /\b(perut|abdomen|abdominal)\b/i, pain: 'b28012', structs: [] },
];

const PAIN_CODE_LABEL = {
  b28010: 'Nyeri kepala & leher',
  b28011: 'Nyeri dada',
  b28012: 'Nyeri perut/pelvis',
  b28013: 'Nyeri punggung',
  b28014: 'Nyeri ekstremitas atas',
  b28015: 'Nyeri ekstremitas bawah',
};

const regionsIn = (text) => REGIONS.filter((r) => r.re.test(text));

// ───────────────────────── Aturan kata kunci ─────────────────────────
// source: 'S' | 'O' | 'SO'. normalNeg: kata "normal/penuh/baik" menegasikan.
// needs: (opsional) klausa harus juga cocok dengan regex ini agar dihitung.

const RULES = [
  // Fungsi mental & sensorik
  { id: 'sleep', code: 'b134', label: 'Sleep functions', re: /\b(gangguan tidur|susah tidur|sulit tidur|tidur terganggu|terbangun(?: malam)?|insomnia|kurang tidur|tidur tidak nyenyak)\b/i, source: 'S' },
  { id: 'emotion', code: 'b152', label: 'Fungsi emosi (cemas/stres/mood)', re: /\b(cemas|ansietas|anxiety|stres|stress|depresi|mood|takut bergerak|kinesiofobia|khawatir|panik)\b/i, source: 'S' },
  { id: 'energy', code: 'b4552', label: 'Fatiguability (mudah lelah)', re: /\b(lelah|kelelahan|fatigue|lemas|letih|capek)\b/i, source: 'SO' },
  { id: 'dizzy', code: 'b2401', label: 'Sensasi pusing/vertigo', re: /\b(pusing|vertigo|berputar|melayang|dizziness)\b/i, source: 'SO' },
  { id: 'tinnitus', code: 'b2400', label: 'Tinitus (berdenging di telinga)', re: /\b(tinitus|tinnitus|berdenging)\b/i, source: 'SO' },
  { id: 'balance', code: 'b2351', label: 'Vestibular function of balance', re: /\b(keseimbangan|balance|romberg|tandem|berg|limit of stability|mini-?bestest|tinetti|sering jatuh|riwayat jatuh|risiko jatuh)\b/i, source: 'SO', normalNeg: true },
  { id: 'postural', code: 'b755', label: 'Reaksi gerak involunter (reaksi postural/protektif)', re: /\b(reaksi (?:perlindungan|postural|keseimbangan)|righting|reaksi protektif)\b/i, source: 'O', normalNeg: true },
  { id: 'proprio', code: 'b260', label: 'Fungsi propriosepsi', re: /\b(propriosepsi|proprioception|joint position sense|rasa posisi sendi)\b/i, source: 'O', normalNeg: true },
  { id: 'tingling', code: 'b840', label: 'Sensasi terkait kulit (kesemutan)', re: /\b(kesemutan|tingling|parestesia|paresthesia|rasa terbakar|burning)\b/i, source: 'SO' },
  { id: 'numb', code: 'b265', label: 'Fungsi sentuh/raba (baal/hipestesia)', re: /\b(baal|mati rasa|kebas|hipestesia|hipoestesia|hypoesthesia|sensasi raba menurun|gangguan sensorik|sensorik terganggu)\b/i, source: 'SO' },

  // Respirasi & kardiovaskular
  { id: 'dyspnea', code: 'b460', label: 'Sensasi sesak napas', re: /\b(sesak|napas pendek|nafas pendek|dispnea|dyspnea)\b/i, source: 'SO' },
  { id: 'resp', code: 'b440', label: 'Fungsi pernapasan', re: /\b(takipnea|mengi|pursed-?lip|wheezing)\b/i, source: 'SO' },
  { id: 'respmuscle', code: 'b4452', label: 'Functions of accessory respiratory muscles', re: /\b(otot bantu napas|otot bantu nafas)\b/i, source: 'O' },
  { id: 'cough', code: 'b450', label: 'Fungsi pernapasan tambahan (batuk/dahak)', re: /\b(batuk|sputum|dahak)\b/i, source: 'SO' },
  { id: 'exercisetol', code: 'b455', label: 'Toleransi latihan/aktivitas', re: /\b(toleransi (?:aktivitas|latihan)|6mwt|borg|mmrc|desaturasi|kapasitas fungsional|jarak jalan sebelum sesak)\b/i, source: 'SO' },
  { id: 'swallow', code: 'b5105', label: 'Swallowing', re: /\b(disfagia|sulit menelan|tersedak|menelan terganggu)\b/i, source: 'SO' },
  { id: 'speech', code: 'b320', label: 'Fungsi artikulasi (bicara)', re: /\b(disartria|dysarthria|bicara pelo|pelo)\b/i, source: 'SO' },
  { id: 'language', code: 'b167', label: 'Fungsi mental bahasa', re: /\b(afasia|aphasia)\b/i, source: 'SO' },
  { id: 'bladder', code: 'b6202', label: 'Urinary continence', re: /\b(inkontinensia urin|inkontinensia|ngompol)\b/i, source: 'SO' },
  { id: 'bowel', code: 'b5253', label: 'Faecal continence', re: /\b(inkontinensia alvi|tidak bisa menahan bab)\b/i, source: 'SO' },
  { id: 'edema', code: 'b4352', label: 'Functions of lymphatic vessels (edema)', re: /\b(edema|oedema|bengkak|pembengkakan|swelling|efusi)\b/i, source: 'SO', normalNeg: true },
  { id: 'wound', code: 'b820', label: 'Fungsi perbaikan kulit (luka/jaringan parut)', re: /\b(luka|ulkus|ulcer|dekubitus|jaringan parut|bekas luka|scar|keloid)\b/i, source: 'SO' },
  { id: 'skin', code: 'b810', label: 'Fungsi proteksi kulit', re: /\b(ruam|kemerahan kulit|eritema|kulit kering|lecet)\b/i, source: 'SO' },

  // Neuromuskuloskeletal & gerak
  { id: 'jointstab', code: 'b715', label: 'Stabilitas sendi', re: /\b(instabilitas|ketidakstabilan|laksitas|lax\b|longgar|lachman|drawer|giving way|dislokasi|subluksasi|hipermobil\w*)\b/i, source: 'SO', normalNeg: true },
  { id: 'tone', code: 'b735', label: 'Fungsi tonus otot', re: /\b(tonus|spastisitas|spastik|rigiditas|rigid|hipertonus|hipertoni|hipotonus|hipotoni|flaksid|flaccid|ashworth)\b/i, source: 'SO', normalNeg: true },
  { id: 'stiffness', code: 'b7800', label: 'Sensasi kekakuan otot/sendi', re: /\b(kaku|kekakuan|stiffness|kaku pagi)\b/i, source: 'SO', normalNeg: true, skipIf: /\b(kaku sendi)\b/i },
  { id: 'spasm', code: 'b7801', label: 'Sensasi spasme/ketegangan otot', re: /\b(spasme|spasm|taut band|trigger point|kram|keram|tegang|muscle guarding|guarding|otot menegang)\b/i, source: 'SO' },
  { id: 'coordination', code: 'b7602', label: 'Coordination of voluntary movements', re: /\b(koordinasi|ataksia|ataxia|dismetria|disdiadokokinesia|kontrol motorik|kontrol postur|kontrol gerak)\b/i, source: 'SO', normalNeg: true },
  { id: 'involuntary', code: 'b7651', label: 'Tremor', re: /\b(tremor)\b/i, source: 'SO' },
  { id: 'gait', code: 'b770', label: 'Pola berjalan', re: /\b(pincang|limping|drop foot|trendelenburg|waddling|menyeret kaki|(?:gaya jalan|gait|jalan)\s+(?:antalgik|abnormal|terganggu|tidak normal|asimetris|lambat|ataksik|spastik|hati-hati))\b/i, source: 'O', normalNeg: true },
  { id: 'endurance', code: 'b740', label: 'Fungsi daya tahan otot', re: /\b(daya tahan otot|endurans|endurance|sit-?to-?stand|1-?min sts|heel raise|plank)\b/i, source: 'O' },
];

// Aktivitas & partisipasi (S dan O, kecuali bagian tujuan/harapan).
const ACTIVITY_RULES = [
  { id: 'walk', code: 'd450', label: 'Berjalan', re: /\b(berjalan|jalan kaki|jalan jauh|jarak jalan|sulit jalan|gaya jalan|gait)\b/i },
  { id: 'climb', code: 'd4551', label: 'Memanjat/naik-turun tangga', re: /\b(naik tangga|turun tangga|naik-turun tangga|tangga)\b/i },
  { id: 'run', code: 'd4552', label: 'Berlari', re: /\b(berlari|lari)\b/i },
  { id: 'position', code: 'd410', label: 'Mengubah posisi tubuh dasar (bangkit dari duduk, berbalik)', re: /\b(bangun dari|bangkit dari|berdiri dari|sit-?to-?stand|berbalik|miring ke|bangun tidur|duduk ke berdiri|tempat tidur ke)\b/i },
  { id: 'bend', code: 'd4105', label: 'Membungkuk', re: /\b(membungkuk|menunduk|bungkuk)\b/i },
  { id: 'squat', code: 'd4101', label: 'Jongkok', re: /\b(jongkok|berjongkok)\b/i },
  { id: 'kneel', code: 'd4102', label: 'Berlutut', re: /\b(berlutut|bersimpuh)\b/i },
  { id: 'sit', code: 'd4153', label: 'Mempertahankan posisi duduk', re: /\b(duduk lama|lama duduk|tidak tahan duduk|duduk terlalu lama|sulit duduk)\b/i },
  { id: 'stand', code: 'd4154', label: 'Mempertahankan posisi berdiri', re: /\b(berdiri lama|lama berdiri|tidak tahan berdiri|berdiri terlalu lama|sulit berdiri)\b/i },
  { id: 'transfer', code: 'd420', label: 'Berpindah (transfer)', re: /\b(transfer|berpindah|pindah dari)\b/i },
  { id: 'lift', code: 'd4300', label: 'Lifting', re: /\b(mengangkat|angkat beban|membawa beban|menjinjing|mengangkut|membawa barang)\b/i },
  { id: 'hand', code: 'd4401', label: 'Grasping', re: /\b(menggenggam|genggam|menulis|mengancing|kancing|memegang|memungut|menjepit|membuka botol|membuka tutup)\b/i },
  { id: 'reach', code: 'd4452', label: 'Reaching', re: /\b(menjangkau|mengangkat tangan|mengangkat lengan|di atas kepala|menyisir|keramas|menggapai|mendorong|menarik)\b/i },
  { id: 'wash', code: 'd510', label: 'Mencuci diri (mandi)', re: /\b(mandi|memandikan)\b/i },
  { id: 'toilet', code: 'd530', label: 'Buang air (toileting)', re: /\b(ke toilet|toileting|jongkok di toilet|buang air)\b/i },
  { id: 'dress', code: 'd540', label: 'Berpakaian', re: /\b(berpakaian|memakai baju|memakai celana|pakai baju|pakai celana|kaus kaki|memakai sepatu|pakai sepatu)\b/i },
  { id: 'eat', code: 'd550', label: 'Makan', re: /\b(makan|menyuap)\b/i },
  { id: 'meal', code: 'd630', label: 'Menyiapkan makanan', re: /\b(memasak|menyiapkan makanan)\b/i },
  { id: 'house', code: 'd640', label: 'Pekerjaan rumah tangga', re: /\b(menyapu|mengepel|mencuci pakaian|mencuci baju|menyetrika|pekerjaan rumah|mengurus rumah|membersihkan rumah)\b/i },
  { id: 'adl', code: 'd230', label: 'Melakukan rutinitas harian', re: /\b(aktivitas sehari-?hari|aktivitas harian|adl)\b/i },
  { id: 'drive', code: 'd4751', label: 'Driving motorized vehicles', re: /\b(mengemudi|menyetir|berkendara|naik motor|mengendarai)\b/i },
  { id: 'work', code: 'd850', label: 'Pekerjaan/mencari nafkah', re: /\b(bekerja|pekerjaan|kerja|kantor|mengetik|komputer|mengajar|berdagang)\b/i },
  { id: 'sport', code: 'd9201', label: 'Olahraga', re: /\b(olahraga|futsal|sepak bola|bulu tangkis|badminton|basket|voli|gym|renang|bersepeda|senam|fitness|jogging)\b/i },
  { id: 'worship', code: 'd930', label: 'Agama & spiritualitas (ibadah)', re: /\b(sholat|shalat|salat|sujud|rukuk|ruku|duduk tahiyat|duduk tasyahud|ibadah)\b/i },
  { id: 'social', code: 'd910', label: 'Kehidupan komunitas/sosial', re: /\b(bersosialisasi|kegiatan sosial|kegiatan masyarakat|kehidupan sosial)\b/i },
];

// Kata yang menandakan keterbatasan (dipakai bersama aturan aktivitas)
const LIMIT_WORDS = /\b(sulit|susah|tidak (?:bisa|mampu|kuat|tahan)|kesulitan|terbatas|terganggu|nyeri saat|nyeri ketika|nyeri bila|nyeri jika|sakit saat|tak mampu|berkurang|menurun|dibantu|butuh bantuan|bergantung|tergantung|lama|keluhan saat|memberat saat|memburuk saat|terhambat|sulit untuk|ngilu saat)\b/i;

// Faktor lingkungan
const ENV_RULES = [
  { id: 'walkaid', code: 'e1201', label: 'Alat bantu mobilitas', re: /\b(tongkat|walker|kruk|kursi roda|alat bantu jalan|crutch|cane)\b/i },
  { id: 'orthosis', code: 'e1151', label: 'Alat bantu kehidupan sehari-hari (ortosis/korset/brace)', re: /\b(korset|brace|collar|bidai|splint|ortosis|insole|sepatu khusus|penyangga)\b/i },
  { id: 'drug', code: 'e1101', label: 'Obat-obatan', re: /\b(obat|analgesik|nsaid|parasetamol|paracetamol|ibuprofen|injeksi|inhaler|relaksan)\b/i },
  { id: 'family', code: 'e310', label: 'Dukungan keluarga inti', re: /\b(dukungan keluarga|keluarga mendukung|didampingi keluarga|dibantu keluarga|didampingi istri|didampingi suami|dibantu anak)\b/i },
  { id: 'home', code: 'e155', label: 'Desain bangunan tempat tinggal (hambatan rumah)', re: /\b(lantai licin|toilet jongkok|rumah bertingkat|tangga di rumah|kamar mandi licin|kasur (?:keras|lunak|empuk)|kasur terlalu)\b/i },
];

// ───────────────────────── Utilitas teks ─────────────────────────

const clean = (t) => String(t || '').replace(/\*\*/g, '').replace(/ /g, ' ').replace(/[−–]/g, '-');

const GOAL_RE = /^\s*(harapan|tujuan|goal|target)\b/i;
const SKIP_SECTION_RE = /red\s*flag|bendera merah/i;

// Teks -> [{ title, clauses: [string] }]
const toSections = (text) => {
  const sections = [];
  let cur = { title: '', body: '' };
  const push = () => { if (cur.body.trim()) sections.push(cur); };
  clean(text).split(/\n+/).forEach((line) => {
    const m = line.match(/^\s*([A-Za-zÀ-ÿ /&()-]{2,40}):\s*(.*)$/);
    if (m && !/^\d/.test(m[1])) {
      push();
      cur = { title: m[1].trim(), body: m[2] };
    } else {
      cur.body += ` . ${line}`;
    }
  });
  push();
  return sections
    .filter((s) => !SKIP_SECTION_RE.test(s.title))
    .map((s) => ({
      title: s.title,
      clauses: s.body
        .replace(/(\d)\.(\d)/g, '$1§$2')
        .split(/[.;|\n]+/)
        .map((c) => c.replace(/§/g, '.').trim())
        .filter((c) => c && !GOAL_RE.test(c)),
    }))
    .filter((s) => s.clauses.length);
};

// Apakah kemunculan kata kunci di indeks idx dinegasikan?
const WORD = '[\\p{L}-]+';
const NEG_AFTER = new RegExp(`^(?:\\s+${WORD}){0,2}\\s*[:\\-]?\\s*(?:\\(\\s*-\\s*\\)|negatif\\b|tidak ada\\b|tidak(?=\\s*(?:[,.)]|$)))`, 'iu');
const NORMAL_AFTER = new RegExp(`^(?:\\s+${WORD}){0,2}\\s*[:\\-]?\\s*(?:normal|penuh|baik|simetris|utuh|intak|dalam batas normal|tidak terbatas|tidak ada keluhan)\\b`, 'iu');
const NEG_BEFORE = /(?:tidak(?: ada| mengalami| ditemukan| tampak| merasa| ada keluhan)?|tanpa|bebas(?: dari)?|bukan|menyangkal)\s+(?:\p{L}+\s+){0,1}$/iu;

const isNegated = (clause, idx, len, normalNeg) => {
  const before = clause.slice(Math.max(0, idx - 28), idx);
  if (NEG_BEFORE.test(before)) return true;
  const after = clause.slice(idx + len, idx + len + 60);
  if (NEG_AFTER.test(after)) return true;
  return !!normalNeg && NORMAL_AFTER.test(after);
};

const firstAffirmed = (clause, re, normalNeg) => {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let m;
  while ((m = g.exec(clause))) {
    if (!isNegated(clause, m.index, m[0].length, normalNeg)) return m;
    if (m[0].length === 0) g.lastIndex += 1;
  }
  return null;
};

const NUM = (s) => Number(String(s).replace(',', '.'));

// ───────────────────────── Ekstraksi nilai ─────────────────────────

const collectPain = (sections) => {
  const values = [];
  sections.forEach((sec) => sec.clauses.forEach((c) => {
    const hasPainWord = /\b(nyeri|vas|nrs|nprs|skala nyeri|intensitas)\b/i.test(c);
    if (!hasPainWord) return;
    let m;
    const slash = /\b(\d{1,2}(?:[.,]\d)?)\s*\/\s*10\b/g;
    while ((m = slash.exec(c))) { const v = NUM(m[1]); if (v >= 0 && v <= 10) values.push(v); }
    const labelled = /\b(?:sekarang|saat ini|terburuk|tertinggi|rata-rata|terendah|diam|gerak|aktivitas|vas|nrs|nprs)\s*[:=]?\s*(\d{1,2}(?:[.,]\d)?)(?!\s*[/\d%])/gi;
    while ((m = labelled.exec(c))) { const v = NUM(m[1]); if (v >= 0 && v <= 10) values.push(v); }
  }));
  return values;
};

const collectMmt = (sections) => {
  const values = [];
  sections.forEach((sec) => sec.clauses.forEach((c) => {
    if (!/\b(mmt|kekuatan(?: otot)?)\b/i.test(c)) return;
    const stripped = c.replace(/\(\s*0\s*-\s*5\s*\)/g, '').replace(/\b0\s*-\s*5\b/g, '');
    let m;
    const g = /\b([0-5])\s*[+-]?\s*(?:\/\s*5)?(?![\d%.])/g;
    const after = stripped.split(/\b(?:mmt|kekuatan(?: otot)?)\b/i).slice(1).join(' ');
    while ((m = g.exec(after))) values.push(Number(m[1]));
  }));
  return values;
};

const collectAshworth = (sections) => {
  const values = [];
  sections.forEach((sec) => sec.clauses.forEach((c) => {
    const m = c.match(/ashworth[^0-9]{0,15}([0-4])\s*\+?/i);
    if (m) values.push(Number(m[1]));
  }));
  return values;
};

// Skor fungsional -> persen disabilitas (0-100, makin tinggi makin berat)
const FUNCTIONAL_PATTERNS = [
  { name: 'NDI', re: /(?:neck disability index|\bndi\b)[^0-9]{0,12}(\d+(?:[.,]\d+)?)\s*%/i, toPct: (v) => v },
  { name: 'ODI', re: /(?:oswestry disability index|\bodi\b)[^0-9]{0,12}(\d+(?:[.,]\d+)?)\s*%/i, toPct: (v) => v },
  { name: 'SPADI', re: /\bspadi\b[^0-9]{0,12}(\d+(?:[.,]\d+)?)\s*%/i, toPct: (v) => v },
  { name: 'QuickDASH/DASH', re: /\b(?:quickdash|dash)\b[^0-9]{0,12}(\d+(?:[.,]\d+)?)\s*(?:%|\/\s*100)/i, toPct: (v) => v },
  { name: 'Barthel Index', re: /barthel(?: index)?\s*(\d+)\s*\/\s*100/i, toPct: (v) => 100 - v },
  { name: 'LEFS', re: /\blefs\b[^0-9]{0,12}(\d+)\s*\/\s*80/i, toPct: (v) => ((80 - v) / 80) * 100 },
  { name: 'WOMAC', re: /\bwomac\b[^0-9]{0,12}(\d+)\s*\/\s*96/i, toPct: (v) => (v / 96) * 100 },
];

const collectFunctional = (text) => {
  const t = clean(text);
  return FUNCTIONAL_PATTERNS.map((p) => {
    const m = t.match(p.re);
    if (!m) return null;
    const raw = NUM(m[1]);
    const pct = Math.max(0, Math.min(100, p.toPct(raw)));
    return { name: p.name, raw: m[0].trim(), pct, q: pctQualifier(pct) };
  }).filter(Boolean);
};

// ───────────────────────── Penyusunan ─────────────────────────

const fmt = (code, q) => (q == null ? code : `${code}.${q}`);

const addTo = (map, code, label, extra = {}) => {
  if (!map.has(code)) map.set(code, { code, label, details: [], q: null, ...extra });
  return map.get(code);
};

const uniq = (arr) => [...new Set(arr.filter(Boolean))];

/**
 * Susun hasil ICF terstruktur dari S, O, dan label diagnosa.
 * @returns {{ b: Array, s: Array, d: Array, e: Array, functional: Array, hasData: boolean }}
 */
export const analyzeIcf = ({ subjective = '', objective = '', diagnoses = [] } = {}) => {
  const sSections = toSections(subjective);
  const oSections = toSections(objective);
  const all = [...sSections.map((s) => ({ ...s, src: 'S' })), ...oSections.map((s) => ({ ...s, src: 'O' }))];
  const diagText = clean(diagnoses.join(' ; '));

  const b = new Map();
  const structCodes = new Map();
  const problemRegions = new Set();

  // Nyeri
  const painSites = new Map(); // pain code -> Set(label)
  const painRegionIds = new Set();
  let painFound = false;
  let radiating = false;
  const mainComplaintRegions = [];
  all.forEach((sec) => {
    if (/keluhan utama/i.test(sec.title)) sec.clauses.forEach((c) => regionsIn(c).forEach((r) => mainComplaintRegions.push(r)));
  });

  all.forEach((sec) => sec.clauses.forEach((c) => {
    const radiates = /\b(menjalar|radiasi|radikular|radikulopati|radiating)\b/i.test(c) && !/tidak menjalar|menjalar tidak|menjalar\s*\(-\)/i.test(c);
    const m = firstAffirmed(c, /\b(nyeri|(?<!rumah )sakit|pegal|ngilu|linu|cekot|nyut-?nyutan)\b/i, false);
    if (!m && !radiates) return;
    painFound = true;
    if (radiates) radiating = true;
    const regs = regionsIn(c);
    const use = regs.length ? regs : mainComplaintRegions;
    use.forEach((r) => {
      painRegionIds.add(r.id);
      problemRegions.add(r.id);
      if (!painSites.has(r.pain)) painSites.set(r.pain, new Set());
      painSites.get(r.pain).add(r.label);
    });
  }));
  if (painFound && painSites.size === 0) {
    regionsIn(diagText).forEach((r) => {
      painRegionIds.add(r.id);
      problemRegions.add(r.id);
      if (!painSites.has(r.pain)) painSites.set(r.pain, new Set());
      painSites.get(r.pain).add(r.label);
    });
  }
  const painVals = collectPain(all);
  const painMax = painVals.length ? Math.max(...painVals) : null;
  const painQ = painMax == null ? null : painQualifier(painMax);
  const painDetail = painMax == null ? null : `skala nyeri tertinggi ${painMax}/10`;
  if (painFound) {
    if (painSites.size >= 3) {
      const e = addTo(b, 'b2802', 'Nyeri di beberapa bagian tubuh');
      e.q = painQ;
      e.details.push(`area: ${uniq([...painSites.values()].flatMap((s) => [...s])).join(', ')}`);
      if (painDetail) e.details.push(painDetail);
    } else if (painSites.size > 0) {
      painSites.forEach((labels, code) => {
        const e = addTo(b, code, PAIN_CODE_LABEL[code] || 'Nyeri pada bagian tubuh');
        e.q = painQ;
        e.details.push(`area: ${[...labels].join(', ')}`);
        if (painDetail) e.details.push(painDetail);
      });
    } else {
      const e = addTo(b, 'b280', 'Sensasi nyeri');
      e.q = painQ;
      if (painDetail) e.details.push(painDetail);
    }
    if (all.some((sec) => sec.clauses.some((c) => /\bsendi\b/i.test(c) && /\bnyeri\b/i.test(c)))) {
      const e = addTo(b, 'b28016', 'Nyeri pada sendi');
      e.q = painQ;
    }
    if (radiating) {
      const dermatomal = /\b(radikulopati|radiculopathy|dermatom|hnp|hernia nukleus|lasegue|spurling|saraf terjepit|saraf kejepit|skiatika|sciatica|ischialgia)\b/i;
      const hit = dermatomal.test(`${all.map((sec) => sec.clauses.join(' ')).join(' ')} ${diagText}`);
      const e = hit ? addTo(b, 'b2803', 'Radiating pain in a dermatome') : addTo(b, 'b2804', 'Radiating pain in a segment or region');
      e.q = painQ;
      structCodes.set('s1201', 'Spinal nerves');
    }
  }

  // Mobilitas sendi (b710) + kekuatan otot (b730)
  const regionLabels = (c) => {
    const regs = regionsIn(c);
    regs.forEach((r) => problemRegions.add(r.id));
    return regs.map((r) => r.label);
  };
  const fallbackLabels = () => uniq([...painRegionIds].map((id) => REGIONS.find((r) => r.id === id)?.label));

  all.forEach((sec) => sec.clauses.forEach((c) => {
    if (/\b(rom|lgs|lingkup gerak|keterbatasan gerak|gerak(?:an)? terbatas|end ?feel|fleksi|ekstensi|abduksi|adduksi|rotasi|goniometer|dorsofleksi|plantarfleksi)\b/i.test(c)) {
      const limited = /\b(terbatas|menurun|berkurang|kaku|hipomobil\w*|restriksi|limited|capsular pattern|nyeri)\b/i.test(c);
      const full = /\b(penuh|normal|full|baik|dalam batas normal)\b/i.test(c) && !/\bterbatas\b/i.test(c);
      const negated = /\b(?:tidak|tanpa)\s+(?:ada\s+)?(?:keterbatasan|terbatas)\b/i.test(c);
      if (limited && !full && !negated) {
        const labs = regionLabels(c);
        const where = labs.length ? labs : fallbackLabels();
        const e = addTo(b, where.length > 1 ? 'b7101' : 'b7100', where.length > 1 ? 'Mobility of several joints' : 'Mobility of a single joint');
        e.details.push(...where.map((w) => `ROM ${w} terbatas`));
        if (!where.length) e.details.push('ROM terbatas');
      }
    }
    if (/\b(mmt|kekuatan(?: otot)?|kelemahan|lemah|parese|paresis|plegia|hemiparese|hemiparesis|hemiplegia|monoparese)\b/i.test(c)) {
      const normal = /\b(kekuatan(?: otot)?\s*(?:normal|baik))\b/i.test(c);
      const weakAffirmed = firstAffirmed(c, /\b(kelemahan|lemah|parese|paresis|plegia|hemiparese|hemiparesis|hemiplegia|monoparese)\b/i, false);
      const mmts = collectMmt([{ clauses: [c] }]).filter((v) => v <= 4);
      if (!normal && (weakAffirmed || mmts.length)) {
        const e = addTo(b, 'b7300', 'Power of isolated muscles and muscle groups');
        const labs = regionLabels(c);
        if (labs.length) e.details.push(`otot ${labs.join(', ')}`);
      }
    }
  }));
  if (b.has('b7300')) {
    const vals = collectMmt(all).filter((v) => v <= 4);
    if (vals.length) {
      const worst = Math.min(...vals);
      b.get('b7300').q = mmtQualifier(worst);
      b.get('b7300').details.push(`MMT terendah ${worst}/5`);
    }
  }
  if (b.has('b735')) {
    const ash = collectAshworth(all);
    if (ash.length) {
      const hi = Math.max(...ash);
      b.get('b735').q = ashworthQualifier(hi);
      b.get('b735').details.push(`Ashworth ${hi}`);
    }
  }

  // Aturan kata kunci fungsi tubuh
  RULES.forEach((rule) => {
    all.forEach((sec) => {
      if (rule.source !== 'SO' && rule.source !== sec.src) return;
      sec.clauses.forEach((c) => {
        if (rule.skipIf && rule.skipIf.test(c)) return;
        const m = firstAffirmed(c, rule.re, rule.normalNeg);
        if (!m) return;
        const e = addTo(b, rule.code, rule.label);
        const labs = regionLabels(c);
        if (['b735', 'b7800', 'b7801', 'b715', 'b840', 'b265', 'b4352'].includes(rule.code) && labs.length) {
          labs.forEach((l) => { if (!e.details.includes(`area: ${l}`)) e.details.push(`area: ${l}`); });
        }
      });
    });
  });

  // Struktur tubuh
  const finalRegionIds = problemRegions.size ? problemRegions : new Set(regionsIn(diagText).map((r) => r.id));
  finalRegionIds.forEach((id) => {
    const r = REGIONS.find((x) => x.id === id);
    r?.structs.forEach(([code, name]) => structCodes.set(code, name));
  });
  const neuroText = `${all.map((s) => s.clauses.join(' ')).join(' ')} ${diagText}`;
  if (/\b(radikulopati|radiculopathy|hnp|hernia nukleus|saraf terjepit|saraf kejepit|lasegue|slr (?:positif|\(\+\))|spurling|neuropati|carpal tunnel|ischialgia|skiatika|sciatica)\b/i.test(neuroText)) {
    structCodes.set('s1201', 'Saraf spinal');
  }
  if (/\b(stroke|cva|hemiplegia|hemiparesis|hemiparese|cedera kepala|parkinson|palsi serebral|cerebral palsy)\b/i.test(neuroText)) {
    structCodes.set('s110', 'Struktur otak');
  }
  if (/\b(paru|pneumonia|ppok|copd|asma|asthma|bronkitis|bronchitis|tuberkulosis|tbc)\b/i.test(neuroText)) {
    structCodes.set('s430', 'Struktur sistem pernapasan');
  }
  const s = [...structCodes.entries()].map(([code, name]) => ({ code, label: name, details: [], q: null }));

  // Aktivitas & partisipasi
  const functional = collectFunctional(`${subjective}\n${objective}`);
  const dQ = functional.length ? Math.max(...functional.map((f) => f.q)) : null;
  const d = new Map();
  all.forEach((sec) => sec.clauses.forEach((c) => {
    const limited = LIMIT_WORDS.test(c);
    ACTIVITY_RULES.forEach((rule) => {
      const m = firstAffirmed(c, rule.re, false);
      if (!m) return;
      // Objective: gait/stairs dsb. dihitung bila ada kata keterbatasan; Subjective juga.
      if (!limited && sec.src === 'S' && !/keluhan utama|aktivitas|fungsi|riwayat/i.test(sec.title)) return;
      if (!limited && sec.src === 'O') return;
      if (!limited && !/keluhan utama|aktivitas|fungsi/i.test(sec.title)) return;
      if (/\b(tidak|tanpa)\s+(?:ada\s+)?(?:kesulitan|keluhan|masalah|gangguan)\b/i.test(c)) return;
      const e = addTo(d, rule.code, rule.label);
      e.q = dQ;
    });
  }));
  // Gaya jalan abnormal dari Objective juga menunjukkan keterbatasan berjalan
  if (b.has('b770') && !d.has('d450')) addTo(d, 'd450', 'Berjalan').q = dQ;

  // Faktor lingkungan
  const e = new Map();
  ENV_RULES.forEach((rule) => {
    all.forEach((sec) => sec.clauses.forEach((c) => {
      if (rule.id === 'drug' && !/\b(mengonsumsi|minum|konsumsi|rutin|dosis|resep|obat\s+\p{L}{3,}|mg)\b/iu.test(c)) return;
      const m = firstAffirmed(c, rule.re, false);
      if (!m) return;
      const item = addTo(e, rule.code, rule.label);
      if (rule.id === 'family') item.details.push('fasilitator');
      if (rule.id === 'home') item.details.push('hambatan');
    }));
  });
  if (all.some((sec) => sec.clauses.some((c) => /\b(tidak ada dukungan keluarga|kurang dukungan keluarga|tinggal sendiri)\b/i.test(c)))) {
    const item = addTo(e, 'e310', 'Dukungan keluarga inti');
    item.details = ['hambatan'];
  }

  const toList = (map) => [...map.values()];
  // Urutan: nyeri dulu, lalu fungsi gerak (b7xx), lalu sisanya; kode lebih spesifik lebih dulu.
  const rank = (it) => (it.code.startsWith('b280') ? 0 : it.code.startsWith('b7') ? 1 : 2);
  const sortKey = (code) => `${code[0]}${code.slice(1).padEnd(5, '0')}`;
  const pick = (arr, max) => {
    // buang kode induk bila kode turunannya sudah terpilih (mis. s710 bila s7102 ada)
    const specific = arr.filter((x) => !arr.some((y) => y !== x && y.code.startsWith(x.code)));
    return specific
      .sort((x, y) => rank(x) - rank(y) || y.code.length - x.code.length || x.code.localeCompare(y.code))
      .slice(0, max)
      .sort((x, y) => sortKey(x.code).localeCompare(sortKey(y.code)));
  };
  const bList = pick(toList(b), 6);
  const dList = pick(toList(d), 5);
  const eList = pick(toList(e), 2);
  const sList = pick(s, 3);

  return {
    b: bList,
    s: sList,
    d: dList,
    e: eList,
    functional,
    hasData: !!(bList.length || sList.length || dList.length),
  };
};

/** Semua kode ICF pada hasil analisis (untuk mengambil judul resminya dari database). */
export const icfCodesOf = (result) => [...result.b, ...result.s, ...result.d, ...result.e].map((x) => x.code);

const lineOf = (titles) => (it) => {
  const det = uniq(it.details);
  return `- ${fmt(it.code, it.q)} ${titles[it.code] || it.label}${det.length ? ` (${det.join('; ')})` : ''}`;
};

/**
 * Teks Assessment ICF siap tempel di kolom Assessment.
 * titles: { kode: judul resmi } dari tabel icf_codes (opsional).
 * Mengembalikan '' bila S atau O kosong atau tidak ada temuan yang bisa dikodekan.
 */
export const generateIcfAssessment = ({ subjective = '', objective = '', diagnoses = [], titles = {} } = {}) => {
  if (!String(subjective).trim() || !String(objective).trim()) return '';
  const r = analyzeIcf({ subjective, objective, diagnoses });
  if (!r.hasData) return '';
  const dx = uniq(diagnoses.map((x) => String(x).trim()));

  const lines = ['Assessment (ICF)'];
  if (dx.length) lines.push(`Kondisi kesehatan: ${dx.join('; ')}`);
  const section = (title, items) => {
    if (items.length) lines.push(title, ...items.map(lineOf(titles)));
  };
  section('Body Functions (b)', r.b);
  section('Body Structures (s)', r.s);
  section('Activities & Participation (d)', r.d);
  section('Environmental Factors (e)', r.e);
  if (r.functional.length) {
    lines.push(`Kualifier d dari ${r.functional.map((f) => `${f.name} ${Math.round(f.pct)}%`).join(', ')}.`);
  }
  return lines.join('\n');
};
