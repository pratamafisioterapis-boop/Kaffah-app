import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Loader2, MapPin,
  Phone, Sparkles, Stethoscope, User, Users, MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { useClinicTenant } from '@/hooks/useClinicTenant';
import { getActivePhysiotherapists, getAvailableSlots, createAppointment } from '@/lib/api';
import { getLandingTemplate } from '@/config/landingTemplates';

const STEPS = ['therapist', 'schedule', 'details', 'confirm'];
const STEP_LABELS = {
  therapist: 'Terapis',
  schedule: 'Jadwal',
  details: 'Data Diri',
  confirm: 'Konfirmasi',
};
const ANY_THERAPIST = { id: null, name: 'Siapa saja yang tersedia', specialization: 'Dijadwalkan otomatis' };

// Public booking flow for a clinic's own tenant site (subdomain or verified
// custom domain). Its step structure is fixed/generic (distinct from
// Kaffah's own /booking flow, SmartBookingPage, kept exclusive to
// kaffahphysio.id) but its color palette follows the same landing_template
// + landing_primary_color/landing_accent_color the clinic picked for its
// public landing page, so booking feels like a continuation of the same
// branded site rather than a generic bolt-on form.
const ClinicBookingPage = () => {
  const { clinic, loading: loadingClinic, notFound } = useClinicTenant();
  const { toast } = useToast();

  const [step, setStep] = useState('therapist');
  const [therapists, setTherapists] = useState([]);
  const [loadingTherapists, setLoadingTherapists] = useState(true);

  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [form, setForm] = useState({ name: '', phone: '', complaint: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const dateOptions = useMemo(
    () => Array.from({ length: 10 }, (_, i) => addDays(new Date(), i)),
    []
  );

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

  const stepIndex = STEPS.indexOf(step);

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

      const { error } = await createAppointment({
        therapistId: selectedSlot.therapist_id,
        clinicId: clinic.id,
        appointmentDate,
        durationMinutes: selectedSlot.duration_minutes || 60,
        status: 'confirmed',
        notes: form.complaint ? `[Booking Online] Keluhan: ${form.complaint}` : '[Booking Online]',
        guestName: form.name.trim(),
        guestPhone: form.phone.trim(),
        guestComplaint: form.complaint.trim() || null,
      });

      if (error) throw new Error(error.message || 'Gagal membuat janji temu.');
      setSuccess(true);
    } catch (err) {
      toast({
        title: 'Booking gagal',
        description: err.message || 'Terjadi kesalahan, silakan coba lagi.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const template = getLandingTemplate(clinic?.landing_template);
  const primary = clinic?.landing_primary_color || template.colors.primary;
  const accent = clinic?.landing_accent_color || template.colors.accent;

  if (loadingClinic) {
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

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>Booking Online — {clinic.name}</title>
        <meta name="theme-color" content={primary} />
      </Helmet>

      <header
        className="pb-14 sm:pb-16"
        style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${accent})` }}
      >
        <div className="max-w-3xl mx-auto px-5 py-6 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3 group">
            {clinic.logo_url ? (
              <img src={clinic.logo_url} alt={clinic.name} className="h-11 w-11 rounded-xl object-cover ring-2 ring-white/40" />
            ) : (
              <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center text-white font-bold ring-2 ring-white/30">
                {clinic.name?.[0]?.toUpperCase() || 'C'}
              </div>
            )}
            <div>
              <span className="block font-bold text-white leading-tight">{clinic.name}</span>
              <span className="block text-xs text-white/80">Booking Online</span>
            </div>
          </Link>
        </div>
      </header>

      {!success && (
        <div className="max-w-3xl mx-auto px-5 -mt-10 sm:-mt-12">
          <div className="bg-white rounded-2xl shadow-lg shadow-slate-900/5 border border-slate-100 px-4 sm:px-6 py-4">
            <div className="flex items-center gap-2">
              {STEPS.map((s, i) => (
                <React.Fragment key={s}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        i <= stepIndex ? 'text-white' : 'bg-slate-200 text-slate-400'
                      }`}
                      style={i <= stepIndex ? { background: primary } : undefined}
                    >
                      {i < stepIndex ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                    </div>
                    <span className="text-xs font-semibold hidden sm:inline" style={{ color: i <= stepIndex ? primary : '#94a3b8' }}>
                      {STEP_LABELS[s]}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: i < stepIndex ? '100%' : '0%', background: accent }} />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-5 py-8">
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-900/5 p-8 sm:p-10 text-center"
            >
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
                style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${accent})` }}
              >
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Booking Berhasil!</h1>
              <p className="text-slate-500 mb-7 max-w-sm mx-auto">
                Terima kasih, {form.name}. Janji temu Anda di <strong>{clinic.name}</strong> pada{' '}
                {format(selectedDate, "EEEE, d MMMM yyyy", { locale: idLocale })} pukul{' '}
                {(selectedSlot?.slot_start || '').slice(0, 5)} telah tercatat.
              </p>
              {clinic.phone && (
                <a
                  href={`https://wa.me/${clinic.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 text-white font-semibold px-7 py-3.5 rounded-xl transition-opacity hover:opacity-90 shadow-md"
                  style={{ background: primary }}
                >
                  <MessageCircle className="w-4 h-4" /> Konfirmasi via WhatsApp
                </a>
              )}
            </motion.div>
          ) : step === 'therapist' ? (
            <motion.div key="therapist" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Pilih Terapis</h1>
              <p className="text-slate-500 text-sm mb-6">Pilih terapis pilihan Anda, atau biarkan kami menjadwalkan otomatis.</p>

              {loadingTherapists ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: primary }} /></div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3.5">
                  <button
                    onClick={() => handlePickTherapist(ANY_THERAPIST)}
                    className="text-left bg-white border-2 border-dashed rounded-2xl p-4 flex items-center gap-3 transition-all hover:shadow-md hover:-translate-y-0.5"
                    style={{ borderColor: `${primary}55` }}
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: `${primary}1a` }}>
                      <Users className="w-5 h-5" style={{ color: primary }} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">Siapa saja yang tersedia</p>
                      <p className="text-xs text-slate-500">Jadwal tercepat</p>
                    </div>
                  </button>

                  {therapists.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handlePickTherapist(t)}
                      className="text-left bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-3 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
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
              <button onClick={() => goTo('therapist')} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:opacity-80 mb-4">
                <ArrowLeft className="w-4 h-4" /> Ganti terapis
              </button>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Pilih Jadwal</h1>
              <p className="text-slate-500 text-sm mb-6">
                dengan <strong>{selectedTherapist?.name}</strong>
              </p>

              <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
                {dateOptions.map((d) => {
                  const active = selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd');
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => setSelectedDate(d)}
                      className={`shrink-0 flex flex-col items-center px-4 py-2.5 rounded-xl border transition-all ${
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
                loadingSlots ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" style={{ color: primary }} /></div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-sm bg-white rounded-2xl border border-slate-100">
                    Tidak ada jadwal tersedia pada tanggal ini. Coba pilih tanggal lain.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {slots.map((s) => (
                      <button
                        key={`${s.therapist_id}-${s.slot_start}`}
                        onClick={() => handlePickSlot(s)}
                        className="bg-white border border-slate-100 rounded-xl py-2.5 text-sm font-semibold text-slate-700 transition-all hover:shadow-md hover:-translate-y-0.5"
                      >
                        {(s.slot_start || '').slice(0, 5)}
                      </button>
                    ))}
                  </div>
                )
              )}
            </motion.div>
          ) : step === 'details' ? (
            <motion.div key="details" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <button onClick={() => goTo('schedule')} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:opacity-80 mb-4">
                <ArrowLeft className="w-4 h-4" /> Ganti jadwal
              </button>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">Data Diri</h1>
              <p className="text-slate-500 text-sm mb-6">Untuk konfirmasi janji temu Anda.</p>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 space-y-4">
                <div>
                  <Label htmlFor="name">Nama Lengkap</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nama Anda" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="phone">Nomor WhatsApp</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="08xxxxxxxxxx" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="complaint">Keluhan (opsional)</Label>
                  <Textarea id="complaint" value={form.complaint} onChange={(e) => setForm((f) => ({ ...f, complaint: e.target.value }))} placeholder="Ceritakan singkat keluhan Anda" className="mt-1.5" rows={3} />
                </div>
              </div>

              <Button
                onClick={() => goTo('confirm')}
                disabled={!canSubmitDetails}
                className="w-full mt-5 text-white h-12 rounded-xl font-semibold shadow-md hover:opacity-90"
                style={{ background: primary }}
              >
                Lanjutkan <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          ) : (
            <motion.div key="confirm" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <button onClick={() => goTo('details')} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:opacity-80 mb-4">
                <ArrowLeft className="w-4 h-4" /> Ubah data
              </button>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-5">Konfirmasi Booking</h1>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">
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

              <Button
                onClick={handleSubmitBooking}
                disabled={submitting}
                className="w-full mt-5 text-white h-12 rounded-xl font-bold shadow-md hover:opacity-90"
                style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${accent})` }}
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Konfirmasi Booking
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="text-center text-xs text-slate-400 py-8 flex items-center justify-center gap-1">
        <Phone className="w-3 h-3" /> Powered by Clinara
      </footer>
    </div>
  );
};

export default ClinicBookingPage;
