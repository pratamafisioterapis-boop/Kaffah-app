import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { format, parseISO, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { id } from 'date-fns/locale';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { User, Clock, FileText, CheckCircle2, Trash2, Loader2 } from 'lucide-react';
import { deleteAppointment, updateAppointment } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { formatTimeIndonesia } from '@/lib/utils';

const BookedSlotDetailModal = ({ 
  appointment, 
  onClose, 
  onSuccess,
  onViewHistory
}) => {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
const [isRescheduleMode, setIsRescheduleMode] = useState(false);
const [newDate, setNewDate] = useState("");
const [availableSlots, setAvailableSlots] = useState([]);
const [selectedTime, setSelectedTime] = useState("");
const [bookedSlots, setBookedSlots] = useState([]);
const [selectedTherapist, setSelectedTherapist] = useState("");
const [therapists, setTherapists] = useState([]);
const fetchAvailableSlots = async (date) => {
  if (!date) return;
  if (!selectedTherapist) return;

  const { data, error } = await supabase.rpc(
    'get_available_slots_with_status_by_date',
    { p_date: date }
  );

  if (error) {
    toast({ variant: "destructive", title: "Gagal ambil slot" });
    return;
  }

  const slots = data
    .filter(s => 
      s.therapist_id === selectedTherapist && 
      s.status === 'aktif'
    )
    .map(s => ({
      time: s.slot_start.slice(0,5),
      end: s.slot_end.slice(0,5)
    }));

  setAvailableSlots(slots);
};
const fetchBookedSlots = async (date) => {
  if (!date) return;
  if (!selectedTherapist) return;

  const start = date + "T00:00:00";
  const end = date + "T23:59:59";

  const { data, error } = await supabase
    .from('appointments')
    .select('appointment_date')
    .eq('therapist_id', selectedTherapist)
    .gte('appointment_date', start)
    .lte('appointment_date', end);

  if (error) return;

  const times = data.map(a => {
    const d = new Date(a.appointment_date);
    return format(d, 'HH:mm');
  });

  setBookedSlots(times);
};
// 🔥 1. AUTO LOAD SAAT PILIH TANGGAL
useEffect(() => {
  if (newDate) {
    fetchAvailableSlots(newDate);
    fetchBookedSlots(newDate); // 🔥 TAMBAH INI
  }
}, [newDate, selectedTherapist]);
useEffect(() => {
  if (!isRescheduleMode || !newDate) return;
  if (!selectedTherapist) return;

  fetchAvailableSlots(newDate);
fetchBookedSlots(newDate);
  const channel = supabase
    .channel('appointments-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'appointments'
      },
      () => {
        fetchAvailableSlots(newDate);
        fetchBookedSlots(newDate);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [isRescheduleMode, newDate]);

// 1. Safety Check: If appointment is null/undefined, don't render anything
  if (!appointment) return null;

  // 2. Safe Data Access with Fallbacks
  const appointmentDateStr = appointment.appointment_date;
  const isValidDate = appointmentDateStr && isValid(parseISO(appointmentDateStr));
  
  const startTime = isValidDate ? formatTimeIndonesia(appointmentDateStr) : "--:--";
  const duration = appointment.duration_minutes || 60;
  
  // Calculate end time safely
  let endTime = "--:--";
  if (isValidDate) {
    try {
      const [startH, startM] = startTime.split(':').map(Number);
      const endDate = new Date();
      endDate.setHours(startH, startM + duration, 0, 0);
      endTime = format(endDate, 'HH:mm');
    } catch (e) {
      console.error("Error calculating end time:", e);
    }
  }
  
  // Date display - standard format
  const dateDisplay = isValidDate 
    ? format(parseISO(appointmentDateStr), 'eeee, dd MMMM yyyy') 
    : "Tanggal tidak valid";

  const status = appointment.status ? appointment.status.toUpperCase() : "UNKNOWN";

  const handleDelete = async () => {
    if (!appointment?.id) {
        toast({ variant: "destructive", title: "Error", description: "ID Appointment tidak ditemukan." });
        return;
    }

    setIsDeleting(true);
    console.log('[BookedSlotDetail] Deleting appointment ID:', appointment.id);
    try {
        const { error } = await deleteAppointment(appointment.id, true); // true = cascade delete
        
        if (error) {
            console.error('[BookedSlotDetail] Delete failed:', error);
            // Check for foreign key violation code
            if (error.code === '23503') {
                throw new Error("Tidak dapat menghapus: Data appointment masih digunakan oleh data lain.");
            }
            throw error;
        }

        console.log('[BookedSlotDetail] Delete successful');
        toast({ title: "Jadwal berhasil dihapus", className: "bg-green-50 border-green-200" });
        if (onSuccess) onSuccess();
        onClose();
    } catch (error) {
        toast({ 
            variant: "destructive", 
            title: "Gagal menghapus jadwal", 
            description: error.message || "Terjadi kesalahan saat menghapus data." 
        });
    } finally {
        setIsDeleting(false);
        setShowDeleteConfirm(false);
    }
  };
useEffect(() => {
  const fetchTherapists = async () => {
    const { data, error } = await supabase
      .from('physiotherapists')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    if (error) {
      toast({ variant: "destructive", title: "Gagal ambil therapist" });
      return;
    }

    setTherapists(data);
  };

  fetchTherapists();
}, []);
    return (
  <div className="space-y-5">
      {isRescheduleMode && (
  <div className="bg-orange-50 border border-orange-200 text-orange-800 px-3 py-2 rounded-md flex justify-between items-center text-sm">
    <span>⚠️ Reschedule Mode</span>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setIsRescheduleMode(false)}
    >
      Batal
    </Button>
  </div>
)}
      <div className="text-center space-y-2 border-b pb-4 animate-in fade-in zoom-in-95 duration-300">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-blue-500/10 to-blue-500/5 text-blue-600 shadow-sm mb-2">
  <CheckCircle2 className="w-7 h-7" />
</div>

<h3 className="text-4xl font-bold text-slate-900 tracking-tight">
  {startTime}
</h3>

<p className="text-sm text-slate-500 font-medium">
  {format(parseISO(appointmentDateStr), 'EEEE, dd MMMM yyyy', { locale: id })}
</p>
        <Badge className="mt-2 bg-green-100 text-green-700 border-none px-3 py-1 rounded-full text-xs font-semibold">
  {status}
</Badge>
      </div>
{isRescheduleMode && (
  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">

    {/* TERAPIS */}
    <div className="space-y-1">
      <label className="text-[11px] tracking-wide font-semibold text-slate-400">TERAPIS</label>
      <select
  value={selectedTherapist}
  onChange={(e) => {
  setSelectedTherapist(e.target.value);
  setSelectedTime("");
}}
  className="w-full border rounded-xl px-3 py-2 text-sm bg-white"
>
  <option value="">Pilih Terapis</option>

  {therapists.map((t) => (
    <option key={t.id} value={t.id}>
      {t.name}
    </option>
  ))}
</select>
    </div>

    {/* TANGGAL */}
    <div className="space-y-1">
      <label className="text-[11px] tracking-wide font-semibold text-slate-400">TANGGAL</label>
      <Input
        type="date"
        value={newDate}
        onChange={(e) => {
  setNewDate(e.target.value);
  setSelectedTime("");
}}
        className="rounded-xl border-slate-200 focus:ring-2 focus:ring-blue-500"
      />
    </div>

    {/* SLOT */}
    {availableSlots.length > 0 && selectedTherapist && newDate ? (
  <div className="space-y-2">
    <label className="text-[11px] tracking-wide font-semibold text-slate-400">JAM TERSEDIA</label>

    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-1">
      {availableSlots.map((slot, i) => {
        const isBooked = bookedSlots.includes(slot.time);

        return (
          <Button
            key={i}
            variant="outline"
            onClick={() => !isBooked && setSelectedTime(slot.time)}
            disabled={isBooked}
            className={`
  text-xs sm:text-sm px-4 py-2 rounded-xl border transition-all
  min-w-[70px] text-center font-medium
  ${selectedTime === slot.time 
    ? "bg-blue-600 text-white shadow-md scale-105" 
    : "bg-white text-slate-700"}
  ${isBooked 
    ? "opacity-30 line-through cursor-not-allowed" 
    : "hover:bg-blue-50 hover:border-blue-300 active:scale-95"
  }
`}
          >
            {slot.time}
          </Button>
        );
      })}
    </div>
  </div>
) : (
  <div className="text-sm text-slate-500 italic">
    Tidak ada jadwal tersedia di tanggal ini
  </div>
)}
  </div>
)}
      <div className="space-y-4">
        
<div className="flex items-start gap-3">
  <User className="w-5 h-5 text-slate-400 mt-0.5" />
  <div>
    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Pasien</p>
    <p className="font-medium text-slate-800">
      {appointment.patient?.full_name || appointment.guest_name || 'Tidak diketahui'}
    </p>
  </div>
</div>
        <div className="flex items-start gap-3">
          <User className="w-5 h-5 text-slate-400 mt-0.5" />
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Terapis</p>
            <p className="font-medium text-slate-800">{appointment.therapist?.name || 'Tidak diketahui'}</p>
          </div>
        </div>

        

        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
          <div className="w-full">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Catatan</p>
            <div className="mt-1 p-3 bg-slate-50 rounded-lg text-sm text-slate-700 border border-slate-100">
              {appointment.notes || <span className="text-slate-400 italic">Tidak ada catatan</span>}
            </div>
          </div>
        </div>
      </div>

      
<DialogFooter className="sticky bottom-0 left-0 right-0 bg-white pt-3 pb-3 border-t flex flex-col gap-3 mt-4 z-10">

  {/* ACTION ROW */}
  <div className="flex flex-col sm:flex-row gap-2 w-full">

    {/* LEFT */}
    <div className="flex gap-2 w-full sm:w-auto">
      <Button 
        variant="outline"
        className="flex-1 sm:flex-none border-red-200 text-red-600 hover:bg-red-50"
        onClick={() => setShowDeleteConfirm(true)}
      >
        Hapus
      </Button>

      <Button
        variant="outline"
        className="flex-1 sm:flex-none border-orange-200 text-orange-600 hover:bg-orange-50"
        onClick={async () => {
          try {
            const { error } = await updateAppointment(appointment.id, {
              status: 'cancelled'
            });

            if (error) throw error;

            toast({ title: "Appointment dibatalkan" });
            if (onSuccess) onSuccess();
            onClose();
          } catch (err) {
            toast({ variant: "destructive", title: "Gagal cancel" });
          }
        }}
      >
        Cancel
      </Button>
    </div>

    {/* RIGHT */}
    <div className="flex gap-2 w-full sm:w-auto sm:ml-auto flex-wrap">
      <Button
  variant="outline"
  className="flex-1 sm:flex-none border-blue-200 text-blue-600 hover:bg-blue-50"
  onClick={() => onViewHistory?.(appointment.patient?.id || appointment.patient_id)}
>
  Riwayat
</Button>
      <Button
        variant="secondary"
        className="flex-1 sm:flex-none"
        onClick={() => setIsRescheduleMode(true)}
      >
        Reschedule
      </Button>

      <Button 
        onClick={onClose} 
        variant="outline" 
        className="flex-1 sm:flex-none"
      >
        Tutup
      </Button>
    </div>

  </div>

  {/* SAVE BUTTON (SEPARATE ROW) */}
  {isRescheduleMode && (
    <Button
      className="w-full sm:w-auto self-end"
      onClick={async () => {
        if (!newDate) {
          toast({ variant: "destructive", title: "Tanggal belum dipilih" });
          return;
        }
        if (!selectedTime) {
          toast({ variant: "destructive", title: "Pilih jam terlebih dahulu" });
          return;
        }

        try {
          const newDateTime = new Date(newDate + "T" + selectedTime).toISOString();

          const { error } = await updateAppointment(appointment.id, {
  appointment_date: newDateTime,
  therapist_id: selectedTherapist,
  status: 'rescheduled'
});

          if (error) throw error;

          toast({ title: "Berhasil reschedule" });
          if (onSuccess) onSuccess();
          onClose();
        } catch (err) {
          toast({ variant: "destructive", title: "Gagal reschedule" });
        }
      }}
    >
      Save Reschedule
    </Button>
  )}

</DialogFooter>
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-[500px] w-full">
            <DialogHeader>
                <DialogTitle>Hapus Jadwal Appointment?</DialogTitle>
                <DialogDescription>
                    Tindakan ini akan menghapus appointment dan data rekap harian yang terkait. Slot waktu akan kembali tersedia.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Batal</Button>
                <Button 
                    variant="destructive" 
                    onClick={handleDelete} 
                    className="bg-red-600 hover:bg-red-700"
                    disabled={isDeleting}
                >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Ya, Hapus
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookedSlotDetailModal;