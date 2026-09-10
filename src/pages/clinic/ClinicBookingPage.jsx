import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays, startOfDay, differenceInCalendarDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  ArrowLeft, ArrowRight, CalendarDays, CalendarPlus, CalendarCheck2, CheckCircle2, Loader2, Lock, MapPin,
  Sparkles, Stethoscope, User, Users, MessageCircle, Activity, HeartPulse, Home,
  ClipboardList, ShieldCheck, Lightbulb, Wand2, Cloud, Search, Clock, ArrowUpDown,
  ChevronLeft, ChevronRight, Repeat, CalendarClock, Info, Check, Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { useClinicTenant } from '@/hooks/useClinicTenant';
import { getActivePhysiotherapists, getAvailableSlots, createAppointment, getTherapistPracticeHoursGrouped } from '@/lib/api';
import { getLandingTemplate, mergeLandingContent } from '@/config/landingTemplates';

// Icon rotation used only as a fallback presentation for tenant services that
// don't have their own image/icon set on the landing page builder - purely
// cosmetic, never used to identify a service.
const SERVICE_ICONS = [Stethoscope, Activity, HeartPulse, Home, ClipboardList];

const ANY_THERAPIST = { id: null, name: 'Siapa Saja yang Tersedia', specialization: 'Jadwal tercepat' };

// Below this count the therapist list stays a flat scroll (matches most
// clinics); at or above it a search box and "show more" paging kick in so
// the step stays usable for tenants with large therapist rosters.
const THERAPIST_SEARCH_THRESHOLD = 6;
const THERAPIST_PAGE_SIZE = 6;

// Schedule step: how many days ahead the date picker lets a patient browse,
// how many open slots on a date still counts as "Terbatas" rather than
// "Tersedia", and how often the currently viewed date is re-checked against
// the backend so a slot someone else just took doesn't stay shown as open.
const SCHEDULE_LOOKAHEAD_DAYS = 180;
const LIMITED_SLOTS_THRESHOLD = 3;
const SLOT_REFRESH_INTERVAL_MS = 25000;

// Fallback for the confirmation step's "Penting untuk Diketahui" card when a
// tenant hasn't set its own list - read from content.bookingPolicies (a
// plain string array a tenant can already set in landing_content, the same
// free-form jsonb every other tenant override lives in) so this stays
// tenant-configurable rather than one clinic's hard-coded rules.
const DEFAULT_BOOKING_POLICIES = [
  'Mohon hadir 10 menit sebelum jadwal.',
  'Jika ada perubahan jadwal, kami akan menghubungi Anda melalui WhatsApp.',
  'Untuk pembatalan atau reschedule, silakan hubungi kami sesegera mungkin.',
];

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
  const [todaySlots, setTodaySlots] = useState([]);
  const [therapistQuery, setTherapistQuery] = useState('');
  const [sortAvailableFirst, setSortAvailableFirst] = useState(false);
  const [therapistVisibleCount, setTherapistVisibleCount] = useState(THERAPIST_PAGE_SIZE);
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [form, setForm] = useState({ name: '', phone: '', dob: '', gender: '', complaint: '', notes: '' });
  const [detailErrors, setDetailErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [bookingRef, setBookingRef] = useState(null);
  const [helperOpen, setHelperOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [showPrivacyNote, setShowPrivacyNote] = useState(false);
  const [slotConflict, setSlotConflict] = useState(false);

  const [weekStart, setWeekStart] = useState(() => startOfDay(new Date()));
  const [dateAvailability, setDateAvailability] = useState({});

  const visibleDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const canGoPrevWeek = differenceInCalendarDays(weekStart, new Date()) > 0;
  const canGoNextWeek = differenceInCalendarDays(weekStart, new Date()) + 7 < SCHEDULE_LOOKAHEAD_DAYS;

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

  // Used to show a real "Tersedia hari ini" indicator per therapist on the
  // therapist-selection step, without an extra round-trip per card - one
  // fetch of today's open slots for the whole clinic, then filtered client-side.
  useEffect(() => {
    if (!clinic?.id) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    getAvailableSlots(todayStr, null, clinic.id)
      .then(({ data }) => setTodaySlots((data || []).filter((s) => s.status === 'aktif')))
      .catch(() => setTodaySlots([]));
  }, [clinic?.id]);

  const hasSlotToday = (therapistId) => todaySlots.some((s) => s.therapist_id === therapistId);

  const filteredTherapists = useMemo(() => {
    const q = therapistQuery.trim().toLowerCase();
    let list = !q
      ? therapists
      : therapists.filter((t) => `${t.name} ${t.specialization || ''}`.toLowerCase().includes(q));
    if (sortAvailableFirst) {
      list = [...list].sort((a, b) => Number(hasSlotToday(b.id)) - Number(hasSlotToday(a.id)));
    }
    return list;
  }, [therapists, therapistQuery, sortAvailableFirst, todaySlots]);

  const visibleTherapists = filteredTherapists.slice(0, therapistVisibleCount);
  const hasMoreTherapists = filteredTherapists.length > visibleTherapists.length;

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

  // Per-date "Tersedia / Terbatas / Tidak tersedia" dots on the schedule
  // step's date picker - one real open-slot count per visible date (for the
  // currently selected therapist, or all of them for "Siapa Saja"), never a
  // guess. Refetched whenever the visible week or therapist changes.
  const visibleDateKeys = visibleDates.map((d) => format(d, 'yyyy-MM-dd')).join(',');
  useEffect(() => {
    if (!clinic?.id || step !== 'schedule') return;
    let active = true;
    const today0 = startOfDay(new Date());
    visibleDates.forEach((d) => {
      if (d < today0) return;
      const dStr = format(d, 'yyyy-MM-dd');
      setDateAvailability((prev) => (prev[dStr] ? prev : { ...prev, [dStr]: { status: 'loading' } }));
      getAvailableSlots(dStr, selectedTherapist?.id || null, clinic.id).then(({ data }) => {
        if (!active) return;
        const open = (data || []).filter((s) => s.status === 'aktif');
        const status = open.length === 0 ? 'none' : open.length <= LIMITED_SLOTS_THRESHOLD ? 'limited' : 'available';
        setDateAvailability((prev) => ({ ...prev, [dStr]: { status, count: open.length } }));
      });
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleDateKeys, selectedTherapist?.id, clinic?.id, step]);

  // Keeps the open-slot list for the date currently in view fresh while the
  // patient sits on this step, so a slot someone else just booked doesn't
  // stay selectable - and if the patient's own selection just got taken,
  // clears it with a clear explanation instead of letting a stale pick
  // through to booking.
  useEffect(() => {
    if (step !== 'schedule' || !selectedDate || !clinic?.id) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const interval = setInterval(() => {
      getAvailableSlots(dateStr, selectedTherapist?.id || null, clinic.id).then(({ data }) => {
        const open = (data || []).filter((s) => s.status === 'aktif');
        setSlots(open);
        setSelectedSlot((prevSlot) => {
          if (!prevSlot) return prevSlot;
          const stillOpen = open.some((s) => s.therapist_id === prevSlot.therapist_id && s.slot_start === prevSlot.slot_start);
          if (!stillOpen) {
            toast({
              title: 'Jadwal baru saja berubah',
              description: 'Slot yang Anda pilih sudah terisi. Silakan pilih waktu lain yang masih tersedia.',
              variant: 'destructive',
            });
            return null;
          }
          return prevSlot;
        });
      });
    }, SLOT_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [step, selectedDate, selectedTherapist, clinic?.id, toast]);

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

  const handleSelectTherapist = (t) => {
    setSelectedTherapist(t);
  };

  const handleFindBestSchedule = () => {
    setSelectedTherapist(ANY_THERAPIST);
    goTo('schedule');
  };

  const handleSelectSlot = (slot) => {
    setSelectedSlot(slot);
  };

  const validateDetails = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Nama lengkap wajib diisi.';
    const phoneDigits = form.phone.replace(/[^0-9]/g, '');
    if (phoneDigits.length < 9 || phoneDigits.length > 14) errors.phone = 'Masukkan nomor WhatsApp yang valid.';
    if (!form.complaint.trim()) errors.complaint = 'Masukkan keluhan utama Anda.';
    return errors;
  };
  const handleContinueDetails = () => {
    const errors = validateDetails();
    setDetailErrors(errors);
    if (Object.keys(errors).length === 0) goTo('confirm');
  };

  const updateFormField = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setDetailErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  const handleSubmitBooking = async () => {
    if (!selectedSlot || !clinic?.id) return;
    setSubmitting(true);
    setSlotConflict(false);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // Re-check the chosen slot is still open right before creating the
      // appointment - it may have been taken by someone else since the
      // patient picked it on Step 3. Surfaces a clear message instead of
      // letting a stale pick through to create_appointment_safe.
      const { data: freshSlots } = await getAvailableSlots(dateStr, selectedSlot.therapist_id, clinic.id);
      const stillOpen = (freshSlots || []).some(
        (s) => s.status === 'aktif' && s.slot_start === selectedSlot.slot_start && s.therapist_id === selectedSlot.therapist_id
      );
      if (!stillOpen) {
        setSlotConflict(true);
        setSubmitting(false);
        return;
      }

      const timePart = (selectedSlot.slot_start || '').slice(0, 5);
      const appointmentDate = `${dateStr}T${timePart}:00`;

      const noteParts = [];
      if (selectedService?.title) noteParts.push(`Layanan: ${selectedService.title}`);
      if (form.dob) noteParts.push(`Tanggal Lahir: ${format(new Date(form.dob), 'd MMMM yyyy', { locale: idLocale })}`);
      if (form.gender) noteParts.push(`Jenis Kelamin: ${form.gender === 'L' ? 'Laki-laki' : 'Perempuan'}`);
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

  const handlePickAnotherSchedule = () => {
    setSlotConflict(false);
    setSelectedSlot(null);
    goTo('schedule');
  };

  const handleCopyBookingRef = async () => {
    if (!bookingRef) return;
    try {
      await navigator.clipboard.writeText(bookingRef);
      toast({ title: 'Disalin', description: 'Nomor booking disalin ke clipboard.' });
    } catch {
      // Clipboard access can be blocked (permissions, non-secure context) -
      // the number is already visible on screen, so failing silently is fine.
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

  const slotTimeRange = (() => {
    if (!selectedDate || !selectedSlot) return '';
    const [h, m] = (selectedSlot.slot_start || '00:00').slice(0, 5).split(':').map(Number);
    const start = new Date(selectedDate);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + (selectedSlot.duration_minutes || 60) * 60000);
    return `${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`;
  })();

  const waHref = clinic.phone
    ? `https://wa.me/${clinic.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}`
    : null;

  const mapsHref = clinic.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${clinic.name} ${clinic.address}`)}`
    : null;

  const slotDurationLabel = (() => {
    const mins = selectedSlot?.duration_minutes || 60;
    return mins % 60 === 0 ? `${mins / 60} jam` : `${mins} menit`;
  })();

  const bookingPolicies = content?.bookingPolicies?.length ? content.bookingPolicies : DEFAULT_BOOKING_POLICIES;

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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
        <div className="flex items-start">
          {STEPS.map((s, i) => {
            const progressIndex = success ? STEPS.length : stepIndex;
            return (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center gap-1 shrink-0 w-10 sm:w-14">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors shrink-0 ${
                      i <= progressIndex ? 'text-white' : 'bg-slate-200 text-slate-400'
                    }`}
                    style={i <= progressIndex ? { background: primary } : undefined}
                  >
                    {i < progressIndex ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span
                    className="text-[9px] sm:text-[11px] font-semibold text-center leading-tight"
                    style={{ color: i <= progressIndex ? primary : '#94a3b8' }}
                  >
                    {STEP_LABELS[s]}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 rounded-full bg-slate-200 overflow-hidden mt-3.5 mx-0.5 sm:mx-1">
                    <div className="h-full rounded-full transition-all" style={{ width: i < progressIndex ? '100%' : '0%', background: accent }} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-8 lg:items-start">
          <div className="pb-28 lg:pb-0">
            <AnimatePresence mode="wait">
              {success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 sm:p-10 text-center relative overflow-hidden mb-4">
                    <span className="absolute left-8 top-10 w-2 h-2 rounded-full bg-amber-300" />
                    <span className="absolute right-12 top-8 w-2.5 h-2.5 rounded-full bg-sky-300" />
                    <span className="absolute left-14 bottom-10 w-2 h-2 rounded-full rotate-45 bg-emerald-300" />
                    <span className="absolute right-10 bottom-14 w-2 h-2 rounded-full bg-violet-300" />
                    <motion.div
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                      className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg bg-emerald-500"
                    >
                      <CheckCircle2 className="w-10 h-10 text-white" />
                    </motion.div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Booking Berhasil!</h1>
                    <p className="text-slate-500">Jadwal terapi Anda telah berhasil dibuat.</p>
                    <p className="text-slate-500">Kami menantikan kedatangan Anda di <strong>{clinic.name}</strong>.</p>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${primary}14` }}>
                      <CalendarCheck2 className="w-5 h-5" style={{ color: primary }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400">Nomor Booking</p>
                      <p className="font-bold text-slate-900 text-lg tracking-wide truncate">{bookingRef}</p>
                    </div>
                    <button
                      onClick={handleCopyBookingRef}
                      aria-label="Salin nomor booking"
                      className="w-10 h-10 rounded-full flex items-center justify-center border border-slate-200 text-slate-500 hover:bg-slate-50 shrink-0"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-4">
                    <div className="p-4 flex items-center justify-between border-b border-slate-100">
                      <p className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900">
                        <CalendarDays className="w-4 h-4" style={{ color: primary }} /> Detail Booking
                      </p>
                      <button
                        onClick={handleAddToCalendar}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border"
                        style={{ color: primary, borderColor: `${primary}55` }}
                      >
                        <CalendarPlus className="w-3.5 h-3.5" /> Lihat di Kalender
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {selectedService && (
                        <div className="p-4 flex items-start gap-3">
                          <Sparkles className="w-4 h-4 shrink-0 mt-0.5" style={{ color: primary }} />
                          <div>
                            <p className="text-xs text-slate-400">Layanan</p>
                            <p className="font-semibold text-slate-800 text-sm">{selectedService.title}</p>
                          </div>
                        </div>
                      )}
                      <div className="p-4 flex items-center gap-3">
                        <Avatar className="w-9 h-9 shrink-0">
                          <AvatarImage src={activeTherapist?.avatar_url} className="object-cover" />
                          <AvatarFallback className="text-white" style={{ background: primary }}>
                            {activeTherapist?.id === null ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs text-slate-400">Terapis</p>
                          <p className="font-semibold text-slate-800 text-sm">{activeTherapist?.name}</p>
                        </div>
                      </div>
                      <div className="p-4 flex items-start gap-3">
                        <CalendarDays className="w-4 h-4 shrink-0 mt-0.5" style={{ color: primary }} />
                        <div>
                          <p className="text-xs text-slate-400">Tanggal</p>
                          <p className="font-semibold text-slate-800 text-sm">{format(selectedDate, 'EEEE, d MMMM yyyy', { locale: idLocale })}</p>
                        </div>
                      </div>
                      <div className="p-4 flex items-start gap-3">
                        <Clock className="w-4 h-4 shrink-0 mt-0.5" style={{ color: primary }} />
                        <div>
                          <p className="text-xs text-slate-400">Waktu</p>
                          <p className="font-semibold text-slate-800 text-sm">{slotTimeRange} ({slotDurationLabel})</p>
                        </div>
                      </div>
                      {clinic.address && (
                        <div className="p-4 flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: primary }} />
                            <div className="min-w-0">
                              <p className="text-xs text-slate-400">Lokasi</p>
                              <p className="font-semibold text-slate-800 text-sm">{clinic.name}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{clinic.address}</p>
                            </div>
                          </div>
                          {mapsHref && (
                            <a
                              href={mapsHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border shrink-0"
                              style={{ color: primary, borderColor: `${primary}55` }}
                            >
                              <MapPin className="w-3.5 h-3.5" /> Lihat Lokasi
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="lg:hidden grid grid-cols-2 gap-3 mb-4">
                    {waHref && (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center text-center gap-1 text-white font-semibold px-3 py-4 rounded-xl transition-opacity hover:opacity-90 shadow-md min-h-[48px] bg-emerald-500"
                      >
                        <MessageCircle className="w-5 h-5" />
                        <span className="text-sm">Chat WhatsApp</span>
                        <span className="text-[10px] font-normal opacity-90">Konfirmasi &amp; tanya lanjut</span>
                      </a>
                    )}
                    <button
                      onClick={handleAddToCalendar}
                      className="flex flex-col items-center justify-center text-center gap-1 font-semibold px-3 py-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors min-h-[48px]"
                    >
                      <CalendarPlus className="w-5 h-5" style={{ color: primary }} />
                      <span className="text-sm">Tambahkan ke Kalender</span>
                      <span className="text-[10px] font-normal text-slate-400">Google / Apple / Outlook</span>
                    </button>
                  </div>
                  <Link
                    to="/"
                    className="lg:hidden w-full inline-flex items-center justify-center gap-2 font-semibold px-6 py-3.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors mb-4 min-h-[48px]"
                  >
                    <Home className="w-4 h-4" /> Kembali ke Beranda
                  </Link>

                  {bookingPolicies.length > 0 && (
                    <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 mb-4">
                      <p className="inline-flex items-center gap-1.5 font-semibold text-slate-800 text-sm mb-2.5">
                        <Info className="w-4 h-4" style={{ color: primary }} /> Informasi Penting
                      </p>
                      <ul className="space-y-1.5">
                        {bookingPolicies.map((policy) => (
                          <li key={policy} className="flex items-start gap-2 text-xs text-slate-600">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: primary }} /> {policy}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mb-2">
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
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: accent }}>
                    Langkah {stepIndex + 1} dari {STEPS.length}
                  </p>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Pilih Terapis</h1>
                  <p className="text-slate-500 text-sm mb-6">Anda dapat memilih fisioterapis tertentu atau membiarkan kami mencarikan jadwal tercepat.</p>

                  {loadingTherapists ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-sm text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: primary }} />
                      Memuat terapis...
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleSelectTherapist(ANY_THERAPIST)}
                        className={`w-full text-left bg-sky-50 rounded-2xl p-4 flex items-center gap-3.5 transition-all hover:shadow-md min-h-[48px] mb-5 ${
                          selectedTherapist?.id === null ? 'ring-2' : 'border border-sky-100'
                        }`}
                        style={selectedTherapist?.id === null ? { '--tw-ring-color': primary } : undefined}
                      >
                        <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shrink-0">
                          <Users className="w-5 h-5" style={{ color: primary }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-800 text-sm">Siapa Saja yang Tersedia</p>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white" style={{ color: primary }}>Direkomendasikan</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">Biarkan kami mencarikan jadwal tercepat dengan terapis yang sesuai.</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>

                      <div className="flex items-center justify-between mb-3 gap-2">
                        <p className="text-sm font-semibold text-slate-700">Atau pilih fisioterapis</p>
                        {therapists.length > 1 && (
                          <button
                            onClick={() => setSortAvailableFirst((v) => !v)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 shrink-0"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5" /> {sortAvailableFirst ? 'Diurutkan: Tersedia dulu' : 'Urutkan: Tersedia dulu'}
                          </button>
                        )}
                      </div>

                      {therapists.length >= THERAPIST_SEARCH_THRESHOLD && (
                        <div className="relative mb-3">
                          <Search className="w-4 h-4 text-slate-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <Input
                            value={therapistQuery}
                            onChange={(e) => { setTherapistQuery(e.target.value); setTherapistVisibleCount(THERAPIST_PAGE_SIZE); }}
                            placeholder="Cari nama atau spesialisasi..."
                            className="pl-10 h-11"
                          />
                        </div>
                      )}

                      {therapists.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 text-sm bg-white rounded-2xl border border-slate-100">
                          Belum ada terapis tersedia. Anda tetap dapat lanjut dengan jadwal tercepat di atas.
                        </div>
                      ) : filteredTherapists.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 text-sm bg-white rounded-2xl border border-slate-100">
                          Tidak ada terapis yang cocok dengan pencarian Anda.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {visibleTherapists.map((t) => {
                            const isSelected = selectedTherapist?.id === t.id;
                            const available = hasSlotToday(t.id);
                            const badge = Array.isArray(t.badges) ? t.badges[0] : null;
                            return (
                              <button
                                key={t.id}
                                onClick={() => handleSelectTherapist(t)}
                                className={`w-full text-left bg-white rounded-2xl p-4 flex items-center gap-3.5 transition-all shadow-sm hover:shadow-md min-h-[48px] ${
                                  isSelected ? 'ring-2' : 'border border-slate-100'
                                }`}
                                style={isSelected ? { '--tw-ring-color': primary } : undefined}
                              >
                                <Avatar className="w-14 h-14 shrink-0 ring-2 ring-offset-1" style={{ '--tw-ring-color': `${primary}33` }}>
                                  <AvatarImage src={t.avatar_url} className="object-cover" />
                                  <AvatarFallback className="text-white" style={{ background: primary }}><User className="w-5 h-5" /></AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <p className="font-semibold text-slate-800 text-sm truncate">{t.name}</p>
                                      {badge && (
                                        <span
                                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                                          style={{ background: `${badge.color || primary}1a`, color: badge.color || primary }}
                                        >
                                          {badge.label}
                                        </span>
                                      )}
                                    </div>
                                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium shrink-0 ${available ? 'text-emerald-600' : 'text-slate-400'}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${available ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                      {available ? 'Tersedia hari ini' : 'Belum tersedia hari ini'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5">{t.specialization || 'Fisioterapis'}</p>
                                  <div className="flex items-start gap-1.5 mt-2 text-[11px] text-slate-400">
                                    <Clock className="w-3 h-3 mt-0.5 shrink-0" />
                                    <div className="leading-relaxed">
                                      <TherapistScheduleLines therapistId={t.id} />
                                    </div>
                                  </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-300 shrink-0 self-center" />
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {hasMoreTherapists && (
                        <button
                          onClick={() => setTherapistVisibleCount((c) => c + THERAPIST_PAGE_SIZE)}
                          className="w-full mt-3 text-sm font-semibold py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 min-h-[48px]"
                        >
                          Tampilkan Semua ({filteredTherapists.length})
                        </button>
                      )}

                      <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 mt-5 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0">
                          <Lightbulb className="w-4 h-4" style={{ color: primary }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm">Tidak menemukan waktu yang sesuai?</p>
                          <p className="text-xs text-slate-500 mt-0.5 mb-3">Coba gunakan fitur jadwal otomatis, atau pilih tanggal lain pada langkah berikutnya.</p>
                          <button
                            onClick={handleFindBestSchedule}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full border bg-white min-h-[36px]"
                            style={{ color: primary, borderColor: `${primary}55` }}
                          >
                            <Wand2 className="w-3.5 h-3.5" /> Carikan Jadwal Terbaik
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-6 mb-2">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: primary }} /> Fisioterapis berlisensi
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <CalendarCheck2 className="w-4 h-4 shrink-0" style={{ color: primary }} /> Jadwal real-time
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Lock className="w-4 h-4 shrink-0" style={{ color: primary }} /> Data Anda terlindungi
                        </div>
                      </div>

                      <div className="hidden lg:flex gap-3 mt-3">
                        <button
                          onClick={goBack}
                          className="px-6 h-12 rounded-xl font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                          <ArrowLeft className="w-4 h-4 inline mr-2" /> Kembali
                        </button>
                        <Button
                          onClick={() => goTo('schedule')}
                          disabled={!selectedTherapist}
                          className="flex-1 text-white h-12 rounded-xl font-semibold shadow-md hover:opacity-90"
                          style={{ background: primary }}
                        >
                          Lanjutkan <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                      <StickyMobileCta>
                        <div className="flex gap-3">
                          <button
                            onClick={goBack}
                            className="px-5 h-12 rounded-xl font-semibold border border-slate-200 text-slate-600 shrink-0"
                          >
                            <ArrowLeft className="w-4 h-4" />
                          </button>
                          <Button
                            onClick={() => goTo('schedule')}
                            disabled={!selectedTherapist}
                            className="flex-1 text-white h-12 rounded-xl font-semibold shadow-md hover:opacity-90"
                            style={{ background: primary }}
                          >
                            Lanjutkan <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      </StickyMobileCta>
                    </>
                  )}
                </motion.div>
              ) : step === 'schedule' ? (
                <motion.div key="schedule" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: accent }}>
                        Langkah {stepIndex + 1} dari {STEPS.length}
                      </p>
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Pilih Tanggal &amp; Waktu</h1>
                      <p className="text-slate-500 text-sm">Pilih jadwal yang paling nyaman untuk Anda.</p>
                    </div>
                    <div className="hidden sm:flex w-12 h-12 rounded-2xl items-center justify-center shrink-0" style={{ background: `${primary}14` }}>
                      <CalendarClock className="w-6 h-6" style={{ color: primary }} />
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-3.5 flex items-center gap-3 mt-5 mb-5">
                    <Avatar className="w-11 h-11 shrink-0">
                      <AvatarImage src={selectedTherapist?.avatar_url} className="object-cover" />
                      <AvatarFallback className="text-white" style={{ background: primary }}>
                        {selectedTherapist?.id === null ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-400">Terapis yang dipilih</p>
                      <p className="font-semibold text-slate-800 text-sm truncate">{selectedTherapist?.name}</p>
                      {selectedTherapist?.specialization && (
                        <p className="text-xs text-slate-500 truncate">{selectedTherapist.specialization}</p>
                      )}
                    </div>
                    <button
                      onClick={goBack}
                      className="inline-flex items-center gap-1 text-xs font-semibold shrink-0"
                      style={{ color: primary }}
                    >
                      <Repeat className="w-3.5 h-3.5" /> Ganti Terapis
                    </button>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-slate-900">Pilih Tanggal</p>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <button
                        onClick={() => canGoPrevWeek && setWeekStart((d) => addDays(d, -7))}
                        disabled={!canGoPrevWeek}
                        aria-label="Minggu sebelumnya"
                        className="w-7 h-7 rounded-full flex items-center justify-center border border-slate-200 disabled:opacity-30"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="min-w-[110px] text-center">{format(visibleDates[0], 'MMMM yyyy', { locale: idLocale })}</span>
                      <button
                        onClick={() => canGoNextWeek && setWeekStart((d) => addDays(d, 7))}
                        disabled={!canGoNextWeek}
                        aria-label="Minggu berikutnya"
                        className="w-7 h-7 rounded-full flex items-center justify-center border border-slate-200 disabled:opacity-30"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-2 mb-2 -mx-1 px-1">
                    {visibleDates.map((d) => {
                      const dStr = format(d, 'yyyy-MM-dd');
                      const isPast = d < startOfDay(new Date());
                      const active = selectedDate && format(selectedDate, 'yyyy-MM-dd') === dStr;
                      const avail = dateAvailability[dStr];
                      const disabled = isPast || avail?.status === 'none';
                      return (
                        <button
                          key={dStr}
                          onClick={() => !disabled && setSelectedDate(d)}
                          disabled={disabled}
                          className={`shrink-0 flex flex-col items-center px-4 py-2.5 rounded-xl border transition-all min-w-[56px] min-h-[48px] ${
                            active ? 'text-white shadow-md' : disabled ? 'bg-slate-50 border-slate-100 text-slate-300' : 'bg-white border-slate-100 text-slate-600 hover:shadow-sm'
                          }`}
                          style={active ? { background: primary, borderColor: primary } : undefined}
                        >
                          <span className="text-[10px] uppercase font-medium opacity-80">{format(d, 'EEE', { locale: idLocale })}</span>
                          <span className="text-lg font-bold leading-tight">{format(d, 'd')}</span>
                          {!isPast && (
                            <span
                              className={`w-1.5 h-1.5 rounded-full mt-1 ${avail?.status === 'loading' || !avail ? 'animate-pulse bg-slate-200' : ''}`}
                              style={
                                avail?.status === 'available' ? { background: active ? '#fff' : primary }
                                  : avail?.status === 'limited' ? { background: active ? '#fff' : '#f59e0b' }
                                  : avail?.status === 'none' ? { background: '#cbd5e1' }
                                  : undefined
                              }
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-4 mb-6 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: primary }} /> Tersedia</span>
                    <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Terbatas</span>
                    <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Tidak tersedia</span>
                  </div>

                  {selectedDate && (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-bold text-slate-900">Pilih Waktu</p>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock className="w-3 h-3" /> Waktu dalam WITA (UTC+8)
                        </span>
                      </div>
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
                          {slots.map((s) => {
                            const isSelected = selectedSlot?.therapist_id === s.therapist_id && selectedSlot?.slot_start === s.slot_start;
                            return (
                              <button
                                key={`${s.therapist_id}-${s.slot_start}`}
                                onClick={() => handleSelectSlot(s)}
                                className={`rounded-xl py-3 text-sm font-semibold transition-all hover:shadow-md hover:-translate-y-0.5 min-h-[48px] ${
                                  isSelected ? 'text-white shadow-md' : 'bg-white border border-slate-100 text-slate-700'
                                }`}
                                style={isSelected ? { background: primary } : undefined}
                              >
                                {(s.slot_start || '').slice(0, 5)}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 mt-5 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0">
                          <CalendarClock className="w-4 h-4" style={{ color: primary }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm">Tidak ada waktu yang sesuai?</p>
                          <p className="text-xs text-slate-500 mt-0.5 mb-3">Coba lihat tanggal lain, atau gunakan fitur jadwal otomatis dari Clinara.</p>
                          <button
                            onClick={handleFindBestSchedule}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full border bg-white min-h-[36px]"
                            style={{ color: primary, borderColor: `${primary}55` }}
                          >
                            <Wand2 className="w-3.5 h-3.5" /> Carikan Jadwal Terbaik
                          </button>
                        </div>
                      </div>

                      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mt-3 flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-emerald-800 text-sm">Jadwal real-time</p>
                          <p className="text-xs text-emerald-700/80 mt-0.5">Slot waktu ditampilkan sesuai ketersediaan terbaru dari jadwal terapis.</p>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-6 mb-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: primary }} /> Fisioterapis berlisensi
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <CalendarCheck2 className="w-4 h-4 shrink-0" style={{ color: primary }} /> Jadwal real-time
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Lock className="w-4 h-4 shrink-0" style={{ color: primary }} /> Data Anda terlindungi
                    </div>
                  </div>

                  <div className="hidden lg:flex gap-3 mt-3">
                    <button
                      onClick={goBack}
                      className="px-6 h-12 rounded-xl font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      <ArrowLeft className="w-4 h-4 inline mr-2" /> Kembali
                    </button>
                    <Button
                      onClick={() => goTo('details')}
                      disabled={!selectedSlot}
                      className="flex-1 text-white h-12 rounded-xl font-semibold shadow-md hover:opacity-90"
                      style={{ background: primary }}
                    >
                      Lanjutkan <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                  <StickyMobileCta>
                    <div className="flex gap-3">
                      <button
                        onClick={goBack}
                        className="px-5 h-12 rounded-xl font-semibold border border-slate-200 text-slate-600 shrink-0"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <Button
                        onClick={() => goTo('details')}
                        disabled={!selectedSlot}
                        className="flex-1 text-white h-12 rounded-xl font-semibold shadow-md hover:opacity-90"
                        style={{ background: primary }}
                      >
                        Lanjutkan <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </StickyMobileCta>
                </motion.div>
              ) : step === 'details' ? (
                <motion.div key="details" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: accent }}>
                    Langkah {stepIndex + 1} dari {STEPS.length}
                  </p>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Lengkapi Data Diri</h1>
                  <p className="text-slate-500 text-sm mb-5">Data ini digunakan untuk memproses booking Anda dan memberikan pelayanan yang lebih baik.</p>

                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <p className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900">
                        <CalendarCheck2 className="w-4 h-4" style={{ color: primary }} /> Ringkasan Jadwal
                      </p>
                      <button onClick={() => goTo('schedule')} className="text-xs font-semibold" style={{ color: primary }}>
                        Edit
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-11 h-11 shrink-0">
                        <AvatarImage src={activeTherapist?.avatar_url} className="object-cover" />
                        <AvatarFallback className="text-white" style={{ background: primary }}>
                          {activeTherapist?.id === null ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        {selectedService && <p className="font-semibold text-slate-800 text-sm truncate">{selectedService.title}</p>}
                        <p className="text-xs text-slate-500 truncate">{activeTherapist?.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="inline-flex items-center gap-1.5 text-xs text-slate-600 justify-end">
                          <CalendarDays className="w-3.5 h-3.5" style={{ color: primary }} />
                          {selectedDate ? format(selectedDate, 'EEEE, d MMMM yyyy', { locale: idLocale }) : ''}
                        </p>
                        <p className="inline-flex items-center gap-1.5 text-xs text-slate-600 justify-end mt-1">
                          <Clock className="w-3.5 h-3.5" style={{ color: primary }} /> {slotTimeRange}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Nama Lengkap *</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => updateFormField('name', e.target.value)}
                        placeholder="Masukkan nama lengkap"
                        className={`mt-1.5 h-[52px] rounded-xl ${detailErrors.name ? 'border-red-400' : ''}`}
                      />
                      {detailErrors.name && <p className="text-xs text-red-500 mt-1">{detailErrors.name}</p>}
                    </div>
                    <div>
                      <Label htmlFor="phone">Nomor WhatsApp *</Label>
                      <div className={`mt-1.5 flex items-center rounded-xl border bg-white overflow-hidden ${detailErrors.phone ? 'border-red-400' : 'border-input'}`}>
                        <span className="pl-3.5 pr-3 h-[52px] flex items-center gap-1.5 text-sm font-semibold text-slate-600 border-r border-slate-100 shrink-0">
                          <MessageCircle className="w-4 h-4 text-emerald-500" /> +62
                        </span>
                        <input
                          id="phone"
                          value={form.phone}
                          onChange={(e) => updateFormField('phone', e.target.value)}
                          placeholder="812 3456 7890"
                          inputMode="numeric"
                          className="flex-1 h-[52px] px-3.5 text-sm bg-transparent outline-none placeholder:text-slate-400"
                        />
                      </div>
                      {detailErrors.phone && <p className="text-xs text-red-500 mt-1">{detailErrors.phone}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <Label htmlFor="dob">Tanggal Lahir</Label>
                        <input
                          id="dob"
                          type="date"
                          value={form.dob}
                          max={format(new Date(), 'yyyy-MM-dd')}
                          onChange={(e) => updateFormField('dob', e.target.value)}
                          className="mt-1.5 w-full h-[52px] px-3.5 rounded-xl border border-input bg-white text-sm text-slate-700 outline-none focus:ring-2"
                          style={{ '--tw-ring-color': `${primary}55` }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="gender">Jenis Kelamin</Label>
                        <select
                          id="gender"
                          value={form.gender}
                          onChange={(e) => updateFormField('gender', e.target.value)}
                          className="mt-1.5 w-full h-[52px] px-3.5 rounded-xl border border-input bg-white text-sm text-slate-700 outline-none focus:ring-2"
                          style={{ '--tw-ring-color': `${primary}55` }}
                        >
                          <option value="">Pilih jenis kelamin</option>
                          <option value="L">Laki-laki</option>
                          <option value="P">Perempuan</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="complaint">Keluhan Utama *</Label>
                      <Textarea
                        id="complaint"
                        value={form.complaint}
                        onChange={(e) => updateFormField('complaint', e.target.value.slice(0, 200))}
                        placeholder="Contoh: Nyeri punggung, cedera lutut, dll."
                        className={`mt-1.5 rounded-xl ${detailErrors.complaint ? 'border-red-400' : ''}`}
                        rows={3}
                        maxLength={200}
                      />
                      <div className="flex items-center justify-between mt-1">
                        {detailErrors.complaint ? <p className="text-xs text-red-500">{detailErrors.complaint}</p> : <span />}
                        <span className="text-[11px] text-slate-300">{form.complaint.length}/200</span>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="notes">Catatan Tambahan (Opsional)</Label>
                      <Textarea
                        id="notes"
                        value={form.notes}
                        onChange={(e) => updateFormField('notes', e.target.value.slice(0, 200))}
                        placeholder="Tambahkan informasi lain yang perlu kami ketahui"
                        className="mt-1.5 rounded-xl"
                        rows={2}
                        maxLength={200}
                      />
                      <div className="flex justify-end mt-1">
                        <span className="text-[11px] text-slate-300">{form.notes.length}/200</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 mt-5 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0">
                      <Lock className="w-4 h-4" style={{ color: primary }} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">Data Anda aman</p>
                      <p className="text-xs text-slate-500 mt-0.5">Informasi yang Anda masukkan digunakan hanya untuk keperluan pelayanan dan booking. Kami tidak membagikan data Anda kepada pihak lain.</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-6 mb-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: primary }} /> Fisioterapis berlisensi
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <CalendarCheck2 className="w-4 h-4 shrink-0" style={{ color: primary }} /> Jadwal real-time
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Lock className="w-4 h-4 shrink-0" style={{ color: primary }} /> Data Anda terlindungi
                    </div>
                  </div>

                  <div className="hidden lg:flex gap-3 mt-3">
                    <button
                      onClick={goBack}
                      className="px-6 h-12 rounded-xl font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      <ArrowLeft className="w-4 h-4 inline mr-2" /> Kembali
                    </button>
                    <Button
                      onClick={handleContinueDetails}
                      className="flex-1 text-white h-12 rounded-xl font-semibold shadow-md hover:opacity-90"
                      style={{ background: primary }}
                    >
                      Lanjutkan <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                  <StickyMobileCta>
                    <div className="flex gap-3">
                      <button
                        onClick={goBack}
                        className="px-5 h-12 rounded-xl font-semibold border border-slate-200 text-slate-600 shrink-0"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <Button
                        onClick={handleContinueDetails}
                        className="flex-1 text-white h-12 rounded-xl font-semibold shadow-md hover:opacity-90"
                        style={{ background: primary }}
                      >
                        Lanjutkan <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </StickyMobileCta>
                </motion.div>
              ) : (
                <motion.div key="confirm" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: accent }}>
                    Langkah {stepIndex + 1} dari {STEPS.length}
                  </p>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Konfirmasi Booking</h1>
                  <p className="text-slate-500 text-sm mb-5">Pastikan semua informasi berikut sudah sesuai sebelum melanjutkan.</p>

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-4">
                    <div className="p-4 flex items-center justify-between border-b border-slate-100">
                      <p className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900">
                        <CalendarCheck2 className="w-4 h-4" style={{ color: primary }} /> Detail Booking
                      </p>
                      <button onClick={() => goTo('schedule')} className="text-xs font-semibold" style={{ color: primary }}>
                        Edit
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {selectedService && (
                        <div className="p-4 flex items-start gap-3">
                          <Sparkles className="w-4 h-4 shrink-0 mt-0.5" style={{ color: primary }} />
                          <div>
                            <p className="text-xs text-slate-400">Layanan</p>
                            <p className="font-semibold text-slate-800 text-sm">{selectedService.title}</p>
                            {selectedService.description && <p className="text-xs text-slate-500 mt-0.5">{selectedService.description}</p>}
                          </div>
                        </div>
                      )}
                      <div className="p-4 flex items-start gap-3">
                        <User className="w-4 h-4 shrink-0 mt-0.5" style={{ color: primary }} />
                        <div>
                          <p className="text-xs text-slate-400">Terapis</p>
                          <p className="font-semibold text-slate-800 text-sm">{activeTherapist?.name}</p>
                          {activeTherapist?.specialization && <p className="text-xs text-slate-500 mt-0.5">{activeTherapist.specialization}</p>}
                        </div>
                      </div>
                      <div className="p-4 flex items-start gap-3">
                        <CalendarDays className="w-4 h-4 shrink-0 mt-0.5" style={{ color: primary }} />
                        <div>
                          <p className="text-xs text-slate-400">Tanggal</p>
                          <p className="font-semibold text-slate-800 text-sm">{format(selectedDate, 'EEEE, d MMMM yyyy', { locale: idLocale })}</p>
                        </div>
                      </div>
                      <div className="p-4 flex items-start gap-3">
                        <Clock className="w-4 h-4 shrink-0 mt-0.5" style={{ color: primary }} />
                        <div>
                          <p className="text-xs text-slate-400">Waktu</p>
                          <p className="font-semibold text-slate-800 text-sm">{slotTimeRange} ({slotDurationLabel})</p>
                        </div>
                      </div>
                      {clinic.address && (
                        <div className="p-4 flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: primary }} />
                            <div className="min-w-0">
                              <p className="text-xs text-slate-400">Lokasi</p>
                              <p className="font-semibold text-slate-800 text-sm">{clinic.name}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{clinic.address}</p>
                            </div>
                          </div>
                          {mapsHref && (
                            <a
                              href={mapsHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border shrink-0"
                              style={{ color: primary, borderColor: `${primary}55` }}
                            >
                              <MapPin className="w-3.5 h-3.5" /> Lihat Lokasi
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-4">
                    <div className="p-4 flex items-center justify-between border-b border-slate-100">
                      <p className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900">
                        <User className="w-4 h-4" style={{ color: primary }} /> Data Pasien
                      </p>
                      <button onClick={() => goTo('details')} className="text-xs font-semibold" style={{ color: primary }}>
                        Edit
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100 text-sm">
                      {[
                        ['Nama Lengkap', form.name],
                        ['Nomor WhatsApp', `+62 ${form.phone.replace(/^0/, '')}`],
                        ['Tanggal Lahir', form.dob ? format(new Date(form.dob), 'd MMMM yyyy', { locale: idLocale }) : '-'],
                        ['Jenis Kelamin', form.gender === 'L' ? 'Laki-laki' : form.gender === 'P' ? 'Perempuan' : '-'],
                        ['Keluhan Utama', form.complaint || '-'],
                        ['Catatan Tambahan', form.notes || '-'],
                      ].map(([label, value]) => (
                        <div key={label} className="p-3.5 flex items-start justify-between gap-4">
                          <span className="text-slate-400 shrink-0">{label}</span>
                          <span className="font-semibold text-slate-800 text-right">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {bookingPolicies.length > 0 && (
                    <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 mb-4">
                      <p className="inline-flex items-center gap-1.5 font-semibold text-slate-800 text-sm mb-2.5">
                        <Info className="w-4 h-4" style={{ color: primary }} /> Penting untuk Diketahui
                      </p>
                      <ul className="space-y-1.5">
                        {bookingPolicies.map((policy) => (
                          <li key={policy} className="flex items-start gap-2 text-xs text-slate-600">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: primary }} /> {policy}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <label className="flex items-start gap-2.5 mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="sr-only"
                    />
                    <span
                      className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                      style={consentChecked ? { background: primary, borderColor: primary } : { borderColor: '#cbd5e1' }}
                    >
                      {consentChecked && <Check className="w-3.5 h-3.5 text-white" />}
                    </span>
                    <span className="text-xs text-slate-600">
                      Saya menyetujui kebijakan privasi dan ketentuan layanan klinik ini.
                      <br />
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setShowPrivacyNote((v) => !v); }}
                        className="font-semibold underline"
                        style={{ color: primary }}
                      >
                        Lihat Kebijakan Privasi
                      </button>
                    </span>
                  </label>
                  {showPrivacyNote && (
                    <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3 mb-3 leading-relaxed">
                      {content?.privacyPolicy || 'Data yang Anda berikan pada formulir ini digunakan semata-mata untuk memproses booking dan pelayanan Anda di ' + clinic.name + ', dan tidak dibagikan kepada pihak lain tanpa persetujuan Anda.'}
                    </div>
                  )}

                  {slotConflict ? (
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mt-3 mb-2">
                      <p className="font-semibold text-red-700 text-sm">Maaf, jadwal tersebut baru saja tidak tersedia.</p>
                      <p className="text-xs text-red-600/80 mt-0.5 mb-3">Slot ini baru saja diambil pasien lain. Silakan pilih jadwal lain yang masih tersedia.</p>
                      <button
                        onClick={handlePickAnotherSchedule}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full bg-white border border-red-200 text-red-700 min-h-[36px]"
                      >
                        <CalendarDays className="w-3.5 h-3.5" /> Pilih Jadwal Lain
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="hidden lg:flex gap-3 mt-3">
                        <button
                          onClick={goBack}
                          className="px-6 h-12 rounded-xl font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                          <ArrowLeft className="w-4 h-4 inline mr-2" /> Kembali
                        </button>
                        <Button
                          onClick={handleSubmitBooking}
                          disabled={submitting || !consentChecked}
                          className="flex-1 text-white h-12 rounded-xl font-bold shadow-md hover:opacity-90"
                          style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${accent})` }}
                        >
                          {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarCheck2 className="w-4 h-4 mr-2" />}
                          {submitting ? 'Memproses booking...' : 'Konfirmasi Booking'}
                        </Button>
                      </div>
                      <StickyMobileCta>
                        <div className="flex gap-3">
                          <button
                            onClick={goBack}
                            className="px-5 h-12 rounded-xl font-semibold border border-slate-200 text-slate-600 shrink-0"
                          >
                            <ArrowLeft className="w-4 h-4" />
                          </button>
                          <Button
                            onClick={handleSubmitBooking}
                            disabled={submitting || !consentChecked}
                            className="flex-1 text-white h-12 rounded-xl font-bold shadow-md hover:opacity-90"
                            style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${accent})` }}
                          >
                            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarCheck2 className="w-4 h-4 mr-2" />}
                            {submitting ? 'Memproses booking...' : 'Konfirmasi Booking'}
                          </Button>
                        </div>
                      </StickyMobileCta>
                    </>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-6 mb-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: primary }} /> Fisioterapis berlisensi
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <CalendarCheck2 className="w-4 h-4 shrink-0" style={{ color: primary }} /> Jadwal real-time
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Lock className="w-4 h-4 shrink-0" style={{ color: primary }} /> Data Anda terlindungi
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <aside className="hidden lg:block sticky top-24">
            {success ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                <p className="text-sm font-bold text-slate-900 mb-1">Langkah Selanjutnya</p>
                {waHref && (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-3 text-white font-semibold px-4 py-3.5 rounded-xl transition-opacity hover:opacity-90 shadow-md bg-emerald-500"
                  >
                    <MessageCircle className="w-5 h-5 shrink-0" />
                    <span className="text-left">
                      <span className="block text-sm">Chat WhatsApp</span>
                      <span className="block text-[11px] font-normal opacity-90">Konfirmasi &amp; tanya lebih lanjut</span>
                    </span>
                  </a>
                )}
                <button
                  onClick={handleAddToCalendar}
                  className="w-full flex items-center gap-3 font-semibold px-4 py-3.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <CalendarPlus className="w-5 h-5 shrink-0" style={{ color: primary }} />
                  <span className="text-left">
                    <span className="block text-sm">Tambahkan ke Kalender</span>
                    <span className="block text-[11px] font-normal text-slate-400">Google / Apple / Outlook</span>
                  </span>
                </button>
                <Link
                  to="/"
                  className="w-full flex items-center justify-center gap-2 font-semibold px-4 py-3.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Home className="w-4 h-4" /> Kembali ke Beranda
                </Link>
              </div>
            ) : (
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
            )}
          </aside>
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
// Fetches and renders one therapist's own working-hours groups (e.g. "Sen -
// Sab: 09:00-17:00") - per-card, since each therapist's schedule is its own
// lookup against real practice-hours data, never invented client-side.
const TherapistScheduleLines = ({ therapistId }) => {
  const [lines, setLines] = useState(null);

  useEffect(() => {
    let active = true;
    setLines(null);
    getTherapistPracticeHoursGrouped(therapistId).then(({ data }) => {
      if (!active) return;
      setLines((data || []).map((g) => `${g.day_range}: ${(g.display_start_time || '').slice(0, 5)}–${(g.display_end_time || '').slice(0, 5)}`));
    });
    return () => { active = false; };
  }, [therapistId]);

  if (lines === null) return <span className="text-slate-300">Memuat jadwal...</span>;
  if (lines.length === 0) return <span className="text-slate-400 italic">Jadwal belum tersedia</span>;
  return lines.map((l, i) => <span key={i} className="block">{l}</span>);
};

const StickyMobileCta = ({ children }) => (
  <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur border-t border-slate-100 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
    <div className="max-w-6xl mx-auto">{children}</div>
  </div>
);

export default ClinicBookingPage;
