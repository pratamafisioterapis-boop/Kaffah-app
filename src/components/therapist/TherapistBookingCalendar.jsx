import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, RefreshCw, CalendarOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar"; 
import { cn } from "@/lib/utils";
import { format, addDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

import { 
  getAvailableSlots, 
  getAppointments,
  getTherapistLeaveStatus
} from '@/lib/api';

// Reuse Components
import TherapistCard from '@/components/admin/booking/TherapistCard';
import SlotBookingForm from '@/components/admin/booking/SlotBookingForm';
import ManualBookingForm from '@/components/admin/booking/ManualBookingForm';
import BookedSlotDetailModal from '@/components/admin/booking/BookedSlotDetailModal';

const TherapistBookingCalendar = ({ therapist }) => {
  const [date, setDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Data State
  const [scheduleSlots, setScheduleSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  
  // Leave Status State
  const [leaveStatus, setLeaveStatus] = useState(null);

  // Modal State
  const [activeModal, setActiveModal] = useState(null); 

  useEffect(() => {
    if (therapist) {
        fetchDayData(date);
    }
  }, [date, therapist]);

  const fetchDayData = async (selectedDate) => {
    if (!therapist) return;

    setIsRefreshing(true);
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // 1. Check Leave Status
      const leaveCheck = await getTherapistLeaveStatus(therapist.id, dateStr);
      setLeaveStatus(leaveCheck.isOnLeave ? leaveCheck.details : null);

      // 2. Get Appointments for the day
      const { data: apps } = await getAppointments({
        startDate: `${dateStr}T00:00:00`,
        endDate: `${dateStr}T23:59:59`,
        therapistId: therapist.id
      });
      setAppointments(apps || []);

      // 3. Get Available Slots using unified API
      if (!leaveCheck.isOnLeave) {
          const { data: slots } = await getAvailableSlots(dateStr, therapist.id);
          
          if (slots) {
              // Map API slots to component format if needed
              // IMPORTANT: Pass 'status' so the card can render booked slots correctly
              const mappedSlots = slots.map(s => ({
                id: `${s.therapist_id}_${s.slot_start}`,
                slot_start_time: s.slot_start,
                slot_end_time: s.slot_end,
                duration_minutes: s.duration_minutes,
                status: s.status
              }));
              
              setScheduleSlots(mappedSlots);
          } else {
             setScheduleSlots([]);
          }
      } else {
          setScheduleSlots([]);
      }

    } catch (error) {
      console.error("Failed to fetch day data", error);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    fetchDayData(date);
  };

  const closeModal = () => setActiveModal(null);
  
  // Handler wrappers to check leave status
  const handleSlotClick = (slot, t) => {
      if (leaveStatus) return; // Disabled
      setActiveModal({ type: 'slot', data: { slot, therapist: t } });
  };
  
  const handleManualBooking = (t) => {
      if (leaveStatus) return; // Disabled
      setActiveModal({ type: 'manual', data: { therapist: t } });
  };

  if (!therapist) return <div className="p-8 text-center text-slate-500">Loading therapist profile...</div>;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header & Date Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-4 z-20">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Booking Calendar Saya</h1>
          <p className="text-slate-500 text-sm">Kelola jadwal dan booking pasien</p>
        </div>
        
        <div className="flex items-center gap-2">
            <Button 
                variant="outline" 
                size="icon" 
                onClick={() => fetchDayData(date)} 
                disabled={isRefreshing}
                className={cn("mr-2", isRefreshing && "animate-spin")}
            >
                <RefreshCw className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <Button variant="ghost" size="icon" onClick={() => setDate(addDays(date, -1))}>
                <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <Popover>
                <PopoverTrigger asChild>
                <Button variant="outline" className={cn("min-w-[200px] justify-center text-center font-medium border-none bg-transparent hover:bg-white shadow-none focus:ring-0")}>
                    <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                    {format(date, "EEEE, dd MMMM yyyy", { locale: idLocale })}
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
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
         <div className="flex flex-col justify-center items-center h-64 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            <p className="text-slate-400">Memuat jadwal...</p>
         </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="col-span-full relative">
              
              {/* Overlay if On Leave */}
              {leaveStatus && (
                  <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300">
                      <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 text-center max-w-sm">
                          <CalendarOff className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                          <h3 className="text-lg font-bold text-slate-800">Sedang Cuti</h3>
                          <p className="text-slate-500 mt-1">Anda tidak dapat menerima booking pada tanggal ini.</p>
                          {leaveStatus.reason && (
                             <p className="text-xs text-slate-400 mt-2 italic">"{leaveStatus.reason}"</p>
                          )}
                      </div>
                  </div>
              )}
              
              <TherapistCard
                therapist={therapist}
                scheduleSlots={scheduleSlots}
                appointments={appointments}
                date={date}
                onSlotClick={handleSlotClick}
                onManualBooking={handleManualBooking}
                onAppointmentClick={(app) => setActiveModal({ type: 'detail', data: app })}
                leaveStatus={leaveStatus ? 'cuti' : 'aktif'}
              />
            </div>
        </div>
      )}

      {/* Global Modal Container */}
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
               onClose={closeModal}
               onSuccess={handleSuccess}
            />
          )}

          {activeModal?.type === 'manual' && (
             <ManualBookingForm 
                therapist={activeModal.data.therapist} 
                date={date}
                onClose={closeModal}
                onSuccess={handleSuccess}
             />
          )}

          {activeModal?.type === 'detail' && (
             <BookedSlotDetailModal 
                appointment={activeModal.data}
                onClose={closeModal}
                onSuccess={handleSuccess}
             />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TherapistBookingCalendar;