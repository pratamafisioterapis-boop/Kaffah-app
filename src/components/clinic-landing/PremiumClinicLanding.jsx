import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarCheck, MessageCircle, MapPin, Phone, CheckCircle2, Quote, Star,
  ShieldCheck, Users, HeartPulse, Sparkles, Home as HomeIcon, Activity,
  Stethoscope, Menu, X, ChevronDown, ArrowRight, ArrowUpRight, Instagram, Facebook,
} from 'lucide-react';

const formatPrice = (value) => {
  const n = Number(value) || 0;
  return `Rp${n.toLocaleString('id-ID')}`;
};

const NAV_LINKS = [
  { label: 'Beranda', href: '#beranda' },
  { label: 'Tentang Kami', href: '#tentang' },
  { label: 'Layanan', href: '#layanan' },
  { label: 'Fasilitas', href: '#fasilitas' },
  { label: 'Testimoni', href: '#testimoni' },
  { label: 'FAQ', href: '#faq' },
];

const SERVICE_ICONS = [Activity, Stethoscope, HeartPulse, HomeIcon];
const ADVANTAGE_ICONS = [ShieldCheck, Users, Sparkles, CheckCircle2];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

// Photography-first template: every visual slot renders the clinic's own
// photo when the owner has set one (content.*.image / facilities.images[].url),
// and otherwise falls back to a tasteful navy/sky duotone panel instead of a
// broken image -- so the page always looks finished before real photos are
// uploaded from the "Landing Page" tab in owner Settings.
const PhotoPanel = ({ src, alt, className = '', children, Icon = HeartPulse }) => {
  if (src) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img src={src} alt={alt} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        {children}
      </div>
    );
  }
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundImage: 'linear-gradient(135deg, #0f2947 0%, #1d4ed8 60%, #38bdf8 130%)' }}
    >
      <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon className="w-10 h-10 text-white/30" strokeWidth={1.25} />
      </div>
      {children}
    </div>
  );
};

const Reveal = ({ children, className = '', delay = 0 }) => (
  <motion.div
    className={className}
    variants={fadeUp}
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, margin: '-80px' }}
    transition={{ delay }}
  >
    {children}
  </motion.div>
);

const PremiumClinicLanding = ({ clinic, content, pricelist = [], bookingHref = '/booking', waHref, primaryColor, accentColor, defaultColors }) => {
  const c = content;
  const primary = primaryColor || defaultColors?.primary || '#1d4ed8';
  const accent = accentColor || defaultColors?.accent || '#38bdf8';
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const pricingByCategory = pricelist.reduce((acc, item) => {
    const key = item.category || 'Lainnya';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const heroTitle = c.hero?.title || clinic.name;
  const highlightWords = Array.isArray(c.hero?.highlight) ? c.hero.highlight : [];
  const heroTitleNodes = highlightWords.length
    ? heroTitle.split(new RegExp(`(${highlightWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g'))
        .map((part, i) => (highlightWords.includes(part) ? <span key={i} style={{ color: accent }}>{part}</span> : <React.Fragment key={i}>{part}</React.Fragment>))
    : heroTitle;

  const [faqOpen, setFaqOpen] = useState(0);

  return (
    <div className="min-h-screen bg-white font-sans text-[#0f2947] antialiased">
      {/* Navbar */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/85 backdrop-blur-md shadow-[0_1px_0_0_rgba(15,41,71,0.06),0_8px_24px_-16px_rgba(15,41,71,0.25)]' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 sm:h-[72px] flex items-center justify-between">
          <a href="#beranda" className="flex items-center gap-2.5 shrink-0">
            {clinic.logo_url ? (
              <img src={clinic.logo_url} alt={clinic.name} className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg object-cover" />
            ) : (
              <span className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: primary }}>
                <HeartPulse className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
            )}
            <span className="font-bold text-[15px] sm:text-lg tracking-tight text-[#0f2947]">{clinic.name}</span>
          </a>

          <nav className="hidden lg:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-[#334155] hover:text-[#0f2947] transition-colors">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <a
              href={bookingHref}
              className="inline-flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-full shadow-sm transition-transform hover:-translate-y-0.5"
              style={{ backgroundColor: primary }}
            >
              <CalendarCheck className="w-4 h-4" /> Booking Sekarang
            </a>
          </div>

          <button type="button" className="lg:hidden p-2 -mr-2 text-[#0f2947]" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="lg:hidden bg-white border-t border-slate-100 px-5 py-4 space-y-3 shadow-lg">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-[#334155] py-1.5">
                {l.label}
              </a>
            ))}
            <a
              href={bookingHref}
              className="flex items-center justify-center gap-2 text-sm font-semibold text-white px-5 py-3 rounded-full mt-2"
              style={{ backgroundColor: primary }}
            >
              <CalendarCheck className="w-4 h-4" /> Booking Sekarang
            </a>
          </div>
        )}
      </header>

      {/* Hero */}
      <section id="beranda" className="relative pt-28 sm:pt-36 pb-16 sm:pb-24 overflow-hidden">
        <div className="pointer-events-none absolute -top-40 -right-40 w-[32rem] h-[32rem] rounded-full opacity-[0.07] blur-3xl" style={{ backgroundColor: primary }} />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-10 items-center">
          <div>
            {c.hero?.eyebrow && (
              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-xs sm:text-sm font-bold tracking-[0.18em] uppercase mb-5" style={{ color: primary }}>
                {c.hero.eyebrow}
              </motion.p>
            )}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-[2.5rem] leading-[1.05] sm:text-6xl sm:leading-[1.05] font-extrabold tracking-tight text-[#0f2947] mb-6"
            >
              {heroTitleNodes}
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="text-base sm:text-lg text-[#475569] max-w-xl mb-9 leading-relaxed">
              {c.hero?.subtitle}
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="flex flex-col sm:flex-row gap-3 mb-10">
              <a href={bookingHref} className="inline-flex items-center justify-center gap-2 font-semibold px-6 py-3.5 rounded-full text-white shadow-lg shadow-blue-900/15 transition-transform hover:-translate-y-0.5" style={{ backgroundColor: primary }}>
                <CalendarCheck className="w-4 h-4" /> {c.hero?.ctaLabel || 'Booking Konsultasi'}
              </a>
              {waHref && (
                <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 font-semibold px-6 py-3.5 rounded-full border border-[#0f2947]/15 text-[#0f2947] transition-colors hover:bg-[#0f2947]/[0.03]">
                  <MessageCircle className="w-4 h-4" /> {c.hero?.ctaWhatsappLabel || 'Chat WhatsApp'}
                </a>
              )}
            </motion.div>
            {Array.isArray(c.hero?.trustPoints) && c.hero.trustPoints.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.4 }} className="grid grid-cols-2 gap-x-6 gap-y-3 max-w-md">
                {c.hero.trustPoints.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-[#334155]">
                    <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: primary }} />
                    <span>{p}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          <Reveal delay={0.15} className="relative">
            <PhotoPanel
              src={c.hero?.image}
              alt={clinic.name}
              className="rounded-[28px] aspect-[4/5] sm:aspect-[5/6] shadow-2xl shadow-[#0f2947]/15"
              Icon={HeartPulse}
            />
            {c.hero?.glassCard?.title && (
              <div className="absolute -bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-72 rounded-2xl bg-white/85 backdrop-blur-md border border-white/60 shadow-xl px-5 py-4">
                <p className="text-sm font-bold text-[#0f2947]">{c.hero.glassCard.title}</p>
                {c.hero.glassCard.subtitle && <p className="text-xs text-[#64748b] mt-0.5">{c.hero.glassCard.subtitle}</p>}
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* Trust / stats strip */}
      {c.stats?.items?.length > 0 && (
        <section className="py-14 sm:py-16 border-y border-[#0f2947]/[0.06]" style={{ backgroundColor: '#0f2947' }}>
          <div className="max-w-6xl mx-auto px-5 sm:px-8">
            {c.stats.title && <p className="text-center text-sm sm:text-base text-white/60 mb-10 max-w-xl mx-auto">{c.stats.title}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-6">
              {c.stats.items.map((s, i) => (
                <Reveal key={i} delay={i * 0.06} className="text-center">
                  <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{s.value}</p>
                  <p className="text-xs sm:text-sm text-white/60 mt-1.5">{s.label}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Services */}
      {c.services?.items?.length > 0 && (
        <section id="layanan" className="py-20 sm:py-28">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <Reveal className="max-w-2xl mb-12 sm:mb-14">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0f2947] mb-3">{c.services.title}</h2>
              {c.services.subtitle && <p className="text-[#64748b] text-base sm:text-lg">{c.services.subtitle}</p>}
            </Reveal>
            <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
              {c.services.items.map((item, i) => {
                const Icon = SERVICE_ICONS[i % SERVICE_ICONS.length];
                return (
                  <Reveal key={i} delay={i * 0.08} className="group relative rounded-3xl overflow-hidden aspect-[4/3] shadow-lg shadow-[#0f2947]/10 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-[#0f2947]/20">
                    <PhotoPanel src={item.image} alt={item.title} className="absolute inset-0 w-full h-full transition-transform duration-700 group-hover:scale-105" Icon={Icon}>
                      <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(180deg, rgba(15,41,71,0.15) 0%, rgba(15,41,71,0.65) 75%, rgba(15,41,71,0.88) 100%)' }} />
                    </PhotoPanel>
                    <div className="relative h-full flex flex-col justify-between p-6 sm:p-7">
                      <div className="flex items-center justify-between">
                        <span className="text-white/50 font-bold text-sm">{String(i + 1).padStart(2, '0')}</span>
                        <span className="w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
                          <Icon className="w-4 h-4 text-white" />
                        </span>
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-lg sm:text-xl mb-1.5">{item.title}</h3>
                        <p className="text-white/75 text-sm leading-relaxed mb-3 max-w-sm">{item.description}</p>
                        <span className="inline-flex items-center gap-1.5 text-white text-sm font-semibold opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                          Selengkapnya <ArrowUpRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* About / story */}
      {c.about && (
        <section id="tentang" className="py-20 sm:py-28 bg-[#f7fafc]">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <Reveal>
              <PhotoPanel src={c.about.image} alt="Tentang kami" className="rounded-[28px] aspect-[4/5] sm:aspect-square shadow-xl shadow-[#0f2947]/10" Icon={Users} />
            </Reveal>
            <Reveal delay={0.1}>
              <p className="text-xs sm:text-sm font-bold tracking-[0.18em] uppercase mb-4" style={{ color: primary }}>Tentang {clinic.name}</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0f2947] mb-5 leading-tight">{c.about.title}</h2>
              <p className="text-[#475569] leading-relaxed mb-7">{c.about.body}</p>
              <a href="#layanan" className="inline-flex items-center gap-2 font-semibold text-sm px-6 py-3 rounded-full border border-[#0f2947]/15 text-[#0f2947] mb-8 transition-colors hover:bg-white">
                {c.about.ctaLabel || 'Kenali Kami Lebih Dekat'} <ArrowRight className="w-4 h-4" />
              </a>
              {Array.isArray(c.about.stats) && c.about.stats.length > 0 && (
                <div className="flex gap-10 pt-6 border-t border-[#0f2947]/10">
                  {c.about.stats.map((s, i) => (
                    <div key={i}>
                      <p className="text-2xl sm:text-3xl font-extrabold text-[#0f2947]">{s.value}</p>
                      <p className="text-xs sm:text-sm text-[#64748b] mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </Reveal>
          </div>
        </section>
      )}

      {/* Why choose us -- editorial rows */}
      {c.advantages?.items?.length > 0 && (
        <section className="py-20 sm:py-28">
          <div className="max-w-5xl mx-auto px-5 sm:px-8">
            <Reveal className="max-w-2xl mb-12 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0f2947] mb-3">{c.advantages.title}</h2>
              {c.advantages.subtitle && <p className="text-[#64748b] text-base sm:text-lg">{c.advantages.subtitle}</p>}
            </Reveal>
            <div className="divide-y divide-[#0f2947]/[0.08]">
              {c.advantages.items.map((item, i) => {
                const Icon = ADVANTAGE_ICONS[i % ADVANTAGE_ICONS.length];
                return (
                  <Reveal key={i} delay={i * 0.05} className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 py-7 sm:py-8">
                    <span className="text-2xl sm:text-3xl font-extrabold shrink-0 w-14" style={{ color: accent }}>{String(i + 1).padStart(2, '0')}</span>
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${primary}14` }}>
                      <Icon className="w-5 h-5" style={{ color: primary }} />
                    </span>
                    <div className="sm:flex-1">
                      <h3 className="font-bold text-lg text-[#0f2947] mb-1">{item.title}</h3>
                      <p className="text-[#64748b] text-sm sm:text-base leading-relaxed">{item.description}</p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Facilities gallery */}
      {c.facilities?.images?.length > 0 && (
        <section id="fasilitas" className="py-20 sm:py-28 bg-[#f7fafc]">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <Reveal className="max-w-2xl mb-12 sm:mb-14">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0f2947] mb-3">{c.facilities.title}</h2>
              {c.facilities.subtitle && <p className="text-[#64748b] text-base sm:text-lg">{c.facilities.subtitle}</p>}
            </Reveal>
            <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
              {(c.facilities.images[0]) && (
                <Reveal className="sm:row-span-2">
                  <figure className="h-full">
                    <PhotoPanel src={c.facilities.images[0].url} alt={c.facilities.images[0].caption} className="rounded-3xl aspect-[4/5] sm:aspect-auto sm:h-full min-h-[280px] shadow-lg shadow-[#0f2947]/10" Icon={HeartPulse} />
                    {c.facilities.images[0].caption && <figcaption className="text-sm text-[#64748b] mt-3">{c.facilities.images[0].caption}</figcaption>}
                  </figure>
                </Reveal>
              )}
              <div className="grid grid-cols-2 gap-5 sm:gap-6">
                {c.facilities.images.slice(1, 3).map((img, i) => (
                  <Reveal key={i} delay={i * 0.08}>
                    <figure>
                      <PhotoPanel src={img.url} alt={img.caption} className="rounded-3xl aspect-square shadow-lg shadow-[#0f2947]/10" Icon={Activity} />
                      {img.caption && <figcaption className="text-xs sm:text-sm text-[#64748b] mt-3">{img.caption}</figcaption>}
                    </figure>
                  </Reveal>
                ))}
              </div>
              {c.facilities.images[3] && (
                <Reveal className="sm:col-span-2" delay={0.1}>
                  <figure>
                    <PhotoPanel src={c.facilities.images[3].url} alt={c.facilities.images[3].caption} className="rounded-3xl aspect-[21/9] shadow-lg shadow-[#0f2947]/10" Icon={Users} />
                    {c.facilities.images[3].caption && <figcaption className="text-sm text-[#64748b] mt-3">{c.facilities.images[3].caption}</figcaption>}
                  </figure>
                </Reveal>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Patient journey */}
      {c.journey?.steps?.length > 0 && (
        <section className="py-20 sm:py-28">
          <div className="max-w-6xl mx-auto px-5 sm:px-8">
            <Reveal className="max-w-2xl mb-14 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0f2947] mb-3">{c.journey.title}</h2>
              {c.journey.subtitle && <p className="text-[#64748b] text-base sm:text-lg">{c.journey.subtitle}</p>}
            </Reveal>
            <div className="relative grid sm:grid-cols-4 gap-10 sm:gap-6">
              <div className="hidden sm:block absolute top-6 left-[12.5%] right-[12.5%] h-px bg-[#0f2947]/10" />
              {c.journey.steps.map((step, i) => (
                <Reveal key={i} delay={i * 0.08} className="relative">
                  <div className="flex sm:flex-col items-center sm:items-start gap-4 sm:gap-5">
                    <span
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-lg"
                      style={{ backgroundColor: i === c.journey.steps.length - 1 ? accent : primary, boxShadow: `0 8px 20px -6px ${primary}55` }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="font-bold text-[#0f2947] mb-1">{step.title}</h3>
                      <p className="text-sm text-[#64748b] leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Pricing */}
      {pricelist.length > 0 && (
        <section className="py-20 sm:py-28 bg-[#f7fafc]">
          <div className="max-w-3xl mx-auto px-5 sm:px-8">
            <Reveal className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0f2947] mb-3">{c.pricing?.title || 'Daftar Harga'}</h2>
              {c.pricing?.subtitle && <p className="text-[#64748b]">{c.pricing.subtitle}</p>}
            </Reveal>
            <div className="space-y-8">
              {Object.entries(pricingByCategory).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: primary }}>{category}</h3>
                  <div className="bg-white rounded-2xl divide-y divide-[#0f2947]/[0.06] shadow-sm border border-[#0f2947]/[0.06]">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                        <div>
                          <p className="font-medium text-[#0f2947]">{item.name}</p>
                          {item.description && <p className="text-sm text-[#64748b]">{item.description}</p>}
                        </div>
                        <p className="font-bold whitespace-nowrap" style={{ color: primary }}>
                          {formatPrice(item.price)}
                          <span className="font-normal text-xs ml-1 text-[#64748b]">/{item.price_unit}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {c.pricing?.note && <p className="text-xs text-center mt-6 text-[#64748b]">{c.pricing.note}</p>}
          </div>
        </section>
      )}

      {/* Testimonials */}
      {c.testimonials?.items?.length > 0 && (
        <section id="testimoni" className="py-20 sm:py-28">
          <div className="max-w-6xl mx-auto px-5 sm:px-8">
            <Reveal className="text-center max-w-xl mx-auto mb-14">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0f2947]">{c.testimonials.title || 'Apa Kata Pasien Kami?'}</h2>
            </Reveal>
            <div className="grid sm:grid-cols-3 gap-6">
              {c.testimonials.items.map((t, i) => (
                <Reveal key={i} delay={i * 0.08} className="relative bg-[#f7fafc] rounded-3xl p-7 sm:p-8 border border-[#0f2947]/[0.06]">
                  <Quote className="absolute top-6 right-7 w-10 h-10" style={{ color: primary, opacity: 0.12 }} strokeWidth={1.5} />
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.rating || 5 }).map((_, si) => (
                      <Star key={si} className="w-4 h-4 fill-current" style={{ color: accent }} />
                    ))}
                  </div>
                  <p className="text-[#334155] text-sm sm:text-base leading-relaxed mb-6 relative">&ldquo;{t.quote}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    {t.photo ? (
                      <img src={t.photo} alt={t.name} className="avatar-img w-11 h-11 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: primary }}>
                        {(t.name || '?').trim().charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-sm text-[#0f2947]">{t.name}</p>
                      <p className="text-xs text-[#64748b]">{t.role}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {c.faq?.items?.length > 0 && (
        <section id="faq" className="py-20 sm:py-28 bg-[#f7fafc]">
          <div className="max-w-3xl mx-auto px-5 sm:px-8">
            <Reveal className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0f2947]">{c.faq.title || 'Pertanyaan yang Sering Diajukan'}</h2>
            </Reveal>
            <div className="space-y-3">
              {c.faq.items.map((item, i) => {
                const open = faqOpen === i;
                return (
                  <div key={i} className="bg-white rounded-2xl border border-[#0f2947]/[0.07] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setFaqOpen(open ? -1 : i)}
                      className="w-full flex items-center justify-between gap-4 text-left px-5 sm:px-6 py-4 sm:py-5"
                    >
                      <span className="font-semibold text-sm sm:text-base text-[#0f2947]">{item.question}</span>
                      <ChevronDown className={`w-4 h-4 shrink-0 text-[#64748b] transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <div className="px-5 sm:px-6 pb-5 text-sm text-[#64748b] leading-relaxed">{item.answer}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Premium CTA */}
      {c.cta && (
        <section className="relative overflow-hidden py-20 sm:py-28 text-center">
          <PhotoPanel src={c.cta.image} alt="Booking" className="absolute inset-0 w-full h-full" Icon={Activity}>
            <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(180deg, rgba(10,22,38,0.75) 0%, rgba(10,22,38,0.92) 100%)' }} />
          </PhotoPanel>
          <div className="relative max-w-2xl mx-auto px-5 sm:px-8">
            <Reveal>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">{c.cta.title}</h2>
              <p className="text-white/75 text-base sm:text-lg mb-9 leading-relaxed">{c.cta.subtitle}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a href={bookingHref} className="inline-flex items-center justify-center gap-2 font-semibold px-7 py-3.5 rounded-full text-white shadow-lg transition-transform hover:-translate-y-0.5" style={{ backgroundColor: accent, color: '#0a1626' }}>
                  <CalendarCheck className="w-4 h-4" /> {c.cta.buttonLabel || 'Booking Sekarang'}
                </a>
                {waHref && (
                  <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 font-semibold px-7 py-3.5 rounded-full border border-white/30 text-white transition-colors hover:bg-white/10">
                    <MessageCircle className="w-4 h-4" /> Chat WhatsApp
                  </a>
                )}
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="text-white pt-16 pb-8" style={{ backgroundColor: '#0a1626' }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="grid sm:grid-cols-3 gap-10 sm:gap-8 pb-10 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                {clinic.logo_url ? (
                  <img src={clinic.logo_url} alt={clinic.name} className="h-8 w-8 rounded-lg object-cover" />
                ) : (
                  <span className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: primary }}>
                    <HeartPulse className="w-4 h-4" />
                  </span>
                )}
                <span className="font-bold text-lg">{clinic.name}</span>
              </div>
              <p className="text-sm text-white/50 leading-relaxed">{c.footer?.tagline || 'Better Movement, Brighter Tomorrow.'}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-white/40 mb-4">Navigasi</p>
              <div className="flex flex-col gap-2.5">
                {NAV_LINKS.map((l) => (
                  <a key={l.href} href={l.href} className="text-sm text-white/60 hover:text-white transition-colors">{l.label}</a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-white/40 mb-4">Kontak</p>
              <div className="space-y-2.5">
                {clinic.address && (
                  <div className="flex items-start gap-2.5 text-sm text-white/60">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: accent }} />
                    <span>{clinic.address}</span>
                  </div>
                )}
                {clinic.phone && (
                  <div className="flex items-start gap-2.5 text-sm text-white/60">
                    <Phone className="w-4 h-4 shrink-0 mt-0.5" style={{ color: accent }} />
                    <span>{clinic.phone}</span>
                  </div>
                )}
                {waHref && (
                  <a href={waHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm text-white/60 hover:text-white transition-colors">
                    <MessageCircle className="w-4 h-4 shrink-0" style={{ color: accent }} />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
              {(c.footer?.social?.instagram || c.footer?.social?.facebook) && (
                <div className="flex items-center gap-3 mt-4">
                  {c.footer.social.instagram && (
                    <a href={c.footer.social.instagram} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                      <Instagram className="w-4 h-4" />
                    </a>
                  )}
                  {c.footer.social.facebook && (
                    <a href={c.footer.social.facebook} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                      <Facebook className="w-4 h-4" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white/40">&copy; {new Date().getFullYear()} {clinic.name}. All rights reserved.</p>
            <p className="text-xs text-white/40">Powered by Clinara</p>
          </div>
        </div>
      </footer>

      {/* Sticky mobile booking bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur-md border-t border-[#0f2947]/10 px-4 py-3 flex gap-2.5" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        {waHref && (
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-full border border-[#0f2947]/15 text-[#0f2947]">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
        )}
        <a href={bookingHref} className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-full text-white" style={{ backgroundColor: primary }}>
          <CalendarCheck className="w-4 h-4" /> Booking
        </a>
      </div>
      <div className="lg:hidden h-16" />
    </div>
  );
};

export default PremiumClinicLanding;
