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

const STEPS = ['therapist', 'schedule', 'details', 'confirm'];
const STEP_LABELS = {
  therapist: 'Terapis',
  schedule: 'Jadwal',
  details: 'Data Diri',
  confirm: 'Konfirmasi',
};
const ANY_THERAPIST = { id: null, name: 'Siapa saja yang tersedia', specialization: 'Dijadwalkan otomatis' };

// Public booking flow for a clinic's own tenant site (subdomain or verified
// custom domain). Deliberately built with Clinara's own visual language
// (navy/blue/teal, see tailwind `clinara.*` colors) and its own step
// structure — distinct from Kaffah's own /booking flow (SmartBookingPage),
// which keeps its premium navy+gold look exclusive to kaffahphysio.id.
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

  if (loadingClinic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-clinara-bg">
        <Loader2 className="w-8 h-8 animate-spin text-clinara-blue" />
      </div>
    );
  }

  if (notFound || !clinic) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-clinara-bg text-center px-4">
        <h1 className="text-2xl font-bold text-clinara-navy mb-2">Domain belum terhubung</h1>
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
    <div className="min-h-screen bg-clinara-bg">
      <Helmet>
        <title>Booking Online — {clinic.name}</title>
        <meta name="theme-color" content="#0f2a4a" />
      </Helmet>

      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3 group">
            {clinic.logo_url ? (
              <img src={clinic.logo_url} alt={clinic.name} className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-clinara-navy flex items-center justify-center text-white font-bold text-sm">
                {clinic.name?.[0]?.toUpperCase() || 'C'}
              </div>
            )}
            <span className="font-bold text-slate-800 group-hover:text-clinara-blue transition-colors">{clinic.name}</span>
          </Link>
        </div>
      </header>

      {!success && (
        <div className="max-w-3xl mx-auto px-5 pt-6">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      i < stepIndex
                        ? 'bg-clinara-teal text-white'
                        : i === stepIndex
                        ? 'bg-clinara-blue text-white'
                        : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {i < stepIndex ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-xs font-medium hidden sm:inline ${i <= stepIndex ? 'text-clinara-navy' : 'text-slate-400'}`}>
                    {STEP_LABELS[s]}
                  </span>
                </div>
                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < stepIndex ? 'bg-clinara-teal' : 'bg-slate-200'}`} />}
              </React.Fragment>
            ))}
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
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-clinara-teal/10 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-9 h-9 text-clinara-teal" />
              </div>
              <h1 className="text-2xl font-bold text-clinara-navy mb-2">Booking Berhasil!</h1>
              <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                Terima kasih, {form.name}. Janji temu Anda di <strong>{clinic.name}</strong> pada{' '}
                {format(selectedDate, "EEEE, d MMMM yyyy", { locale: idLocale })} pukul{' '}
                {(selectedSlot?.slot_start || '').slice(0, 5)} telah tercatat.
              </p>
              {clinic.phone && (
                <a
                  href={`https://wa.me/${clinic.phone.replace(/[^0-9]/g, '').replace(/^0/, '62')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-clinara-navy hover:bg-clinara-blue text-white font-semibold px-6 py-3 rounded-xl transition-colors"
                >
                  <MessageCircle className="w-4 h-4" /> Konfirmasi via WhatsApp
                </a>
              )}
            </motion.div>
          ) : step === 'therapist' ? (
            <motion.div key="therapist" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <h1 className="text-xl font-bold text-clinara-navy mb-1">Pilih Terapis</h1>
              <p className="text-slate-500 text-sm mb-5">Pilih terapis pilihan Anda, atau biarkan kami menjadwalkan otomatis.</p>

              {loadingTherapists ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-clinara-blue" /></div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handlePickTherapist(ANY_THERAPIST)}
                    className="text-left bg-white border-2 border-dashed border-clinara-sky/60 hover:border-clinara-blue rounded-xl p-4 flex items-center gap-3 transition-colors"
                  >
                    <div className="w-11 h-11 rounded-full bg-clinara-blue/10 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-clinara-blue" />
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
                      className="text-left bg-white border border-slate-100 hover:border-clinara-blue rounded-xl p-4 flex items-center gap-3 transition-colors shadow-sm"
                    >
                      <Avatar className="w-11 h-11 shrink-0">
                        <AvatarImage src={t.avatar_url} className="object-cover" />
                        <AvatarFallback className="bg-clinara-navy text-white"><User className="w-5 h-5" /></AvatarFallback>
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
              <button onClick={() => goTo('therapist')} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-clinara-blue mb-4">
                <ArrowLeft className="w-4 h-4" /> Ganti terapis
              </button>
              <h1 className="text-xl font-bold text-clinara-navy mb-1">Pilih Jadwal</h1>
              <p className="text-slate-500 text-sm mb-5">
                dengan <strong>{selectedTherapist?.name}</strong>
              </p>

              <div className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1">
                {dateOptions.map((d) => {
                  const active = selectedDate && format(selectedDate, 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd');
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => setSelectedDate(d)}
                      className={`shrink-0 flex flex-col items-center px-4 py-2.5 rounded-xl border transition-colors ${
                        active ? 'bg-clinara-navy border-clinara-navy text-white' : 'bg-white border-slate-100 text-slate-600 hover:border-clinara-blue'
                      }`}
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
                  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-clinara-blue" /></div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-sm bg-white rounded-xl border border-slate-100">
                    Tidak ada jadwal tersedia pada tanggal ini. Coba pilih tanggal lain.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((s) => (
                      <button
                        key={`${s.therapist_id}-${s.slot_start}`}
                        onClick={() => handlePickSlot(s)}
                        className="bg-white border border-slate-100 hover:border-clinara-blue hover:bg-clinara-blue/5 rounded-lg py-2.5 text-sm font-semibold text-slate-700 transition-colors"
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
              <button onClick={() => goTo('schedule')} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-clinara-blue mb-4">
                <ArrowLeft className="w-4 h-4" /> Ganti jadwal
              </button>
              <h1 className="text-xl font-bold text-clinara-navy mb-1">Data Diri</h1>
              <p className="text-slate-500 text-sm mb-5">Untuk konfirmasi janji temu Anda.</p>

              <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
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
                className="w-full mt-5 bg-clinara-navy hover:bg-clinara-blue text-white h-12 rounded-xl font-semibold"
              >
                Lanjutkan <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          ) : (
            <motion.div key="confirm" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <button onClick={() => goTo('details')} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-clinara-blue mb-4">
                <ArrowLeft className="w-4 h-4" /> Ubah data
              </button>
              <h1 className="text-xl font-bold text-clinara-navy mb-5">Konfirmasi Booking</h1>

              <div className="bg-white rounded-xl border border-slate-100 divide-y divide-slate-100">
                <div className="p-4 flex items-center gap-3">
                  <Stethoscope className="w-5 h-5 text-clinara-blue shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">Terapis</p>
                    <p className="font-semibold text-slate-800 text-sm">{activeTherapist?.name}</p>
                  </div>
                </div>
                <div className="p-4 flex items-center gap-3">
                  <CalendarDays className="w-5 h-5 text-clinara-blue shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">Jadwal</p>
                    <p className="font-semibold text-slate-800 text-sm">
                      {format(selectedDate, "EEEE, d MMMM yyyy", { locale: idLocale })} — {(selectedSlot?.slot_start || '').slice(0, 5)}
                    </p>
                  </div>
                </div>
                <div className="p-4 flex items-center gap-3">
                  <User className="w-5 h-5 text-clinara-blue shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400">Pasien</p>
                    <p className="font-semibold text-slate-800 text-sm">{form.name} · {form.phone}</p>
                  </div>
                </div>
                {clinic.address && (
                  <div className="p-4 flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-clinara-blue shrink-0" />
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
                className="w-full mt-5 bg-clinara-teal hover:bg-clinara-teal/90 text-clinara-navy h-12 rounded-xl font-bold"
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
