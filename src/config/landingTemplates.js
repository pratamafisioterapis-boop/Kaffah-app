// Registry of ready-made landing page templates for clinics that run on
// their own subdomain/custom domain (see src/pages/clinic/ClinicTenantSitePage.jsx).
// Each template ships with full sample content in `defaultContent` so a
// clinic owner can go live immediately, then override only the parts they
// want to change from the "Landing Page" tab in owner Settings -- nothing
// here affects kaffahphysio.id, which keeps its own static landing page in
// src/components/landing/*.
//
// Content shape shared by every template (owner overrides in
// clinics.landing_content are deep-merged over `defaultContent`):
// {
//   hero: { eyebrow, title, subtitle, image, ctaLabel, ctaWhatsappLabel },
//   about: { title, body, points: string[], image },
//   services: { title, subtitle, items: [{ title, description }] },
//   advantages: { title, items: [{ title, description }] },
//   testimonials: { title, items: [{ name, role, quote }] },
//   pricing: { title, subtitle, note },
//   cta: { title, subtitle, buttonLabel },
//   footer: { tagline },
// }

export const LANDING_TEMPLATES = [
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Gradient biru-ungu modern dengan hero besar. Cocok untuk klinik yang ingin tampil segar dan kontemporer.',
    swatch: ['#4338ca', '#0ea5e9'],
    colors: { primary: '#4338ca', accent: '#0ea5e9' },
    style: {
      heroBg: 'bg-gradient-to-br from-indigo-700 via-indigo-600 to-sky-500',
      heroText: 'text-white',
      sectionBg: 'bg-white',
      sectionAltBg: 'bg-indigo-50/60',
      headingText: 'text-slate-900',
      bodyText: 'text-slate-600',
      cardShape: 'rounded-2xl',
      buttonPrimary: 'bg-indigo-600 hover:opacity-90 text-white',
      buttonSecondary: 'bg-white/10 hover:bg-white/20 text-white border border-white/40 backdrop-blur',
      badgeBg: 'bg-white/15 text-white',
      accentText: 'text-indigo-600',
      ctaBg: 'bg-gradient-to-br from-indigo-700 to-sky-500',
      font: 'font-sans',
      gradientHero: true,
    },
    defaultContent: {
      hero: {
        eyebrow: 'Klinik Fisioterapi Terpercaya',
        title: 'Pulih Lebih Cepat, Bergerak Lebih Bebas',
        subtitle: 'Layanan fisioterapi profesional dengan terapis berpengalaman dan program pemulihan yang dipersonalisasi untuk setiap pasien.',
        ctaLabel: 'Booking Konsultasi',
        ctaWhatsappLabel: 'Chat WhatsApp',
      },
      about: {
        title: 'Kenapa Memilih Kami',
        body: 'Kami hadir untuk membantu Anda kembali beraktivitas tanpa nyeri melalui pendekatan terapi yang berbasis bukti ilmiah, ditangani langsung oleh fisioterapis berlisensi.',
        points: [
          'Fisioterapis berpengalaman & tersertifikasi',
          'Program terapi dipersonalisasi sesuai kondisi pasien',
          'Peralatan modern dan ruang terapi nyaman',
          'Pendampingan pemulihan sampai tuntas',
        ],
      },
      services: {
        title: 'Layanan Kami',
        subtitle: 'Solusi lengkap untuk pemulihan fisik Anda',
        items: [
          { title: 'Fisioterapi Umum', description: 'Penanganan nyeri otot, sendi, dan cedera ringan hingga menengah.' },
          { title: 'Terapi Pasca Operasi', description: 'Program pemulihan terstruktur setelah tindakan operasi ortopedi.' },
          { title: 'Terapi Olahraga (Sports Injury)', description: 'Penanganan cedera atlet dan program kembali ke performa optimal.' },
          { title: 'Home Care', description: 'Layanan fisioterapi langsung ke rumah untuk kenyamanan pasien.' },
        ],
      },
      advantages: {
        title: 'Keunggulan Kami',
        items: [
          { title: 'Terapis Bersertifikat', description: 'Seluruh tim adalah fisioterapis lulusan dan berlisensi resmi.' },
          { title: 'Pendekatan Personal', description: 'Setiap program terapi disesuaikan dengan kondisi dan target pasien.' },
          { title: 'Fasilitas Modern', description: 'Peralatan terapi terkini yang mendukung proses pemulihan.' },
        ],
      },
      testimonials: {
        title: 'Kata Pasien Kami',
        items: [
          { name: 'Sarah W.', role: 'Pasien Fisioterapi Umum', quote: 'Nyeri punggung saya jauh berkurang setelah beberapa sesi. Terapisnya sangat komunikatif dan sabar.' },
          { name: 'Budi H.', role: 'Pasien Pasca Operasi', quote: 'Proses pemulihan pasca operasi lutut saya jadi lebih terarah berkat program terapi di sini.' },
          { name: 'Dewi K.', role: 'Pasien Home Care', quote: 'Layanan home care sangat membantu karena mobilitas saya terbatas. Tim datang tepat waktu dan profesional.' },
        ],
      },
      pricing: {
        title: 'Daftar Harga Layanan',
        subtitle: 'Harga transparan tanpa biaya tersembunyi',
        note: 'Harga dapat berubah sewaktu-waktu. Hubungi kami untuk info paket terbaru.',
      },
      cta: {
        title: 'Siap Memulai Pemulihan Anda?',
        subtitle: 'Booking sesi konsultasi pertama Anda sekarang, tim kami siap membantu.',
        buttonLabel: 'Booking Sekarang',
      },
      footer: { tagline: 'Layanan fisioterapi profesional untuk hidup yang lebih bebas bergerak.' },
    },
  },
  {
    id: 'zen',
    name: 'Zen',
    description: 'Minimalis, tenang, dominan putih dan hijau sage. Cocok untuk klinik yang ingin kesan calming & wellness.',
    swatch: ['#3f6c51', '#a3b18a'],
    colors: { primary: '#3f6c51', accent: '#a3b18a' },
    style: {
      heroBg: 'bg-[#f6f5f0]',
      heroText: 'text-[#243b2c]',
      sectionBg: 'bg-white',
      sectionAltBg: 'bg-[#f6f5f0]',
      headingText: 'text-[#243b2c]',
      bodyText: 'text-[#5b6b60]',
      cardShape: 'rounded-xl',
      buttonPrimary: 'bg-[#3f6c51] hover:opacity-90 text-white',
      buttonSecondary: 'bg-white hover:bg-[#f0efe8] text-[#3f6c51] border border-[#3f6c51]/30',
      badgeBg: 'bg-[#3f6c51]/10 text-[#3f6c51]',
      accentText: 'text-[#3f6c51]',
      ctaBg: 'bg-[#243b2c]',
      font: 'font-serif',
    },
    defaultContent: {
      hero: {
        eyebrow: 'Ruang Pemulihan Tenang Anda',
        title: 'Sembuh dengan Tenang, Bergerak dengan Percaya Diri',
        subtitle: 'Pendekatan fisioterapi yang lembut, personal, dan menyeluruh -- membantu tubuh Anda pulih secara alami.',
        ctaLabel: 'Jadwalkan Sesi',
        ctaWhatsappLabel: 'Tanya via WhatsApp',
      },
      about: {
        title: 'Filosofi Perawatan Kami',
        body: 'Kami percaya pemulihan terbaik datang dari perhatian penuh terhadap tubuh dan pikiran pasien. Setiap sesi dirancang dengan tenang, teliti, dan penuh empati.',
        points: [
          'Suasana klinik yang tenang dan nyaman',
          'Sesi terapi satu-per-satu, tanpa terburu-buru',
          'Kombinasi teknik manual therapy & latihan terarah',
          'Evaluasi berkala untuk memastikan progres pemulihan',
        ],
      },
      services: {
        title: 'Layanan Perawatan',
        subtitle: 'Dipilih sesuai kebutuhan pemulihan Anda',
        items: [
          { title: 'Manual Therapy', description: 'Teknik terapi manual untuk meredakan nyeri otot dan sendi.' },
          { title: 'Terapi Postur', description: 'Perbaikan postur tubuh untuk mencegah nyeri berulang.' },
          { title: 'Terapi Geriatri', description: 'Program pemulihan lembut yang dirancang khusus untuk lansia.' },
          { title: 'Relaksasi & Peregangan Terapeutik', description: 'Sesi peregangan terpandu untuk mengurangi ketegangan otot.' },
        ],
      },
      advantages: {
        title: 'Mengapa Pasien Memilih Kami',
        items: [
          { title: 'Suasana Menenangkan', description: 'Ruang terapi didesain nyaman agar pasien rileks selama proses.' },
          { title: 'Waktu Sesi yang Cukup', description: 'Tidak terburu-buru, setiap pasien mendapat perhatian penuh.' },
          { title: 'Terapis yang Sabar & Komunikatif', description: 'Kami menjelaskan setiap langkah terapi dengan jelas.' },
        ],
      },
      testimonials: {
        title: 'Pengalaman Pasien',
        items: [
          { name: 'Rina A.', role: 'Pasien Manual Therapy', quote: 'Suasananya tenang, terapisnya sangat perhatian. Saya merasa didengar sepanjang proses terapi.' },
          { name: 'Hendra S.', role: 'Pasien Terapi Postur', quote: 'Postur saya membaik signifikan, nyeri leher yang dulu sering kambuh sekarang jauh berkurang.' },
          { name: 'Ibu Yuli', role: 'Keluarga Pasien Geriatri', quote: 'Terapis sangat sabar menangani ibu saya yang sudah lansia. Sangat direkomendasikan.' },
        ],
      },
      pricing: {
        title: 'Investasi untuk Pemulihan Anda',
        subtitle: 'Paket harga yang jelas dan tanpa kejutan',
        note: 'Konsultasikan kebutuhan Anda untuk mendapatkan rekomendasi paket yang sesuai.',
      },
      cta: {
        title: 'Beri Waktu untuk Tubuh Anda Pulih',
        subtitle: 'Jadwalkan sesi pertama Anda hari ini bersama tim kami.',
        buttonLabel: 'Jadwalkan Sekarang',
      },
      footer: { tagline: 'Ruang pemulihan yang tenang untuk tubuh dan pikiran Anda.' },
    },
  },
  {
    id: 'vitality',
    name: 'Vitality',
    description: 'Warna oranye-merah energik dengan aksen tegas. Cocok untuk klinik sports injury / performance recovery.',
    swatch: ['#ea580c', '#facc15'],
    colors: { primary: '#ea580c', accent: '#facc15' },
    style: {
      heroBg: 'bg-gradient-to-br from-orange-600 via-red-500 to-amber-400',
      heroText: 'text-white',
      sectionBg: 'bg-white',
      sectionAltBg: 'bg-orange-50',
      headingText: 'text-slate-900',
      bodyText: 'text-slate-600',
      cardShape: 'rounded-lg',
      buttonPrimary: 'bg-orange-600 hover:opacity-90 text-white',
      buttonSecondary: 'bg-white/15 hover:bg-white/25 text-white border border-white/50',
      badgeBg: 'bg-white/20 text-white',
      accentText: 'text-orange-600',
      ctaBg: 'bg-gradient-to-br from-orange-600 to-red-500',
      font: 'font-sans',
      gradientHero: true,
    },
    defaultContent: {
      hero: {
        eyebrow: 'Kembali Aktif, Lebih Kuat dari Sebelumnya',
        title: 'Pulihkan Performa Tubuh Anda Secara Maksimal',
        subtitle: 'Fisioterapi khusus cedera olahraga dan pemulihan performa, ditangani tim yang memahami kebutuhan tubuh aktif Anda.',
        ctaLabel: 'Booking Terapi',
        ctaWhatsappLabel: 'Hubungi Kami',
      },
      about: {
        title: 'Fokus Pemulihan & Performa',
        body: 'Kami membantu atlet maupun individu aktif untuk pulih dari cedera dan kembali ke performa terbaik, dengan program terapi berbasis fungsi gerak dan kekuatan.',
        points: [
          'Program pemulihan berbasis fungsi & performa',
          'Penanganan cedera olahraga oleh terapis berpengalaman',
          'Latihan penguatan & pencegahan cedera berulang',
          'Monitoring progres dengan target terukur',
        ],
      },
      services: {
        title: 'Layanan Pemulihan Performa',
        subtitle: 'Dirancang untuk tubuh yang aktif bergerak',
        items: [
          { title: 'Sports Injury Recovery', description: 'Penanganan cedera olahraga dari akut hingga rehabilitasi lanjutan.' },
          { title: 'Strength & Conditioning Therapy', description: 'Program penguatan otot untuk mendukung performa dan mencegah cedera.' },
          { title: 'Terapi Cedera Sendi & Ligamen', description: 'Penanganan cedera lutut, bahu, dan pergelangan kaki.' },
          { title: 'Program Return to Sport', description: 'Panduan bertahap kembali berolahraga dengan aman.' },
        ],
      },
      advantages: {
        title: 'Kenapa Atlet Memilih Kami',
        items: [
          { title: 'Pemahaman Kebutuhan Atlet', description: 'Tim kami terbiasa menangani kebutuhan pemulihan performa tinggi.' },
          { title: 'Program Terukur', description: 'Progres dipantau dengan indikator kekuatan dan mobilitas yang jelas.' },
          { title: 'Pemulihan Lebih Cepat & Aman', description: 'Kombinasi terapi manual dan latihan fungsional yang tepat sasaran.' },
        ],
      },
      testimonials: {
        title: 'Cerita Pemulihan Mereka',
        items: [
          { name: 'Rizky P.', role: 'Atlet Futsal', quote: 'Cedera ankle saya ditangani dengan tepat, sekarang saya sudah bisa main lagi dengan percaya diri.' },
          { name: 'Anisa F.', role: 'Pelari Marathon', quote: 'Program latihan penguatannya sangat membantu mencegah cedera lutut saya kambuh lagi.' },
          { name: 'Coach Dimas', role: 'Pelatih Tim Basket', quote: 'Kami selalu rujuk pemain yang cedera ke sini, hasil pemulihannya konsisten bagus.' },
        ],
      },
      pricing: {
        title: 'Paket Terapi & Harga',
        subtitle: 'Investasi untuk performa terbaik Anda',
        note: 'Tersedia paket khusus untuk atlet dan komunitas olahraga, hubungi kami untuk detail.',
      },
      cta: {
        title: 'Waktunya Kembali ke Performa Terbaik',
        subtitle: 'Konsultasikan cedera Anda dengan tim spesialis pemulihan performa kami.',
        buttonLabel: 'Booking Sekarang',
      },
      footer: { tagline: 'Mendukung pemulihan dan performa terbaik tubuh aktif Anda.' },
    },
  },
  {
    id: 'heritage',
    name: 'Heritage',
    description: 'Navy & emas klasik, elegan dan terpercaya. Cocok untuk klinik yang ingin kesan established & profesional.',
    swatch: ['#1e3a5f', '#c9a227'],
    colors: { primary: '#1e3a5f', accent: '#c9a227' },
    style: {
      heroBg: 'bg-[#0f2440]',
      heroText: 'text-white',
      sectionBg: 'bg-white',
      sectionAltBg: 'bg-[#f4f1e8]',
      headingText: 'text-[#0f2440]',
      bodyText: 'text-slate-600',
      cardShape: 'rounded-md',
      buttonPrimary: 'bg-[#c9a227] hover:opacity-90 text-[#0f2440] font-semibold',
      buttonSecondary: 'bg-transparent hover:bg-white/10 text-white border border-white/50',
      badgeBg: 'bg-[#c9a227]/20 text-[#e9d38b]',
      accentText: 'text-[#c9a227]',
      ctaBg: 'bg-[#0f2440]',
      font: 'font-serif',
    },
    defaultContent: {
      hero: {
        eyebrow: 'Sejak Melayani Kesehatan Gerak Anda',
        title: 'Kepercayaan Anda, Prioritas Pemulihan Kami',
        subtitle: 'Klinik fisioterapi dengan standar pelayanan profesional, ditangani tim berpengalaman yang mengutamakan keselamatan dan hasil terapi.',
        ctaLabel: 'Buat Janji Temu',
        ctaWhatsappLabel: 'Hubungi via WhatsApp',
      },
      about: {
        title: 'Komitmen Kami',
        body: 'Dengan pengalaman menangani beragam kondisi muskuloskeletal, kami berkomitmen memberikan pelayanan fisioterapi yang aman, terukur, dan berorientasi pada kesembuhan jangka panjang pasien.',
        points: [
          'Ditangani fisioterapis berpengalaman & tersertifikasi',
          'Standar prosedur klinis yang konsisten',
          'Rekam medis dan evaluasi terdokumentasi rapi',
          'Layanan ramah untuk seluruh kalangan usia',
        ],
      },
      services: {
        title: 'Layanan Unggulan',
        subtitle: 'Penanganan menyeluruh untuk kesehatan gerak Anda',
        items: [
          { title: 'Fisioterapi Muskuloskeletal', description: 'Penanganan nyeri otot, sendi, tulang belakang, dan gangguan gerak.' },
          { title: 'Rehabilitasi Pasca Stroke', description: 'Program pemulihan fungsi gerak pasca stroke secara bertahap.' },
          { title: 'Terapi Nyeri Kronis', description: 'Penanganan nyeri jangka panjang dengan pendekatan komprehensif.' },
          { title: 'Konsultasi & Assessment Awal', description: 'Evaluasi menyeluruh untuk menentukan rencana terapi yang tepat.' },
        ],
      },
      advantages: {
        title: 'Keunggulan Klinik Kami',
        items: [
          { title: 'Tim Berpengalaman', description: 'Fisioterapis dengan jam terbang tinggi menangani berbagai kasus.' },
          { title: 'Standar Layanan Terjaga', description: 'Setiap sesi mengikuti prosedur klinis yang konsisten dan aman.' },
          { title: 'Kepercayaan Pasien Bertahun-tahun', description: 'Dipercaya oleh ratusan pasien untuk pemulihan mereka.' },
        ],
      },
      testimonials: {
        title: 'Testimoni Pasien',
        items: [
          { name: 'Bapak Slamet', role: 'Pasien Rehabilitasi Stroke', quote: 'Perkembangan pemulihan ayah saya sangat terlihat sejak rutin terapi di sini. Timnya sangat profesional.' },
          { name: 'Ny. Farah', role: 'Pasien Nyeri Kronis', quote: 'Setelah bertahun-tahun nyeri punggung, akhirnya menemukan penanganan yang benar-benar membantu.' },
          { name: 'Pak Wahyu', role: 'Pasien Fisioterapi Umum', quote: 'Pelayanannya rapi dan terpercaya, dokter dan terapisnya menjelaskan dengan detail.' },
        ],
      },
      pricing: {
        title: 'Daftar Tarif Layanan',
        subtitle: 'Tarif transparan sesuai standar layanan kami',
        note: 'Hubungi resepsionis kami untuk informasi tarif terbaru dan skema asuransi.',
      },
      cta: {
        title: 'Percayakan Pemulihan Anda pada Kami',
        subtitle: 'Buat janji temu dengan tim fisioterapi profesional kami hari ini.',
        buttonLabel: 'Buat Janji Temu',
      },
      footer: { tagline: 'Melayani kesehatan gerak masyarakat dengan standar profesional.' },
    },
  },
  {
    id: 'nova',
    name: 'Nova',
    description: 'Dark mode modern dengan aksen neon teal. Cocok untuk klinik yang ingin kesan tech-forward & premium.',
    swatch: ['#0d9488', '#22d3ee'],
    colors: { primary: '#0d9488', accent: '#22d3ee' },
    style: {
      heroBg: 'bg-[#0b1120]',
      heroText: 'text-white',
      sectionBg: 'bg-[#0b1120]',
      sectionAltBg: 'bg-[#111a2e]',
      headingText: 'text-white',
      bodyText: 'text-slate-300',
      cardShape: 'rounded-2xl',
      buttonPrimary: 'bg-teal-500 hover:opacity-90 text-[#0b1120] font-semibold',
      buttonSecondary: 'bg-white/5 hover:bg-white/10 text-white border border-white/20',
      badgeBg: 'bg-teal-400/10 text-teal-300',
      accentText: 'text-teal-400',
      ctaBg: 'bg-gradient-to-br from-[#0b1120] to-[#0d3b3a]',
      font: 'font-sans',
      dark: true,
    },
    defaultContent: {
      hero: {
        eyebrow: 'Fisioterapi Generasi Baru',
        title: 'Pemulihan Presisi, Ditunjang Pendekatan Modern',
        subtitle: 'Kombinasi teknologi terapi terkini dan keahlian fisioterapis untuk hasil pemulihan yang lebih cepat dan terukur.',
        ctaLabel: 'Booking Online',
        ctaWhatsappLabel: 'Chat Kami',
      },
      about: {
        title: 'Pendekatan Kami',
        body: 'Kami memadukan metode fisioterapi modern dengan evaluasi berbasis data untuk memastikan setiap pasien mendapatkan program pemulihan yang paling sesuai dan efisien.',
        points: [
          'Evaluasi awal berbasis pengukuran objektif',
          'Program terapi yang terus dievaluasi & disesuaikan',
          'Fasilitas dan peralatan terapi mutakhir',
          'Laporan progres yang jelas untuk setiap pasien',
        ],
      },
      services: {
        title: 'Layanan Kami',
        subtitle: 'Pemulihan yang presisi dan terukur',
        items: [
          { title: 'Fisioterapi Fungsional', description: 'Terapi berbasis pola gerak untuk pemulihan fungsi tubuh secara menyeluruh.' },
          { title: 'Dry Needling & Manual Therapy', description: 'Teknik terapi lanjutan untuk mengatasi nyeri otot dan trigger point.' },
          { title: 'Terapi Neurologis', description: 'Penanganan gangguan gerak akibat kondisi neurologis.' },
          { title: 'Program Pemulihan Digital', description: 'Pemantauan progres terapi dengan laporan berkala yang jelas.' },
        ],
      },
      advantages: {
        title: 'Kenapa Nova Berbeda',
        items: [
          { title: 'Pendekatan Berbasis Data', description: 'Setiap kemajuan terapi diukur dan dipantau secara objektif.' },
          { title: 'Teknologi Terapi Modern', description: 'Menggunakan peralatan dan metode terapi yang terus diperbarui.' },
          { title: 'Transparansi Progres', description: 'Pasien mendapat laporan kemajuan yang jelas di setiap tahap.' },
        ],
      },
      testimonials: {
        items: [
          { name: 'Bimo A.', role: 'Pasien Fisioterapi Fungsional', quote: 'Saya suka karena progresnya benar-benar terukur, bukan cuma "terasa lebih baik" tapi ada datanya.' },
          { name: 'Clara T.', role: 'Pasien Dry Needling', quote: 'Metode terapinya modern dan efektif, nyeri bahu kronis saya jauh berkurang dalam beberapa sesi.' },
          { name: 'Fajar N.', role: 'Pasien Terapi Neurologis', quote: 'Tim sangat kompeten menangani kondisi saya, penjelasannya juga mudah dipahami.' },
        ],
        title: 'Apa Kata Pasien',
      },
      pricing: {
        title: 'Struktur Harga Layanan',
        subtitle: 'Transparan, sesuai kebutuhan terapi Anda',
        note: 'Harga dapat disesuaikan dengan kompleksitas kondisi -- konsultasikan dengan tim kami.',
      },
      cta: {
        title: 'Mulai Pemulihan yang Lebih Presisi',
        subtitle: 'Booking sesi evaluasi awal Anda dan rasakan pendekatan terapi modern kami.',
        buttonLabel: 'Booking Online',
      },
      footer: { tagline: 'Pemulihan modern, presisi, dan terukur untuk setiap pasien.' },
    },
  },
  {
    id: 'prestige',
    name: 'Prestige',
    description: 'Navy premium, editorial, dan photography-driven. Cocok untuk klinik yang ingin tampil eksklusif dan high-end.',
    swatch: ['#0b1f3a', '#2563eb'],
    colors: { primary: '#1d4ed8', accent: '#38bdf8' },
    style: {
      // Rendered by PremiumClinicLanding.jsx instead of the shared
      // ClinicLandingRenderer -- the layout itself (split hero, large photo
      // service cards, facilities gallery, patient journey) is structurally
      // different from the other 5 templates, not just a palette swap.
      premiumLayout: true,
      font: 'font-sans',
    },
    defaultContent: {
      hero: {
        eyebrow: 'Premium Physiotherapy & Rehabilitation',
        title: 'Pulih Lebih Cepat, Bergerak Lebih Bebas.',
        highlight: ['Lebih Cepat', 'Lebih Bebas'],
        subtitle: 'Layanan fisioterapi profesional dengan pendekatan personal dan program pemulihan yang disesuaikan dengan kebutuhan setiap pasien.',
        ctaLabel: 'Booking Konsultasi',
        ctaWhatsappLabel: 'Chat WhatsApp',
        image: '',
        trustPoints: [
          'Fisioterapis Berlisensi',
          'Program Terpersonalisasi',
          'Evidence-Based Treatment',
          'Pendampingan Personal',
        ],
        glassCard: { title: 'Trusted Physiotherapy Care', subtitle: 'Personalized Recovery Program' },
      },
      stats: {
        title: 'Dipercaya untuk mendampingi perjalanan pemulihan pasien',
        items: [
          { value: '1.000+', label: 'Pasien Ditangani' },
          { value: '95%', label: 'Kepuasan Pasien' },
          { value: '5+', label: 'Tahun Pengalaman' },
          { value: '4.9/5', label: 'Rating Pasien' },
        ],
      },
      services: {
        title: 'Layanan Kami',
        subtitle: 'Pendekatan terapi yang dirancang untuk membantu Anda kembali bergerak dengan optimal.',
        items: [
          { title: 'Fisioterapi Umum', description: 'Penanganan nyeri otot, sendi, dan cedera ringan hingga menengah.', image: '' },
          { title: 'Terapi Pasca Operasi', description: 'Program pemulihan terstruktur setelah tindakan operasi ortopedi.', image: '' },
          { title: 'Terapi Olahraga (Sports Injury)', description: 'Penanganan cedera atlet dan program kembali ke performa optimal.', image: '' },
          { title: 'Home Care', description: 'Layanan fisioterapi langsung ke rumah untuk kenyamanan pasien.', image: '' },
        ],
      },
      about: {
        title: 'Lebih dari Sekadar Terapi. Kami Membantu Anda Kembali Menikmati Aktivitas.',
        body: 'Grand Physiocare hadir untuk memberikan layanan fisioterapi yang profesional, personal, dan berbasis bukti ilmiah. Setiap pasien memiliki kondisi dan tujuan pemulihan yang berbeda, sehingga setiap program terapi dirancang secara individual.',
        image: '',
        points: [
          'Fisioterapis berpengalaman & tersertifikasi',
          'Program terapi dipersonalisasi sesuai kondisi pasien',
          'Peralatan modern dan ruang terapi nyaman',
          'Pendampingan pemulihan sampai tuntas',
        ],
        stats: [
          { value: '1.000+', label: 'Pasien Terbantu' },
          { value: '5+', label: 'Tahun Pengalaman' },
        ],
        ctaLabel: 'Kenali Kami Lebih Dekat',
      },
      advantages: {
        title: 'Mengapa Memilih Grand Physiocare?',
        subtitle: 'Alasan mengapa pasien mempercayakan pemulihannya kepada kami.',
        items: [
          { title: 'Fisioterapis Berlisensi', description: 'Ditangani oleh fisioterapis profesional dengan kompetensi dan sertifikasi yang relevan.' },
          { title: 'Pendekatan Personal', description: 'Program terapi disesuaikan dengan kondisi, kebutuhan dan target setiap pasien.' },
          { title: 'Fasilitas Modern', description: 'Didukung peralatan dan lingkungan terapi yang nyaman.' },
          { title: 'Evidence-Based Care', description: 'Pendekatan terapi berdasarkan prinsip ilmiah dan evaluasi kondisi pasien.' },
        ],
      },
      facilities: {
        title: 'Ruang Pemulihan yang Dirancang untuk Kenyamanan',
        subtitle: 'Fasilitas modern yang mendukung setiap tahap pemulihan Anda.',
        images: [
          { url: '', caption: 'Ruang Terapi Utama', size: 'large' },
          { url: '', caption: 'Peralatan Rehabilitasi', size: 'small' },
          { url: '', caption: 'Area Konsultasi', size: 'small' },
          { url: '', caption: 'Lobi & Ruang Tunggu', size: 'panoramic' },
        ],
      },
      journey: {
        title: 'Perjalanan Pemulihan Anda',
        subtitle: 'Empat tahap yang memastikan proses pemulihan Anda terarah dan terukur.',
        steps: [
          { title: 'Assessment', description: 'Evaluasi menyeluruh untuk memahami kondisi dan tujuan pemulihan Anda.' },
          { title: 'Personalized Treatment', description: 'Program terapi dirancang khusus sesuai kondisi dan target Anda.' },
          { title: 'Progress Monitoring', description: 'Perkembangan dipantau secara berkala untuk memastikan hasil optimal.' },
          { title: 'Return to Activity', description: 'Pendampingan hingga Anda kembali beraktivitas dengan percaya diri.' },
        ],
      },
      testimonials: {
        title: 'Apa Kata Pasien Kami?',
        items: [
          { name: 'Eka Puspita Sari', role: 'Pasien Fisioterapi Umum', quote: 'Nyeri punggung saya jauh berkurang setelah beberapa sesi. Terapisnya sangat komunikatif dan sabar.', rating: 5 },
          { name: 'Budi H.', role: 'Pasien Pasca Operasi', quote: 'Proses pemulihan pasca operasi lutut saya jadi lebih terarah berkat program terapi di sini. Sangat profesional!', rating: 5 },
          { name: 'Rina M.', role: 'Pasien Home Care', quote: 'Layanan home care sangat membantu karena mobilitas saya terbatas. Tim datang tepat waktu dan profesional.', rating: 5 },
        ],
      },
      faq: {
        title: 'Pertanyaan yang Sering Diajukan',
        items: [
          { question: 'Apakah saya perlu rujukan dokter untuk memulai fisioterapi?', answer: 'Tidak selalu. Anda bisa langsung melakukan assessment awal bersama tim kami untuk menentukan program terapi yang tepat.' },
          { question: 'Berapa lama satu sesi terapi berlangsung?', answer: 'Umumnya 45-60 menit per sesi, tergantung kondisi dan rencana terapi yang disepakati.' },
          { question: 'Apakah tersedia layanan home care?', answer: 'Ya, kami menyediakan layanan fisioterapi langsung ke rumah untuk pasien dengan mobilitas terbatas.' },
          { question: 'Bagaimana cara melakukan booking konsultasi?', answer: 'Anda dapat booking langsung melalui tombol "Booking Konsultasi" di halaman ini atau menghubungi kami via WhatsApp.' },
        ],
      },
      pricing: {
        title: 'Daftar Harga Layanan',
        subtitle: 'Harga transparan tanpa biaya tersembunyi',
        note: 'Harga dapat berubah sewaktu-waktu. Hubungi kami untuk info paket terbaru.',
      },
      cta: {
        title: 'Siap Kembali Bergerak Tanpa Nyeri?',
        subtitle: 'Mulai perjalanan pemulihan Anda bersama tim fisioterapis Grand Physiocare.',
        buttonLabel: 'Booking Sekarang',
        image: '',
      },
      footer: { tagline: 'Better Movement, Brighter Tomorrow.' },
    },
  },
];

export const getLandingTemplate = (id) =>
  LANDING_TEMPLATES.find((t) => t.id === id) || LANDING_TEMPLATES[0];

// Deep-merges owner overrides (clinics.landing_content) over a template's
// defaultContent so any field the owner hasn't touched keeps its ready-made
// sample copy instead of rendering blank.
export const mergeLandingContent = (defaultContent, overrides) => {
  const out = {};
  const keys = new Set([...Object.keys(defaultContent || {}), ...Object.keys(overrides || {})]);
  keys.forEach((key) => {
    const base = defaultContent?.[key];
    const override = overrides?.[key];
    if (Array.isArray(base) || Array.isArray(override)) {
      out[key] = override !== undefined ? override : base;
    } else if (base && typeof base === 'object' && override && typeof override === 'object') {
      out[key] = { ...base, ...override };
    } else {
      out[key] = override !== undefined ? override : base;
    }
  });
  return out;
};
