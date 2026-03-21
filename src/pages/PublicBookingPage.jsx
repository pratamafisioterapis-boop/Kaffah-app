import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, ArrowLeft, AlertTriangle, RefreshCw } from 'lucide-react';
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
          
          const onlinePatientPayload = {
              full_name: patientData.full_name,
              phone: patientData.phone,
              address: patientData.address || '',
              birth_date: patientData.birth_date, // Captured from new form
              medical_history: patientData.complaint,
              created_at: new Date().toISOString()
          };

          const { data: onlinePatient, error: onlineError } = await createOnlinePatient(onlinePatientPayload);
          if (onlineError) throw new Error(`Gagal menyimpan data pasien: ${onlineError.message}`);

          // 2. Create Appointment
          const therapist = therapists.find(t => t.id === selectedTherapistId);
          const timePart = selectedSlot.slot.slot_start_time.substring(0, 5);
          const appointmentDate = constructAppointmentDateTime(selectedDate, timePart);
          const serviceName = selectedService?.name || 'Physiotherapy';
          const combinedNotes = `[${serviceName}] Keluhan: ${patientData.complaint}`;

          const appointmentPayload = {
              therapist_id: selectedTherapistId,
              clinic_id: therapist.clinic_id,
              appointment_date: appointmentDate,
              duration_minutes: selectedSlot.duration,
              status: 'confirmed', 
              notes: combinedNotes,
              guest_name: patientData.full_name, 
              guest_phone: patientData.phone,
              guest_complaint: patientData.complaint,
              patient_id: undefined // Always undefined for online booking (handled as guest initially)
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
          window.open(`https://wa.me/6285245965745?text=${encodedMessage}`, '_blank');

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

  if (success) {
      return (
          <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white max-w-md w-full rounded-2xl shadow-xl p-8 text-center border-t-4 border-[#1e3a8a]">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-[#1e3a8a] mb-2">Booking Berhasil!</h2>
                  <p className="text-slate-600 mb-6">Terima kasih telah melakukan booking. Admin kami akan segera menghubungi Anda via WhatsApp.</p>
                  <Button onClick={() => window.location.href = '/'} className="w-full bg-[#1e3a8a] text-white rounded-full h-12 font-bold shadow-lg">Kembali ke Beranda</Button>
              </motion.div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white font-sans text-slate-900 flex flex-col">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = '/'}>
                {logoUrl ? <img src={logoUrl} alt="Logo" className="h-14 w-auto object-contain" /> : <div className="w-10 h-10 bg-[#1e3a8a] rounded flex items-center justify-center text-white font-bold">KC</div>}
                <span className="font-bold text-base text-[#1e3a8a] tracking-tight">KAFFAH PHYSIOTHERAPY</span>
            </div>
        </div>
      </header>

      <main className="flex-grow py-8">
          {fetchError ? (
             <div className="flex flex-col items-center justify-center p-12 text-center">
                 <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                     <AlertTriangle className="w-8 h-8 text-red-500" />
                 </div>
                 <h2 className="text-xl font-bold text-slate-800 mb-2">Maaf, Terjadi Kesalahan</h2>
                 <p className="text-slate-500 max-w-md mb-6">{fetchError}</p>
                 <Button onClick={fetchInitialData} className="gap-2">
                    <RefreshCw className="w-4 h-4" /> Coba Lagi
                 </Button>
             </div>
          ) : (
            <AnimatePresence mode="wait">
              {bookingStep === 'loading' && (
                  <div className="flex flex-col items-center justify-center py-20">
                      <Loader2 className="w-12 h-12 animate-spin text-[#1e3a8a] mb-4" />
                      <p className="text-slate-500">Memuat data...</p>
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
                  <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-3xl mx-auto px-4 py-8">
                      <Button variant="ghost" onClick={() => setBookingStep('therapist')} className="pl-0 text-[#1e3a8a] mb-6 hover:text-[#3b82f6]"><ArrowLeft className="w-4 h-4 mr-2" /> Kembali</Button>
                      <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
                          <h2 className="text-2xl font-bold text-[#1e3a8a] mb-6">Pilih Jadwal Konsultasi</h2>
                          <div className="mb-6">
  <label className="block text-sm font-medium text-slate-700 mb-2">
    Tanggal Terapi
  </label>

  <Input
    type="date"
    min={format(new Date(), 'yyyy-MM-dd')}
    value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
    onChange={(e) => setSelectedDate(parseISO(e.target.value))}
    className="h-12 text-lg"
  />

  {selectedDate && (
    <div className="mt-2 text-sm font-medium text-[#1e3a8a]">
      {format(selectedDate, 'dd/MM/yyyy')}
    </div>
  )}
</div>
                          {selectedDate && (
                              <div className="animate-in fade-in slide-in-from-top-4">
                                  <label className="block text-sm font-medium text-slate-700 mb-3">Waktu Tersedia</label>
                                  {fetchingSlots ? ( <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-[#1e3a8a]" /></div> ) : availableSlots.length > 0 ? (
                                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                          {availableSlots.map(slot => ( <Button key={slot.id} variant="outline" className="h-12 text-lg font-bold hover:bg-[#1e3a8a] hover:text-white transition-colors" onClick={() => handleSlotSelect(slot)}>{slot.time}</Button> ))}
                                      </div>
                                  ) : ( <div className="text-center py-8 text-slate-400">Tidak ada jadwal tersedia.</div> )}
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
                  <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-2xl mx-auto px-4 py-8">
                      <Button variant="ghost" onClick={() => setBookingStep('patient')} className="pl-0 text-[#1e3a8a] mb-6"><ArrowLeft className="w-4 h-4 mr-2" /> Edit Data</Button>
                      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
                          <div className="bg-[#1e3a8a] p-6 text-white text-center"><h2 className="text-2xl font-bold">Review Booking</h2><p className="text-blue-100">Pastikan data berikut sudah benar</p></div>
                          <div className="p-8 space-y-4">
                              <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Kategori Treatment</span><span className="font-bold text-[#1e3a8a] capitalize">{selectedTreatment}</span></div>
                              <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Layanan</span><span className="font-bold text-[#1e3a8a] capitalize">{selectedService?.name || 'Standard Session'}</span></div>
                              <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Fisioterapis</span><span className="font-bold text-[#1e3a8a]">{getSelectedTherapistName()}</span></div>
                              <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Waktu</span><span className="font-bold text-[#1e3a8a]">{format(selectedDate, 'dd MMM yyyy')} - {selectedSlot?.time}</span></div>
                              <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Nama Pasien</span><span className="font-bold text-[#1e3a8a]">{patientData?.full_name || "Nama tidak tersedia"}</span></div>
                              <div className="flex justify-between py-2 border-b"><span className="text-slate-500">WhatsApp</span><span className="font-bold text-[#1e3a8a]">{patientData?.phone}</span></div>
                              <div className="flex justify-between py-2 border-b"><span className="text-slate-500">Tanggal Lahir</span><span className="font-bold text-[#1e3a8a]">{patientData?.birth_date ? format(new Date(patientData.birth_date), 'dd MMM yyyy') : '-'}</span></div>
                              <div className="py-2"><span className="text-slate-500 block mb-1">Keluhan</span><p className="text-slate-800 bg-slate-50 p-3 rounded-lg text-sm">{patientData?.complaint}</p></div>
                              <Button onClick={handleConfirmBooking} disabled={submitting} className="w-full h-14 text-lg font-bold bg-[#1e3a8a] hover:bg-[#172554] mt-6 rounded-full shadow-lg hover:shadow-xl transition-all">{submitting ? <Loader2 className="animate-spin mr-2" /> : "Simpan & Konfirmasi via WhatsApp"}</Button>
                          </div>
                      </div>
                  </motion.div>
              )}
            </AnimatePresence>
          )}
      </main>
      <footer className="bg-slate-900 text-slate-400 py-8 text-center text-sm"><p>© 2024 Kaffah Physiotherapy. All rights reserved.</p></footer>
    </div>
  );
};

export default PublicBookingPage;