import React from 'react';
import {
  CalendarCheck, MessageCircle, MapPin, Phone, CheckCircle2, Quote,
  Activity, HeartPulse, Dumbbell, Home as HomeIcon, Stethoscope, Brain, ShieldCheck, Sparkles, Award, Star,
} from 'lucide-react';

const formatPrice = (value) => {
  const n = Number(value) || 0;
  return `Rp${n.toLocaleString('id-ID')}`;
};

// Decorative icon rotations for services/advantages cards -- clinics don't
// pick icons themselves (content is just title/description), so we cycle a
// small curated set to give every card a distinct visual anchor instead of
// the flat text-only block it used to be.
const SERVICE_ICONS = [Activity, HeartPulse, Dumbbell, HomeIcon, Stethoscope, Brain, ShieldCheck, Sparkles];
const ADVANTAGE_ICONS = [ShieldCheck, Award, Star, HeartPulse, Sparkles, Activity];

const DOT_PATTERN = { backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' };

// Renders a clinic's public landing page from a template's style tokens +
// merged content (template defaults with owner overrides applied). One
// renderer drives all 5 templates -- what changes per template is the style
// object (colors/shapes/fonts) and the default content, not the markup
// structure -- so adding a 6th template later only means adding a config
// entry, not a new page component.
const ClinicLandingRenderer = ({ clinic, style, content, pricelist = [], bookingHref = '/booking', waHref, primaryColor, accentColor, defaultColors }) => {
  const s = style;
  const c = content;
  const pricingByCategory = pricelist.reduce((acc, item) => {
    const key = item.category || 'Lainnya';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  // Custom colors picked by the clinic owner override the template's own
  // palette on just the elements that carry brand color (primary buttons,
  // gradient hero for templates built around one, accent-tinted text) --
  // everything else (layout, dark/light mode, radius, font) stays fixed per
  // template so the 5 styles remain visually distinct.
  const primary = primaryColor || defaultColors?.primary || '#4338ca';
  const accent = accentColor || defaultColors?.accent || '#0ea5e9';
  const primaryStyle = primaryColor ? { backgroundColor: primaryColor } : undefined;
  const accentStyle = accentColor ? { color: accentColor } : undefined;
  const heroStyle = s.gradientHero && (primaryColor || accentColor)
    ? { backgroundImage: `linear-gradient(135deg, ${primaryColor || defaultColors?.primary}, ${accentColor || defaultColors?.accent})` }
    : undefined;
  const iconGradient = { backgroundImage: `linear-gradient(135deg, ${primary}, ${accent})` };
  const trustBadges = Array.isArray(c.about?.points) ? c.about.points.slice(0, 2) : [];

  return (
    <div className={`min-h-screen ${s.font} ${s.dark ? 'bg-[#0b1120]' : 'bg-white'}`}>
      {/* Header */}
      <header className={`${s.sectionBg} ${s.dark ? 'border-b border-white/10' : 'border-b border-slate-100'}`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          {clinic.logo_url ? (
            <img src={clinic.logo_url} alt={clinic.name} className="h-9 w-9 rounded-lg object-cover" />
          ) : null}
          <span className={`font-bold text-lg ${s.headingText}`}>{clinic.name}</span>
        </div>
      </header>

      {/* Hero */}
      <section className={`relative overflow-hidden ${s.heroBg} ${s.heroText}`} style={heroStyle}>
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full blur-3xl opacity-30" style={{ backgroundColor: accent }} />
          <div className="absolute -bottom-28 -left-20 w-96 h-96 rounded-full blur-3xl opacity-20" style={{ backgroundColor: primary }} />
          <div className="absolute inset-0 opacity-[0.06]" style={DOT_PATTERN} />
        </div>
        <div className="relative max-w-4xl mx-auto px-6 py-20 sm:py-28 text-center">
          {c.hero?.eyebrow && (
            <span className={`inline-block text-xs font-semibold tracking-wide uppercase px-3 py-1.5 rounded-full mb-5 backdrop-blur ${s.badgeBg}`}>
              {c.hero.eyebrow}
            </span>
          )}
          <h1 className="text-3xl sm:text-5xl font-bold mb-5 leading-tight drop-shadow-sm">{c.hero?.title || clinic.name}</h1>
          <p className="text-base sm:text-lg opacity-90 max-w-2xl mx-auto mb-9">{c.hero?.subtitle}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={bookingHref} className={`inline-flex items-center justify-center gap-2 font-semibold px-6 py-3 ${s.cardShape} shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:shadow-xl ${s.buttonPrimary}`} style={primaryStyle}>
              <CalendarCheck className="w-4 h-4" /> {c.hero?.ctaLabel || 'Booking Sekarang'}
            </a>
            {waHref && (
              <a href={waHref} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center justify-center gap-2 font-semibold px-6 py-3 ${s.cardShape} transition-all hover:-translate-y-0.5 ${s.buttonSecondary}`}>
                <MessageCircle className="w-4 h-4" /> {c.hero?.ctaWhatsappLabel || 'Chat WhatsApp'}
              </a>
            )}
          </div>
          {trustBadges.length > 0 && (
            <div className="hidden sm:flex items-center justify-center flex-wrap gap-3 mt-10">
              {trustBadges.map((point, i) => (
                <span key={i} className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur ${s.badgeBg}`}>
                  <ShieldCheck className="w-3.5 h-3.5" /> {point}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* About */}
      {c.about && (
        <section className={`relative overflow-hidden ${s.sectionBg} py-16 sm:py-20`}>
          <div className={`pointer-events-none absolute inset-0 opacity-[0.035] ${s.headingText}`} style={DOT_PATTERN} />
          <div className="relative max-w-6xl mx-auto px-6 grid lg:grid-cols-5 gap-10 lg:gap-14 items-center">
            <div className="lg:col-span-3">
              <h2 className={`text-2xl sm:text-3xl font-bold mb-4 ${s.headingText}`}>{c.about.title}</h2>
              <p className={`${s.bodyText} mb-8 leading-relaxed`}>{c.about.body}</p>
              {Array.isArray(c.about.points) && c.about.points.length > 0 && (
                <ul className="grid sm:grid-cols-2 gap-3">
                  {c.about.points.map((point, i) => (
                    <li key={i} className={`flex items-start gap-2.5 ${s.bodyText}`}>
                      <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${s.accentText}`} style={accentStyle} />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {(c.about.points?.[0] || c.about.title) && (
              <div className="lg:col-span-2">
                <div className={`relative rounded-3xl p-8 shadow-xl ${s.dark ? 'shadow-black/40' : 'shadow-slate-300/50'}`} style={iconGradient}>
                  <div className="absolute inset-0 rounded-3xl opacity-10" style={DOT_PATTERN} />
                  <HeartPulse className="relative w-11 h-11 text-white/90 mb-5" />
                  <p className="relative text-white text-lg font-semibold leading-snug">
                    {c.about.points?.[0] || c.about.title}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Services */}
      {c.services?.items?.length > 0 && (
        <section className={`relative overflow-hidden ${s.sectionAltBg} py-16 sm:py-20`}>
          <div className={`pointer-events-none absolute inset-0 opacity-[0.05] ${s.headingText}`} style={DOT_PATTERN} />
          <div className="relative max-w-6xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className={`text-2xl sm:text-3xl font-bold mb-2 ${s.headingText}`}>{c.services.title}</h2>
              {c.services.subtitle && <p className={s.bodyText}>{c.services.subtitle}</p>}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {c.services.items.map((item, i) => {
                const Icon = SERVICE_ICONS[i % SERVICE_ICONS.length];
                return (
                  <div key={i} className={`${s.sectionBg} ${s.cardShape} p-6 transition-all duration-300 hover:-translate-y-1 ${s.dark ? 'border border-white/10 hover:border-white/20' : 'border border-slate-100 shadow-sm hover:shadow-xl'}`}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-md" style={iconGradient}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className={`font-semibold mb-2 ${s.headingText}`}>{item.title}</h3>
                    <p className={`text-sm ${s.bodyText}`}>{item.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Advantages */}
      {c.advantages?.items?.length > 0 && (
        <section className={`${s.sectionBg} py-16 sm:py-20`}>
          <div className="max-w-6xl mx-auto px-6">
            <h2 className={`text-2xl sm:text-3xl font-bold mb-10 text-center ${s.headingText}`}>{c.advantages.title}</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {c.advantages.items.map((item, i) => {
                const Icon = ADVANTAGE_ICONS[i % ADVANTAGE_ICONS.length];
                return (
                  <div key={i} className={`text-center px-6 py-8 rounded-2xl transition-all duration-300 hover:-translate-y-1 ${s.dark ? 'bg-white/5 border border-white/10 hover:border-white/20' : 'bg-white border border-slate-100 shadow-sm hover:shadow-lg'}`}>
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center shadow-md" style={iconGradient}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className={`font-semibold mb-2 ${s.headingText}`}>{item.title}</h3>
                    <p className={`text-sm ${s.bodyText}`}>{item.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Pricing */}
      {pricelist.length > 0 && (
        <section className={`relative overflow-hidden ${s.sectionAltBg} py-16 sm:py-20`}>
          <div className={`pointer-events-none absolute inset-0 opacity-[0.05] ${s.headingText}`} style={DOT_PATTERN} />
          <div className="relative max-w-4xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className={`text-2xl sm:text-3xl font-bold mb-2 ${s.headingText}`}>{c.pricing?.title || 'Daftar Harga'}</h2>
              {c.pricing?.subtitle && <p className={s.bodyText}>{c.pricing.subtitle}</p>}
            </div>
            <div className="space-y-8">
              {Object.entries(pricingByCategory).map(([category, items]) => (
                <div key={category}>
                  <h3 className={`text-sm font-bold uppercase tracking-wide mb-3 ${s.accentText}`} style={accentStyle}>{category}</h3>
                  <div className={`${s.sectionBg} ${s.cardShape} divide-y shadow-sm ${s.dark ? 'divide-white/10 border border-white/10' : 'divide-slate-100 border border-slate-100'}`}>
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                        <div>
                          <p className={`font-medium ${s.headingText}`}>{item.name}</p>
                          {item.description && <p className={`text-sm ${s.bodyText}`}>{item.description}</p>}
                        </div>
                        <p className={`font-bold whitespace-nowrap ${s.accentText}`} style={accentStyle}>
                          {formatPrice(item.price)}
                          <span className={`font-normal text-xs ml-1 ${s.bodyText}`}>/{item.price_unit}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {c.pricing?.note && <p className={`text-xs text-center mt-6 ${s.bodyText}`}>{c.pricing.note}</p>}
          </div>
        </section>
      )}

      {/* Testimonials */}
      {c.testimonials?.items?.length > 0 && (
        <section className={`${s.sectionBg} py-16 sm:py-20`}>
          <div className="max-w-6xl mx-auto px-6">
            <h2 className={`text-2xl sm:text-3xl font-bold mb-10 text-center ${s.headingText}`}>{c.testimonials.title || 'Testimoni Pasien'}</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {c.testimonials.items.map((t, i) => (
                <div key={i} className={`relative ${s.cardShape} p-6 transition-shadow duration-300 ${s.dark ? 'bg-white/5 border border-white/10 hover:shadow-2xl' : 'bg-slate-50 border border-slate-100 shadow-sm hover:shadow-xl'}`}>
                  <Quote className={`w-6 h-6 mb-3 ${s.accentText}`} style={accentStyle} />
                  <p className={`text-sm mb-5 ${s.bodyText}`}>&ldquo;{t.quote}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md" style={iconGradient}>
                      {(t.name || '?').trim().charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${s.headingText}`}>{t.name}</p>
                      <p className={`text-xs ${s.bodyText}`}>{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      {c.cta && (
        <section className={`relative overflow-hidden ${s.ctaBg} text-white py-16 sm:py-20 text-center`}>
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full blur-3xl opacity-20" style={{ backgroundColor: accent }} />
            <div className="absolute -bottom-20 -right-10 w-80 h-80 rounded-full blur-3xl opacity-20" style={{ backgroundColor: primary }} />
          </div>
          <div className="relative max-w-2xl mx-auto px-6">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">{c.cta.title}</h2>
            <p className="opacity-90 mb-8">{c.cta.subtitle}</p>
            <a href={bookingHref} className={`inline-flex items-center justify-center gap-2 font-semibold px-7 py-3 ${s.cardShape} shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:shadow-xl ${s.buttonPrimary}`} style={primaryStyle}>
              <CalendarCheck className="w-4 h-4" /> {c.cta.buttonLabel || 'Booking Sekarang'}
            </a>
          </div>
        </section>
      )}

      {/* Contact + Footer */}
      <footer className={`${s.sectionBg} ${s.dark ? 'border-t border-white/10' : 'border-t border-slate-100'} py-12`}>
        <div className="max-w-4xl mx-auto px-6">
          {(clinic.address || clinic.phone) && (
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 mb-8">
              {clinic.address && (
                <div className={`flex items-start gap-2.5 ${s.bodyText}`}>
                  <MapPin className={`w-5 h-5 shrink-0 mt-0.5 ${s.accentText}`} style={accentStyle} />
                  <span>{clinic.address}</span>
                </div>
              )}
              {clinic.phone && (
                <div className={`flex items-start gap-2.5 ${s.bodyText}`}>
                  <Phone className={`w-5 h-5 shrink-0 mt-0.5 ${s.accentText}`} style={accentStyle} />
                  <span>{clinic.phone}</span>
                </div>
              )}
            </div>
          )}
          {c.footer?.tagline && <p className={`text-sm ${s.bodyText} mb-6`}>{c.footer.tagline}</p>}
          <p className={`text-xs ${s.dark ? 'text-slate-500' : 'text-slate-400'}`}>Powered by Clinara</p>
        </div>
      </footer>
    </div>
  );
};

export default ClinicLandingRenderer;
