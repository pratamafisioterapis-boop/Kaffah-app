import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, ArrowLeft, AlertTriangle, RefreshCw, ShieldCheck, Stethoscope, User, CalendarDays, ClipboardCheck, Sparkles, Clock } from 'lucide-react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { 
  getActivePhysiotherapists, createAppointment, getAvailableSlots, 
  getClinicLogo, getWhatsAppScheduleConfig, getWhatsAppTemplates, createWhatsAppScheduleLog,
  createOnlinePatient
} from '@/lib/api';
import { constructAppointmentDateTime } from '@/lib/utils';
import TreatmentSelectionStep from '@/components/public/TreatmentSelectionStep';
import TherapistFilteredSelectionStep from '@/components/public/TherapistFilteredSelectionStep';
import PatientSelectionStep from '@/components/public/PatientSelectionStep';
import BookingSuccessScreen from '@/components/public/BookingSuccessScreen';

// Step metadata for the premium progress indicator (visual only, does not affect flow/logic)
const STEP_ORDER = [
  { key: 'treatment', label: 'Layanan', icon: Sparkles },
  { key: 'therapist', label: 'Terapis', icon: Stethoscope },
  { key: 'date', label: 'Jadwal', icon: CalendarDays },
  { key: 'patient', label: 'Data Diri', icon: User },
  { key: 'confirm', label: 'Konfirmasi', icon: ClipboardCheck },
];

const PublicBookingPage = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  
  // State Management
  const [bookingStep, setBookingStep] = useState('loading'); 
  const [selectedTreatment, setSelectedTreatment] = useState(null);
  const [selectedTherapistId, setSelectedTherapistId] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [patientData, setPatientData] = useState(null);
  
  // Data State
  const [therapists, setTherapists] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [logoUrl, setLogoUrl] = useState(null);
  
  // Loading & Error States
  const [fetchingSlots, setFetchingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Initial Data Load
  useEffect(() => {
    fetchInitialData();
  }, []);

  // URL Parameter Handling
  useEffect(() => {
    const urlTherapistId = searchParams.get('therapist_id');
    
    if (therapists.length > 0 && bookingStep === 'loading') {
      if (urlTherapistId) {
        const therapist = therapists.find(t => t.id === urlTherapistId);
        if (therapist) {
          let inferredTreatment = 'physiotherapy';
          if (therapist.services && Array.isArray(therapist.services) && therapist.services.length > 0) {
             const firstSvc = therapist.services[0];
             if (typeof firstSvc === 'string') inferredTreatment = firstSvc.toLowerCase().includes('recovery') ? 'recovery' : 'physiotherapy';
             else if (firstSvc.treatment_type) inferredTreatment = firstSvc.treatment_type;
          }
          
          setSelectedTreatment(inferredTreatment);
          handleTherapistSelect(therapist.id, true);
          return;
        }
      }
      
      setBookingStep('treatment');
    }
  }, [therapists, searchParams, bookingStep]);

  const fetchInitialData = async () => {
    setFetchError(null);
    try {
      const filterParams = { showOnBooking: true };
      const [therapistRes, logoRes] = await Promise.all([
          getActivePhysiotherapists(filterParams), 
          getClinicLogo()
      ]);

      if (therapistRes.error) throw new Error(therapistRes.error.message);

      if (therapistRes.data) {
        setTherapists(therapistRes.data);
      }
      
      if (logoRes.data?.file_url) setLogoUrl(logoRes.data.file_url);
      
      // If we successfully loaded data, move past loading step if still there
      if (bookingStep === 'loading') {
        setBookingStep('treatment');
      }

    } catch (error) {
      console.error("❌ Error fetching data:", error);
      setFetchError(error.message);
      toast({ variant: "destructive", title: "Gagal Memuat Data", description: "Silakan coba muat ulang." });
    }
  };

  const handleTreatmentSelect = (id) => {
      setSelectedTreatment(id);
      localStorage.setItem('selectedTreatment', id);
      setBookingStep('therapist');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getAutoSelectedService = (therapist, treatmentType) => {
      if (!therapist || !therapist.services || !Array.isArray(therapist.services)) return null;
      
      const exactMatch = therapist.services.find(s => 
          (typeof s === 'object' && s.treatment_type === treatmentType)
      );
      if (exactMatch) return exactMatch;

      const stringMatch = therapist.services.find(s => {
          const sName = typeof s === 'string' ? s : s.name;
          return sName && sName.toLowerCase().includes(treatmentType.toLowerCase());
      });
      
      if (stringMatch) {
          return typeof stringMatch === 'string' 
              ? { id: stringMatch, name: stringMatch, price: 0 } 
              : stringMatch;
      }

      if (therapist.services.length > 0) {
          const first = therapist.services[0];
           return typeof first === 'string' 
              ? { id: first, name: first, price: 0 } 
              : first;
      }

      return { id: 'default', name: 'Konsultasi Fisioterapi', price: 0 };
  };

  const handleTherapistSelect = (id, fromUrl = false) => {
      setSelectedTherapistId(id);
      
      const therapist = therapists.find(t => t.id === id);
      if (therapist) {
          const autoService = getAutoSelectedService(therapist, selectedTreatment || 'physiotherapy');
          setSelectedService(autoService);
      }

      setBookingStep('date');
      if (!fromUrl) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSlotSelect = (slot) => {
      setSelectedSlot(slot);
      setBookingStep('patient');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePatientComplete = (data) => {
      setPatientData(data);
      setBookingStep('confirm');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (bookingStep === 'date' && selectedDate && selectedTherapistId) {
      fetchSlotsForDate(selectedDate);
    }
  }, [selectedDate, selectedTherapistId, bookingStep]);

  const fetchSlotsForDate = async date => {
    setFetchingSlots(true);
    setAvailableSlots([]);
    setSelectedSlot(null);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const therapist = therapists.find(t => t.id === selectedTherapistId);
      if (!therapist) return;

      const { data: slots } = await getAvailableSlots(dateStr, therapist.id);
      
      if (slots) {
         // Filter for only 'aktif' slots for public booking
         const activeSlots = slots.filter(s => s.status === 'aktif');
         const sortedSlots = activeSlots.sort((a, b) => {
             const timeA = a.slot_start || "00:00";
             const timeB = b.slot_start || "00:00";
             return timeA.localeCompare(timeB);
         });
         
         const formattedSlots = sortedSlots.map(s => ({
            id: `${s.therapist_id}_${s.slot_start}`,
            therapist: therapist,
            slot: { slot_start_time: s.slot_start, slot_end_time: s.slot_end, duration_minutes: s.duration_minutes },
            time: (s.slot_start || "").slice(0, 5),
            duration: s.duration_minutes
         }));
         setAvailableSlots(formattedSlots);
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat jadwal." });
    } finally {
      setFetchingSlots(false);
    }
  };

  const handleConfirmBooking = async () => {
      setSubmitting(true);
      try {
          // 1. Create Patient Record in Online Staging
          if (!patientData.birth_date) throw new Error("Tanggal lahir wajib diisi.");
          
          

          // 2. Create Appointment
          const therapist = therapists.find(t => t.id === selectedTherapistId);
          const timePart = selectedSlot.time;
          const dateStr = format(selectedDate, 'yyyy-MM-dd');
const appointmentDate = `${dateStr}T${timePart}:00`;
          const serviceName = selectedService?.name || 'Physiotherapy';
          const combinedNotes = `[${serviceName}] Keluhan: ${patientData.complaint}`;

          const appointmentPayload = {
  therapistId: selectedTherapistId, // 🔥 FIX
  clinicId: therapist.clinic_id,
  appointmentDate: appointmentDate,
  durationMinutes: selectedSlot.duration,
  status: 'confirmed', 
  notes: combinedNotes,
  guestName: patientData.full_name, 
  guestPhone: patientData.phone,
  patientId: patientData?.patient_id || null
};

          const { error: apptError } = await createAppointment(appointmentPayload);
          if (apptError) throw new Error(`Gagal membuat janji temu: ${apptError.message}`);

          // 3. Auto Follow Up (Optional)
          // Intentionally skipping robust patient match for auto-follow up to prevent privacy leaks on public side
          // Can implement simple notification if needed

          setSuccess(true);

          // 4. Redirect to WhatsApp
          const message = `Halo Admin Kaffah Physiotherapy,\nSaya ingin konfirmasi booking:\n\nNama: ${patientData.full_name}\nLayanan: ${serviceName}\nTerapis: ${therapist.name}\nTanggal: ${format(selectedDate, 'dd MMM yyyy')}\nJam: ${selectedSlot.time}\n\nMohon diproses. Terima kasih.`;
          const encodedMessage = encodeURIComponent(message);
          window.open(`https://wa.me/6281233339435?text=${encodedMessage}`, '_blank');

      } catch (error) {
          console.error("Booking Error:", error);
          toast({ variant: "destructive", title: "Booking Gagal", description: error.message || "Terjadi kesalahan saat memproses data." });
      } finally {
          setSubmitting(false);
      }
  };

  const getFilteredTherapists = () => {
    return therapists.filter(t => {
      if (!t.is_active || !t.show_on_booking) return false;
      if (selectedTreatment) {
        if (!t.services || !Array.isArray(t.services) || t.services.length === 0) return false;
        const hasMatchingService = t.services.some(s => {
           if (typeof s === 'string') return s.toLowerCase().includes(selectedTreatment.toLowerCase());
           if (typeof s === 'object') return s.treatment_type === selectedTreatment || (s.name && s.name.toLowerCase().includes(selectedTreatment.toLowerCase()));
           return false;
        });
        return hasMatchingService;
      }
      return true;
    });
  };

  const getSelectedTherapistName = () => therapists.find(t => t.id === selectedTherapistId)?.name;

  // ---- Premium Step Progress Indicator (visual-only addition, no flow change) ----
  const currentStepIndex = STEP_ORDER.findIndex(s => s.key === bookingStep);
  const StepProgress = () => {
    if (currentStepIndex === -1) return null;
    return (
      <div className="w-full max-w-3xl mx-auto px-4 mb-6 sm:mb-10">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-4 left-0 right-0 h-[2px] bg-slate-200 mx-4 sm:mx-6 -z-0" />
          <div
            className="absolute top-4 left-0 h-[2px] bg-gradient-to-r from-[#1e3a8a] to-[#3b82f6] mx-4 sm:mx-6 -z-0 transition-all duration-500"
            style={{ width: `calc(${(currentStepIndex / (STEP_ORDER.length - 1)) * 100}% - ${currentStepIndex === 0 ? '0px' : '0px'})`, maxWidth: 'calc(100% - 2rem)' }}
          />
          {STEP_ORDER.map((step, idx) => {
            const Icon = step.icon;
            const isDone = idx < currentStepIndex;
            const isActive = idx === currentStepIndex;
            return (
              <div key={step.key} className="relative z-10 flex flex-col items-center gap-1.5 flex-1">
                <div
                  className={
                    "w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-sm " +
                    (isDone
                      ? "bg-[#1e3a8a] border-[#1e3a8a] text-white"
                      : isActive
                      ? "bg-white border-[#1e3a8a] text-[#1e3a8a] ring-4 ring-blue-100"
                      : "bg-white border-slate-200 text-slate-300")
                  }
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </div>
                <span className={"text-[10px] sm:text-xs font-semibold tracking-tight text-center hidden xs:block sm:block " + (isActive ? "text-[#1e3a8a]" : isDone ? "text-slate-500" : "text-slate-300")}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (success) {
      return <BookingSuccessScreen />;
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
                    <ShieldCheck className="w-3 h-3 text-emerald-500" /> Sistem Booking Online Terpercaya
                  </span>
                </div>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-3.5 py-1.5">
              <Clock className="w-3.5 h-3.5 text-[#1e3a8a]" /> Proses cepat &lt; 2 menit
            </div>
        </div>
      </header>

      <main className="flex-grow py-6 sm:py-10">
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
          ) : (
            <>
              <StepProgress />
              <AnimatePresence mode="wait">
                {bookingStep === 'loading' && (
                    <div className="flex flex-col items-center justify-center py-24">
                        <div className="relative mb-5">
                          <div className="absolute inset-0 rounded-full bg-blue-200/40 blur-xl" />
                          <Loader2 className="w-11 h-11 animate-spin text-[#1e3a8a] relative" />
                        </div>
                        <p className="text-slate-400 font-medium">Menyiapkan sistem booking...</p>
                    </div>
                )}

                {bookingStep === 'treatment' && ( 
                   <TreatmentSelectionStep key="step1" initialSelection={selectedTreatment} onSelect={handleTreatmentSelect} /> 
                )}

                {bookingStep === 'therapist' && ( 
                   <TherapistFilteredSelectionStep 
                      key="step2" 
                      therapists={getFilteredTherapists()} 
                      selectedTreatment={selectedTreatment} 
                      selectedTherapistId={selectedTherapistId} 
                      onSelect={(id) => handleTherapistSelect(id, false)} 
                      onBack={() => setBookingStep('treatment')} 
                   /> 
                )}

                {bookingStep === 'date' && (
                    <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-3xl mx-auto px-4 py-2 sm:py-4">
                        <Button variant="ghost" onClick={() => setBookingStep('therapist')} className="pl-0 text-[#1e3a8a] mb-4 sm:mb-6 hover:text-[#3b82f6] hover:bg-transparent"><ArrowLeft className="w-4 h-4 mr-2" /> Kembali</Button>
                        <div className="bg-white rounded-3xl shadow-[0_20px_60px_-25px_rgba(30,58,138,0.25)] p-6 sm:p-8 md:p-10 border border-slate-100">
                            <div className="flex items-center gap-3 mb-6 sm:mb-8">
                              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#1e3a8a] to-[#3b82f6] flex items-center justify-center text-white shrink-0 shadow-md shadow-blue-900/20">
                                <CalendarDays className="w-5 h-5" />
                              </div>
                              <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-[#1e3a8a] tracking-tight">Pilih Jadwal Konsultasi</h2>
                                <p className="text-sm text-slate-400">Tentukan tanggal dan jam yang paling sesuai untuk Anda</p>
                              </div>
                            </div>
                            <div className="mb-6 sm:mb-8">
  <label className="block text-sm font-semibold text-slate-700 mb-2">
    Tanggal Terapi
  </label>

  <Input
    type="date"
    min={format(new Date(), 'yyyy-MM-dd')}
    value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
    onChange={(e) => setSelectedDate(parseISO(e.target.value))}
    className="h-12 sm:h-14 text-base sm:text-lg rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-[#1e3a8a]/40"
  />

  {selectedDate && (
    <div className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1e3a8a] bg-blue-50 px-3 py-1 rounded-full">
      <CalendarDays className="w-3.5 h-3.5" />
      {format(selectedDate, 'dd/MM/yyyy')}
    </div>
  )}
</div>
                            {selectedDate && (
                                <div className="animate-in fade-in slide-in-from-top-4">
                                    <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-3">
                                      <Clock className="w-4 h-4 text-[#1e3a8a]" /> Waktu Tersedia
                                    </label>
                                    {fetchingSlots ? ( <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-[#1e3a8a]" /></div> ) : availableSlots.length > 0 ? (
                                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 sm:gap-3">
                                            {availableSlots.map(slot => ( <Button key={slot.id} variant="outline" className="h-12 sm:h-13 text-base sm:text-lg font-bold rounded-xl border-slate-200 hover:bg-[#1e3a8a] hover:text-white hover:border-[#1e3a8a] transition-all hover:-translate-y-0.5 hover:shadow-md" onClick={() => handleSlotSelect(slot)}>{slot.time}</Button> ))}
                                        </div>
                                    ) : ( <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">Tidak ada jadwal tersedia untuk tanggal ini.</div> )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {bookingStep === 'patient' && (
    <PatientSelectionStep
      key="step4"
      onBack={() => setBookingStep('date')}
      onComplete={handlePatientComplete}
      selectedDate={selectedDate}
      selectedTherapistName={getSelectedTherapistName()}
      selectedSlot={selectedSlot}
    />
  )}

                {bookingStep === 'confirm' && (
                    <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-2xl mx-auto px-4 py-2 sm:py-4">
                        <Button variant="ghost" onClick={() => setBookingStep('patient')} className="pl-0 text-[#1e3a8a] mb-4 sm:mb-6 hover:bg-transparent"><ArrowLeft className="w-4 h-4 mr-2" /> Edit Data</Button>
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
                                <div className="flex justify-between items-center py-3 border-b border-slate-100"><span className="text-slate-400 text-sm">Kategori Treatment</span><span className="font-bold text-[#1e3a8a] capitalize text-right">{selectedTreatment}</span></div>
                                <div className="flex justify-between items-center py-3 border-b border-slate-100"><span className="text-slate-400 text-sm">Layanan</span><span className="font-bold text-[#1e3a8a] capitalize text-right">{selectedService?.name || 'Standard Session'}</span></div>
                                <div className="flex justify-between items-center py-3 border-b border-slate-100"><span className="text-slate-400 text-sm">Fisioterapis</span><span className="font-bold text-[#1e3a8a] text-right">{getSelectedTherapistName()}</span></div>
                                <div className="flex justify-between items-center py-3 border-b border-slate-100"><span className="text-slate-400 text-sm">Waktu</span><span className="font-bold text-[#1e3a8a] text-right">{format(selectedDate, 'dd MMM yyyy')} - {selectedSlot?.time}</span></div>
                                <div className="flex justify-between items-center py-3 border-b border-slate-100"><span className="text-slate-400 text-sm">Nama Pasien</span><span className="font-bold text-[#1e3a8a] text-right">{patientData?.full_name || "Nama tidak tersedia"}</span></div>
                                <div className="flex justify-between items-center py-3 border-b border-slate-100"><span className="text-slate-400 text-sm">WhatsApp</span><span className="font-bold text-[#1e3a8a] text-right">{patientData?.phone}</span></div>
                                <div className="flex justify-between items-center py-3 border-b border-slate-100"><span className="text-slate-400 text-sm">Tanggal Lahir</span><span className="font-bold text-[#1e3a8a] text-right">{patientData?.birth_date ? format(new Date(patientData.birth_date), 'dd MMM yyyy') : '-'}</span></div>
                                <div className="py-3"><span className="text-slate-400 text-sm block mb-1.5">Keluhan</span><p className="text-slate-700 bg-slate-50 p-4 rounded-xl text-sm border border-slate-100">{patientData?.complaint}</p></div>
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

export default PublicBookingPage;
