import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Calendar, User, Phone, MapPin, Search, 
  CheckCircle2, Clock, AlertCircle, Loader2, RefreshCw, CalendarOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import SearchableSelect from '@/components/ui/searchable-select';
import { 
  getTherapistSchedules, 
  getAppointments, 
  createAppointment,
  getPatients,
  getTherapistLeaveStatus // New import
} from '@/lib/api';
import { format, parseISO, addDays } from 'date-fns';
import { constructAppointmentDateTime, formatTimeIndonesia } from '@/lib/utils';
import { id as idLocale } from 'date-fns/locale';

const TherapistAppointmentScheduler = ({ therapist }) => {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [patientsLoading, setPatientsLoading] = useState(false);
  
  // Data State
  const [patients, setPatients] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  
  // Selection State
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState(location.state?.selectedSlot || null);
  const [bookingType, setBookingType] = useState('registered'); // 'registered' or 'guest'
  
  // Leave State
  const [leaveStatus, setLeaveStatus] = useState(null);

  // Form State
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [guestData, setGuestData] = useState({
    name: '',
    phone: '',
    address: '',
    complaint: ''
  });

  useEffect(() => {
    if (therapist) {
      loadInitialData();
    }
  }, [therapist]);

  useEffect(() => {
    if (therapist && schedules.length > 0) {
      loadSlotsForDate(selectedDate);
    }
  }, [selectedDate, schedules]);

  const loadInitialData = async () => {
    setLoading(true);
    // Load patients separately to handle its specific loading state
    loadPatients();

    try {
      const { data } = await getTherapistSchedules(therapist.id);
      if (data) setSchedules(data);
    } catch (error) {
      console.error("Failed to load schedules", error);
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat jadwal terapis." });
    } finally {
      setLoading(false);
    }
  };

  const loadPatients = async () => {
    setPatientsLoading(true);
    try {
      const { data, error } = await getPatients();
      if (error) throw error;
      setPatients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load patients", error);
      toast({ 
        variant: "destructive", 
        title: "Gagal Memuat Pasien", 
        description: "Tidak dapat mengambil data pasien. Silakan coba lagi." 
      });
      setPatients([]);
    } finally {
      setPatientsLoading(false);
    }
  };

  const loadSlotsForDate = async (date) => {
    // TASK 5: Check Leave Status first
    const leaveCheck = await getTherapistLeaveStatus(therapist.id, date);
    if (leaveCheck.isOnLeave) {
        setLeaveStatus(leaveCheck);
        setAvailableSlots([]);
        setSelectedSlot(null);
        return; // Stop slot loading
    } else {
        setLeaveStatus(null);
    }

    const dayOfWeek = date.getDay();
    const dateStr = format(date, 'yyyy-MM-dd');
    const daySchedule = schedules.find(s => s.day_of_week === dayOfWeek);

    if (!daySchedule || !daySchedule.therapist_slots) {
      setAvailableSlots([]);
      return;
    }

    // Check existing appointments
    const { data: appointments } = await getAppointments({
      startDate: `${dateStr}T00:00:00`,
      endDate: `${dateStr}T23:59:59`,
      therapistId: therapist.id
    });

    const slots = daySchedule.therapist_slots.filter(slot => {
       const isBooked = appointments?.some(apt => {
          // Use formatTimeIndonesia to properly extract Jakarta time from UTC appointment
          const aptTime = formatTimeIndonesia(apt.appointment_date); // "HH:mm"
          const slotStartShort = slot.slot_start_time.substring(0, 5); // "HH:mm"
          
          return aptTime === slotStartShort && apt.status !== 'cancelled';
       });
       return !isBooked;
    }).sort((a,b) => a.slot_start_time.localeCompare(b.slot_start_time));

    setAvailableSlots(slots);
  };

  const handleBook = async () => {
    // Double check leave before booking
    if (leaveStatus?.isOnLeave) {
        toast({ variant: "destructive", title: "Gagal", description: "Tidak bisa membuat appointment saat sedang cuti." });
        return;
    }

    if (!selectedSlot) return;

    if (bookingType === 'registered' && !selectedPatientId) {
      toast({ variant: "destructive", title: "Pilih Pasien", description: "Silakan pilih pasien terdaftar." });
      return;
    }
    if (bookingType === 'guest' && (!guestData.name || !guestData.phone)) {
       toast({ variant: "destructive", title: "Data Tamu Kurang", description: "Nama dan No HP wajib diisi." });
       return;
    }

    setLoading(true);
    try {
       // DEBUG: Log input time
       const slotTime = selectedSlot.slot_start_time.substring(0, 5);
       console.log(`[Scheduler] Selected Date: ${format(selectedDate, 'yyyy-MM-dd')}, Time: ${slotTime} (Asia/Jakarta)`);

       // Use centralized utility to handle +07:00 construction
       const appointmentDate = constructAppointmentDateTime(selectedDate, slotTime);
       console.log(`[Scheduler] Constructed ISO (UTC): ${appointmentDate}`);

       if (!appointmentDate) {
           throw new Error("Gagal mengonversi waktu booking (Invalid Date).");
       }

       // Calculate duration preference: Slot Duration > Calculated Duration
       let duration = selectedSlot.duration_minutes;
       if (!duration) {
            const startH = parseInt(selectedSlot.slot_start_time.split(':')[0]);
            const startM = parseInt(selectedSlot.slot_start_time.split(':')[1]);
            const endH = parseInt(selectedSlot.slot_end_time.split(':')[0]);
            const endM = parseInt(selectedSlot.slot_end_time.split(':')[1]);
            duration = (endH * 60 + endM) - (startH * 60 + startM);
       }

       const payload = {
         therapist_id: therapist.id,
         clinic_id: therapist.clinic_id,
         appointment_date: appointmentDate, // SENDING UTC ISO DIRECTLY
         duration_minutes: duration,
         status: 'confirmed', // Therapist booked, so confirmed
         notes: guestData.complaint || 'Booked by therapist',
         
         // Guest Info
         guest_name: bookingType === 'guest' ? guestData.name : null,
         guest_phone: bookingType === 'guest' ? guestData.phone : null,
         guest_address: bookingType === 'guest' ? guestData.address : null,
         guest_complaint: bookingType === 'guest' ? guestData.complaint : null,
         
         // Patient Info
         patient_id: bookingType === 'registered' ? selectedPatientId : null
       };

       console.log("[Scheduler] Payload to submit:", payload);

       const { data, error } = await createAppointment(payload);
       if (error) throw error;
       
       console.log("[Scheduler] Success response:", data);

       toast({ title: "Appointment Berhasil Dibuat!", className: "bg-green-50 border-green-200" });
       navigate('/therapist/appointments');

    } catch (error) {
       console.error("[Scheduler] Booking Error:", error);
       const errorMsg = error.message || "Terjadi kesalahan sistem.";
       
       if (error.code === 'PGRST203') {
           toast({ variant: "destructive", title: "System Error", description: "Konflik fungsi database (PGRST203). Hubungi admin." });
       } else if (errorMsg.includes('Slot sudah di-booking') || error.code === 'P0001') {
           toast({ variant: "destructive", title: "Jadwal Bentrok", description: "Slot waktu ini sudah terisi. Silakan pilih waktu lain." });
       } else {
           toast({ variant: "destructive", title: "Gagal Membuat Appointment", description: errorMsg });
       }
    } finally {
       setLoading(false);
    }
  };

  // Prepare options for SearchableSelect
  const patientOptions = useMemo(() => {
    return patients.map(p => ({
      value: p.id,
      label: `${p.full_name} (${p.medical_record_number})`,
      description: p.phone || 'No phone'
    }));
  }, [patients]);

  if (!therapist) {
    return <div className="p-4 text-center text-slate-500">Data terapis tidak ditemukan.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
       <div>
         <h2 className="text-2xl font-bold text-slate-900">Jadwalkan Pasien</h2>
         <p className="text-slate-500">Buat appointment baru untuk pasien.</p>
       </div>

       <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Date & Slot Selection */}
          <div className="space-y-6">
             <Card>
               <CardHeader><CardTitle className="text-sm">1. Pilih Tanggal</CardTitle></CardHeader>
               <CardContent>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {[...Array(14)].map((_, i) => {
                       const date = addDays(new Date(), i);
                       const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                       return (
                         <button
                           key={i}
                           onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                           className={`flex-shrink-0 w-14 h-16 rounded-lg flex flex-col items-center justify-center border transition-all ${
                              isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 hover:border-blue-300'
                           }`}
                         >
                            <span className="text-[10px] uppercase">{format(date, 'EEE', {locale: idLocale})}</span>
                            <span className="font-bold text-lg">{format(date, 'd')}</span>
                         </button>
                       )
                    })}
                  </div>
               </CardContent>
             </Card>

             <Card>
               <CardHeader><CardTitle className="text-sm">2. Pilih Slot Waktu (WIB)</CardTitle></CardHeader>
               <CardContent>
                  {/* TASK 5: Leave Error State */}
                  {leaveStatus?.isOnLeave ? (
                     <div className="text-center py-8 bg-amber-50 rounded-lg border border-amber-100">
                         <CalendarOff className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                         <p className="text-amber-800 font-semibold">Anda Sedang Cuti</p>
                         <p className="text-xs text-amber-600 px-4 mt-1">
                             Tidak bisa menerima appointment pada tanggal ini.
                             <br/>Cuti sampai: {format(new Date(leaveStatus.endDate), 'd MMM yyyy')}
                         </p>
                     </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="text-center py-4 text-slate-400 text-sm">Tidak ada slot tersedia.</div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                       {availableSlots.map((slot, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedSlot(slot)}
                            className={`py-2 px-1 rounded text-sm border transition-all flex flex-col items-center justify-center gap-1 ${
                               selectedSlot?.id === slot.id ? 'bg-blue-100 border-blue-500 text-blue-700 font-medium' : 'bg-white border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                             <span className="font-bold">{slot.slot_start_time.slice(0,5)}</span>
                             <span className="text-[10px] text-slate-500">{slot.duration_minutes || 60}m</span>
                          </button>
                       ))}
                    </div>
                  )}
               </CardContent>
             </Card>
          </div>

          {/* Right: Patient Data Form */}
          <div className="space-y-6">
             <Card className="h-full">
               <CardHeader><CardTitle className="text-sm">3. Data Pasien</CardTitle></CardHeader>
               <CardContent className="space-y-4">
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                     <button 
                       className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${bookingType === 'registered' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                       onClick={() => setBookingType('registered')}
                       disabled={!!leaveStatus?.isOnLeave}
                     >
                       Pasien Terdaftar
                     </button>
                     <button 
                       className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${bookingType === 'guest' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                       onClick={() => setBookingType('guest')}
                       disabled={!!leaveStatus?.isOnLeave}
                     >
                       Pasien Baru / Tamu
                     </button>
                  </div>

                  {bookingType === 'registered' ? (
                     <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Cari Pasien</label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs" 
                            onClick={loadPatients}
                            disabled={patientsLoading || !!leaveStatus?.isOnLeave}
                          >
                            <RefreshCw className={`w-3 h-3 mr-1 ${patientsLoading ? 'animate-spin' : ''}`} />
                            Reload
                          </Button>
                        </div>
                        
                        <SearchableSelect 
                          options={patientOptions}
                          value={selectedPatientId}
                          onChange={setSelectedPatientId}
                          placeholder="Cari nama pasien..."
                          notFoundText="Tidak ada pasien ditemukan."
                          isLoading={patientsLoading}
                          disabled={patientsLoading || !!leaveStatus?.isOnLeave}
                        />
                        {patients.length === 0 && !patientsLoading && (
                           <p className="text-xs text-red-500 mt-1">
                             Gagal memuat daftar pasien. Coba reload.
                           </p>
                        )}
                     </div>
                  ) : (
                     <div className="space-y-3">
                        <Input 
                          placeholder="Nama Lengkap" 
                          value={guestData.name}
                          onChange={e => setGuestData({...guestData, name: e.target.value})}
                          disabled={!!leaveStatus?.isOnLeave}
                        />
                        <Input 
                          placeholder="Nomor HP/WA" 
                          value={guestData.phone}
                          onChange={e => setGuestData({...guestData, phone: e.target.value})}
                          disabled={!!leaveStatus?.isOnLeave}
                        />
                        <Input 
                          placeholder="Alamat" 
                          value={guestData.address}
                          onChange={e => setGuestData({...guestData, address: e.target.value})}
                          disabled={!!leaveStatus?.isOnLeave}
                        />
                        <Textarea 
                          placeholder="Keluhan Utama" 
                          value={guestData.complaint}
                          onChange={e => setGuestData({...guestData, complaint: e.target.value})}
                          disabled={!!leaveStatus?.isOnLeave}
                        />
                     </div>
                  )}

                  <div className="pt-4 mt-auto">
                     <Button 
                       className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                       disabled={loading || !selectedSlot || (bookingType === 'registered' && !selectedPatientId) || !!leaveStatus?.isOnLeave}
                       onClick={handleBook}
                     >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {leaveStatus?.isOnLeave ? 'Tidak Tersedia (Cuti)' : 'Konfirmasi Jadwal'}
                     </Button>
                  </div>
               </CardContent>
             </Card>
          </div>
       </div>
    </div>
  );
};

export default TherapistAppointmentScheduler;