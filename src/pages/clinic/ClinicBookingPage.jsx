import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  ArrowLeft, ArrowRight, CalendarDays, CalendarPlus, CalendarCheck2, CheckCircle2, Loader2, Lock, MapPin,
  Sparkles, Stethoscope, User, Users, MessageCircle, Activity, HeartPulse, Home,
  ClipboardList, RotateCcw, ShieldCheck, Lightbulb, Wand2, Cloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { useClinicTenant } from '@/hooks/useClinicTenant';
import { getActivePhysiotherapists, getAvailableSlots, createAppointment } from '@/lib/api';
import { getLandingTemplate, mergeLandingContent } from '@/config/landingTemplates';

// Icon rotation used only as a fallback presentation for tenant services that
// don't have their own image/icon set on the landing page builder - purely
// cosmetic, never used to identify a service.
const SERVICE_ICONS = [Stethoscope, Activity, HeartPulse, Home, ClipboardList];

const ANY_THERAPIST = { id: null, name: 'Siapa Saja yang Tersedia', specialization: 'Jadwal tercepat' };

// "Bantu Saya Memilih" quick-pick tags for the service step. Each tag is
// matched against a tenant's own service titles/descriptions by keyword
// score at runtime (matchServiceByKeywords) - the tags themselves are
// generic complaint categories, never tied to any one clinic's services.
const HELP_TAGS = [
  { label: 'Nyeri Otot & Sendi', keywords: ['nyeri', 'otot', 'sendi', 'umum', 'musculoskeletal'] },
  { label: 'Pasca Operasi', keywords: ['operasi', 'pasca', 'post', 'ortopedi'] },
  { label: 'Cedera Olahraga', keywords: ['olahraga', 'cedera', 'sport', 'atlet', 'sports'] },
  { label: 'Kunjungan ke Rumah', keywords: ['rumah', 'home', 'care', 'kunjungan'] },
];

const matchServiceByKeywords = (services, keywords) => {
  let best = null;
  let bestScore = 0;
  services.forEach((s) => {
    const haystack = `${s.title} ${s.description || ''}`.toLowerCase();
    const score = keywords.reduce((acc, k) => acc + (haystack.includes(k) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  });
  return bestScore > 0 ? best : null;
};

const STEP_LABELS = {
  service: 'Layanan',
  therapist: 'Terapis',
  schedule: 'Jadwal',
  details: 'Data Diri',
  confirm: 'Konfirmasi',
};

// Public booking flow for a clinic's own tenant site (subdomain or verified
// custom domain) - this is the Clinara Booking Engine: one reusable,
// white-label booking product shared by every tenant clinic, never a
// one-off page built for a single clinic. Its step structure, interaction
// model and visual system belong to Clinara; only branding (logo, name,
// colors) and content (services, therapists, schedule) come from the
// tenant, resolved dynamically via useClinicTenant. Distinct from Kaffah's
// own /booking flow (SmartBookingPage), which stays exclusive to
// kaffahphysio.id and is untouched by this component.
const ClinicBookingPage = () => {
  const { clinic, loading: loadingClinic, notFound } = useClinicTenant();
  const { toast } = useToast();

  const [content, setContent] = useState(null);
  const [step, setStep] = useState(null);
  const [therapists, setTherapists] = useState([]);
  const [loadingTherapists, setLoadingTherapists] = useState(true);

  const [selectedService, setSelectedService] = useState(null);
  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [form, setForm] = useState({ name: '', phone: '', complaint: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [bookingRef, setBookingRef] = useState(null);
  const [helperOpen, setHelperOpen] = useState(false);

  const dateOptions = useMemo(
    () => Array.from({ length: 10 }, (_, i) => addDays(new Date(), i)),
    []
  );

  useEffect(() => {
    if (!clinic) return;
    const template = getLandingTemplate(clinic.landing_template);
    setContent(mergeLandingContent(template.defaultContent, clinic.landing_content));
  }, [clinic]);

  const services = (content?.services?.items || []).filter((s) => s?.title);
  const STEPS = useMemo(
    () => (services.length > 0 ? ['service', 'therapist', 'schedule', 'details', 'confirm'] : ['therapist', 'schedule', 'details', 'confirm']),
    [services.length]
  );

  useEffect(() => {
    if (step === null && STEPS.length > 0) setStep(STEPS[0]);
  }, [STEPS, step]);

  useEffect(() => {
    if (!clinic?.id) return;
    setLoadingTherapists(true);
    getActivePhysiotherapists({ clinicId: clinic.id, showOnBooking: true })
      .then(({ data }) => setTherapists(data || []))
      .finally(() => setLoadingTherapists(false));
  }, [clinic?.id]);

  useEffect(() => {
    if (!selectedDate || !clinic?.id) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    getAvailableSlots(dateStr, selectedTherapist?.id || null, clinic.id)
      .then(({ data }) => {
        const open = (data || []).filter((s) => s.status === 'aktif');
        setSlots(open);
      })
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, selectedTherapist, clinic?.id]);

  const goTo = (target) => {
    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const stepIndex = step ? STEPS.indexOf(step) : -1;
  const goBack = () => {
    if (stepIndex > 0) goTo(STEPS[stepIndex - 1]);
  };

  const handleSelectService = (s) => {
    setSelectedService(s);
  };

  const handleHelpTag = (tag) => {
    const match = matchServiceByKeywords(services, tag.keywords);
    setHelperOpen(false);
    if (match) {
      setSelectedService(match);
      toast({ title: 'Direkomendasikan', description: match.title });
    } else {
      toast({ title: 'Belum ada rekomendasi otomatis', description: 'Silakan pilih layanan secara manual di bawah.' });
    }
  };

  const handlePickTherapist = (t) => {
    setSelectedTherapist(t);
    goTo('schedule');
  };

  const handlePickSlot = (slot) => {
    setSelectedSlot(slot);
    goTo('details');
  };

  const canSubmitDetails = form.name.trim().length > 1 && form.phone.trim().length >= 8;

  const handleSubmitBooking = async () => {
    if (!selectedSlot || !clinic?.id) return;
    setSubmitting(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const timePart = (selectedSlot.slot_start || '').slice(0, 5);
      const appointmentDate = `${dateStr}T${timePart}:00`;

      const noteParts = [];
      if (selectedService?.title) noteParts.push(`Layanan: ${selectedService.title}`);
      if (form.complaint.trim()) noteParts.push(`Keluhan: ${form.complaint.trim()}`);
      if (form.notes.trim()) noteParts.push(`Catatan: ${form.notes.trim()}`);
      const notes = noteParts.length > 0 ? `[Booking Online] ${noteParts.join(' | ')}` : '[Booking Online]';

      const { data, error } = await createAppointment({
        therapistId: selectedSlot.therapist_id,
        clinicId: clinic.id,
        appointmentDate,
        durationMinutes: selectedSlot.duration_minutes || 60,
        status: 'confirmed',
        notes,
        guestName: form.name.trim(),
        guestPhone: form.phone.trim(),
        guestComplaint: form.complaint.trim() || null,
      });

      if (error) throw new Error(error.message || 'Gagal membuat janji temu.');

      const initials = (clinic.name || 'CL').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'CL';
      const suffix = (data?.id || '').replace(/-/g, '').slice(-4).toUpperCase();
      setBookingRef(`${initials}-${format(new Date(), 'yyyyMMdd')}-${suffix || '0000'}`);
      setSuccess(true);
    } catch (err) {
      toast({
        title: 'Booking belum dapat diproses',
        description: 'Silakan coba kembali dalam beberapa saat.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddToCalendar = () => {
    if (!selectedDate || !selectedSlot) return;
    const dateStr = format(selectedDate, 'yyyyMMdd');
    const timePart = (selectedSlot.slot_start || '00:00').slice(0, 5).replace(':', '');
    const duration = selectedSlot.duration_minutes || 60;
    const start = new Date(selectedDate);
    const [h, m] = (selectedSlot.slot_start || '00:00').slice(0, 5).split(':').map(Number);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + duration * 60000);
    const fmt = (d) => format(d, "yyyyMMdd'T'HHmmss");
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
      `UID:${bookingRef || `${dateStr}${timePart}`}@clinara.id`,
      `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
      `SUMMARY:Booking ${clinic.name}${selectedService ? ` - ${selectedService.title}` : ''}`,
      `LOCATION:${(clinic.address || '').replace(/\n/g, ', ')}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booking-${clinic.name?.replace(/\s+/g, '-').toLowerCase() || 'clinara'}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const template = getLandingTemplate(clinic?.landing_template);
  const primary = clinic?.landing_primary_color || template.colors.primary;
  const accent = clinic?.landing_accent_color || template.colors.accent;

  if (loadingClinic || (clinic && !content) || step === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: primary }} />
      </div>
    );
  }

  if (notFound || !clinic) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-center px-4">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Domain belum terhubung</h1>
        <p className="text-slate-500 max-w-md">
          Domain ini belum dihubungkan ke klinik manapun, atau proses verifikasinya belum selesai.
        </p>
      </div>
    );
  }

  const activeTherapist = selectedSlot
    ? therapists.find((t) => t.id === selectedSlot.therapist_id) || selectedTherapist
    : selectedTherapist;

  const waHref = clinic.phone
    ? `https://wa.me/${clinic.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}`
    : null;

  const summaryRows = [
    { label: 'Klinik', value: clinic.name },
    selectedService && { label: 'Layanan', value: selectedService.title },
    selectedTherapist && { label: 'Terapis', value: selectedTherapist.name },
    selectedDate && { label: 'Tanggal', value: format(selectedDate, 'EEEE, d MMMM yyyy', { locale: idLocale }) },
    selectedSlot && { label: 'Waktu', value: `${(selectedSlot.slot_start || '').slice(0, 5)} WIB` },
  ].filter(Boolean);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)' }}>
      <Helmet>
        <title>Booking Online — {clinic.name}</title>
        <meta name="theme-color" content={primary} />
      </Helmet>

      {/* Header - tenant identity leads, Clinara stays subtle (footer only) */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {!success && stepIndex > 0 ? (
              <button
                onClick={goBack}
                aria-label="Kembali"
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <Link to="/" aria-label="Kembali ke beranda" className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            )}
            {clinic.logo_url ? (
              <img src={clinic.logo_url} alt={clinic.name} className="h-9 w-9 rounded-lg object-cover shrink-0 ring-1 ring-slate-100" />
            ) : (
              <div className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold shrink-0" style={{ background: primary }}>
                {clinic.name?.[0]?.toUpperCase() || 'C'}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-slate-900 leading-tight truncate text-sm sm:text-base">{clinic.name}</p>
              <p className="text-[11px] sm:text-xs text-slate-400 leading-tight truncate">{content?.footer?.tagline || 'Booking Online'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 shrink-0 text-right">
            <Lock className="w-3.5 h-3.5 hidden sm:block" />
            <div className="leading-tight">
              <p className="text-[11px] sm:text-xs font-semibold text-slate-600">Booking Online</p>
              <p className="text-[10px] sm:text-[11px]">Aman &amp; Privat</p>
            </div>
          </div>
        </div>
      </header>

      {!success && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
          <div className="flex items-start">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center gap-1 shrink-0 w-10 sm:w-14">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors shrink-0 ${
                      i <= stepIndex ? 'text-white' : 'bg-slate-200 text-slate-400'
                    }`}
                    style={i <= stepIndex ? { background: primary } : undefined}
                  >
                    {i < stepIndex ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span
                    className="text-[9px] sm:text-[11px] font-semibold text-center leading-tight"
                    style={{ color: i <= stepIndex ? primary : '#94a3b8' }}
                  >
                    {STEP_LABELS[s]}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 rounded-full bg-slate-200 overflow-hidden mt-3.5 mx-0.5 sm:mx-1">
                    <div className="h-full rounded-full transition-all" style={{ width: i < stepIndex ? '100%' : '0%', background: accent }} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className={success ? '' : 'lg:grid lg:grid-cols-[1fr_320px] lg:gap-8 lg:items-start'}>
          <div className="pb-28 lg:pb-0">
            <AnimatePresence mode="wait">
              {success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-lg mx-auto bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-900/5 p-8 sm:p-10 text-center"
                >
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
                    style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${accent})` }}
                  >
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900 mb-2">Booking Berhasil!</h1>
                  <p className="text-slate-500 mb-6">
                    Jadwal Anda di <strong>{clinic.name}</strong> telah berhasil dibuat.
                  </p>

                  <div className="bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-100 text-left mb-7">
                    <div className="p-4 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">Nomor Booking</span>
                      <span className="font-bold text-slate-800 text-sm">{bookingRef}</span>
                    </div>
                    {selectedService && (
                      <div className="p-4 flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-400">Layanan</span>
                        <span className="font-semibold text-slate-800 text-sm">{selectedService.title}</span>
                      </div>
                    )}
                    <div className="p-4 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">Tanggal</span>
                      <span className="font-semibold text-slate-800 text-sm text-right">{format(selectedDate, "EEEE, d MMMM yyyy", { locale: idLocale })}</span>
                    </div>
                    <div className="p-4 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">Waktu</span>
                      <span className="font-semibold text-slate-800 text-sm">{(selectedSlot?.slot_start || '').slice(0, 5)} WIB</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {waHref && (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 text-white font-semibold px-6 py-3.5 rounded-xl transition-opacity hover:opacity-90 shadow-md"
                        style={{ background: primary }}
                      >
                        <MessageCircle className="w-4 h-4" /> Chat WhatsApp
                      </a>
                    )}
                    <button
                      onClick={handleAddToCalendar}
                      className="w-full inline-flex items-center justify-center gap-2 font-semibold px-6 py-3.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <CalendarPlus className="w-4 h-4" /> Tambahkan ke Kalender
                    </button>
                    <Link
                      to="/"
                      className="w-full inline-flex items-center justify-center gap-2 font-semibold px-6 py-3.5 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                      <Home className="w-4 h-4" /> Kembali ke Beranda
                    </Link>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-6 flex items-center justify-center gap-1">
                    <Lock className="w-3 h-3" /> Terima kasih telah mempercayakan jadwal Anda kepada kami.
                  </p>
                </motion.div>
              ) : step === 'service' ? (
                <motion.div key="service" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: accent }}>
                    Langkah {stepIndex + 1} dari {STEPS.length}
                  </p>

                  {content?.hero?.image ? (
                    <div className="relative rounded-3xl overflow-hidden mb-6 h-40 sm:h-56">
                      <img src={content.hero.image} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(0deg, rgba(15,23,42,0.55), rgba(15,23,42,0.05))` }} />
                      {content?.hero?.eyebrow && (
                        <p className="absolute top-4 right-4 text-white text-xs italic font-medium text-right max-w-[60%]">{content.hero.eyebrow}</p>
                      )}
                    </div>
                  ) : (
                    <div
                      className="relative rounded-3xl overflow-hidden mb-6 h-28 sm:h-36 flex items-center justify-center"
                      style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${accent})` }}
                    >
                      <Sparkles className="w-10 h-10 text-white/40" />
                    </div>
                  )}

                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
                    {content?.hero?.title || 'Mulai Perjalanan Pemulihan Anda'}
                  </h1>
                  <p className="text-slate-500 text-sm mb-6">
                    {content?.services?.subtitle || 'Pilih layanan yang sesuai dengan kebutuhan Anda. Jika masih bingung, kami dapat membantu merekomendasikan pilihan yang tepat.'}
                  </p>

                  <h2 className="text-base font-bold text-slate-900 mb-1">{content?.services?.title || 'Pilih Layanan Terapi'}</h2>
                  <p className="text-slate-500 text-xs mb-4">Pilih jenis layanan yang Anda butuhkan.</p>

                  <div className="grid sm:grid-cols-2 gap-3.5">
                    {services.map((s, i) => {
                      const Icon = SERVICE_ICONS[i % SERVICE_ICONS.length];
                      const isSelected = selectedService?.title === s.title;
                      return (
                        <button
                          key={s.title}
                          onClick={() => handleSelectService(s)}
                          className={`text-left bg-white rounded-2xl overflow-hidden transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 min-h-[48px] ${
                            isSelected ? 'ring-2' : 'border border-slate-100'
                          }`}
                          style={isSelected ? { '--tw-ring-color': primary } : undefined}
                        >
                          {s.image ? (
                            <div className="relative h-32">
                              <img src={s.image} alt="" className="w-full h-full object-cover" />
                              <div
                                className="absolute -bottom-4 left-3 w-9 h-9 rounded-full flex items-center justify-center ring-4 ring-white"
                                style={{ background: primary }}
                              >
                                <Icon className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          ) : null}
                          <div className={`p-4 flex items-start gap-3 ${s.image ? 'pt-6' : ''}`}>
                            {!s.image && (
                              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${primary}14` }}>
                                <Icon className="w-5 h-5" style={{ color: primary }} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-800 text-sm">{s.title}</p>
                              {s.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{s.description}</p>}
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-300 mt-1 shrink-0" />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 mt-5 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0">
                      <Lightbulb className="w-4 h-4" style={{ color: primary }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">Belum yakin memilih layanan?</p>
                      <p className="text-xs text-slate-500 mt-0.5 mb-3">Pilih keluhan Anda dan kami bantu rekomendasikan layanan yang paling sesuai.</p>
                      {!helperOpen ? (
                        <button
                          onClick={() => setHelperOpen(true)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full border bg-white min-h-[36px]"
                          style={{ color: primary, borderColor: `${primary}55` }}
                        >
                          <Wand2 className="w-3.5 h-3.5" /> Bantu Saya Memilih
                        </button>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {HELP_TAGS.map((tag) => (
                            <button
                              key={tag.label}
                              onClick={() => handleHelpTag(tag)}
                              className="text-xs font-semibold px-3 py-2 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-slate-300 min-h-[36px]"
                            >
                              {tag.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-6 mb-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: primary }} /> Fisioterapis berlisensi
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <CalendarCheck2 className="w-4 h-4 shrink-0" style={{ color: primary }} /> Jadwal terkonfirmasi
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Lock className="w-4 h-4 shrink-0" style={{ color: primary }} /> Data Anda terlindungi
                    </div>
                  </div>

                  <div className="hidden lg:block">
                    <Button
                      onClick={() => goTo('therapist')}
                      disabled={!selectedService}
                      className="w-full mt-3 text-white h-12 rounded-xl font-semibold shadow-md hover:opacity-90"
                      style={{ background: primary }}
                    >
                      Lanjutkan <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                  <StickyMobileCta>
                    <Button
                      onClick={() => goTo('therapist')}
                      disabled={!selectedService}
                      className="w-full text-white h-12 rounded-xl font-semibold shadow-md hover:opacity-90"
                      style={{ background: primary }}
                    >
                      Lanjutkan <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </StickyMobileCta>
                </motion.div>
              ) : step === 'therapist' ? (
                <motion.div key="therapist" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Pilih Terapis</h1>
                  <p className="text-slate-500 text-sm mb-6">Pilih terapis tertentu, atau biarkan kami mencarikan jadwal tercepat untuk Anda.</p>

                  {loadingTherapists ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-sm text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: primary }} />
                      Memuat terapis...
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3.5">
                      <button
                        onClick={() => handlePickTherapist(ANY_THERAPIST)}
                        className="text-left bg-white border-2 border-dashed rounded-2xl p-4 flex items-center gap-3 transition-all hover:shadow-md hover:-translate-y-0.5 min-h-[48px]"
                        style={{ borderColor: `${primary}55` }}
                      >
                        <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: `${primary}1a` }}>
                          <Users className="w-5 h-5" style={{ color: primary }} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">Siapa Saja yang Tersedia</p>
                          <p className="text-xs text-slate-500">Jadwal tercepat</p>
                        </div>
                      </button>

                      {therapists.length === 0 && (
                        <div className="sm:col-span-2 text-center py-10 text-slate-500 text-sm bg-white rounded-2xl border border-slate-100">
                          Belum ada terapis tersedia. Anda tetap dapat lanjut dengan jadwal tercepat di atas.
                        </div>
                      )}

                      {therapists.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handlePickTherapist(t)}
                          className="text-left bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-3 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 min-h-[48px]"
                        >
                          <Avatar className="w-12 h-12 shrink-0 ring-2 ring-offset-1" style={{ '--tw-ring-color': `${primary}33` }}>
                            <AvatarImage src={t.avatar_url} className="object-cover" />
                            <AvatarFallback className="text-white" style={{ background: primary }}><User className="w-5 h-5" /></AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{t.name}</p>
                            <p className="text-xs text-slate-500">{t.specialization || 'Fisioterapis'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ) : step === 'schedule' ? (
                <motion.div key="schedule" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Pilih Tanggal &amp; Waktu</h1>
                  <p className="text-slate-500 text-sm mb-6">
                    Temukan jadwal yang paling nyaman, dengan <strong>{selectedTherapist?.name}</strong>.
                  </p>

                  <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
                    {dateOptions.map((d) => {
                      const active = selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd');
                      return (
                        <button
                          key={d.toISOString()}
                          onClick={() => setSelectedDate(d)}
                          className={`shrink-0 flex flex-col items-center px-4 py-2.5 rounded-xl border transition-all min-w-[56px] min-h-[48px] ${
                            active ? 'text-white shadow-md' : 'bg-white border-slate-100 text-slate-600 hover:shadow-sm'
                          }`}
                          style={active ? { background: primary, borderColor: primary } : undefined}
                        >
                          <span className="text-[10px] uppercase font-medium opacity-80">{format(d, 'EEE', { locale: idLocale })}</span>
                          <span className="text-lg font-bold leading-tight">{format(d, 'd')}</span>
                          <span className="text-[10px] opacity-80">{format(d, 'MMM', { locale: idLocale })}</span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedDate && (
                    <>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Jam Tersedia</p>
                      {loadingSlots ? (
                        <div className="flex flex-col items-center gap-3 py-10 text-sm text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin" style={{ color: primary }} />
                          Mencari jadwal tersedia...
                        </div>
                      ) : slots.length === 0 ? (
                        <div className="text-center py-10 px-4 text-slate-500 text-sm bg-white rounded-2xl border border-slate-100">
                          Belum ada jadwal tersedia pada tanggal ini. Silakan pilih tanggal lain.
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                          {slots.map((s) => (
                            <button
                              key={`${s.therapist_id}-${s.slot_start}`}
                              onClick={() => handlePickSlot(s)}
                              className="bg-white border border-slate-100 rounded-xl py-3 text-sm font-semibold text-slate-700 transition-all hover:shadow-md hover:-translate-y-0.5 min-h-[48px]"
                            >
                              {(s.slot_start || '').slice(0, 5)}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              ) : step === 'details' ? (
                <motion.div key="details" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Lengkapi Data Diri</h1>
                  <p className="text-slate-500 text-sm mb-6">Data ini digunakan untuk memproses booking Anda.</p>

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 space-y-4">
                    <div>
                      <Label htmlFor="name">Nama Lengkap *</Label>
                      <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Masukkan nama lengkap" className="mt-1.5 h-12" />
                    </div>
                    <div>
                      <Label htmlFor="phone">Nomor WhatsApp *</Label>
                      <Input id="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="08xxxxxxxxxx" className="mt-1.5 h-12" />
                    </div>
                    <div>
                      <Label htmlFor="complaint">Keluhan Utama</Label>
                      <Textarea id="complaint" value={form.complaint} onChange={(e) => setForm((f) => ({ ...f, complaint: e.target.value }))} placeholder="Contoh: Nyeri punggung, cedera lutut, dll." className="mt-1.5" rows={3} />
                    </div>
                    <div>
                      <Label htmlFor="notes">Catatan Tambahan (Opsional)</Label>
                      <Textarea id="notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Tambahkan informasi lain yang perlu kami ketahui" className="mt-1.5" rows={2} />
                    </div>
                  </div>

                  <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-4">
                    <Lock className="w-3.5 h-3.5 shrink-0" /> Data Anda aman dan hanya digunakan untuk kebutuhan pelayanan &amp; booking.
                  </p>

                  <div className="hidden lg:block">
                    <Button
                      onClick={() => goTo('confirm')}
                      disabled={!canSubmitDetails}
                      className="w-full mt-5 text-white h-12 rounded-xl font-semibold shadow-md hover:opacity-90"
                      style={{ background: primary }}
                    >
                      Lanjutkan <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                  <StickyMobileCta>
                    <Button
                      onClick={() => goTo('confirm')}
                      disabled={!canSubmitDetails}
                      className="w-full text-white h-12 rounded-xl font-semibold shadow-md hover:opacity-90"
                      style={{ background: primary }}
                    >
                      Lanjutkan <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </StickyMobileCta>
                </motion.div>
              ) : (
                <motion.div key="confirm" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Konfirmasi Booking</h1>
                  <p className="text-slate-500 text-sm mb-5">Pastikan informasi berikut sudah sesuai.</p>

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">
                    {selectedService && (
                      <div className="p-4 flex items-center gap-3">
                        <Sparkles className="w-5 h-5 shrink-0" style={{ color: primary }} />
                        <div>
                          <p className="text-xs text-slate-400">Layanan</p>
                          <p className="font-semibold text-slate-800 text-sm">{selectedService.title}</p>
                        </div>
                      </div>
                    )}
                    <div className="p-4 flex items-center gap-3">
                      <Stethoscope className="w-5 h-5 shrink-0" style={{ color: primary }} />
                      <div>
                        <p className="text-xs text-slate-400">Terapis</p>
                        <p className="font-semibold text-slate-800 text-sm">{activeTherapist?.name}</p>
                      </div>
                    </div>
                    <div className="p-4 flex items-center gap-3">
                      <CalendarDays className="w-5 h-5 shrink-0" style={{ color: primary }} />
                      <div>
                        <p className="text-xs text-slate-400">Jadwal</p>
                        <p className="font-semibold text-slate-800 text-sm">
                          {format(selectedDate, "EEEE, d MMMM yyyy", { locale: idLocale })} — {(selectedSlot?.slot_start || '').slice(0, 5)}
                        </p>
                      </div>
                    </div>
                    <div className="p-4 flex items-center gap-3">
                      <User className="w-5 h-5 shrink-0" style={{ color: primary }} />
                      <div>
                        <p className="text-xs text-slate-400">Pasien</p>
                        <p className="font-semibold text-slate-800 text-sm">{form.name} · {form.phone}</p>
                      </div>
                    </div>
                    {clinic.address && (
                      <div className="p-4 flex items-center gap-3">
                        <MapPin className="w-5 h-5 shrink-0" style={{ color: primary }} />
                        <div>
                          <p className="text-xs text-slate-400">Lokasi</p>
                          <p className="font-semibold text-slate-800 text-sm">{clinic.address}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-4">
                    <Lock className="w-3.5 h-3.5 shrink-0" /> Dengan melanjutkan, Anda menyetujui kebijakan privasi dan ketentuan layanan.
                  </p>

                  <div className="hidden lg:flex flex-col gap-2.5 mt-5">
                    <Button
                      onClick={handleSubmitBooking}
                      disabled={submitting}
                      className="w-full text-white h-12 rounded-xl font-bold shadow-md hover:opacity-90"
                      style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${accent})` }}
                    >
                      {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      Konfirmasi Booking
                    </Button>
                    <button onClick={goBack} className="w-full text-sm font-semibold text-slate-500 hover:text-slate-700 py-2 flex items-center justify-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" /> Kembali &amp; Edit
                    </button>
                  </div>
                  <StickyMobileCta>
                    <Button
                      onClick={handleSubmitBooking}
                      disabled={submitting}
                      className="w-full text-white h-12 rounded-xl font-bold shadow-md hover:opacity-90"
                      style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${accent})` }}
                    >
                      {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      Konfirmasi Booking
                    </Button>
                  </StickyMobileCta>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!success && (
            <aside className="hidden lg:block sticky top-24">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{clinic.name}</p>
                <p className="text-sm font-bold text-slate-900 mb-4">Ringkasan Booking</p>
                {summaryRows.length <= 1 ? (
                  <p className="text-sm text-slate-400">Pilihan Anda akan muncul di sini.</p>
                ) : (
                  <div className="space-y-3">
                    {summaryRows.map((row) => (
                      <div key={row.label} className="flex items-start justify-between gap-3 text-sm">
                        <span className="text-slate-400 shrink-0">{row.label}</span>
                        <span className="font-semibold text-slate-800 text-right">{row.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </main>

      <footer className="text-center py-8 px-4">
        <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
          Powered by <Cloud className="w-3.5 h-3.5 text-slate-400" /> <span className="font-semibold text-slate-500">Clinara</span>
        </p>
        <p className="text-[11px] text-slate-300 mt-0.5">Modern. Flexible. Made for Healthcare.</p>
      </footer>
    </div>
  );
};

// Keeps the primary call-to-action reachable with one thumb on small
// screens without pushing the desktop two-column layout around.
const StickyMobileCta = ({ children }) => (
  <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur border-t border-slate-100 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
    <div className="max-w-6xl mx-auto">{children}</div>
  </div>
);

export default ClinicBookingPage;
