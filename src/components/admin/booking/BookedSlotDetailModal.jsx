import React, { useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { Button } from '@/components/ui/button';
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
import { deleteAppointment } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { formatTimeIndonesia } from '@/lib/utils';

const BookedSlotDetailModal = ({ appointment, onClose, onSuccess }) => {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  return (
    <div className="space-y-6 relative">
      <div className="text-center space-y-2 border-b pb-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 mb-2">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-2xl font-bold text-slate-900">{startTime} - {endTime}</h3>
        <p className="text-sm text-slate-500 font-medium">{dateDisplay}</p>
        <Badge variant="outline" className="mt-2 bg-green-50 text-green-700 border-green-200">
          {status}
        </Badge>
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <User className="w-5 h-5 text-slate-400 mt-0.5" />
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Pasien</p>
            <p className="font-medium text-slate-800">
              {appointment.patient?.full_name || appointment.guest_name || 'Tanpa Nama'}
            </p>
            {/* UPDATED: Correct field name medical_record_number with safe access */}
            {appointment.patient?.medical_record_number && (
              <p className="text-xs text-slate-500">{appointment.patient.medical_record_number}</p>
            )}
            {appointment.guest_phone && (
              <p className="text-xs text-slate-500">{appointment.guest_phone}</p>
            )}
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
          <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Durasi</p>
            <p className="font-medium text-slate-800">{duration} Menit</p>
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

      <div className="flex gap-2 justify-between items-center sm:justify-between mt-6">
         <Button 
            variant="destructive" 
            className="bg-red-50 text-red-600 hover:bg-red-100 border-red-100"
            onClick={() => setShowDeleteConfirm(true)}
         >
            <Trash2 className="w-4 h-4 mr-2" /> Hapus Jadwal
         </Button>

        <Button onClick={onClose} variant="outline" className="min-w-[100px]">Tutup</Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Hapus Jadwal Appointment?</DialogTitle>
                <DialogDescription>
                    Tindakan ini akan menghapus appointment dan data rekap harian yang terkait. Slot waktu akan kembali tersedia.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
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