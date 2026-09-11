import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  Users, CalendarCheck, Stethoscope, ClipboardList, Package, MessageCircle,
  Wallet, BarChart3, Sparkles, Network, TrendingUp, Heart, ShieldCheck,
  ArrowRight, CheckCircle2, Bell, LineChart, Building2,
  HeartHandshake, Activity, Baby, Menu, X as CloseIcon,
  Fingerprint, ChevronDown, PlayCircle,
  FileText, CalendarClock, Calculator, User, CreditCard,
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

// Section 3 — "Mengapa Clinara?" problem/solution comparison. Copy is
// reproduced verbatim from the brand reference — do not rewrite, shorten,
// or "fix" wording (including the bottom trust line) without being asked.
const PROBLEM_ITEMS = [
  { icon: FileText, title: 'Data pasien tercecer', desc: 'Rekam medis, riwayat terapi, dan dokumen tersimpan di banyak tempat.' },
  { icon: CalendarClock, title: 'Jadwal mudah bentrok', desc: 'Pengelolaan jadwal manual sering menyebabkan double booking.' },
  { icon: Calculator, title: 'Pencatatan pembayaran rumit', desc: 'Transaksi dan paket terapi sulit dipantau dengan akurat.' },
  { icon: MessageCircle, title: 'Komunikasi tidak terarah', desc: 'Follow-up pasien, reminder, dan informasi sering terlewat.' },
  { icon: BarChart3, title: 'Sulit melihat perkembangan klinik', desc: 'Laporan dan data harus dikumpulkan manual, memakan waktu.' },
];

const SOLUTION_ITEMS = [
  { icon: User, title: 'Data pasien terstruktur', desc: 'Semua informasi pasien tersimpan aman, rapi, dan mudah diakses.' },
  { icon: CalendarCheck, title: 'Jadwal lebih efisien', desc: 'Sistem penjadwalan otomatis dengan notifikasi real-time.' },
  { icon: CreditCard, title: 'Pembayaran tercatat otomatis', desc: 'Semua transaksi, paket, dan riwayat pembayaran dalam satu sistem.' },
  { icon: MessageCircle, title: 'Komunikasi terintegrasi', desc: 'Kirim reminder, follow-up, dan broadcast langsung dari sistem (termasuk WhatsApp).' },
  { icon: BarChart3, title: 'Laporan & analytics real-time', desc: 'Pantau perkembangan klinik dengan mudah dan akurat.' },
];

// Section 4 — "The Clinara Platform" connected-ecosystem hub. Copy and
// layout mirror the brand reference verbatim (eyebrow, headline,
// description, the 6 numbered modules, and the closing CTA) — do not
// rewrite, shorten, or reorder without being asked. Desktop positions each
// module around a central Clinara hub (see PLATFORM_MODULE_POSITIONS);
// mobile falls back to a simple stacked flow.
const PLATFORM_MODULES = [
  { n: '01', icon: Users, title: 'Pasien', desc: 'Kelola data dan riwayat pasien dengan mudah.' },
  { n: '02', icon: CalendarCheck, title: 'Appointment', desc: 'Atur jadwal dan kunjungan lebih terorganisir.' },
  { n: '03', icon: ClipboardList, title: 'Rekam Medis', desc: 'Dokumentasikan layanan pasien secara sistematis.' },
  { n: '04', icon: Stethoscope, title: 'Tenaga Kesehatan', desc: 'Kelola tim dan pantau aktivitasnya.' },
  { n: '05', icon: Wallet, title: 'Keuangan & Paket', desc: 'Kelola transaksi dan paket layanan dalam satu sistem.' },
  { n: '06', icon: MessageCircle, title: 'Komunikasi & Analytics', desc: 'Otomatisasi komunikasi dan pahami performa klinik.' },
];

// Percentage coordinates (of the desktop hub canvas) for each module's
// card center and the point its connector line should touch.
const PLATFORM_MODULE_POSITIONS = [
  { card: { x: 50, y: 8 }, line: { x: 50, y: 24 } },
  { card: { x: 13, y: 34 }, line: { x: 29, y: 38 } },
  { card: { x: 87, y: 34 }, line: { x: 71, y: 38 } },
  { card: { x: 13, y: 72 }, line: { x: 30, y: 63 } },
  { card: { x: 50, y: 88 }, line: { x: 50, y: 68 } },
  { card: { x: 87, y: 72 }, line: { x: 70, y: 63 } },
];

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

const PRICING_FEATURES = [
  'Website klinik + subdomain', 'Domain sendiri (custom domain)', 'Booking online tanpa batas',
  'Rekam medis elektronik', 'Keuangan & invoice', 'Semua peran & dashboard', 'Tanpa batas admin & terapis',
];

const PRICING_PLANS = [
  { badge: 'Coba dulu', name: '1 Bulan', desc: 'Cocok untuk mencoba seluruh fitur platform.', price: 'Rp150.000', period: '/bulan', highlight: false },
  { badge: 'Paling populer', name: '3 Bulan', desc: 'Hemat untuk operasional klinik jangka menengah.', price: 'Rp450.000', period: '/3 bulan', highlight: true },
  { badge: 'Paling hemat', name: '1 Tahun', desc: 'Nilai terbaik untuk klinik yang berkembang.', price: 'Rp1.250.000', period: '/tahun', highlight: false },
];

const TIPE_KLINIK = [
  'Fisioterapi', 'Okupasi Terapi', 'Terapi Wicara', 'Terapi Tumbuh Kembang',
  'Terapi Perilaku', 'Terapi Aquatic', 'Psikolog',
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
  <div className="relative w-full rounded-2xl border border-slate-100 bg-white/95 backdrop-blur-sm shadow-[0_16px_40px_rgba(11,39,71,0.10)] p-4">
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
    { name: 'Mengapa Clinara', href: '#mengapa-clinara' },
    { name: 'Cara Kerja', href: '#cara-kerja' },
    { name: 'Fitur', href: '#fitur' },
    { name: 'Harga', href: '#harga' },
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
              src="/hero/clinara-hero-bg.webp"
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
                        src="/hero/clinara-hero-dashboard.webp"
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
                  >
                    <img
                      src="/hero/clinara-hero-mobile-v2.webp"
                      alt="Tampilan aplikasi mobile Clinara"
                      className="w-full h-auto block"
                      style={{ filter: 'drop-shadow(0 24px 60px rgba(11, 39, 71, 0.28))' }}
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
              <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5 px-2">
                {CAPABILITIES.map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => setActiveCapability(cap)}
                    aria-pressed={activeCapability === cap}
                    className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold border transition-colors ${
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
                  src="/hero/clinara-section2-laptop.webp"
                  alt="Dashboard Clinara ditampilkan di laptop — menu pasien, appointment, rekam medis, pembayaran, dan analytics klinik"
                  className="w-full h-auto block"
                />
              </motion.div>

              {/* desktop floating callouts — positioned with right/left (not
                  transform) so they don't fight framer-motion's own y-transform
                  animation on the FadeIn wrapper */}
              <div className="hidden xl:block">
                <FadeIn delay={0.25} className="absolute top-[8%] w-56" style={{ right: 'calc(100% + 28px)' }}>
                  <FloatingCallout {...PRODUCT_CALLOUTS[0]} connector connectorSide="right" />
                </FadeIn>
                <FadeIn delay={0.35} className="absolute bottom-[14%] w-56" style={{ right: 'calc(100% + 28px)' }}>
                  <FloatingCallout {...PRODUCT_CALLOUTS[1]} connector connectorSide="right" />
                </FadeIn>
                <FadeIn delay={0.3} className="absolute top-[6%] w-56" style={{ left: 'calc(100% + 28px)' }}>
                  <FloatingCallout {...PRODUCT_CALLOUTS[2]} connector connectorSide="left" />
                </FadeIn>
                <FadeIn delay={0.4} className="absolute bottom-[16%] w-56" style={{ left: 'calc(100% + 28px)' }}>
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
            <div className="grid grid-cols-2 lg:hidden gap-3 sm:gap-4 mt-10 max-w-xl sm:max-w-2xl mx-auto">
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

        {/* MENGAPA CLINARA? — problem vs. solution comparison */}
        <section id="mengapa-clinara" className="relative overflow-hidden bg-gradient-to-b from-clinara-bg to-white py-24 md:py-28 px-4">
          {/* soft quarter-circle decorations, top corners only */}
          <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-slate-200/40 pointer-events-none" />
          <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-clinara-sky/10 pointer-events-none" />

          <div className="container mx-auto max-w-6xl relative">
            <FadeIn className="text-center max-w-2xl mx-auto mb-16 md:mb-20">
              <Label>Mengapa Clinara?</Label>
              <h2 className="text-3xl md:text-[2.75rem] font-extrabold leading-[1.15] tracking-tight">
                <span className="text-clinara-navy">Dari Tantangan Sehari-hari,</span>
                <br />
                <span className="text-clinara-blue">Menjadi Klinik yang Lebih Terorganisir</span>
              </h2>
              <p className="mt-6 text-[17px] text-slate-600 leading-relaxed">
                Kami memahami tantangan dalam mengelola klinik. Clinara hadir untuk menyederhanakan
                proses, menghemat waktu, dan membantu Anda fokus pada hal yang paling penting — pasien Anda.
              </p>
            </FadeIn>

            {/* comparison row — photos share the card row's own max-width box so
                left-0/right-0 line up exactly with its edges, then sit outside
                it by a fixed gap (mirrors the Section 2 callout fix) */}
            <div className="relative mx-auto lg:max-w-3xl xl:max-w-5xl">
              {/* desktop-only side photos, bleeding into the outer margin beside the cards */}
              <div className="hidden lg:block absolute inset-y-0 right-[calc(100%+24px)] w-[170px] xl:w-[210px]">
                <FadeIn className="relative h-full rounded-[28px] overflow-hidden">
                  <img
                    src="/section3/problem-photo.png"
                    alt="Tenaga kesehatan kewalahan dengan pekerjaan administratif manual"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-6 left-5 right-3">
                    <p
                      className="text-clinara-navy text-lg xl:text-xl leading-[1.15] -rotate-2"
                      style={{ fontFamily: "'Caveat', cursive", fontWeight: 600 }}
                    >
                      Kurang waktu<br />Terlalu banyak<br />hal yang harus<br />diurus...
                    </p>
                    <svg width="52" height="14" viewBox="0 0 52 14" fill="none" className="mt-1 text-clinara-teal">
                      <path d="M2 8c10-8 30-8 48 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </FadeIn>
              </div>
              <div className="hidden lg:block absolute inset-y-0 left-[calc(100%+24px)] w-[170px] xl:w-[210px]">
                <FadeIn className="relative h-full rounded-[28px] overflow-hidden">
                  <img
                    src="/section3/solution-photo.png"
                    alt="Tenaga kesehatan bekerja tenang dan efisien dengan dashboard Clinara"
                    className="w-full h-full object-cover"
                    style={{ objectPosition: '25% center' }}
                  />
                  <div className="absolute top-6 right-5 left-3 text-right">
                    <p
                      className="text-clinara-navy text-lg xl:text-xl leading-[1.15] rotate-2"
                      style={{ fontFamily: "'Caveat', cursive", fontWeight: 600 }}
                    >
                      Lebih fokus<br />pada pasien,<br />lebih banyak<br />dampak positif
                    </p>
                    <svg width="52" height="14" viewBox="0 0 52 14" fill="none" className="mt-1 ml-auto text-clinara-teal scale-x-[-1]">
                      <path d="M2 8c10-8 30-8 48 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </FadeIn>
              </div>

              {/* problem / transformation / solution */}
              <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-6 lg:gap-8 items-start">
                {/* problem card */}
                <FadeIn className="bg-white rounded-[24px] border border-slate-100 shadow-[0_20px_50px_rgba(11,39,71,0.08)] p-6 md:p-7">
                  <span className="inline-block text-xs font-bold tracking-wide text-rose-700 bg-rose-50 border border-rose-100 rounded-full px-3.5 py-1.5 mb-5">
                    TANTANGAN TANPA CLINARA
                  </span>
                  <img
                    src="/section3/problem-photo.png"
                    alt="Tenaga kesehatan kewalahan dengan pekerjaan administratif manual"
                    className="lg:hidden w-full h-44 object-cover rounded-2xl mb-5"
                  />
                  <div className="divide-y divide-slate-100">
                    {PROBLEM_ITEMS.map((item, i) => (
                      <div key={item.title} className={`flex items-start gap-3.5 py-4 ${i === 0 ? 'pt-0' : ''}`}>
                        <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                          <item.icon className="w-[18px] h-[18px] text-rose-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-clinara-navy text-[15px] leading-snug">{item.title}</h3>
                          <p className="text-sm text-slate-500 leading-relaxed mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </FadeIn>

                {/* center transformation */}
                <FadeIn delay={0.1} className="flex flex-col items-center justify-center gap-2 text-center py-6 lg:py-8 mx-auto lg:w-40">
                  <p
                    className="text-clinara-navy text-4xl leading-[0.95]"
                    style={{ fontFamily: "'Caveat', cursive", fontWeight: 600 }}
                  >
                    Saatnya<br />Berubah
                  </p>
                  <svg width="34" height="80" viewBox="0 0 34 80" fill="none" className="lg:hidden text-clinara-teal my-1">
                    <path d="M6 4c2 14 14 22 24 12-8 18-6 44-2 60" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    <path d="M24 68l8 8-2-11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                  <svg width="80" height="34" viewBox="0 0 80 34" fill="none" className="hidden lg:block text-clinara-teal my-1">
                    <path d="M4 6c14 2 22 14 12 24 18-8 44-6 60 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    <path d="M68 24l8 8-11 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                  <div className="mt-1 lg:mt-2">
                    <p className="text-[11px] font-bold tracking-[0.15em] text-slate-400 uppercase leading-relaxed">
                      Solusi<br className="hidden lg:block" /> Lebih Cerdas<br className="hidden lg:block" /> Untuk Klinik<br className="hidden lg:block" /> Anda
                    </p>
                    <span className="block w-6 h-[3px] rounded-full bg-clinara-teal mx-auto mt-3" />
                  </div>
                </FadeIn>

                {/* solution card */}
                <FadeIn delay={0.15} className="bg-white rounded-[24px] border border-slate-100 shadow-[0_20px_50px_rgba(11,39,71,0.08)] p-6 md:p-7">
                  <span className="inline-block text-xs font-bold tracking-wide text-teal-700 bg-teal-50 border border-teal-100 rounded-full px-3.5 py-1.5 mb-5">
                    SOLUSI DENGAN CLINARA
                  </span>
                  <img
                    src="/section3/solution-photo.png"
                    alt="Tenaga kesehatan bekerja tenang dan efisien dengan dashboard Clinara"
                    className="lg:hidden w-full h-44 object-cover rounded-2xl mb-5"
                  />
                  <div className="divide-y divide-slate-100">
                    {SOLUTION_ITEMS.map((item, i) => (
                      <div key={item.title} className={`flex items-start gap-3.5 py-4 ${i === 0 ? 'pt-0' : ''}`}>
                        <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
                          <item.icon className="w-[18px] h-[18px] text-clinara-blue" />
                        </div>
                        <div>
                          <h3 className="font-bold text-clinara-navy text-[15px] leading-snug">{item.title}</h3>
                          <p className="text-sm text-slate-500 leading-relaxed mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </FadeIn>
              </div>
            </div>

            {/* bottom trust bar */}
            <FadeIn delay={0.2} className="mt-10 md:mt-12 rounded-2xl bg-gradient-to-r from-clinara-bg to-[#DCEEFB] p-6 md:p-7 flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-clinara-blue" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="font-bold text-clinara-navy text-lg leading-snug">Ratusan klinik telah mempercayai Clinara</p>
                <p className="text-sm text-slate-500 mt-0.5">Bergabunglah sekarang dan rasakan kemudahan mengelola klinik Anda.</p>
              </div>
              <a href="/register" className="w-full sm:w-auto shrink-0">
                <Button size="lg" className="w-full sm:w-auto h-12 bg-clinara-navy hover:bg-clinara-blue text-white rounded-full px-7 gap-2">
                  Mulai Gratis 7 Hari <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
            </FadeIn>
          </div>
        </section>

        {/* THE CLINARA PLATFORM — connected ecosystem hub */}
        <Section id="cara-kerja">
          <FadeIn className="text-center max-w-2xl mx-auto mb-16">
            <Label>The Clinara Platform</Label>
            <h2 className="text-3xl md:text-[2.75rem] font-bold text-clinara-navy leading-tight">
              Semua operasional klinik.<br />
              <span className="text-clinara-blue">Satu sistem yang terhubung.</span>
            </h2>
            <p className="mt-5 text-slate-600 leading-relaxed">
              Dari pasien, appointment, layanan, tenaga kesehatan, hingga keuangan dan analytics — semua
              terhubung dalam satu platform.
            </p>
          </FadeIn>

          {/* Desktop / tablet — hub-and-spoke ecosystem */}
          <div className="hidden lg:block relative mx-auto max-w-4xl" style={{ height: 640 }}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {PLATFORM_MODULE_POSITIONS.map((pos, i) => (
                <line
                  key={i}
                  x1={50} y1={50} x2={pos.line.x} y2={pos.line.y}
                  stroke="#2dd4bf" strokeOpacity="0.5" strokeWidth="0.25" strokeDasharray="1.4 1.4"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {PLATFORM_MODULE_POSITIONS.map((pos, i) => (
                <circle key={i} cx={pos.line.x} cy={pos.line.y} r="0.7" fill="#2dd4bf" />
              ))}
              <circle cx={50} cy={50} r="1" fill="#2dd4bf" />
            </svg>

            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <FadeIn className="w-44 h-44 rounded-full bg-white shadow-[0_20px_50px_rgba(11,39,71,0.15)] border border-clinara-teal/20 flex flex-col items-center justify-center text-center">
                <img src={ICON_URL} alt="Clinara" className="w-9 h-9 mb-2" />
                <span className="font-extrabold text-clinara-navy text-lg leading-none">Clinara</span>
                <span className="mt-1.5 text-[11px] text-slate-500 leading-snug px-4">
                  Satu Platform<br />untuk Klinik Anda
                </span>
              </FadeIn>
            </div>

            {PLATFORM_MODULES.map((m, i) => {
              const pos = PLATFORM_MODULE_POSITIONS[i].card;
              return (
                <div
                  key={m.n}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-[1]"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                >
                  <FadeIn
                    delay={i * 0.06}
                    className="w-64 rounded-2xl bg-white border border-slate-100 shadow-[0_12px_32px_rgba(11,39,71,0.08)] p-5 hover:-translate-y-1 transition-transform duration-300"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-clinara-teal/10 flex items-center justify-center shrink-0">
                        <m.icon className="w-[18px] h-[18px] text-clinara-blue" />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-clinara-teal">{m.n}</span>
                        <h3 className="font-bold text-clinara-navy text-[15px] leading-tight">{m.title}</h3>
                      </div>
                    </div>
                    <p className="text-[13px] text-slate-500 leading-relaxed">{m.desc}</p>
                  </FadeIn>
                </div>
              );
            })}
          </div>

          {/* Mobile — stacked vertical flow */}
          <div className="lg:hidden">
            <FadeIn className="mx-auto w-40 h-40 rounded-full bg-white shadow-[0_16px_40px_rgba(11,39,71,0.12)] border border-clinara-teal/20 flex flex-col items-center justify-center text-center mb-6">
              <img src={ICON_URL} alt="Clinara" className="w-8 h-8 mb-1.5" />
              <span className="font-extrabold text-clinara-navy text-base leading-none">Clinara</span>
              <span className="mt-1.5 text-[11px] text-slate-500 leading-snug px-3">
                Satu Platform<br />untuk Klinik Anda
              </span>
            </FadeIn>
            <div className="flex flex-col items-center gap-3 max-w-sm mx-auto">
              {PLATFORM_MODULES.map((m, i) => (
                <React.Fragment key={m.n}>
                  <span aria-hidden="true" className="w-px h-4 bg-clinara-teal/40" />
                  <FadeIn delay={i * 0.05} className="w-full rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-clinara-teal/10 flex items-center justify-center shrink-0">
                        <m.icon className="w-[18px] h-[18px] text-clinara-blue" />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-clinara-teal">{m.n}</span>
                        <h3 className="font-bold text-clinara-navy text-[15px] leading-tight">{m.title}</h3>
                      </div>
                    </div>
                    <p className="text-[13px] text-slate-500 leading-relaxed">{m.desc}</p>
                  </FadeIn>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Bottom CTA */}
          <FadeIn delay={0.1} className="mt-16 md:mt-20 rounded-3xl bg-clinara-bg p-8 md:p-10 flex flex-col md:flex-row items-center gap-8 md:gap-10">
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl md:text-[1.75rem] font-bold text-clinara-navy leading-snug">
                Semua terhubung.<br />
                Semua <span className="text-clinara-blue">dalam satu sistem.</span>
              </h3>
              <p className="mt-3 text-slate-600 leading-relaxed max-w-xl">
                Clinara membantu tim klinik bekerja dari satu sumber informasi yang terorganisir.
              </p>
            </div>
            <a href="#fitur" className="shrink-0">
              <Button size="lg" className="h-12 bg-clinara-navy hover:bg-clinara-blue text-white rounded-full px-7 gap-2">
                Lihat Semua Fitur <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
          </FadeIn>
        </Section>

        {/* FEATURES */}
        <Section id="fitur" className="relative overflow-hidden bg-clinara-bg">
          {/* subtle decoration — soft glow, faint dotted grid, very soft curve.
              Kept low-opacity and behind everything so the section stays clean. */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-clinara-sky/10 blur-3xl" />
            <div className="absolute bottom-0 right-0 w-[480px] h-[480px] rounded-full bg-clinara-teal/10 blur-3xl translate-x-1/4 translate-y-1/4" />
            <div
              className="absolute top-10 left-6 md:left-10 w-28 h-28 opacity-[0.35]"
              style={{
                backgroundImage: 'radial-gradient(currentColor 1.4px, transparent 1.4px)',
                backgroundSize: '14px 14px',
                color: '#2b6cb0',
              }}
            />
            <svg className="absolute -bottom-6 -left-10 text-clinara-sky/10" width="360" height="200" viewBox="0 0 360 200" fill="none" aria-hidden="true">
              <path d="M-20 180C60 100 140 220 240 140S400 20 420 60" stroke="currentColor" strokeWidth="60" />
            </svg>
          </div>

          <div className="relative">
            <FadeIn className="text-center max-w-2xl mx-auto mb-4">
              <Label>Powerful Tools. Simple Experience.</Label>
            </FadeIn>

            {/* headline + handwritten annotation share one row on desktop so the
                note sits beside the headline like the reference; on mobile it
                collapses to a small centered annotation under the subtitle */}
            <div className="relative max-w-2xl mx-auto mb-14">
              <FadeIn className="text-center">
                <h2 className="text-3xl sm:text-4xl md:text-[2.75rem] font-bold leading-tight">
                  <span className="text-clinara-navy">Dirancang untuk </span>
                  <span className="text-clinara-blue">
                    kebutuhan<br className="sm:hidden" /> nyata klinik.
                  </span>
                </h2>
                <p className="mt-5 text-slate-600 leading-relaxed">
                  Semua fitur yang Anda butuhkan dalam satu platform, untuk membantu operasional klinik berjalan
                  lebih efisien dan profesional.
                </p>
              </FadeIn>

              <FadeIn
                delay={0.15}
                className="hidden lg:block absolute top-0 right-[-260px] w-56 rotate-3 text-right"
              >
                <p
                  className="text-clinara-navy text-2xl leading-[1.15]"
                  style={{ fontFamily: "'Caveat', cursive", fontWeight: 600 }}
                >
                  Solusi lengkap<br />untuk klinik<br />yang berkembang
                </p>
                <svg width="70" height="16" viewBox="0 0 70 16" fill="none" className="mt-1 ml-auto text-clinara-teal">
                  <path d="M2 8c14-9 40-9 66 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </FadeIn>

              <FadeIn delay={0.15} className="lg:hidden flex justify-center mt-5">
                <p
                  className="text-clinara-navy text-xl leading-[1.15] text-center -rotate-1"
                  style={{ fontFamily: "'Caveat', cursive", fontWeight: 600 }}
                >
                  Solusi lengkap untuk klinik yang berkembang
                </p>
              </FadeIn>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {FEATURES.map((f, i) => (
                <FadeIn
                  key={f.title}
                  delay={(i % 4) * 0.05}
                  className="group bg-white rounded-2xl p-6 border border-slate-100 shadow-[0_8px_24px_rgba(11,39,71,0.05)] hover:shadow-[0_16px_36px_rgba(11,39,71,0.10)] hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-clinara-teal/10 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                      <f.icon className="w-5 h-5 text-clinara-blue" />
                    </div>
                    <span className="text-sm font-bold text-clinara-blue/30">{f.n}</span>
                  </div>
                  <h3 className="font-bold text-clinara-navy mb-1.5">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </FadeIn>
              ))}
            </div>

            {/* bottom CTA panel */}
            <FadeIn delay={0.1} className="mt-14 md:mt-16 rounded-3xl bg-white/70 border border-white p-8 md:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
              <div className="flex-1 flex items-start gap-4 text-center md:text-left">
                <span aria-hidden="true" className="hidden md:block w-1 self-stretch rounded-full bg-clinara-teal shrink-0" />
                <div>
                  <h3 className="text-2xl md:text-[1.75rem] font-bold leading-snug">
                    <span className="text-clinara-navy">Semua fitur, satu tujuan.</span>
                    <br />
                    <span className="text-clinara-blue">Klinik yang lebih efisien dan berkembang.</span>
                  </h3>
                  <p className="mt-3 text-slate-600 leading-relaxed">
                    Clinara hadir untuk mendukung setiap langkah pertumbuhan klinik Anda.
                  </p>
                </div>
              </div>
              <a href="#harga" className="shrink-0">
                <Button size="lg" className="h-12 bg-clinara-navy hover:bg-clinara-blue text-white rounded-full px-7 gap-2">
                  Lihat Semua Fitur <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
            </FadeIn>
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
                <Button size="lg" variant="outline" className="rounded-full px-8 bg-transparent border-white/40 text-white hover:bg-white/10">
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
