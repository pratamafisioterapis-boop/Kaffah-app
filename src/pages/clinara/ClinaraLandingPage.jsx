import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  Users, CalendarCheck, Stethoscope, ClipboardList, Package, MessageCircle,
  Wallet, BarChart3, Sparkles, Network, TrendingUp, Heart, ShieldCheck,
  ArrowRight, CheckCircle2, XCircle, Bell, LineChart, Building2,
  HeartHandshake, Activity, Baby, Link2, Menu, X as CloseIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Content — mirrors the Clinara brand book verbatim so copy stays a single
// source of truth here rather than scattered across JSX.
// ---------------------------------------------------------------------------

const HIGHLIGHTS = [
  { icon: Users, title: 'Patient Management', desc: 'Kelola data pasien secara terstruktur dan mudah diakses.' },
  { icon: CalendarCheck, title: 'Appointment Management', desc: 'Atur jadwal dan kunjungan pasien dengan lebih mudah.' },
  { icon: Stethoscope, title: 'Healthcare Professional', desc: 'Kelola tenaga kesehatan, jadwal, aktivitas, dan performa.' },
  { icon: ClipboardList, title: 'Clinical Services', desc: 'Dokumentasikan layanan dan perjalanan pasien secara sistematis.' },
  { icon: Package, title: 'Package Management', desc: 'Pantau paket layanan, penggunaan sesi, dan masa berlaku.' },
  { icon: MessageCircle, title: 'Communication', desc: 'Bangun komunikasi dengan pasien melalui reminder dan follow-up otomatis.' },
  { icon: Wallet, title: 'Finance', desc: 'Pantau transaksi dan performa pendapatan secara lebih terstruktur.' },
  { icon: BarChart3, title: 'Analytics', desc: 'Ubah data operasional menjadi insight untuk keputusan yang lebih baik.' },
];

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

const FadeIn = ({ children, className = '', delay = 0 }) => (
  <motion.div
    className={className}
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

// Full brand lockup (mark + wordmark + tagline) — used large in the hero
// where its own whitespace reads as intentional. The compact navbar/footer
// mark below is a plain text wordmark instead: the source file is a square
// stacked lockup, not a horizontal mark, so shrinking it into a 36px-tall
// navbar slot would crop the icon away and leave only illegible padding.
const LOGO_URL = 'https://dqkejdamagvlhqvxaqej.supabase.co/storage/v1/object/public/images/assets/file_00000000d4908211acc2dbc9fb3a06ab.png';

const Logo = ({ dark = false }) => (
  <span className={`inline-flex items-center gap-2 text-2xl font-extrabold tracking-tight ${dark ? 'text-white' : 'text-clinara-navy'}`}>
    <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-clinara-sky to-clinara-teal flex items-center justify-center text-white text-sm font-black">
      C
    </span>
    Clinara
  </span>
);

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------

const ClinaraNavbar = () => {
  const [open, setOpen] = React.useState(false);
  const links = [
    { name: 'Platform', href: '#platform' },
    { name: 'Fitur', href: '#fitur' },
    { name: 'Untuk Siapa', href: '#untuk-siapa' },
    { name: 'Ekosistem', href: '#ekosistem' },
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
          <a href="/login">
            <Button className="bg-clinara-navy hover:bg-clinara-blue text-white rounded-full px-5">
              Mulai Sekarang
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
          <a href="/login">
            <Button className="w-full bg-clinara-navy hover:bg-clinara-blue text-white rounded-full">Mulai Sekarang</Button>
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
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Clinara — Better Care. Smarter Management." />
        <meta property="og:description" content="Platform manajemen layanan kesehatan untuk klinik dan pusat terapi." />
        <meta name="theme-color" content="#0f2a4a" />
      </Helmet>

      <div id="top" className="min-h-screen bg-white font-sans text-slate-900 selection:bg-clinara-teal selection:text-white">
        <ClinaraNavbar />

        {/* HERO */}
        <header className="relative pt-40 pb-24 px-4 overflow-hidden bg-clinara-bg">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-clinara-teal/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 -left-24 w-80 h-80 bg-clinara-sky/20 rounded-full blur-3xl pointer-events-none" />
          <div className="container mx-auto max-w-4xl relative text-center">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <img src={LOGO_URL} alt="Clinara — Better Care. Smarter Management." className="w-40 md:w-48 mx-auto mb-2" />
              <span className="inline-block px-4 py-1.5 rounded-full bg-white border border-clinara-teal/30 text-clinara-navy text-xs font-bold tracking-wide uppercase mb-6 shadow-sm">
                Healthcare Management Platform
              </span>
              <h1 className="text-4xl md:text-6xl font-extrabold text-clinara-navy leading-tight tracking-tight">
                Better Care.<br />Smarter Management.
              </h1>
              <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">
                Clinara membantu klinik mengelola pasien, tenaga kesehatan, jadwal, layanan, komunikasi, dan data dalam satu platform yang terintegrasi.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <a href="/login">
                  <Button size="lg" className="bg-clinara-navy hover:bg-clinara-blue text-white rounded-full px-8 gap-2">
                    Mulai Sekarang <ArrowRight className="w-4 h-4" />
                  </Button>
                </a>
                <a href="#cara-kerja">
                  <Button size="lg" variant="outline" className="rounded-full px-8 border-clinara-navy/30 text-clinara-navy hover:bg-clinara-navy hover:text-white">
                    Lihat Cara Kerja
                  </Button>
                </a>
              </div>
              <p className="mt-8 text-sm font-medium text-slate-500">
                Manage your clinic. Empower your team. Deliver better care.
              </p>
            </motion.div>
          </div>
        </header>

        {/* INTRODUCTION */}
        <Section id="platform">
          <FadeIn className="text-center max-w-3xl mx-auto mb-16">
            <Label>One Platform. Complete Healthcare Management.</Label>
            <h2 className="text-3xl md:text-4xl font-bold text-clinara-navy">
              Semua yang dibutuhkan klinik, dalam satu ekosistem.
            </h2>
            <p className="mt-5 text-slate-600 leading-relaxed">
              Mengelola fasilitas kesehatan bukan hanya tentang melayani pasien. Ada jadwal yang harus diatur,
              data pasien yang harus dikelola, layanan yang harus dicatat, paket yang harus dipantau, komunikasi
              yang harus dilakukan, dan data yang harus dipahami. Clinara menghubungkan seluruh proses tersebut
              dalam satu platform agar operasional klinik menjadi lebih sederhana, terorganisir, dan efisien.
            </p>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {HIGHLIGHTS.map((h, i) => (
              <FadeIn key={h.title} delay={i * 0.05} className="bg-clinara-bg rounded-2xl p-6 border border-slate-100 hover:border-clinara-teal/40 hover:shadow-md transition-all">
                <div className="w-11 h-11 rounded-xl bg-clinara-navy/5 flex items-center justify-center mb-4">
                  <h.icon className="w-5 h-5 text-clinara-navy" />
                </div>
                <h3 className="font-bold text-clinara-navy mb-1.5">{h.title}</h3>
                <p className="text-sm text-slate-600">{h.desc}</p>
              </FadeIn>
            ))}
          </div>
        </Section>

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
        <Section className="bg-clinara-navy text-white">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <FadeIn>
              <Label>Trust &amp; Security</Label>
              <h2 className="text-3xl md:text-4xl font-bold">Healthcare deserves trust.</h2>
              <p className="mt-5 text-slate-300 leading-relaxed">
                Data kesehatan merupakan informasi yang penting. Karena itu, keamanan, kontrol akses, dan
                pengelolaan data menjadi bagian penting dari bagaimana Clinara dirancang.
              </p>
              <p className="mt-6 text-clinara-mint font-semibold leading-relaxed">
                Technology is about innovation. Healthcare is about trust. Clinara is built with both in mind.
              </p>
            </FadeIn>
            <FadeIn delay={0.1} className="grid grid-cols-2 gap-3">
              {SECURITY_PRINCIPLES.map((s) => (
                <div key={s} className="flex items-center gap-2 bg-white/5 rounded-xl p-4 border border-white/10">
                  <ShieldCheck className="w-4 h-4 text-clinara-mint shrink-0" />
                  <span className="text-sm text-slate-200">{s}</span>
                </div>
              ))}
            </FadeIn>
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
              <a href="/login">
                <Button size="lg" className="bg-white text-clinara-navy hover:bg-slate-100 rounded-full px-8">
                  Mulai Bersama Clinara
                </Button>
              </a>
              <a href="#platform">
                <Button size="lg" variant="outline" className="rounded-full px-8 border-white/40 text-white hover:bg-white/10">
                  Pelajari Lebih Lanjut
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
            <div className="grid md:grid-cols-4 gap-10 mb-12">
              <div className="md:col-span-2">
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
                <h4 className="text-white font-semibold mb-4 text-sm">Platform</h4>
                <ul className="space-y-2 text-sm">
                  <li><a href="#fitur" className="hover:text-white transition-colors">Features</a></li>
                  <li><a href="#untuk-siapa" className="hover:text-white transition-colors">Solutions</a></li>
                  <li><a href="/login" className="hover:text-white transition-colors">Masuk</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4 text-sm">Solutions</h4>
                <ul className="space-y-2 text-sm">
                  {['Clinic', 'Physiotherapy', 'Rehabilitation', 'Child Development', 'Therapy Center'].map((s) => (
                    <li key={s}>{s}</li>
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
