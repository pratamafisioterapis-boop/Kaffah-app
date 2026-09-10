import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  Users, CalendarCheck, Stethoscope, ClipboardList, Package, MessageCircle,
  Wallet, BarChart3, Sparkles, Network, TrendingUp, Heart, ShieldCheck,
  ArrowRight, CheckCircle2, XCircle, Bell, LineChart, Building2,
  HeartHandshake, Activity, Baby, Link2, Menu, X as CloseIcon,
  Database, Fingerprint, Zap, Server, Globe, Rocket, ChevronDown, PlayCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Content — mirrors the Clinara brand book verbatim so copy stays a single
// source of truth here rather than scattered across JSX.
// ---------------------------------------------------------------------------

// Section 2 — "Meet Clinara" product reveal. The pill order mirrors the
// core modules shown live in the dashboard screenshot (patient → schedule →
// records → payment → analytics) so the capability nav reads as a map of
// the real product, not a generic feature list.
const CAPABILITIES = ['Dashboard', 'Pasien', 'Appointment', 'Rekam Medis', 'Pembayaran', 'Analytics'];

const PRODUCT_CALLOUTS = [
  { icon: Users, title: 'Kelola Pasien', desc: 'Data pasien terstruktur dan mudah diakses.', side: 'left', align: 'top' },
  { icon: CalendarCheck, title: 'Atur Jadwal', desc: 'Kelola appointment dengan lebih mudah.', side: 'left', align: 'bottom' },
  { icon: BarChart3, title: 'Pantau Performa', desc: 'Lihat perkembangan klinik secara real-time.', side: 'right', align: 'top' },
  { icon: MessageCircle, title: 'Otomatisasi Komunikasi', desc: 'Reminder, follow-up, dan broadcast WhatsApp.', side: 'right', align: 'bottom' },
];

const PRODUCT_TRUST_POINTS = ['Terintegrasi', 'Mudah digunakan', 'Aman & terpercaya', 'Siap berkembang'];

const PROBLEMS = [
  'Data pasien tersebar di berbagai tempat.',
  'Jadwal tenaga kesehatan sulit dipantau.',
  'Pencatatan layanan masih dilakukan secara manual.',
  'Paket pasien sulit dipantau masa berlaku dan penggunaannya.',
  'Follow-up pasien sering terlewat.',
  'Laporan operasional membutuhkan banyak pekerjaan manual.',
  'Pemilik klinik kesulitan melihat kondisi bisnis secara real-time.',
];

const FLOW_STEPS = ['Patient', 'Appointment', 'Clinical Service', 'Payment', 'Follow-up', 'Analytics'];

const FEATURES = [
  { n: '01', icon: Users, title: 'Patient Management', desc: 'Simpan dan kelola informasi pasien secara terstruktur sehingga tim dapat mengakses informasi yang dibutuhkan dengan lebih cepat.' },
  { n: '02', icon: CalendarCheck, title: 'Appointment', desc: 'Kelola jadwal pasien dan tenaga kesehatan dalam satu sistem yang lebih terorganisir.' },
  { n: '03', icon: ClipboardList, title: 'Clinical Records', desc: 'Dokumentasikan layanan dan perjalanan pasien secara sistematis untuk mendukung continuity of care.' },
  { n: '04', icon: Package, title: 'Package Management', desc: 'Pantau paket terapi, jumlah sesi, penggunaan, masa berlaku, dan status paket pasien.' },
  { n: '05', icon: Stethoscope, title: 'Healthcare Professional', desc: 'Kelola tenaga kesehatan, jadwal kerja, aktivitas, dan performa secara lebih terukur.' },
  { n: '06', icon: Bell, title: 'Automated Communication', desc: 'Otomatisasi reminder, follow-up, dan komunikasi pasien sehingga tim tidak perlu melakukan pekerjaan repetitif secara manual.' },
  { n: '07', icon: Wallet, title: 'Finance', desc: 'Kelola transaksi dan pantau performa pendapatan dengan data yang lebih terstruktur.' },
  { n: '08', icon: LineChart, title: 'Analytics Dashboard', desc: 'Lihat kondisi klinik melalui data pasien, kunjungan, pendapatan, layanan, tenaga kesehatan, dan berbagai indikator penting lainnya.' },
];

const PROFESSIONAL_BENEFITS = [
  'Lebih mudah mengakses data pasien.',
  'Lebih mudah melihat riwayat layanan.',
  'Lebih mudah mengelola jadwal.',
  'Lebih mudah mendokumentasikan layanan.',
  'Lebih mudah memantau perjalanan pasien.',
];

const OWNER_METRICS = [
  'Jumlah pasien', 'Pasien baru', 'Jumlah kunjungan', 'Pendapatan',
  'Layanan', 'Paket', 'Performa tenaga kesehatan', 'Referral', 'Tren pertumbuhan',
];

const ADMIN_WORKFLOW = ['Patient', 'Appointment', 'Service', 'Payment', 'Follow-up'];

const JOURNEY_STAGES = [
  { n: '01', title: 'First Contact', desc: 'Pasien menemukan klinik dan melakukan booking.' },
  { n: '02', title: 'Registration', desc: 'Informasi pasien tercatat secara terstruktur.' },
  { n: '03', title: 'Assessment', desc: 'Healthcare professional memahami kebutuhan pasien.' },
  { n: '04', title: 'Treatment', desc: 'Layanan diberikan dan didokumentasikan.' },
  { n: '05', title: 'Progress', desc: 'Perjalanan pasien dapat dipantau.' },
  { n: '06', title: 'Follow-up', desc: 'Pasien mendapatkan komunikasi dan pengingat yang relevan.' },
  { n: '07', title: 'Continuity of Care', desc: 'Klinik dapat membangun hubungan jangka panjang dengan pasien.' },
];

const AUTOMATIONS = [
  'Appointment Reminder', 'Therapy Reminder', 'Follow-up', 'Package Expiry Reminder',
  'Patient Communication', 'Birthday Greeting', 'Operational Notification',
];

const ANALYTICS_CARDS = [
  { title: 'PATIENTS', desc: 'Pahami jumlah dan perkembangan pasien.' },
  { title: 'VISITS', desc: 'Pantau tren kunjungan.' },
  { title: 'REVENUE', desc: 'Lihat performa pendapatan.' },
  { title: 'SERVICES', desc: 'Pahami layanan yang paling banyak digunakan.' },
  { title: 'PROFESSIONALS', desc: 'Pantau performa tenaga kesehatan.' },
  { title: 'GROWTH', desc: 'Lihat bagaimana klinik berkembang dari waktu ke waktu.' },
];

const FACILITIES = [
  'Physiotherapy Clinic', 'Child Development Center', 'Rehabilitation Center',
  'Speech Therapy Center', 'Occupational Therapy Center', 'Sports Rehabilitation Center',
  'Multi-disciplinary Clinic', 'Healthcare Practice',
];

const ECOSYSTEM = [
  { icon: Building2, name: 'Clinara Clinic', tag: 'Clinic Management', desc: 'Mengelola operasional klinik dalam satu platform.' },
  { icon: HeartHandshake, name: 'Clinara Care', tag: 'Patient Engagement', desc: 'Membangun komunikasi dan hubungan yang lebih baik dengan pasien.' },
  { icon: Activity, name: 'Clinara Rehab', tag: 'Rehabilitation Management', desc: 'Mendukung kebutuhan fisioterapi dan layanan rehabilitasi.' },
  { icon: Baby, name: 'Clinara Kids', tag: 'Child Development', desc: 'Mendukung pengelolaan layanan tumbuh kembang dan terapi anak.' },
  { icon: Link2, name: 'Clinara Connect', tag: 'Communication & Automation', desc: 'Menghubungkan klinik dengan pasien melalui komunikasi dan automation.' },
  { icon: LineChart, name: 'Clinara Insight', tag: 'Healthcare Analytics', desc: 'Mengubah data klinik menjadi insight untuk pengambilan keputusan.' },
];

const WHY_REASONS = [
  { title: 'Healthcare-focused', desc: 'Clinara dirancang dengan memahami kebutuhan fasilitas kesehatan dan pusat terapi.', icon: Stethoscope },
  { title: 'Integrated', desc: 'Berbagai proses penting klinik terhubung dalam satu ekosistem.', icon: Network },
  { title: 'Simple', desc: 'Antarmuka dirancang agar mudah dipahami dan digunakan oleh seluruh tim.', icon: Sparkles },
  { title: 'Data-driven', desc: 'Data membantu manajemen memahami kondisi klinik dan mengambil keputusan.', icon: BarChart3 },
  { title: 'Scalable', desc: 'Clinara dapat berkembang mengikuti pertumbuhan klinik dan kebutuhan layanan.', icon: TrendingUp },
  { title: 'Human-centered', desc: 'Teknologi digunakan untuk membantu manusia memberikan pelayanan yang lebih baik.', icon: Heart },
];

const SECURITY_PRINCIPLES = [
  'Secure authentication', 'Role-based access', 'Data access control',
  'User permissions', 'Structured data management', 'Audit-friendly workflow',
];

const PRICING_FEATURES = [
  'Website klinik + subdomain', 'Domain sendiri (custom domain)', 'Booking online tanpa batas',
  'Rekam medis elektronik', 'Keuangan & invoice', 'Semua peran & dashboard', 'Tanpa batas admin & terapis',
];

const PRICING_PLANS = [
  { badge: 'Coba dulu', name: '1 Bulan', desc: 'Cocok untuk mencoba seluruh fitur platform.', price: 'Rp150.000', period: '/bulan', highlight: false },
  { badge: 'Paling populer', name: '3 Bulan', desc: 'Hemat untuk operasional klinik jangka menengah.', price: 'Rp450.000', period: '/3 bulan', highlight: true },
  { badge: 'Paling hemat', name: '1 Tahun', desc: 'Nilai terbaik untuk klinik yang berkembang.', price: 'Rp1.250.000', period: '/tahun', highlight: false },
];

const SELF_HOSTED_FEATURES = [
  { icon: Zap, title: 'Bayar sekali', desc: 'Tanpa biaya langganan bulanan — cukup satu kali untuk selamanya.' },
  { icon: Database, title: 'Data 100% milik Anda', desc: 'Berjalan di akun Cloudflare & Supabase klinik sendiri (tier gratis).' },
  { icon: Rocket, title: 'Deploy otomatis', desc: 'Pemasangan kami siapkan otomatis — klinik siap pakai tanpa keahlian teknis.' },
  { icon: Globe, title: 'Domain sendiri', desc: 'Pakai domain milik klinik, tampil sepenuhnya sebagai brand Anda.' },
];

const SECURITY_CARDS = [
  { icon: Database, title: 'Isolasi data antar klinik', desc: 'Row Level Security memastikan data satu klinik tak pernah terlihat klinik lain.' },
  { icon: Fingerprint, title: 'Audit akses rekam medis', desc: 'Setiap buka & ubah data medis meninggalkan jejak untuk kepatuhan privasi.' },
  { icon: ShieldCheck, title: 'Retensi data medis', desc: 'Data pasien & rekam medis tidak dihapus permanen (soft-delete), sesuai UU PDP.' },
  { icon: Zap, title: 'Perlindungan anti-abuse', desc: 'Rate limiting pada endpoint publik mencegah spam & penyalahgunaan.' },
];

const TIPE_KLINIK = [
  'Fisioterapi', 'Okupasi Terapi', 'Terapi Wicara', 'Terapi Tumbuh Kembang',
  'Terapi Perilaku', 'Terapi Aquatic', 'Psikolog',
];

const FAQS = [
  { q: 'Apakah ada masa coba gratis?', a: 'Ya. Setiap klinik baru mendapatkan 7 hari gratis dengan seluruh fitur terbuka penuh, aktif saat itu juga tanpa perlu kartu kredit.' },
  { q: 'Apakah data pasien klinik saya aman dan terpisah dari klinik lain?', a: 'Aman. Setiap klinik diisolasi dengan Row Level Security di level database, sehingga data satu klinik tidak pernah terlihat oleh klinik lain.' },
  { q: 'Apa bedanya paket langganan dan self-hosted?', a: 'Fitur keduanya identik. Paket langganan dikelola penuh oleh tim Clinara, sedangkan self-hosted berjalan di infrastruktur milik klinik sendiri dengan sekali bayar.' },
  { q: 'Bisakah saya upgrade atau downgrade paket kapan saja?', a: 'Bisa. Anda dapat berpindah paket kapan saja tanpa kehilangan data — hubungi tim kami untuk perubahan paket.' },
  { q: 'Bagaimana jika masa langganan berakhir?', a: 'Website klinik tetap tayang, hanya booking online & dashboard yang terkunci sampai diperpanjang. Data Anda tidak dihapus.' },
];

const BRAND_VALUES = [
  { title: 'CARE FIRST', desc: 'Pasien selalu menjadi pusat dari setiap keputusan.', icon: Heart },
  { title: 'SIMPLICITY', desc: 'Teknologi harus membuat pekerjaan lebih mudah, bukan lebih rumit.', icon: Sparkles },
  { title: 'TRUST', desc: 'Sistem dan informasi harus dapat dipercaya.', icon: ShieldCheck },
  { title: 'PROGRESS', desc: 'Kami percaya setiap klinik dapat terus berkembang.', icon: TrendingUp },
  { title: 'HUMAN', desc: 'Teknologi membantu manusia memberikan pelayanan yang lebih baik.', icon: Users },
  { title: 'DATA-DRIVEN', desc: 'Keputusan yang lebih baik dimulai dari informasi yang lebih baik.', icon: BarChart3 },
];

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

const FadeIn = ({ children, className = '', delay = 0, style }) => (
  <motion.div
    className={className}
    style={style}
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.5, delay }}
  >
    {children}
  </motion.div>
);

const Label = ({ children }) => (
  <span className="inline-block text-xs font-bold tracking-[0.2em] text-clinara-teal uppercase mb-4">
    {children}
  </span>
);

const Section = ({ id, className = '', children }) => (
  <section id={id} className={`py-20 md:py-28 px-4 ${className}`}>
    <div className="container mx-auto max-w-6xl">{children}</div>
  </section>
);

// Floating annotation card used around the Section 2 product showcase. On
// desktop it's absolutely positioned beside the dashboard with a thin
// connector line pointing at it; on mobile/tablet it's rendered as a plain
// card in a stacked/2-col grid (connector omitted — there's no dashboard
// edge to point at once it's no longer floating alongside it).
const FloatingCallout = ({ icon: Icon, title, desc, connector = false, connectorSide = 'right' }) => (
  <div className="relative w-56 rounded-2xl border border-slate-100 bg-white/95 backdrop-blur-sm shadow-[0_16px_40px_rgba(11,39,71,0.10)] p-4">
    {connector && (
      <span
        aria-hidden="true"
        className={`hidden lg:block absolute top-1/2 w-10 h-px bg-gradient-to-r from-clinara-teal/60 to-clinara-teal/0 ${
          connectorSide === 'right' ? 'left-full' : 'right-full rotate-180'
        }`}
      />
    )}
    <div className="w-9 h-9 rounded-lg bg-clinara-teal/10 flex items-center justify-center mb-3">
      <Icon className="w-[18px] h-[18px] text-clinara-blue" />
    </div>
    <h4 className="font-bold text-clinara-navy text-[15px] leading-snug mb-1">{title}</h4>
    <p className="text-[13px] text-slate-500 leading-relaxed">{desc}</p>
  </div>
);

// Full brand lockup (mark + wordmark + tagline, transparent background) —
// used large in the hero. The compact navbar/footer mark below is a plain
// text wordmark instead: the source file is a square stacked lockup, not a
// horizontal mark, so shrinking it into a 36px-tall navbar slot would still
// crop the icon away from the wordmark.
const LOGO_URL = '/clinara-logo.png';
const ICON_URL = '/clinara-icon.png';

const Logo = ({ dark = false }) => (
  <span className={`inline-flex items-center gap-2 text-2xl font-extrabold tracking-tight ${dark ? 'text-white' : 'text-clinara-navy'}`}>
    <img src={ICON_URL} alt="" className="w-8 h-8" />
    Clinara
  </span>
);

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------

const ClinaraNavbar = () => {
  const [open, setOpen] = React.useState(false);
  const links = [
    { name: 'Fitur', href: '#fitur' },
    { name: 'Peran', href: '#untuk-siapa' },
    { name: 'Harga', href: '#harga' },
    { name: 'FAQ', href: '#faq' },
  ];
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
      <div className="container mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <a href="#top"><Logo /></a>
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a key={l.name} href={l.href} className="text-sm font-medium text-slate-600 hover:text-clinara-navy transition-colors">
              {l.name}
            </a>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-3">
          <a href="/login" className="text-sm font-semibold text-clinara-navy hover:text-clinara-blue transition-colors px-3">
            Masuk
          </a>
          <a href="/register">
            <Button className="bg-clinara-navy hover:bg-clinara-blue text-white rounded-full px-5 gap-1.5">
              Daftarkan Klinik <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </a>
        </div>
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <CloseIcon className="w-6 h-6 text-clinara-navy" /> : <Menu className="w-6 h-6 text-clinara-navy" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 flex flex-col gap-4">
          {links.map((l) => (
            <a key={l.name} href={l.href} onClick={() => setOpen(false)} className="text-sm font-medium text-slate-700">
              {l.name}
            </a>
          ))}
          <a href="/login" className="text-sm font-semibold text-clinara-navy">Masuk</a>
          <a href="/register">
            <Button className="w-full bg-clinara-navy hover:bg-clinara-blue text-white rounded-full">Daftarkan Klinik</Button>
          </a>
        </div>
      )}
    </nav>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const ClinaraLandingPage = () => {
  const [activeCapability, setActiveCapability] = React.useState(CAPABILITIES[0]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <Helmet>
        <title>Clinara — Better Care. Smarter Management.</title>
        <meta
          name="description"
          content="Clinara adalah Healthcare Management Platform yang membantu klinik dan pusat terapi mengelola pasien, tenaga kesehatan, jadwal, layanan, komunikasi, dan data dalam satu sistem terintegrasi."
        />
        <link rel="canonical" href="https://clinara.id/" />
        <link rel="icon" type="image/png" href={ICON_URL} />
        <link rel="apple-touch-icon" href="/clinara-icon-app.png" />
        <link rel="manifest" href="/manifest-clinara.json" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Clinara — Better Care. Smarter Management." />
        <meta property="og:description" content="Platform manajemen layanan kesehatan untuk klinik dan pusat terapi." />
        <meta name="theme-color" content="#0f2a4a" />
      </Helmet>

      <div id="top" className="min-h-screen bg-white font-sans text-slate-900 selection:bg-clinara-teal selection:text-white">
        <ClinaraNavbar />

        {/* HERO */}
        <header className="relative overflow-hidden bg-clinara-bg min-h-[calc(100vh-4rem)] flex items-center pt-28 pb-16 md:pt-16 md:pb-0">
          {/* LAYER 1 — background environment photo */}
          <div className="absolute inset-0 z-0">
            <img
              src="/hero/clinara-hero-bg.png"
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover object-[center_right] opacity-40 md:opacity-100"
            />
            {/* left-to-right wash so headline stays readable, softest over the photo's right side */}
            <div className="absolute inset-0 bg-gradient-to-r from-clinara-bg via-clinara-bg/95 to-clinara-bg/10 md:via-clinara-bg/80" />
            <div className="absolute inset-0 bg-gradient-to-t from-clinara-bg via-transparent to-clinara-bg/30" />
            <div className="absolute inset-0 bg-clinara-navy/5" />
          </div>

          <div className="container mx-auto max-w-6xl px-4 relative z-10">
            <div className="grid lg:grid-cols-[minmax(0,560px)_1fr] gap-12 lg:gap-8 items-center">

              {/* LAYER 2 — content */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className="text-center lg:text-left"
              >
                <span className="inline-block text-xs sm:text-sm font-semibold tracking-[0.2em] text-clinara-teal uppercase mb-5">
                  Healthcare Clinic Management Platform
                </span>
                <h1 className="text-[2.5rem] leading-[1.05] sm:text-5xl md:text-6xl lg:text-[4rem] lg:leading-[0.98] font-extrabold text-clinara-navy tracking-tight">
                  Run your clinic.
                  <br />
                  <span className="bg-gradient-to-r from-clinara-navy via-clinara-blue to-clinara-teal bg-clip-text text-transparent">
                    Everything connected.
                  </span>
                </h1>
                <p className="mt-6 text-lg md:text-xl leading-relaxed text-slate-600 max-w-[520px] mx-auto lg:mx-0">
                  Clinara membantu klinik mengelola pasien, jadwal, layanan, tenaga kesehatan, pembayaran,
                  komunikasi, dan analytics dalam satu platform yang terintegrasi.
                </p>

                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5">
                  <a href="/register" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto h-12 bg-clinara-navy hover:bg-clinara-blue text-white rounded-full px-7 gap-2 shadow-lg shadow-clinara-navy/20">
                      Mulai Gratis 7 Hari <ArrowRight className="w-4 h-4" />
                    </Button>
                  </a>
                  <a href="#cara-kerja" className="w-full sm:w-auto">
                    <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 rounded-full px-7 gap-2 border-clinara-navy/25 bg-white/60 backdrop-blur-sm text-clinara-navy hover:bg-white">
                      <PlayCircle className="w-4 h-4" /> Lihat Cara Kerja
                    </Button>
                  </a>
                </div>

                <div className="mt-7 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-sm font-medium text-slate-600">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-clinara-teal shrink-0" /> Tanpa kartu kredit</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-clinara-teal shrink-0" /> Setup cepat</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-clinara-teal shrink-0" /> Semua fitur lengkap</span>
                </div>
              </motion.div>

              {/* LAYER 3 — product showcase */}
              <div className="relative mt-4 lg:mt-0 h-[320px] xs:h-[380px] sm:h-[440px] md:h-[520px] lg:h-[560px]">
                <motion.div
                  initial={{ opacity: 0, y: 30, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                  className="absolute inset-0 flex items-center justify-center lg:justify-end"
                >
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                    className="relative w-[112%] xs:w-[105%] sm:w-[95%] lg:w-[108%] -rotate-2 lg:-rotate-3"
                    style={{ boxShadow: '0 30px 80px rgba(11, 39, 71, 0.18), 0 10px 30px rgba(11, 39, 71, 0.12)' }}
                  >
                    <div className="rounded-[20px] overflow-hidden border border-white/60 bg-white ring-1 ring-clinara-navy/5">
                      <img
                        src="/hero/clinara-hero-dashboard.png"
                        alt="Dashboard aplikasi Clinara menampilkan data pasien, jadwal, dan analitik klinik"
                        className="w-full h-auto block object-contain"
                      />
                    </div>
                    {/* subtle glass reflection */}
                    <div className="absolute inset-0 rounded-[20px] bg-gradient-to-tr from-white/0 via-white/10 to-white/0 pointer-events-none" />

                    {/* floating platform label */}
                    <span className="hidden sm:inline-flex absolute -top-4 left-6 items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-white/60 shadow-sm text-[11px] font-bold tracking-wide uppercase text-clinara-navy">
                      <Sparkles className="w-3 h-3 text-clinara-teal" /> Clinara Platform
                    </span>
                  </motion.div>

                  {/* mobile app floating in front */}
                  <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
                    className="absolute w-[26%] sm:w-[24%] lg:w-[22%] bottom-[-6%] right-[2%] sm:right-[6%] lg:right-[-2%] rotate-[3deg]"
                    style={{ boxShadow: '0 24px 60px rgba(11, 39, 71, 0.28)' }}
                  >
                    <img
                      src="/hero/clinara-hero-mobile.png"
                      alt="Tampilan aplikasi mobile Clinara"
                      className="w-full h-auto block"
                    />
                  </motion.div>
                </motion.div>
              </div>
            </div>
          </div>
        </header>

        {/* MEET CLINARA — product reveal */}
        <section id="platform" className="relative overflow-hidden bg-clinara-bg pt-28 md:pt-32 pb-24 md:pb-28 px-4">
          {/* soft depth glow, very low opacity — no particles/blobs */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full bg-clinara-sky/10 blur-3xl" />
          </div>

          <div className="container mx-auto max-w-6xl relative">
            <FadeIn className="text-center mb-6 md:mb-7">
              <Label>Meet Clinara</Label>
              <h2 className="text-4xl sm:text-5xl md:text-[3.25rem] font-extrabold text-clinara-navy leading-[1.05] tracking-tight">
                Everything your clinic needs.
                <br />
                <span className="bg-gradient-to-r from-clinara-navy to-clinara-blue bg-clip-text text-transparent">
                  One connected platform.
                </span>
              </h2>
              <p className="mt-6 text-[17px] md:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
                Satu sistem untuk mengelola seluruh operasional klinik — dari pasien, jadwal, layanan, tenaga
                kesehatan, pembayaran, komunikasi, hingga analytics. Dirancang untuk membuat klinik Anda lebih
                efisien dan berkembang.
              </p>
            </FadeIn>

            {/* capability selector */}
            <FadeIn delay={0.1} className="mt-10 md:mt-12 mb-10 md:mb-14">
              <div className="flex lg:flex-wrap lg:justify-center gap-2.5 overflow-x-auto lg:overflow-visible px-4 -mx-4 lg:px-0 lg:mx-0 snap-x snap-mandatory">
                {CAPABILITIES.map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => setActiveCapability(cap)}
                    aria-pressed={activeCapability === cap}
                    className={`shrink-0 snap-start px-5 py-2.5 rounded-full text-sm font-semibold border transition-colors ${
                      activeCapability === cap
                        ? 'bg-clinara-navy text-white border-clinara-navy'
                        : 'bg-white text-clinara-navy border-slate-200 hover:border-clinara-teal/50'
                    }`}
                  >
                    {cap}
                  </button>
                ))}
              </div>
            </FadeIn>

            {/* product showcase — callouts share the laptop's own max-width box so
                left-0/right-0 line up exactly with its edges, then push out by a
                fixed gap via calc() regardless of card width */}
            <div className="relative mx-auto sm:max-w-3xl lg:max-w-4xl">
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.97 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="relative w-[112%] -ml-[6%] sm:w-full sm:ml-0"
              >
                <img
                  src="/hero/clinara-section2-laptop.png"
                  alt="Dashboard Clinara ditampilkan di laptop — menu pasien, appointment, rekam medis, pembayaran, dan analytics klinik"
                  className="w-full h-auto block"
                />
              </motion.div>

              {/* desktop floating callouts — positioned with right/left (not
                  transform) so they don't fight framer-motion's own y-transform
                  animation on the FadeIn wrapper */}
              <div className="hidden xl:block">
                <FadeIn delay={0.25} className="absolute top-[8%]" style={{ right: 'calc(100% + 28px)' }}>
                  <FloatingCallout {...PRODUCT_CALLOUTS[0]} connector connectorSide="right" />
                </FadeIn>
                <FadeIn delay={0.35} className="absolute bottom-[14%]" style={{ right: 'calc(100% + 28px)' }}>
                  <FloatingCallout {...PRODUCT_CALLOUTS[1]} connector connectorSide="right" />
                </FadeIn>
                <FadeIn delay={0.3} className="absolute top-[6%]" style={{ left: 'calc(100% + 28px)' }}>
                  <FloatingCallout {...PRODUCT_CALLOUTS[2]} connector connectorSide="left" />
                </FadeIn>
                <FadeIn delay={0.4} className="absolute bottom-[16%]" style={{ left: 'calc(100% + 28px)' }}>
                  <FloatingCallout {...PRODUCT_CALLOUTS[3]} connector connectorSide="left" />
                </FadeIn>
              </div>
            </div>

            {/* lg-only callouts: not enough side margin for floating cards yet,
                so show them as a centered 2-col grid instead of overlapping the laptop */}
            <div className="hidden lg:grid xl:hidden sm:grid-cols-2 gap-4 mt-10 max-w-2xl mx-auto">
              {PRODUCT_CALLOUTS.map((c, i) => (
                <FadeIn key={c.title} delay={i * 0.06}>
                  <FloatingCallout {...c} />
                </FadeIn>
              ))}
            </div>

            {/* mobile/tablet callouts */}
            <div className="grid sm:grid-cols-2 lg:hidden gap-4 mt-10 max-w-xl sm:max-w-2xl mx-auto">
              {PRODUCT_CALLOUTS.map((c, i) => (
                <FadeIn key={c.title} delay={i * 0.06}>
                  <FloatingCallout {...c} />
                </FadeIn>
              ))}
            </div>

            {/* bottom statement */}
            <FadeIn delay={0.15} className="text-center mt-20 md:mt-24">
              <p className="text-[13px] font-bold tracking-[0.18em] text-slate-500 uppercase">
                Not just a website.<br className="sm:hidden" /> A system behind your clinic.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                {PRODUCT_TRUST_POINTS.map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-clinara-teal shrink-0" /> {t}
                  </span>
                ))}
              </div>
            </FadeIn>
          </div>
        </section>

        {/* PROBLEM */}
        <Section className="bg-clinara-navy text-white">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <FadeIn>
              <Label>The Challenge</Label>
              <h2 className="text-3xl md:text-4xl font-bold">
                Klinik berkembang.<br />Kompleksitas ikut berkembang.
              </h2>
              <p className="mt-5 text-slate-300 leading-relaxed">
                Semakin banyak pasien dan layanan yang dimiliki klinik, semakin banyak pula hal yang harus dikelola.
              </p>
              <p className="mt-6 text-clinara-mint font-semibold">
                Ketika sistem tidak terhubung, pekerjaan menjadi lebih lambat dan keputusan menjadi lebih sulit.
              </p>
            </FadeIn>
            <FadeIn delay={0.1} className="space-y-3">
              {PROBLEMS.map((p) => (
                <div key={p} className="flex items-start gap-3 bg-white/5 rounded-xl p-4 border border-white/10">
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-200">{p}</span>
                </div>
              ))}
            </FadeIn>
          </div>
        </Section>

        {/* SOLUTION */}
        <Section id="cara-kerja">
          <FadeIn className="text-center max-w-3xl mx-auto mb-14">
            <Label>The Clinara Way</Label>
            <h2 className="text-3xl md:text-4xl font-bold text-clinara-navy">
              Simplify the complexity behind better healthcare.
            </h2>
            <p className="mt-5 text-slate-600 leading-relaxed">
              Clinara menyatukan berbagai proses penting dalam operasional klinik sehingga tim dapat bekerja dari
              satu sumber informasi yang terorganisir.
            </p>
          </FadeIn>
          <FadeIn delay={0.1} className="flex flex-wrap items-center justify-center gap-3 mb-8">
            {FLOW_STEPS.map((step, i) => (
              <React.Fragment key={step}>
                <span className="px-5 py-2.5 rounded-full bg-clinara-navy text-white text-sm font-semibold">
                  {step}
                </span>
                {i < FLOW_STEPS.length - 1 && <ArrowRight className="w-4 h-4 text-clinara-teal shrink-0" />}
              </React.Fragment>
            ))}
          </FadeIn>
          <FadeIn delay={0.15} className="text-center text-slate-600 max-w-2xl mx-auto">
            Dari pasien melakukan booking hingga manajemen memahami performa klinik, seluruh perjalanan dapat
            terhubung dalam satu ekosistem.
          </FadeIn>
        </Section>

        {/* FEATURES */}
        <Section id="fitur" className="bg-clinara-bg">
          <FadeIn className="text-center max-w-2xl mx-auto mb-14">
            <Label>Powerful Tools. Simple Experience.</Label>
            <h2 className="text-3xl md:text-4xl font-bold text-clinara-navy">
              Dirancang untuk kebutuhan nyata klinik.
            </h2>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f, i) => (
              <FadeIn key={f.title} delay={(i % 4) * 0.05} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 rounded-xl bg-clinara-teal/10 flex items-center justify-center">
                    <f.icon className="w-5 h-5 text-clinara-blue" />
                  </div>
                  <span className="text-xs font-bold text-slate-300">{f.n}</span>
                </div>
                <h3 className="font-bold text-clinara-navy mb-1.5">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </FadeIn>
            ))}
          </div>
        </Section>

        {/* PRICING */}
        <Section id="harga">
          <FadeIn className="text-center max-w-2xl mx-auto mb-14">
            <Label>Harga</Label>
            <h2 className="text-3xl md:text-4xl font-bold text-clinara-navy">Pilih cara yang paling pas.</h2>
            <p className="mt-5 text-slate-600 leading-relaxed">
              Langganan bulanan yang praktis dan langsung aktif, atau self-hosted sekali bayar dengan infrastruktur
              &amp; data milik klinik sendiri. Semua fitur sama.
            </p>
          </FadeIn>

          <FadeIn className="text-center mb-8">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-clinara-bg border border-slate-200 text-clinara-navy text-xs font-bold uppercase tracking-wide">
              <CheckCircle2 className="w-3.5 h-3.5 text-clinara-teal" /> Langganan — dikelola kami
            </span>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            {PRICING_PLANS.map((plan, i) => (
              <FadeIn
                key={plan.name}
                delay={i * 0.08}
                className={`relative rounded-2xl p-8 flex flex-col ${
                  plan.highlight
                    ? 'bg-white border-2 border-clinara-teal shadow-xl md:-translate-y-2'
                    : 'bg-white border border-slate-100'
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-clinara-teal text-white text-xs font-bold">
                    Paling Populer
                  </span>
                )}
                <span className="inline-block text-xs font-bold text-clinara-blue uppercase tracking-wide mb-3">{plan.badge}</span>
                <h3 className="text-2xl font-bold text-clinara-navy">{plan.name}</h3>
                <p className="mt-1.5 text-sm text-slate-500">{plan.desc}</p>
                <div className="mt-5">
                  <span className="text-3xl font-extrabold text-clinara-navy">{plan.price}</span>
                  <span className="text-sm text-slate-500">{plan.period}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">Semua fitur terbuka penuh, tanpa biaya tersembunyi.</p>
                <ul className="mt-6 space-y-2.5 flex-1">
                  {PRICING_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-clinara-teal shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                <a href="/register" className="mt-6 block">
                  <Button className={`w-full rounded-full ${plan.highlight ? 'bg-clinara-navy hover:bg-clinara-blue text-white' : 'bg-clinara-bg text-clinara-navy hover:bg-clinara-navy hover:text-white'}`}>
                    Daftarkan Klinik
                  </Button>
                </a>
              </FadeIn>
            ))}
          </div>

          <FadeIn className="text-center mt-8 text-sm text-slate-500">
            Saat langganan berakhir, website klinik tetap tayang — hanya booking &amp; dashboard yang terkunci sampai diperpanjang.
          </FadeIn>

          <FadeIn className="mt-16 rounded-3xl bg-clinara-navy text-white p-8 md:p-10">
            <div className="grid md:grid-cols-[1.2fr,1fr] gap-10 items-center">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-bold uppercase tracking-wide">
                    <Server className="w-3.5 h-3.5" /> Self-Hosted
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-bold uppercase tracking-wide">
                    <Link2 className="w-3.5 h-3.5" /> Sekali Bayar
                  </span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold">Punya sendiri, tanpa langganan bulanan.</h3>
                <p className="mt-4 text-slate-300 leading-relaxed">
                  Seluruh aplikasi berjalan di infrastruktur milik klinik Anda — data 100% Anda pegang, cukup bayar
                  satu kali. Cocok untuk yang ingin kontrol dan kepemilikan penuh. Fitur identik dengan versi
                  langganan.
                </p>
                <div className="mt-6 flex items-center gap-4">
                  <a href="mailto:hello@clinara.id?subject=Konsultasi%20Self-Hosted%20Clinara">
                    <Button className="bg-white text-clinara-navy hover:bg-slate-100 rounded-full px-6 gap-1.5">
                      Konsultasikan Kebutuhan <ArrowRight className="w-4 h-4" />
                    </Button>
                  </a>
                  <span className="text-sm text-slate-300">Harga: <span className="font-semibold text-white">Hubungi kami</span></span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {SELF_HOSTED_FEATURES.map((f) => (
                  <div key={f.title} className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <f.icon className="w-5 h-5 text-clinara-mint mb-2" />
                    <h4 className="text-sm font-bold">{f.title}</h4>
                    <p className="mt-1 text-xs text-slate-300 leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </Section>

        {/* AUDIENCES */}
        <Section id="untuk-siapa">
          <div className="grid lg:grid-cols-3 gap-6">
            <FadeIn className="rounded-2xl bg-clinara-navy text-white p-8">
              <Label>For Healthcare Professionals</Label>
              <h3 className="text-2xl font-bold mb-3">Less administration.<br />More care.</h3>
              <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                Tenaga kesehatan seharusnya menghabiskan lebih banyak waktu untuk pasien, bukan untuk pekerjaan
                administratif yang berulang. Clinara membantu menyederhanakan proses kerja sehingga healthcare
                professional dapat bekerja dengan lebih terorganisir.
              </p>
              <ul className="space-y-2 mb-6">
                {PROFESSIONAL_BENEFITS.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-clinara-mint shrink-0 mt-0.5" /> {b}
                  </li>
                ))}
              </ul>
              <p className="text-clinara-mint font-semibold text-sm">Your focus should be care.</p>
            </FadeIn>

            <FadeIn delay={0.08} className="rounded-2xl bg-clinara-bg p-8 border border-slate-100">
              <Label>For Clinic Owners</Label>
              <h3 className="text-2xl font-bold text-clinara-navy mb-3">Run your clinic with clarity.</h3>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Pemilik klinik membutuhkan lebih dari sekadar laporan transaksi. Clinara membantu memberikan
                gambaran yang lebih jelas mengenai bagaimana klinik berjalan dan berkembang.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {OWNER_METRICS.map((m) => (
                  <span key={m} className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600">
                    {m}
                  </span>
                ))}
              </div>
              <p className="text-sm font-semibold text-clinara-navy leading-relaxed">
                See what's happening. Understand why. Decide what's next.
              </p>
            </FadeIn>

            <FadeIn delay={0.16} className="rounded-2xl bg-clinara-bg p-8 border border-slate-100">
              <Label>For Administrators</Label>
              <h3 className="text-2xl font-bold text-clinara-navy mb-3">Everything organized in one place.</h3>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Clinara membantu admin mengurangi pekerjaan berulang dan mengelola informasi klinik secara lebih
                terstruktur.
              </p>
              <div className="flex flex-wrap items-center gap-2 mb-6">
                {ADMIN_WORKFLOW.map((w, i) => (
                  <React.Fragment key={w}>
                    <span className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-clinara-navy">
                      {w}
                    </span>
                    {i < ADMIN_WORKFLOW.length - 1 && <ArrowRight className="w-3 h-3 text-slate-400" />}
                  </React.Fragment>
                ))}
              </div>
              <p className="text-sm font-semibold text-clinara-navy leading-relaxed">
                Fewer repetitive tasks. Fewer scattered records. Better workflow.
              </p>
            </FadeIn>
          </div>
        </Section>

        {/* PATIENT JOURNEY */}
        <Section className="bg-clinara-bg">
          <FadeIn className="text-center max-w-2xl mx-auto mb-14">
            <Label>Patient Journey</Label>
            <h2 className="text-3xl md:text-4xl font-bold text-clinara-navy">
              Because better healthcare is more than one visit.
            </h2>
            <p className="mt-5 text-slate-600 leading-relaxed">
              Perjalanan pasien tidak berhenti ketika satu sesi selesai. Clinara membantu klinik memahami dan
              mengelola perjalanan pasien secara lebih menyeluruh.
            </p>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {JOURNEY_STAGES.map((s, i) => (
              <FadeIn key={s.n} delay={(i % 4) * 0.05} className="bg-white rounded-2xl p-6 border border-slate-100">
                <span className="text-clinara-teal font-black text-xl">{s.n}</span>
                <h3 className="font-bold text-clinara-navy mt-2 mb-1.5">{s.title}</h3>
                <p className="text-sm text-slate-600">{s.desc}</p>
              </FadeIn>
            ))}
          </div>
        </Section>

        {/* AUTOMATION */}
        <Section>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <FadeIn>
              <Label>Smart Automation</Label>
              <h2 className="text-3xl md:text-4xl font-bold text-clinara-navy">
                Let Clinara handle the repetitive work.
              </h2>
              <p className="mt-5 text-slate-600 leading-relaxed">
                Tidak semua pekerjaan membutuhkan manusia. Clinara membantu mengotomatisasi pekerjaan repetitif
                sehingga tim dapat lebih fokus pada aktivitas yang memberikan nilai lebih besar.
              </p>
              <p className="mt-6 font-semibold text-clinara-navy">
                Less repetitive work. More meaningful care.
              </p>
            </FadeIn>
            <FadeIn delay={0.1} className="flex flex-wrap gap-3">
              {AUTOMATIONS.map((a) => (
                <span key={a} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-clinara-navy/5 border border-clinara-navy/10 text-sm font-medium text-clinara-navy">
                  <Bell className="w-3.5 h-3.5 text-clinara-blue" /> {a}
                </span>
              ))}
            </FadeIn>
          </div>
        </Section>

        {/* ANALYTICS */}
        <Section className="bg-clinara-navy text-white">
          <FadeIn className="text-center max-w-2xl mx-auto mb-14">
            <Label>Data &amp; Analytics</Label>
            <h2 className="text-3xl md:text-4xl font-bold">
              Turn clinic data into better decisions.
            </h2>
            <p className="mt-5 text-slate-300 leading-relaxed">
              Data klinik sering kali tersebar di berbagai tempat. Clinara membantu mengubah data operasional
              menjadi informasi yang lebih mudah dipahami dan digunakan.
            </p>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {ANALYTICS_CARDS.map((c, i) => (
              <FadeIn key={c.title} delay={(i % 3) * 0.05} className="bg-white/5 rounded-2xl p-6 border border-white/10">
                <h3 className="font-bold tracking-wide text-clinara-mint mb-1.5">{c.title}</h3>
                <p className="text-sm text-slate-300">{c.desc}</p>
              </FadeIn>
            ))}
          </div>
          <FadeIn className="text-center font-semibold text-lg">
            Better data. Better decisions.
          </FadeIn>
        </Section>

        {/* MULTI-DISCIPLINARY */}
        <Section>
          <FadeIn className="text-center max-w-2xl mx-auto mb-10">
            <Label>Built for Healthcare</Label>
            <h2 className="text-3xl md:text-4xl font-bold text-clinara-navy">
              One platform. Multiple possibilities.
            </h2>
            <p className="mt-5 text-slate-600 leading-relaxed">
              Clinara dirancang agar dapat berkembang mengikuti kebutuhan fasilitas kesehatan.
            </p>
          </FadeIn>
          <FadeIn delay={0.1} className="flex flex-wrap justify-center gap-3 mb-10">
            {FACILITIES.map((f) => (
              <span key={f} className="px-4 py-2 rounded-full bg-clinara-bg border border-slate-200 text-sm font-medium text-clinara-navy">
                {f}
              </span>
            ))}
          </FadeIn>
          <FadeIn className="text-center font-semibold text-clinara-navy">
            Built for today's clinic. Ready for tomorrow's healthcare.
          </FadeIn>
        </Section>

        {/* ECOSYSTEM */}
        <Section id="ekosistem" className="bg-clinara-bg">
          <FadeIn className="text-center max-w-2xl mx-auto mb-14">
            <Label>Clinara Ecosystem</Label>
            <h2 className="text-3xl md:text-4xl font-bold text-clinara-navy">
              A platform that grows with your clinic.
            </h2>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ECOSYSTEM.map((p, i) => (
              <FadeIn key={p.name} delay={(i % 3) * 0.05} className="bg-white rounded-2xl p-6 border border-slate-100">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-clinara-sky to-clinara-teal flex items-center justify-center mb-4">
                  <p.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-clinara-navy">{p.name}</h3>
                <span className="text-xs font-semibold text-clinara-blue uppercase tracking-wide">{p.tag}</span>
                <p className="text-sm text-slate-600 mt-2">{p.desc}</p>
              </FadeIn>
            ))}
          </div>
        </Section>

        {/* WHY CLINARA */}
        <Section>
          <FadeIn className="text-center max-w-2xl mx-auto mb-14">
            <Label>Why Clinara</Label>
            <h2 className="text-3xl md:text-4xl font-bold text-clinara-navy">More than clinic management.</h2>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {WHY_REASONS.map((r, i) => (
              <FadeIn key={r.title} delay={(i % 3) * 0.05} className="p-6 rounded-2xl border border-slate-100 hover:border-clinara-teal/40 hover:shadow-md transition-all">
                <r.icon className="w-6 h-6 text-clinara-blue mb-3" />
                <h3 className="font-bold text-clinara-navy mb-1.5">{r.title}</h3>
                <p className="text-sm text-slate-600">{r.desc}</p>
              </FadeIn>
            ))}
          </div>
        </Section>

        {/* SECURITY */}
        <Section>
          <FadeIn className="text-center max-w-2xl mx-auto mb-14">
            <Label>Keamanan &amp; Privasi</Label>
            <h2 className="text-3xl md:text-4xl font-bold text-clinara-navy">
              Data pasien diperlakukan sebagaimana mestinya.
            </h2>
            <p className="mt-5 text-slate-600 leading-relaxed">
              Data kesehatan itu sensitif. Kami membangunnya dengan isolasi ketat, jejak audit, dan retensi sesuai
              UU PDP.
            </p>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
            {SECURITY_CARDS.map((s, i) => (
              <FadeIn key={s.title} delay={i * 0.06} className="bg-clinara-bg rounded-2xl p-6 border border-slate-100">
                <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center mb-4">
                  <s.icon className="w-5 h-5 text-clinara-blue" />
                </div>
                <h3 className="font-bold text-clinara-navy mb-1.5">{s.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.desc}</p>
              </FadeIn>
            ))}
          </div>
          <FadeIn className="rounded-2xl bg-clinara-navy text-white p-8 md:p-10 grid md:grid-cols-2 gap-8 items-center">
            <div>
              <Label>Trust &amp; Security</Label>
              <h3 className="text-2xl font-bold">Healthcare deserves trust.</h3>
              <p className="mt-4 text-slate-300 leading-relaxed">
                Keamanan, kontrol akses, dan pengelolaan data menjadi bagian penting dari bagaimana Clinara dirancang.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {SECURITY_PRINCIPLES.map((s) => (
                <div key={s} className="flex items-center gap-2 bg-white/5 rounded-xl p-3.5 border border-white/10">
                  <ShieldCheck className="w-4 h-4 text-clinara-mint shrink-0" />
                  <span className="text-xs sm:text-sm text-slate-200">{s}</span>
                </div>
              ))}
            </div>
          </FadeIn>
        </Section>

        {/* FAQ */}
        <Section id="faq" className="bg-clinara-bg">
          <FadeIn className="text-center max-w-2xl mx-auto mb-14">
            <Label>FAQ</Label>
            <h2 className="text-3xl md:text-4xl font-bold text-clinara-navy">Pertanyaan yang sering diajukan.</h2>
          </FadeIn>
          <div className="max-w-3xl mx-auto space-y-3">
            {FAQS.map((item, i) => (
              <FadeIn key={item.q} delay={i * 0.05}>
                <details className="group bg-white rounded-2xl border border-slate-100 open:border-clinara-teal/40 open:shadow-sm">
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none p-5 font-semibold text-clinara-navy">
                    {item.q}
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">{item.a}</p>
                </details>
              </FadeIn>
            ))}
          </div>
        </Section>

        {/* BRAND VALUES */}
        <Section>
          <FadeIn className="text-center max-w-2xl mx-auto mb-14">
            <Label>Our Values</Label>
            <h2 className="text-3xl md:text-4xl font-bold text-clinara-navy">Technology with purpose.</h2>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BRAND_VALUES.map((v, i) => (
              <FadeIn key={v.title} delay={(i % 3) * 0.05} className="bg-clinara-bg rounded-2xl p-6 border border-slate-100">
                <v.icon className="w-6 h-6 text-clinara-blue mb-3" />
                <h3 className="font-bold text-clinara-navy mb-1.5 tracking-wide text-sm">{v.title}</h3>
                <p className="text-sm text-slate-600">{v.desc}</p>
              </FadeIn>
            ))}
          </div>
        </Section>

        {/* BRAND PROMISE */}
        <Section className="bg-clinara-bg">
          <FadeIn className="max-w-3xl mx-auto text-center">
            <Label>The Clinara Promise</Label>
            <h2 className="text-3xl md:text-4xl font-bold text-clinara-navy mb-6">We don't just build software.</h2>
            <p className="text-slate-600 leading-relaxed mb-6">
              Kami membangun teknologi yang membantu healthcare providers bekerja dengan lebih baik. Clinara akan
              terus berkembang bersama penggunanya.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mb-6 text-sm font-semibold text-clinara-navy">
              {['Mendengarkan', 'Memahami', 'Menyederhanakan', 'Mengembangkan'].map((w) => (
                <span key={w} className="px-4 py-2 rounded-full bg-white border border-slate-200">{w}</span>
              ))}
            </div>
            <p className="text-clinara-navy font-semibold leading-relaxed">
              Because healthcare is always evolving. And so should the technology behind it.
            </p>
          </FadeIn>
        </Section>

        {/* FINAL CTA */}
        <Section className="bg-gradient-to-br from-clinara-navy to-clinara-blue text-white text-center">
          <FadeIn className="max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-5">Ready to manage your clinic better?</h2>
            <p className="text-slate-200 mb-10 leading-relaxed">
              Bawa operasional klinik Anda ke level berikutnya dengan sistem yang lebih terintegrasi, sederhana,
              dan berbasis data.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <a href="/register">
                <Button size="lg" className="bg-white text-clinara-navy hover:bg-slate-100 rounded-full px-8 gap-2">
                  Daftarkan Klinik <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
              <a href="#harga">
                <Button size="lg" variant="outline" className="rounded-full px-8 border-white/40 text-white hover:bg-white/10">
                  Lihat Harga
                </Button>
              </a>
            </div>
            <p className="text-sm text-slate-300 font-medium">
              Better systems. Better teams. Better experiences. Better care.
            </p>
          </FadeIn>
        </Section>

        {/* FOOTER */}
        <footer className="bg-clinara-navy text-slate-300 pt-16 pb-8 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
              <div className="sm:col-span-2 lg:col-span-2">
                <Logo dark />
                <p className="mt-3 text-sm font-semibold text-clinara-mint">
                  Healthcare Management Platform — Better Care. Smarter Management.
                </p>
                <p className="mt-4 text-sm text-slate-400 max-w-sm leading-relaxed">
                  Clinara adalah platform manajemen layanan kesehatan yang membantu fasilitas kesehatan mengelola
                  pasien, tenaga kesehatan, operasional, komunikasi, dan data dalam satu ekosistem.
                </p>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4 text-sm">Produk</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="#fitur" className="hover:text-white transition-colors">Fitur</a></li>
                  <li><a href="#harga" className="hover:text-white transition-colors">Harga</a></li>
                  <li><a href="/register" className="hover:text-white transition-colors">Daftarkan Klinik</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4 text-sm">Untuk Klinik</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="/register" className="hover:text-white transition-colors">Daftarkan Klinik</a></li>
                  <li><a href="/login" className="hover:text-white transition-colors">Masuk Akun</a></li>
                  <li><a href="#untuk-siapa" className="hover:text-white transition-colors">Peran Pengguna</a></li>
                  <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4 text-sm">Tipe Klinik</h4>
                <ul className="space-y-2 text-sm">
                  {TIPE_KLINIK.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-slate-500">© 2026 Clinara. All rights reserved.</p>
              <div className="flex gap-5 text-xs text-slate-500">
                <span>Privacy Policy</span>
                <span>Terms of Service</span>
                <span>Data Security</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default ClinaraLandingPage;
