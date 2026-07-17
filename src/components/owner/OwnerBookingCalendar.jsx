import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, RefreshCw, ArrowLeft, ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from '@/components/ui/badge';
import { cn } from "@/lib/utils";
import { format, addDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

import { 
  getActivePhysiotherapists,  
  getAppointments,
  getAvailableSlots
} from '@/lib/api';

// Reuse Admin Components
import TherapistCard from '@/components/admin/booking/TherapistCard';
import SlotBookingForm from '@/components/admin/booking/SlotBookingForm';
import ManualBookingForm from '@/components/admin/booking/ManualBookingForm';
import BookedSlotDetailModal from '@/components/admin/booking/BookedSlotDetailModal';
import ScheduleTemplateModal from '@/components/admin/booking/ScheduleTemplateModal';

const OwnerBookingCalendar = () => {
  const navigate = useNavigate();
  const { userDetails } = useAuth();
  const { toast } = useToast();
  const [date, setDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBablastEnabled, setIsBablastEnabled] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  
  // Data State
  const [therapists, setTherapists] = useState([]);
  const [schedulesMap, setSchedulesMap] = useState({});
  const [appointments, setAppointments] = useState([]);
  const [therapistLeaveStatus, setTherapistLeaveStatus] = useState({});
  const [therapistLeaveReason, setTherapistLeaveReason] = useState({});

  // Modal State
  const [activeModal, setActiveModal] = useState(null); 

  useEffect(() => {
    loadInitialData();
    loadWaSettings();
  }, []);

  const loadWaSettings = async () => {
    if (!userDetails?.clinic_id) return;
    const { data } = await supabase
      .from('wa_settings')
      .select('id, enabled')
      .eq('clinic_id', userDetails.clinic_id)
      .maybeSingle();
    if (data) setIsBablastEnabled(data.enabled);
  };


  useEffect(() => {
    if (therapists.length > 0) {
      fetchDayData(date);
    }
  }, [date, therapists]);

  // Real-time subscription
  useEffect(() => {
    
    const leaveChannel = supabase
      .channel('public:therapist_time_off')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'therapist_time_off' }, 
        (payload) => {
          fetchDayData(date);
        }
      )
      .subscribe();

    const appChannel = supabase
      .channel('public:appointments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
           fetchDayData(date);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leaveChannel);
      supabase.removeChannel(appChannel);
    };
  }, [date]);

  const loadInitialData = async () => {
    setLoading(true);
    const response = await getActivePhysiotherapists();
    const data = response?.data || [];
    setTherapists(data);
    setLoading(false);
  };

  const fetchDayData = async (selectedDate) => {
    setIsRefreshing(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // === STEP 5: LOGGING START ===
      console.log(`[OwnerBookingCalendar] === FETCH START ===`);
      console.log(`[OwnerBookingCalendar] Fetching data for date: ${dateStr}`);
      console.log(`[OwnerBookingCalendar] Total Therapists: ${therapists.length}`);

      // 1️⃣ Appointments (DISPLAY ONLY)
      const appsRes = await getAppointments({
        startDate: `${dateStr}T00:00:00`,
        endDate: `${dateStr}T23:59:59`
      });
      setAppointments(appsRes?.data || []);

      // 2️⃣ SLOT + STATUS (SOURCE OF TRUTH)
      const { data, error } = await getAvailableSlots(dateStr);
      
      if (error) throw error;
      
      console.log('[OwnerBookingCalendar] RAW RPC RESPONSE:', data);
      console.log('[OwnerBookingCalendar] Response Length:', data?.length || 0);

      // 3️⃣ schedulesMap & Status Map
      const newSchedulesMap = {};
      const statusMap = {};

      // Initialize all therapists with default state
      therapists.forEach(t => {
         statusMap[t.id] = 'tidak_ada_jadwal'; // Default assumption
         newSchedulesMap[t.id] = [];
      });

      if (data && data.length > 0) {
          // Pass 1: Determine Status from RPC
          data.forEach(s => {
            if (s.therapist_id) {
               // Prioritize active or terisi statuses over 'tidak_ada_jadwal'
               if (s.status === 'aktif') {
                  statusMap[s.therapist_id] = 'aktif';
               } else if (s.status === 'terisi' && statusMap[s.therapist_id] !== 'aktif') {
                  statusMap[s.therapist_id] = 'terisi';
               } else if (statusMap[s.therapist_id] === 'tidak_ada_jadwal') {
                  statusMap[s.therapist_id] = s.status;
               }
            }
         });

          // Pass 2: Map Slots
          therapists.forEach(t => {
              // Include BOTH 'aktif' and 'terisi' slots so UI can show booked state
              const tSlots = data.filter(s => s.therapist_id === t.id && (s.status === 'aktif' || s.status === 'terisi'));
              newSchedulesMap[t.id] = tSlots.map(s => ({
                  id: s.id, 
                  therapist_id: t.id,
                  slot_start_time: s.slot_start,
                  slot_end_time: s.slot_end,
                  duration_minutes: s.duration_minutes || 60,
                  status: s.status // Pass status to card
              }));
          });
      }

      // 4️⃣ CEK LANGSUNG THERAPIST_TIME_OFF (agar hari tanpa slot tetap ketahuan cuti/libur)
      const reasonMap = {};
      const { data: timeOffRows } = await supabase
        .from('therapist_time_off')
        .select('therapist_id, reason')
        .lte('start_date', dateStr)
        .gte('end_date', dateStr);

      (timeOffRows || []).forEach(row => {
        const reasonLower = (row.reason || '').toLowerCase();
        statusMap[row.therapist_id] = reasonLower.includes('mingguan')
          ? 'libur_mingguan'
          : 'cuti';
        reasonMap[row.therapist_id] = row.reason || '';
      });

      // === LOGGING END ===
      console.log('[OwnerBookingCalendar] === MAPPING RESULT ===');
      console.log('[OwnerBookingCalendar] Schedules Map:', newSchedulesMap);
      console.log('[OwnerBookingCalendar] Status Map:', statusMap);
      
      setSchedulesMap(newSchedulesMap);
      setTherapistLeaveStatus(statusMap);
      setTherapistLeaveReason(reasonMap);

    } catch (error) {
      console.error('[OwnerBookingCalendar] fetchDayData ERROR:', error);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  // 🔁 Setelah booking / delete / edit berhasil
  const handleSuccess = () => {
    fetchDayData(date);
  };

  const handleViewHistory = async (patientId) => {
    if (!patientId) {
      toast({
        variant: "destructive",
        title: "Patient tidak ditemukan"
      });
      return;
    }

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        patient:patients(full_name),
        therapist:physiotherapists(name)
      `)
      .eq('patient_id', patientId)
      .order('appointment_date', { ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Gagal ambil history"
      });
      return;
    }

    setPatientHistory(data || []);
    setShowHistoryModal(true);
  };

  // ❌ Tutup modal
  const closeModal = () => {
    setActiveModal(null);
  };

  const handleViewHistory = async (patientId) => {
    if (!patientId) {
      toast({
        variant: "destructive",
        title: "Patient tidak ditemukan"
      });
      return;
    }

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        patient:patients(full_name),
        therapist:physiotherapists(name)
      `)
      .eq('patient_id', patientId)
      .order('appointment_date', { ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Gagal ambil history"
      });
      return;
    }

    setPatientHistory(data || []);
    setShowHistoryModal(true);
  };

  // 🧠 Ambil status therapist utk modal
  const getModalLeaveStatus = () => {
    if (!activeModal?.data?.therapist?.id) return 'aktif';
    return therapistLeaveStatus[activeModal.data.therapist.id] || 'aktif';
  };

  return (
    <div className="w-full px-4 md:px-6 xl:px-8 2xl:px-12 space-y-6 pb-12">
      <div className="flex items-center gap-4 mt-4 mb-4">
        <Button variant="ghost" className="gap-2 pl-0 hover:bg-transparent hover:text-blue-600" onClick={() => navigate('/owner')}>
           <ArrowLeft className="w-4 h-4" />
           Back to Dashboard
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-4 z-20 overflow-hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Booking Calendar</h1>
          <p className="text-slate-500 text-sm">Owner View: Manage Appointments</p>
        </div>

        <div className="flex items-center justify-between sm:justify-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 shrink-0">
          <span className="text-sm font-medium text-slate-700">WaAuto</span>
          <button
            onClick={async () => {
              if (!userDetails?.clinic_id) return;

              const { data: current } = await supabase
                .from('wa_settings')
                .select('id, enabled')
                .eq('clinic_id', userDetails.clinic_id)
                .maybeSingle();

              let result;
              if (current) {
                const newValue = !current.enabled;
                result = await supabase
                  .from('wa_settings')
                  .update({
                    enabled: newValue,
                    updated_at: new Date().toISOString(),
                    ...(newValue && { last_enabled_at: new Date().toISOString() })
                  })
                  .eq('id', current.id)
                  .select()
                  .single();
              } else {
                result = await supabase
                  .from('wa_settings')
                  .insert({
                    clinic_id: userDetails.clinic_id,
                    enabled: true,
                    last_enabled_at: new Date().toISOString()
                  })
                  .select()
                  .single();
              }

              const { data, error } = result;
              if (!error && data) {
                setIsBablastEnabled(data.enabled);
                toast({
                  title: data.enabled ? 'Bablast Aktif' : 'Bablast Nonaktif',
                  description: data.enabled ? 'WhatsApp otomatis diaktifkan' : 'WhatsApp otomatis dimatikan'
                });
              }
            }}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 ${
              isBablastEnabled ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 ${
                isBablastEnabled ? 'translate-x-8' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center gap-2 w-full min-w-0 overflow-hidden">
            <Button 
                variant="outline" 
                size="icon" 
                onClick={() => fetchDayData(date)} 
                disabled={isRefreshing}
                className={cn("mr-2", isRefreshing && "animate-spin")}
            >
                <RefreshCw className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-1 min-w-0 w-full overflow-hidden bg-slate-50 p-1 rounded-lg border border-slate-200">
            <Button 
  variant="ghost" 
  size="icon" 
  className="shrink-0"
  onClick={() => setDate(addDays(date, -1))}
>
                <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <Popover>
                <PopoverTrigger asChild>
                <Button 
  variant="outline" 
  className="flex-1 min-w-0 max-w-full overflow-hidden justify-center text-center font-medium border-none bg-transparent hover:bg-white shadow-none focus:ring-0 px-1"
>
  <CalendarIcon className="mr-1.5 h-4 w-4 text-slate-500 shrink-0" />
  <span className="text-xs leading-tight truncate">
    {format(date, "EEE, dd MMM yyyy", { locale: idLocale })}
  </span>
</Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                />
                </PopoverContent>
            </Popover>

            <Button variant="ghost" size="icon" onClick={() => setDate(addDays(date, 1))}>
                <ChevronRight className="w-4 h-4" />
            </Button>
            </div>

            {/* Tombol Template Jadwal */}
            <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => setShowTemplateModal(true)}
                title="Copy Template Jadwal Tersedia"
            >
                <ClipboardList className="h-4 w-4" />
            </Button>
        </div>
      </div>

      {loading ? (
         <div className="flex flex-col justify-center items-center h-64 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            <p className="text-slate-400">Loading schedules...</p>
         </div>
      ) : (
       <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
          {[...therapists]
  .sort((a, b) => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todayStr = format(now, 'yyyy-MM-dd');
    const selectedStr = format(date, 'yyyy-MM-dd');
    const isToday = selectedStr === todayStr;

    const getSortKey = (therapist) => {
      const slots = schedulesMap[therapist.id] || [];
      const leaveStatus = therapistLeaveStatus[therapist.id] || 'aktif';

      // Group 3: Tidak ada jadwal / cuti / non_active
      if (
        slots.length === 0 ||
        ['tidak_ada_jadwal', 'cuti', 'non_active'].includes(leaveStatus)
      ) {
        return { group: 3, time: '99:99' };
      }

      // Group 2: Full booked (semua slot terisi)
      const allFull = slots.every(s => s.status === 'terisi');
      if (allFull) {
        return { group: 2, time: '99:99' };
      }

      // Ambil slot aktif paling awal
      const aktifSlots = slots.filter(s => s.status === 'aktif' || !s.status);
      const sorted = [...aktifSlots].sort((x, y) =>
        (x.slot_start_time || '').localeCompare(y.slot_start_time || '')
      );
      const firstSlot = sorted[0]?.slot_start_time || '99:99';

      // Group 1: Hari ini dan jam slot sudah lewat
      if (isToday && firstSlot < currentTime) {
        return { group: 1, time: firstSlot };
      }

      // Group 0: Slot masih akan datang / bukan hari ini
      return { group: 0, time: firstSlot };
    };

    const keyA = getSortKey(a);
    const keyB = getSortKey(b);

    if (keyA.group !== keyB.group) return keyA.group - keyB.group;
    return keyA.time.localeCompare(keyB.time);
  })
  .map((therapist) => {
            const slots = schedulesMap[therapist.id] || [];
            const therapistApps = appointments.filter(a => a.therapist_id === therapist.id);
            const leaveStatus = therapistLeaveStatus[therapist.id] || 'aktif';

            return (
              <TherapistCard
                key={therapist.id}
                therapist={therapist}
                scheduleSlots={slots}
                appointments={therapistApps}
                date={date}
                leaveStatus={leaveStatus}
                leaveReason={therapistLeaveReason[therapist.id]}
                onSlotClick={(slot, t) => setActiveModal({ type: 'slot', data: { slot, therapist: t } })}
                onManualBooking={(t) => setActiveModal({ type: 'manual', data: { therapist: t } })}
                onAppointmentClick={(app) => setActiveModal({ type: 'detail', data: app })}
                onPatientClick={handleViewHistory}
              />
            );
          })}
        </div>
      )}

      <Dialog open={!!activeModal} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="w-full max-w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[90vh] overflow-y-auto bg-white p-4 sm:p-6">
          <DialogHeader className="mb-4">
             <DialogTitle>
                {activeModal?.type === 'slot' && 'Booking Slot'}
                {activeModal?.type === 'manual' && 'Booking Manual'}
                {activeModal?.type === 'detail' && 'Detail Appointment'}
             </DialogTitle>
             <DialogDescription>
                {activeModal?.type === 'slot' && 'Isi data pasien untuk konfirmasi slot ini.'}
                {activeModal?.type === 'manual' && 'Buat jadwal manual di luar slot tersedia.'}
                {activeModal?.type === 'detail' && 'Informasi detail jadwal yang sudah di-booking.'}
             </DialogDescription>
          </DialogHeader>

          {activeModal?.type === 'slot' && (
            <SlotBookingForm 
               slot={activeModal.data.slot} 
               therapist={activeModal.data.therapist} 
               date={date}
               leaveStatus={getModalLeaveStatus()}
               onClose={closeModal}
               onSuccess={handleSuccess}
            />
          )}

          {activeModal?.type === 'manual' && (
             <ManualBookingForm 
                therapist={activeModal.data.therapist} 
                date={date}
                leaveStatus={getModalLeaveStatus()}
                onClose={closeModal}
                onSuccess={handleSuccess}
             />
          )}

          {activeModal?.type === 'detail' && (
            <>
              <BookedSlotDetailModal
                appointment={activeModal.data}
                onClose={closeModal}
                onSuccess={handleSuccess}
             />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Riwayat Appointment</DialogTitle>
            <DialogDescription>
              History appointment pasien
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {patientHistory.filter(item => item.status !== 'cancelled').length > 0 ? (
              patientHistory
                .filter(item => item.status !== 'cancelled')
                .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date))
                .map((item) => {
                  const isUpcoming = new Date(item.appointment_date) > new Date();
                  return (
                    <div key={item.id} className="border rounded-xl p-4 bg-slate-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-800">
                            {item.patient?.full_name || '-'}
                          </p>
                          <p className="text-sm text-slate-500">
                            {item.therapist?.name || '-'}
                          </p>
                        </div>
                        <Badge
                          className={
                            isUpcoming
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-200 text-slate-700'
                          }
                        >
                          {isUpcoming ? 'Upcoming' : item.status || '-'}
                        </Badge>
                      </div>
                      <div className="mt-2 text-sm text-slate-600">
                        {item.appointment_date
                          ? format(
                              new Date(item.appointment_date),
                              'EEEE, dd MMMM yyyy HH:mm',
                              { locale: idLocale }
                            )
                          : '-'}
                      </div>
                      {item.notes && (
                        <div className="mt-2 text-sm italic text-slate-500">
                          {item.notes}
                        </div>
                      )}
                    </div>
                  );
                })
            ) : (
              <div className="text-center text-slate-500 py-10">
                Tidak ada history appointment
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ScheduleTemplateModal
        open={showTemplateModal}
        onOpenChange={setShowTemplateModal}
        date={date}
        therapists={therapists}
        schedulesMap={schedulesMap}
        therapistLeaveStatus={therapistLeaveStatus}
      />
    </div>
  );
};

export default OwnerBookingCalendar;