import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import {
  Sparkles, ArrowRight, ArrowLeft, ShieldCheck, Loader2, AlertTriangle, RefreshCw,
  UserPlus, Stethoscope, CalendarClock, Wand2, ClipboardCheck, CheckCircle2, Crown, MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { getActivePhysiotherapists, createAppointment, getClinicLogo, matchPatientForNewRegistration, getPatientTherapistHistory } from '@/lib/api';
import { complaintLabel } from '@/lib/complaintTags';
import SmartPatientTypeStep from '@/components/public/SmartPatientTypeStep';
import SmartPatientStep from '@/components/public/SmartPatientStep';
import SmartPatientMatchConfirmStep from '@/components/public/SmartPatientMatchConfirmStep';
import SmartReturningPatientStep from '@/components/public/SmartReturningPatientStep';
import SmartComplaintStep from '@/components/public/SmartComplaintStep';
import SmartTimePreferenceStep from '@/components/public/SmartTimePreferenceStep';
import SmartResultsStep from '@/components/public/SmartResultsStep';
import BookingSuccessScreen from '@/components/public/BookingSuccessScreen';

const STEP_ORDER = [
  { key: 'patient', label: 'Data Diri', icon: UserPlus },
  { key: 'complaint', label: 'Keluhan', icon: Stethoscope },
  { key: 'time', label: 'Waktu', icon: CalendarClock },
  { key: 'results', label: 'Rekomendasi', icon: Wand2 },
  { key: 'confirm', label: 'Konfirmasi', icon: ClipboardCheck },
];

// 'patientSearch' (returning patients) and 'patientMatchConfirm' (possible
// duplicate found while registering as a new patient) fill the same slot as
// 'patient' in the progress bar — they're all paths to the same milestone.
const STEP_PROGRESS_ALIAS = { patientSearch: 'patient', patientMatchConfirm: 'patient' };

const SmartBookingPage = () => {
  const { toast } = useToast();
  const location = useLocation();

  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  const [step, setStep] = useState('intro');
  const [therapists, setTherapists] = useState([]);
  const [logoUrl, setLogoUrl] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [patientType, setPatientType] = useState(null); // 'new' | 'returning'
  const [existingPatientId, setExistingPatientId] = useState(null);
  const [preferredTherapistIds, setPreferredTherapistIds] = useState([]);
  const [patientData, setPatientData] = useState(null);
  const [matchCandidate, setMatchCandidate] = useState(null);
  const [matchingPatient, setMatchingPatient] = useState(false);
  const [complaintSlugs, setComplaintSlugs] = useState([]);
  const [complaintNote, setComplaintNote] = useState('');
  const [timePreference, setTimePreference] = useState(null);
  const [selectedPick, setSelectedPick] = useState(null); // { therapist, date, slot }

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setFetchError(null);
    setLoadingData(true);
    try {
      const [therapistRes, logoRes] = await Promise.all([
        getActivePhysiotherapists({ showOnBooking: true }),
        getClinicLogo()
      ]);
      if (therapistRes.error) throw new Error(therapistRes.error.message);
      if (therapistRes.data) setTherapists(therapistRes.data);
      if (logoRes.data?.file_url) setLogoUrl(logoRes.data.file_url);
    } catch (error) {
      setFetchError(error.message);
    } finally {
      setLoadingData(false);
    }
  };

  const goTo = (next) => {
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleHomecareWhatsApp = () => {
    const message = `Halo Admin Kaffah Physiotherapy,\n\nSaya ingin melakukan reservasi layanan fisioterapi homecare.\n\nMohon informasi terkait jadwal yang tersedia dan prosedur booking.\n\nTerima kasih.`;
    window.open(`https://wa.me/6281233339435?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleNewPatientSubmit = async (data) => {
    setPatientData(data);
    setMatchingPatient(true);
    try {
      const { data: candidates } = await matchPatientForNewRegistration(data.full_name, data.phone, data.birth_date);
      if (candidates && candidates.length > 0) {
        setMatchCandidate(candidates[0]);
        goTo('patientMatchConfirm');
        return;
      }
    } catch (e) {
      // Matching is a best-effort convenience — if it fails, fall through to a normal new-patient booking.
    } finally {
      setMatchingPatient(false);
    }
    setExistingPatientId(null);
    goTo('complaint');
  };

  const handleMatchConfirm = async (candidate) => {
    setExistingPatientId(candidate.id);
    const { data: historyRes } = await getPatientTherapistHistory(candidate.id);
    const topTherapistIds = (historyRes || [])
      .sort((a, b) => b.count - a.count)
      .slice(0, 2)
      .map(t => t.id);
    setPreferredTherapistIds(topTherapistIds);
    goTo('complaint');
  };

  const handleMatchReject = async () => {
    setExistingPatientId(null);
    setMatchCandidate(null);
    goTo('complaint');
  };

  const handleSelectSlot = (therapist, date, slot) => {
    setSelectedPick({ therapist, date, slot });
    goTo('confirm');
  };

  const handleConfirmBooking = async () => {
    if (!selectedPick) return;
    setSubmitting(true);
    try {
      const { therapist, date, slot } = selectedPick;
      const dateStr = format(date, 'yyyy-MM-dd');
      const timePart = (slot.slot_start || '').slice(0, 5);
      const appointmentDate = `${dateStr}T${timePart}:00`;
      const complaintLabels = complaintSlugs.map(complaintLabel);
      const guestComplaint = complaintNote
        ? `${complaintLabels.join(', ')} — ${complaintNote}`
        : complaintLabels.join(', ');

      const appointmentPayload = {
        therapistId: therapist.id,
        clinicId: therapist.clinic_id,
        appointmentDate,
        durationMinutes: slot.duration_minutes || 60,
        status: 'confirmed',
        notes: `[Smart Booking] Keluhan: ${guestComplaint}`,
        guestName: patientData.full_name,
        guestPhone: patientData.phone,
        guestComplaint,
        guestAge: parseInt(patientData.age, 10),
        guestGender: patientData.gender,
        patientId: existingPatientId
      };

      const { error } = await createAppointment(appointmentPayload);
      if (error) throw new Error(error.message || 'Gagal membuat janji temu.');

      setSuccess(true);

      const message = `Halo Admin Kaffah Physiotherapy,\nSaya ingin konfirmasi booking (Smart Booking):\n\nNama: ${patientData.full_name}\nUsia: ${patientData.age} tahun\nJenis Kelamin: ${patientData.gender === 'male' ? 'Laki-laki' : 'Perempuan'}\nKeluhan: ${guestComplaint}\nTerapis: ${therapist.name}\nTanggal: ${format(date, 'dd MMM yyyy')}\nJam: ${timePart}\n\nMohon diproses. Terima kasih.`;
      window.open(`https://wa.me/6281233339435?text=${encodeURIComponent(message)}`, '_blank');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Booking Gagal', description: error.message || 'Terjadi kesalahan saat memproses data.' });
    } finally {
      setSubmitting(false);
    }
  };

  const currentStepIndex = STEP_ORDER.findIndex(s => s.key === (STEP_PROGRESS_ALIAS[step] || step));
  const StepProgress = () => {
    if (currentStepIndex === -1) return null;
    return (
      <div className="w-full max-w-3xl mx-auto px-4 mb-6 sm:mb-10">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-4 left-0 right-0 h-[2px] bg-slate-200 mx-4 sm:mx-6 -z-0" />
          <div
            className="absolute top-4 left-0 h-[2px] bg-gradient-to-r from-[#1e3a8a] to-[#3b82f6] mx-4 sm:mx-6 -z-0 transition-all duration-500"
            style={{ width: `calc(${(currentStepIndex / (STEP_ORDER.length - 1)) * 100}% - 0px)`, maxWidth: 'calc(100% - 2rem)' }}
          />
          {STEP_ORDER.map((s, idx) => {
            const Icon = s.icon;
            const isDone = idx < currentStepIndex;
            const isActive = idx === currentStepIndex;
            return (
              <div key={s.key} className="relative z-10 flex flex-col items-center gap-1.5 flex-1">
                <div className={
                  "w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-sm " +
                  (isDone ? "bg-[#1e3a8a] border-[#1e3a8a] text-white" : isActive ? "bg-white border-[#1e3a8a] text-[#1e3a8a] ring-4 ring-blue-100" : "bg-white border-slate-200 text-slate-300")
                }>
                  {isDone ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </div>
                <span className={"text-[10px] sm:text-xs font-semibold tracking-tight text-center hidden xs:block sm:block " + (isActive ? "text-[#1e3a8a]" : isDone ? "text-slate-500" : "text-slate-300")}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (success) {
    return (
      <BookingSuccessScreen
        title="Smart Booking Berhasil!"
        description="Terima kasih! Terapis dan jadwal terbaik sudah kami siapkan. Admin kami akan segera menghubungi Anda via WhatsApp untuk konfirmasi."
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/60 via-white to-white font-sans text-slate-900 flex flex-col">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/70 sticky top-0 z-50 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group" onClick={() => window.location.href = '/'}>
            {logoUrl ? <img src={logoUrl} alt="Logo" className="h-11 sm:h-14 w-auto object-contain transition-transform group-hover:scale-105" /> : <div className="w-10 h-10 bg-gradient-to-br from-[#1e3a8a] to-[#3b82f6] rounded-xl flex items-center justify-center text-white font-bold shadow-md">KC</div>}
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-sm sm:text-base text-[#1e3a8a] tracking-tight">KAFFAH PHYSIOTHERAPY</span>
              <span className="hidden sm:flex items-center gap-1 text-[11px] font-medium text-slate-400">
                <Sparkles className="w-3 h-3 text-[#b8935f]" /> Smart Booking — Rekomendasi Otomatis
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className={step === 'intro' ? 'flex-grow' : 'flex-grow py-6 sm:py-10'}>
        {fetchError ? (
          <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-red-100">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Maaf, Terjadi Kesalahan</h2>
            <p className="text-slate-500 max-w-md mb-6">{fetchError}</p>
            <Button onClick={fetchInitialData} className="gap-2 rounded-full bg-[#1e3a8a] hover:bg-[#172554] h-11 px-6">
              <RefreshCw className="w-4 h-4" /> Coba Lagi
            </Button>
          </div>
        ) : loadingData ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-11 h-11 animate-spin text-[#1e3a8a] mb-5" />
            <p className="text-slate-400 font-medium">Menyiapkan Smart Booking...</p>
          </div>
        ) : (
          <>
            {step !== 'intro' && <StepProgress />}
            <AnimatePresence mode="wait">
              {step === 'intro' && (
                <motion.div key="intro" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full">
                  {/* Premium hero */}
                  <div className="relative overflow-hidden bg-gradient-to-br from-[#0f1e3d] via-[#132348] to-[#0f1e3d] pt-14 sm:pt-20 pb-16 sm:pb-24 px-4">
                    <div className="absolute -top-24 -right-24 w-72 h-72 bg-[#b8935f]/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-[#1e3a8a]/30 rounded-full blur-3xl" />
                    <div
                      className="absolute inset-0 opacity-[0.07]"
                      style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '22px 22px' }}
                    />

                    <div className="relative z-10 max-w-2xl mx-auto text-center">
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur mb-6">
                        <Crown className="w-3.5 h-3.5 text-[#e8c98a]" />
                        <span className="text-[11px] sm:text-xs font-bold tracking-[0.15em] text-[#e8c98a] uppercase">Kaffah Premium Care</span>
                      </div>
                      <h1 className="text-3xl sm:text-5xl font-bold text-white tracking-tight mb-4 leading-tight">
                        Biar Kami Carikan Terapis &amp; Jadwal Terbaik
                      </h1>
                      <p className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto leading-relaxed mb-10">
                        Ceritakan keluhan dan waktu favorit Anda — sistem kami akan merekomendasikan fisioterapis yang paling sesuai beserta jadwal yang tersedia.
                      </p>

                      <Button onClick={() => goTo('patientType')} className="h-13 sm:h-14 px-8 sm:px-10 rounded-full bg-gradient-to-r from-[#b8935f] to-[#d4b378] hover:from-[#a8825a] hover:to-[#c4a368] text-[#0f1e3d] font-bold shadow-lg shadow-[#b8935f]/25 text-base sm:text-lg hover:scale-[1.02] transition-transform">
                        Mulai Smart Booking <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </div>
                  </div>

                  {/* How it works */}
                  <div className="max-w-4xl mx-auto px-4 -mt-8 sm:-mt-10 relative z-10 mb-12 sm:mb-16">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
                      {[
                        { icon: Stethoscope, title: 'Ceritakan Keluhan', desc: 'Pilih kondisi yang Anda rasakan' },
                        { icon: CalendarClock, title: 'Pilih Waktu Favorit', desc: 'Kapan & jam berapa Anda mau terapi' },
                        { icon: Wand2, title: 'Dapatkan Rekomendasi', desc: 'Terapis & slot jam terbaik otomatis' },
                      ].map((f, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-slate-200/70 p-5 sm:p-6 shadow-[0_20px_45px_-25px_rgba(15,30,61,0.35)] text-left">
                          <div className="w-11 h-11 rounded-xl bg-[#0f1e3d]/5 flex items-center justify-center mb-4">
                            <f.icon className="w-5 h-5 text-[#0f1e3d]" />
                          </div>
                          <p className="font-bold text-sm text-[#0f1e3d]">{f.title}</p>
                          <p className="text-xs text-slate-500 mt-1">{f.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Homecare CTA */}
                  <div className="max-w-4xl mx-auto px-4 pb-16 sm:pb-24">
                    <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0f1e3d] via-[#132348] to-[#0f1e3d] p-7 sm:p-9 shadow-[0_30px_70px_-25px_rgba(15,30,61,0.5)]">
                      <div className="absolute -top-20 -right-20 w-48 h-48 bg-[#b8935f]/10 rounded-full blur-3xl" />
                      <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-[#1e3a8a]/20 rounded-full blur-3xl" />

                      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="max-w-2xl text-left">
                          <div className="inline-flex items-center gap-1.5 mb-3">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#b8935f]" />
                            <p className="text-[11px] sm:text-xs font-bold tracking-[0.15em] text-[#b8935f] uppercase">Exclusive Service</p>
                          </div>
                          <h4 className="text-lg sm:text-xl font-bold text-white mb-2.5 sm:mb-3 tracking-tight">
                            Layanan Fisioterapi Homecare
                          </h4>
                          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                            Untuk reservasi layanan fisioterapi homecare, kami sarankan menghubungi Admin Kaffah Physiotherapy secara langsung agar penjadwalan dapat disesuaikan dengan kebutuhan dan ketersediaan terapis.
                          </p>
                        </div>

                        <button
                          onClick={handleHomecareWhatsApp}
                          className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#b8935f] to-[#d4b378] hover:from-[#a8825a] hover:to-[#c4a368] text-[#0f1e3d] px-6 sm:px-7 py-3 rounded-full text-sm font-bold shadow-lg shadow-[#b8935f]/20 transition-all duration-300 hover:scale-105 shrink-0"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Hubungi Admin via WhatsApp
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 'patientType' && (
                <SmartPatientTypeStep
                  key="patientType"
                  onBack={() => goTo('intro')}
                  onSelectNew={() => { setPatientType('new'); setExistingPatientId(null); goTo('patient'); }}
                  onSelectReturning={() => { setPatientType('returning'); goTo('patientSearch'); }}
                />
              )}

              {step === 'patient' && (
                <SmartPatientStep
                  key="patient"
                  initialData={patientData}
                  onBack={() => goTo('patientType')}
                  onNext={handleNewPatientSubmit}
                  submitting={matchingPatient}
                />
              )}

              {step === 'patientMatchConfirm' && matchCandidate && (
                <SmartPatientMatchConfirmStep
                  key="patientMatchConfirm"
                  candidate={matchCandidate}
                  onBack={() => goTo('patient')}
                  onConfirm={handleMatchConfirm}
                  onReject={handleMatchReject}
                />
              )}

              {step === 'patientSearch' && (
                <SmartReturningPatientStep
                  key="patientSearch"
                  onBack={() => goTo('patientType')}
                  onSwitchToNew={() => { setPatientType('new'); setExistingPatientId(null); goTo('patient'); }}
                  onNext={({ patientId, patientData: foundData, preferredTherapistIds: ids }) => {
                    setExistingPatientId(patientId);
                    setPatientData(foundData);
                    setPreferredTherapistIds(ids);
                    goTo('complaint');
                  }}
                />
              )}

              {step === 'complaint' && (
                <SmartComplaintStep
                  key="complaint"
                  initialSelection={complaintSlugs}
                  initialNote={complaintNote}
                  onBack={() => goTo(patientType === 'returning' ? 'patientSearch' : 'patient')}
                  onNext={(slugs, note) => { setComplaintSlugs(slugs); setComplaintNote(note); goTo('time'); }}
                />
              )}

              {step === 'time' && (
                <SmartTimePreferenceStep
                  key="time"
                  initialData={timePreference}
                  onBack={() => goTo('complaint')}
                  onNext={(pref) => { setTimePreference(pref); goTo('results'); }}
                />
              )}

              {step === 'results' && (
                <SmartResultsStep
                  key="results"
                  therapists={therapists}
                  complaintSlugs={complaintSlugs}
                  timePreference={timePreference}
                  preferredTherapistIds={preferredTherapistIds}
                  onBack={() => goTo('time')}
                  onSelectSlot={handleSelectSlot}
                />
              )}

              {step === 'confirm' && selectedPick && (
                <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-2xl mx-auto px-4 py-2 sm:py-4">
                  <Button variant="ghost" onClick={() => goTo('results')} className="pl-0 text-[#1e3a8a] mb-4 sm:mb-6 hover:bg-transparent"><ArrowLeft className="w-4 h-4 mr-2" /> Pilih Jadwal Lain</Button>
                  <div className="bg-white rounded-3xl shadow-[0_20px_60px_-25px_rgba(30,58,138,0.25)] overflow-hidden border border-slate-100">
                    <div className="bg-gradient-to-br from-[#1e3a8a] to-[#1e40af] p-7 sm:p-8 text-white text-center relative overflow-hidden">
                      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                      <div className="relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mx-auto mb-3">
                          <ClipboardCheck className="w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight">Review Booking</h2>
                        <p className="text-blue-100 text-sm mt-1">Pastikan data berikut sudah benar sebelum konfirmasi</p>
                      </div>
                    </div>
                    <div className="p-6 sm:p-8 space-y-1">
                      <div className="flex justify-between items-center py-3 border-b border-slate-100"><span className="text-slate-400 text-sm">Nama Pasien</span><span className="font-bold text-[#1e3a8a] text-right">{patientData?.full_name}</span></div>
                      <div className="flex justify-between items-center py-3 border-b border-slate-100"><span className="text-slate-400 text-sm">WhatsApp</span><span className="font-bold text-[#1e3a8a] text-right">{patientData?.phone}</span></div>
                      <div className="flex justify-between items-center py-3 border-b border-slate-100"><span className="text-slate-400 text-sm">Usia / Jenis Kelamin</span><span className="font-bold text-[#1e3a8a] text-right">{patientData?.age} tahun · {patientData?.gender === 'male' ? 'Laki-laki' : 'Perempuan'}</span></div>
                      <div className="flex justify-between items-center py-3 border-b border-slate-100"><span className="text-slate-400 text-sm">Fisioterapis</span><span className="font-bold text-[#1e3a8a] text-right">{selectedPick.therapist.name}</span></div>
                      <div className="flex justify-between items-center py-3 border-b border-slate-100"><span className="text-slate-400 text-sm">Waktu</span><span className="font-bold text-[#1e3a8a] text-right">{format(selectedPick.date, 'dd MMM yyyy', { locale: idLocale })} - {(selectedPick.slot.slot_start || '').slice(0, 5)}</span></div>
                      <div className="py-3"><span className="text-slate-400 text-sm block mb-1.5">Keluhan</span><div className="flex flex-wrap gap-1.5">{complaintSlugs.map(slug => (<span key={slug} className="text-xs font-semibold bg-slate-50 border border-slate-100 text-slate-700 px-2.5 py-1 rounded-full">{complaintLabel(slug)}</span>))}</div>{complaintNote && <p className="text-sm text-slate-600 mt-2 leading-relaxed">{complaintNote}</p>}</div>
                      <Button onClick={handleConfirmBooking} disabled={submitting} className="w-full h-14 text-base sm:text-lg font-bold bg-[#1e3a8a] hover:bg-[#172554] mt-6 rounded-full shadow-lg shadow-blue-900/20 hover:shadow-xl transition-all hover:-translate-y-0.5">{submitting ? <Loader2 className="animate-spin mr-2" /> : "Simpan & Konfirmasi via WhatsApp"}</Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </main>

      <footer className="bg-slate-900 text-slate-400 py-8 text-center text-sm">
        <p className="flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          © 2024 Kaffah Physiotherapy. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default SmartBookingPage;
