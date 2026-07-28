import { Bone, Zap, Activity, Users, Briefcase, Home } from 'lucide-react';

// Content for the /layanan and /layanan/:slug pages. Each entry targets a
// distinct keyword cluster (condition + "Balikpapan") found during SEO
// research, instead of leaving all services buried in one homepage section.
export const SERVICES = [
  {
    slug: 'nyeri-otot-sendi',
    icon: Bone,
    title: 'Fisioterapi Nyeri Otot & Sendi',
    shortDescription: 'Terapi untuk nyeri otot, sendi, pinggang, leher, dan tulang belakang.',
    metaTitle: 'Fisioterapi Nyeri Otot & Sendi di Balikpapan | Kaffah Physiotherapy',
    metaDescription: 'Tangani nyeri pinggang, leher, bahu, lutut, dan sendi lainnya dengan fisioterapi evidence-based di Kaffah Physiotherapy, Balikpapan Utara. Booking konsultasi sekarang.',
    h1: 'Fisioterapi Nyeri Otot & Sendi di Balikpapan',
    intro:
      'Nyeri otot dan sendi yang berkepanjangan — baik di pinggang, leher, bahu, lutut, maupun punggung — sering kali berasal dari postur yang salah, aktivitas berulang, atau proses degeneratif. Kaffah Physiotherapy menangani keluhan muskuloskeletal ini dengan asesmen menyeluruh sebelum menentukan program terapi.',
    conditions: [
      'Nyeri pinggang bawah (low back pain)',
      'Nyeri leher dan tegang otot bahu',
      'Nyeri lutut akibat osteoarthritis',
      'Frozen shoulder / bahu kaku',
      'Nyeri punggung kronis',
      'Sakit sendi akibat postur kerja yang salah',
    ],
    process: [
      { step: 'Asesmen & Diagnosis', detail: 'Pemeriksaan riwayat keluhan, postur, dan rentang gerak untuk menentukan sumber nyeri.' },
      { step: 'Program Terapi Personal', detail: 'Kombinasi terapi manual, latihan penguatan, dan modalitas fisik sesuai kondisi.' },
      { step: 'Evaluasi & Latihan Mandiri', detail: 'Pemantauan progres tiap sesi dan edukasi latihan yang bisa dilanjutkan di rumah.' },
    ],
    faqs: [
      {
        q: 'Berapa kali sesi fisioterapi dibutuhkan untuk nyeri pinggang?',
        a: 'Tergantung tingkat keparahan dan durasi keluhan. Fisioterapis akan menentukan estimasi jumlah sesi setelah asesmen awal.',
      },
      {
        q: 'Apakah fisioterapi nyeri sendi terasa sakit?',
        a: 'Terapi disesuaikan dengan toleransi pasien. Tujuannya mengurangi nyeri secara bertahap, bukan menambah rasa sakit.',
      },
    ],
  },
  {
    slug: 'cedera-olahraga',
    icon: Zap,
    title: 'Fisioterapi Cedera Olahraga',
    shortDescription: 'Pemulihan cedera akibat olahraga: sprain, strain, cedera lutut, bahu, dan pergelangan tangan.',
    metaTitle: 'Fisioterapi Cedera Olahraga di Balikpapan | Kaffah Physiotherapy',
    metaDescription: 'Pemulihan cedera olahraga (keseleo, cedera lutut, bahu, pergelangan tangan) dengan program rehabilitasi berbasis bukti di Kaffah Physiotherapy, Balikpapan.',
    h1: 'Fisioterapi Cedera Olahraga di Balikpapan',
    intro:
      'Cedera saat berolahraga — mulai dari keseleo ringan hingga cedera ligamen — perlu penanganan yang tepat agar tidak berulang. Kaffah Physiotherapy membantu atlet maupun masyarakat umum kembali beraktivitas dengan aman melalui program pemulihan yang terstruktur.',
    conditions: [
      'Keseleo (sprain) dan cedera otot (strain)',
      'Cedera ligamen lutut (termasuk pasca cedera ACL)',
      'Cedera bahu akibat olahraga lempar/angkat',
      'Cedera pergelangan tangan dan pergelangan kaki',
      'Nyeri tendon (tendinitis) pada pelari atau pemain bola',
    ],
    process: [
      { step: 'Evaluasi Cedera', detail: 'Menentukan tingkat keparahan dan tahap pemulihan (akut, subakut, atau lanjutan).' },
      { step: 'Terapi Pemulihan Aktif', detail: 'Kombinasi terapi manual, latihan penguatan otot, dan pemulihan rentang gerak.' },
      { step: 'Return to Activity', detail: 'Program bertahap untuk kembali ke aktivitas olahraga tanpa risiko cedera berulang.' },
    ],
    faqs: [
      {
        q: 'Kapan waktu terbaik memulai fisioterapi setelah cedera olahraga?',
        a: 'Setelah fase akut (biasanya 48-72 jam pertama) mulai reda, fisioterapi bisa dimulai untuk mempercepat pemulihan dan mencegah kekakuan.',
      },
      {
        q: 'Apakah bisa kembali berolahraga penuh setelah terapi?',
        a: 'Program dirancang bertahap hingga fungsi dan kekuatan kembali memadai sebelum kembali ke intensitas olahraga semula.',
      },
    ],
  },
  {
    slug: 'rehabilitasi-pasca-operasi',
    icon: Activity,
    title: 'Fisioterapi Rehabilitasi Pasca Operasi',
    shortDescription: 'Program pemulihan optimal setelah operasi ortopedi maupun bedah lainnya.',
    metaTitle: 'Fisioterapi Pasca Operasi di Balikpapan | Kaffah Physiotherapy',
    metaDescription: 'Program rehabilitasi pasca operasi ortopedi (penggantian sendi, operasi tulang, ligamen) di Kaffah Physiotherapy, Balikpapan Utara. Terapis bersertifikat STR.',
    h1: 'Fisioterapi Rehabilitasi Pasca Operasi di Balikpapan',
    intro:
      'Operasi ortopedi seperti penggantian sendi, operasi tulang, atau rekonstruksi ligamen membutuhkan rehabilitasi terarah agar fungsi gerak pulih maksimal. Kaffah Physiotherapy mendampingi proses pemulihan pasca operasi sesuai anjuran dokter bedah yang menangani.',
    conditions: [
      'Pasca operasi penggantian sendi lutut atau panggul',
      'Pasca operasi fraktur (patah tulang)',
      'Pasca rekonstruksi ligamen (ACL, dsb.)',
      'Pasca operasi tulang belakang',
      'Pasca operasi bahu atau rotator cuff',
    ],
    process: [
      { step: 'Koordinasi dengan Dokter', detail: 'Program terapi disusun mengacu pada rekomendasi dan batasan pasca operasi dari dokter bedah.' },
      { step: 'Pemulihan Bertahap', detail: 'Mobilisasi dini, pemulihan rentang gerak, hingga penguatan otot sesuai fase penyembuhan jaringan.' },
      { step: 'Kembali Beraktivitas', detail: 'Latihan fungsional agar pasien dapat kembali ke aktivitas sehari-hari dengan aman.' },
    ],
    faqs: [
      {
        q: 'Kapan fisioterapi pasca operasi sebaiknya dimulai?',
        a: 'Umumnya sesuai jadwal yang direkomendasikan dokter bedah, sering kali dimulai segera setelah kondisi stabil untuk mencegah kekakuan sendi.',
      },
      {
        q: 'Apakah perlu membawa surat rujukan dari dokter?',
        a: 'Disarankan membawa catatan medis atau rekomendasi dokter agar program terapi sesuai dengan prosedur operasi yang dijalani.',
      },
    ],
  },
  {
    slug: 'neuromuskular',
    icon: Users,
    title: 'Fisioterapi Neuromuskular',
    shortDescription: 'Terapi untuk stroke, saraf kejepit (HNP), parkinson, dan bell’s palsy.',
    metaTitle: 'Fisioterapi Stroke & Saraf Kejepit di Balikpapan | Kaffah Physiotherapy',
    metaDescription: 'Fisioterapi neuromuskular untuk pemulihan pasca stroke, saraf kejepit (HNP), parkinson, dan bell’s palsy di Kaffah Physiotherapy, Balikpapan Utara.',
    h1: 'Fisioterapi Neuromuskular: Stroke, Saraf Kejepit & Parkinson di Balikpapan',
    intro:
      'Gangguan sistem saraf seperti stroke, saraf kejepit (HNP), parkinson, dan bell’s palsy memengaruhi kekuatan otot, koordinasi, dan kemampuan bergerak. Kaffah Physiotherapy menyediakan program neurorehabilitasi yang disesuaikan dengan kondisi neurologis tiap pasien, termasuk opsi kunjungan home care bagi pasien dengan mobilitas terbatas.',
    conditions: [
      'Pemulihan pasca stroke (kelemahan anggota gerak)',
      'Saraf kejepit / HNP (Hernia Nukleus Pulposus)',
      'Parkinson',
      'Bell’s palsy (kelumpuhan wajah)',
      'Gangguan keseimbangan dan koordinasi',
    ],
    process: [
      { step: 'Asesmen Neurologis', detail: 'Evaluasi kekuatan otot, koordinasi, keseimbangan, dan tingkat kemandirian fungsional.' },
      { step: 'Terapi Neurorehabilitasi', detail: 'Latihan motorik, stimulasi fungsional, dan latihan keseimbangan sesuai kondisi.' },
      { step: 'Pendampingan Berkelanjutan', detail: 'Pemantauan progres jangka panjang, termasuk opsi terapi di rumah untuk pasien dengan mobilitas terbatas.' },
    ],
    faqs: [
      {
        q: 'Apakah fisioterapi bisa membantu pemulihan pasca stroke?',
        a: 'Ya, fisioterapi adalah bagian penting dari rehabilitasi pasca stroke untuk melatih kembali kekuatan otot, koordinasi, dan kemandirian gerak.',
      },
      {
        q: 'Apakah tersedia layanan terapi di rumah untuk pasien stroke?',
        a: 'Tersedia melalui layanan Home Care kami bagi pasien yang kesulitan mobilisasi ke klinik.',
      },
    ],
  },
  {
    slug: 'terapi-ergonomis',
    icon: Briefcase,
    title: 'Terapi Ergonomis',
    shortDescription: 'Koreksi postur tubuh dan penanganan keluhan akibat posisi kerja yang salah.',
    metaTitle: 'Terapi Ergonomis & Koreksi Postur di Balikpapan | Kaffah Physiotherapy',
    metaDescription: 'Atasi nyeri leher, bahu, dan punggung akibat posisi kerja/duduk yang salah dengan terapi ergonomis dari Kaffah Physiotherapy, Balikpapan.',
    h1: 'Terapi Ergonomis & Koreksi Postur di Balikpapan',
    intro:
      'Bekerja dengan posisi duduk atau berdiri yang salah dalam waktu lama sering menimbulkan nyeri leher, bahu, dan punggung. Kaffah Physiotherapy membantu mengidentifikasi sumber masalah postur dan menyusun program koreksi ergonomis untuk mencegah keluhan berulang.',
    conditions: [
      'Nyeri leher & bahu akibat posisi kerja di depan komputer',
      'Nyeri punggung akibat duduk terlalu lama',
      'Postur membungkuk (forward head posture)',
      'Ketegangan otot akibat repetitive strain',
    ],
    process: [
      { step: 'Analisis Postur & Aktivitas', detail: 'Mengevaluasi kebiasaan duduk/berdiri dan pola gerak yang memicu keluhan.' },
      { step: 'Koreksi & Latihan Penguatan', detail: 'Terapi manual serta latihan penguatan otot postural.' },
      { step: 'Edukasi Ergonomi', detail: 'Rekomendasi penyesuaian posisi kerja agar keluhan tidak berulang.' },
    ],
    faqs: [
      {
        q: 'Apakah terapi ergonomis cocok untuk pekerja kantoran?',
        a: 'Sangat cocok, terutama bagi yang mengalami nyeri leher/punggung akibat duduk lama di depan komputer.',
      },
    ],
  },
  {
    slug: 'home-care',
    icon: Home,
    title: 'Fisioterapi Panggilan ke Rumah (Home Care)',
    shortDescription: 'Layanan fisioterapi datang ke rumah untuk pasien yang sulit mobilisasi.',
    metaTitle: 'Fisioterapi Panggilan ke Rumah di Balikpapan | Kaffah Physiotherapy',
    metaDescription: 'Layanan fisioterapi home care / panggilan ke rumah di Balikpapan Utara dan sekitarnya. Cocok untuk pasien lansia, pasca stroke, atau sulit mobilisasi.',
    h1: 'Fisioterapi Panggilan ke Rumah (Home Care) di Balikpapan',
    intro:
      'Bagi pasien yang sulit mobilisasi ke klinik — lansia, pasien pasca stroke, atau pasca operasi tahap awal — Kaffah Physiotherapy menyediakan layanan fisioterapi panggilan ke rumah di area Balikpapan. Terapi dilakukan oleh fisioterapis yang sama, dengan kualitas penanganan setara sesi di klinik.',
    conditions: [
      'Lansia dengan keterbatasan mobilitas',
      'Pasien pasca stroke yang belum bisa bepergian jauh',
      'Pasien pasca operasi tahap awal pemulihan',
      'Pasien dengan kekakuan sendi berat',
    ],
    process: [
      { step: 'Jadwalkan Kunjungan', detail: 'Hubungi kami via WhatsApp untuk menentukan jadwal dan lokasi kunjungan.' },
      { step: 'Asesmen di Rumah', detail: 'Fisioterapis melakukan evaluasi kondisi langsung di lokasi pasien.' },
      { step: 'Terapi Rutin', detail: 'Sesi terapi terjadwal di rumah dengan pemantauan progres berkelanjutan.' },
    ],
    faqs: [
      {
        q: 'Area mana saja yang dilayani untuk home care?',
        a: 'Prioritas area Balikpapan Utara dan sekitarnya. Hubungi kami via WhatsApp untuk memastikan jangkauan ke lokasi Anda.',
      },
      {
        q: 'Apa bedanya terapi di rumah dengan di klinik?',
        a: 'Metode dan kualitas penanganan sama, hanya lokasinya di rumah pasien — cocok bagi yang kesulitan bepergian ke klinik.',
      },
    ],
  },
];

export const getServiceBySlug = (slug) => SERVICES.find((s) => s.slug === slug);
