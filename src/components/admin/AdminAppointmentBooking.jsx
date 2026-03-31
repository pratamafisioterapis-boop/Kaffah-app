import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, isValid } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';

import {
  getActivePhysiotherapists,
  getAppointments,
  getPhysiotherapistByUserId,
  getAvailableSlots
} from '@/lib/api';

import TherapistCard from './booking/TherapistCard';
import SlotBookingForm from './booking/SlotBookingForm';
import ManualBookingForm from './booking/ManualBookingForm';
import BookedSlotDetailModal from './booking/BookedSlotDetailModal';

const AdminAppointmentBooking = () => {
  const { user, userDetails } = useAuth();
  const { toast } = useToast();

  const [date, setDate] = useState(() => {
  const saved = localStorage.getItem('appointment_date');
  return saved ? new Date(saved) : new Date();
});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [therapists, setTherapists] = useState([]);
  const [therapistLeaveStatus, setTherapistLeaveStatus] = useState({});
  const [schedulesMap, setSchedulesMap] = useState({});
  const [appointments, setAppointments] = useState([]);
  const [activeModal, setActiveModal] = useState(null);
const formattedDate = date
  ? format(date, "EEE, dd MMM yy", { locale: idLocale })
  : '';
  useEffect(() => {
    loadInitialData();
  }, [user, userDetails]);

  useEffect(() => {
  if (date) {
    localStorage.setItem('appointment_date', date.toISOString());
  }
}, [date]);

  useEffect(() => {
    if (therapists.length > 0) {
      fetchDayData(date);
    }
  }, [date, therapists]);

  useEffect(() => {
    const leaveChannel = supabase
      .channel('public:therapist_time_off')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'therapist_time_off' }, () => fetchDayData(date))
      .subscribe();

    const appChannel = supabase
      .channel('public:appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchDayData(date))
      .subscribe();

    return () => {
      supabase.removeChannel(leaveChannel);
      supabase.removeChannel(appChannel);
    };
  }, [date]);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (userDetails?.role === 'therapist' || userDetails?.role === 'physiotherapist') {
        const { data } = await getPhysiotherapistByUserId(user.id);
        setTherapists(data ? [data] : []);
      } else {
        const { data } = await getActivePhysiotherapists();
        setTherapists(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setError("Gagal memuat data fisioterapis.");
    }

    setLoading(false);
  };

  const fetchDayData = async (selectedDate) => {
    if (!selectedDate || !isValid(selectedDate)) return;

    setIsRefreshing(true);
    setError(null);

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      const { data: apps } = await getAppointments({
        startDate: `${dateStr}T00:00:00`,
        endDate: `${dateStr}T23:59:59`
      });

      setAppointments(Array.isArray(apps) ? apps : []);

      const { data: slots } = await getAvailableSlots(dateStr);

      const newSchedulesMap = {};
      const statusMap = {};

      therapists.forEach(t => {
        statusMap[t.id] = 'tidak_ada_jadwal';
        newSchedulesMap[t.id] = [];
      });

      if (Array.isArray(slots)) {
        slots.forEach(s => {
          if (!s.therapist_id) return;

          if (s.status === 'aktif') {
            statusMap[s.therapist_id] = 'aktif';
          }

          const slotObj = {
            id: `${s.therapist_id}_${s.slot_start}`,
            slot_start_time: s.slot_start,
            slot_end_time: s.slot_end,
            duration_minutes: s.duration_minutes || 60,
            status: s.status
          };

          newSchedulesMap[s.therapist_id].push(slotObj);
        });
        Object.keys(newSchedulesMap).forEach((therapistId) => {
  newSchedulesMap[therapistId].sort((a, b) =>
    a.slot_start_time.localeCompare(b.slot_start_time)
  );
});
      }

      setSchedulesMap(newSchedulesMap);
      setTherapistLeaveStatus(statusMap);

    } catch (err) {
      setError("Gagal memuat jadwal.");
      toast({
        variant: "destructive",
        title: "Gagal Memuat Data",
        description: err.message
      });
    }

    setIsRefreshing(false);
    setLoading(false);
  };

  const closeModal = () => setActiveModal(null);

  const handleSuccess = () => {
    setTimeout(() => fetchDayData(date), 200);
  };

  const getModalLeaveStatus = () => {
    if (!activeModal?.data?.therapist?.id) return 'aktif';
    return therapistLeaveStatus[activeModal.data.therapist.id] || 'aktif';
  };

  return (
    <div className="w-full max-w-full px-3 sm:px-4 md:px-6 xl:px-8 2xl:px-12 space-y-6 pb-12">

      {/* HEADER */}
<div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6 sticky top-2 sm:top-4 z-20 overflow-hidden">
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">

    {/* LEFT SIDE */}
    <div>
      <h1 className="text-2xl font-bold text-slate-800">
        Booking Appointment
      </h1>
      <p className="text-slate-500 text-sm">
        Kelola jadwal dan booking pasien secara real-time
      </p>
    </div>

    {/* RIGHT SIDE */}
    <div className="flex items-center gap-3 ml-auto w-full md:w-auto min-w-0 overflow-hidden">

      {/* Refresh */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => fetchDayData(date)}
        disabled={isRefreshing}
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
      </Button>

      {/* Date Controller */}
      <div className="flex items-center gap-1 min-w-0 w-full overflow-hidden bg-slate-50 p-1 rounded-lg border border-slate-200">

  {/* tombol kiri */}
  <Button
    variant="ghost"
    size="icon"
    className="shrink-0"
    onClick={() => setDate(addDays(date, -1))}
  >
    <ChevronLeft className="w-4 h-4" />
  </Button>

  {/* tanggal */}
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="ghost"
        className="flex-1 min-w-0 justify-center text-center"
      >
        <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-slate-500" />

        <span className="text-xs font-semibold tracking-tight whitespace-nowrap text-slate-700">
  {formattedDate}
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

  {/* tombol kanan */}
  <Button
    variant="ghost"
    size="icon"
    className="shrink-0"
    onClick={() => setDate(addDays(date, 1))}
  >
    <ChevronRight className="w-4 h-4" />
  </Button>

</div>
    </div>
  </div>
</div>

      {/* ERROR */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* CONTENT */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 bg-white rounded-2xl border shadow-sm">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          <p className="text-slate-400">Memuat jadwal...</p>
        </div>
      ) : (
          <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
          {[...therapists]
  .sort((a, b) => {
    const getFirstSlot = (therapist) => {
      const slots = schedulesMap[therapist.id] || [];

      if (slots.length === 0) return "99:99";

      // ambil slot paling awal
      const sortedSlots = [...slots].sort((x, y) =>
        x.slot_start_time.localeCompare(y.slot_start_time)
      );

      return sortedSlots[0].slot_start_time;
    };

    return getFirstSlot(a).localeCompare(getFirstSlot(b));
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
                onSlotClick={(slot, t) => setActiveModal({ type: 'slot', data: { slot, therapist: t } })}
                onManualBooking={(t) => setActiveModal({ type: 'manual', data: { therapist: t } })}
                onAppointmentClick={(app) => setActiveModal({ type: 'detail', data: app })}
              />
            );
          })}
        </div>
      )}

      <Dialog open={!!activeModal} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="w-full max-w-xl bg-white p-6 rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="mb-4">
            <DialogTitle>
              {activeModal?.type === 'slot' && 'Booking Slot'}
              {activeModal?.type === 'manual' && 'Booking Manual'}
              {activeModal?.type === 'detail' && 'Detail Appointment'}
            </DialogTitle>
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

export default AdminAppointmentBooking;