import { id as idLocale } from 'date-fns/locale';
import React, { useState, useEffect } from 'react';
import {
  Loader2, AlertCircle, Clock, CalendarDays,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  bookAppointmentSafe,
  getPatients,
  getActivePackage,
  getPatientById,
  checkFollowUpQueueExists,
  deleteFollowUpQueueEntry,
  checkRecurringSlotConflicts,
  createRecurringAppointmentSafe
} from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

import { format, isValid } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';

const MIN_DURATION = 60; // 🔥 Minimum 60 menit

const ManualBookingForm = ({ therapist, date, onClose, onSuccess, leaveStatus = 'aktif' }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
const [filteredPatients, setFilteredPatients] = useState([]);
const [showDropdown, setShowDropdown] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [matchedSlot, setMatchedSlot] = useState(null);
  const [slotError, setSlotError] = useState(null);

  const [formData, setFormData] = useState({
    patient_type: 'registered',
    patient_id: '',
    guest_name: '',
    guest_phone: '',
    start_time: '09:00',
    notes: '',
    recurringEndDate: ''
  });
  const [isHomecare, setIsHomecare] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [conflictData, setConflictData] = useState(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [packageInfo, setPackageInfo] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);

  const isLeave = ['cuti', 'sakit', 'non_active'].includes(leaveStatus);

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [therapist, date]);

  useEffect(() => {
    detectSlot();
  }, [formData.start_time, availableSlots]);

  const loadPatients = async () => {
    try {
      const { data } = await getPatients();
      setPatients(Array.isArray(data) ? data : []);
    } catch {
      toast({ variant: "destructive", title: "Gagal memuat data pasien" });
    }
  };

  const fetchSlots = async () => {
    if (!therapist?.id || !date) return;

    const dateStr = format(date, 'yyyy-MM-dd');

    const { data, error } = await supabase.rpc(
      'get_available_slots_with_status_by_date',
      { p_date: dateStr }
    );

    if (error) return;

    const slotsForTherapist = data
      .filter(s => s.therapist_id === therapist.id)
      .filter(s => s.status === 'aktif');

    setAvailableSlots(slotsForTherapist);
  };

  const detectSlot = () => {
  if (!formData.start_time) {
    setMatchedSlot(null);
    setSlotError(null);
    return;
  }

  const startDate = new Date(`2000-01-01T${formData.start_time}:00`);
  const endManual = new Date(startDate.getTime() + 90 * 60000);

  const overlappedSlots = availableSlots.filter(slot => {
    const slotStart = new Date(`2000-01-01T${slot.slot_start}:00`);
    const slotEnd = new Date(`2000-01-01T${slot.slot_end}:00`);

    return startDate < slotEnd && endManual > slotStart;
  });

  if (overlappedSlots.length > 0) {
    setMatchedSlot({
      slot_start: formData.start_time,
      slot_end: formData.start_time,
      calculated_duration: 90,
      overlappedSlots
    });
    setSlotError(null);
    return;
  }
 setMatchedSlot({
    slot_start: formData.start_time,
    slot_end: formData.start_time,
    calculated_duration: 60
  });

  setSlotError(null);
};
  
  const handlePatientSelect = async (val) => {
    setFormData(prev => ({ ...prev, patient_id: val }));
    if (!val) return;

    try {
      const { data: patientData } = await getPatientById(val);
      if (patientData?.medical_history) {
        setFormData(prev => ({ ...prev, notes: patientData.medical_history }));
      }

      const { data: activePkg } = await getActivePackage(val);
      if (activePkg) {
  setPackageInfo(activePkg);

  toast({
    title: "Paket Aktif Ditemukan",
    description: `Pasien memiliki paket aktif: ${activePkg.package_name}.`
  });
} else {
  setPackageInfo(null);
}
    } catch {}
  };

  const handleSubmit = async () => {
    if (!therapist?.id) {
      toast({ variant: "destructive", title: "Data terapis tidak valid." });
      return;
    }

    if (!date || !isValid(date)) {
      toast({ variant: "destructive", title: "Tanggal tidak valid." });
      return;
    }

    if (isLeave) {
      toast({
        variant: "destructive",
        title: "Tidak Dapat Booking",
        description: `Fisioterapis sedang ${leaveStatus}.`
      });
      return;
    }

    if (!matchedSlot) {
      toast({
        variant: "destructive",
        title: "Jam Tidak Valid",
        description: "Silakan pilih jam dalam slot aktif (min 60 menit)."
      });
      return;
    }
    // 🔥 CEK BENTROK APPOINTMENT
    const startDate = new Date(`${format(date, 'yyyy-MM-dd')}T${formData.start_time}:00`);
    const endDate = new Date(startDate.getTime() + (matchedSlot.calculated_duration || 60) * 60000);

    const { data: existingAppointments } = await supabase
      .from('appointments')
      .select('appointment_date, duration_minutes')
      .eq('therapist_id', therapist.id);

    const isConflict = existingAppointments?.some(app => {
      const appStart = new Date(app.appointment_date);
      const appEnd = new Date(appStart.getTime() + app.duration_minutes * 60000);

      return (
        startDate < appEnd && endDate > appStart
      );
    });

    if (isConflict) {
      toast({
        variant: "destructive",
        title: "Jadwal Bentrok",
        description: "Sudah ada appointment di jam tersebut."
      });
      return;
    }
    
    // 🔥 HANDLE RECURRING
    if (isRecurring) {
      if (!formData.recurringEndDate) {
        toast({
          variant: "destructive",
          title: "Tanggal akhir wajib diisi untuk recurring"
        });
        return;
      }

      setLoading(true);

      try {
        const { data, error } = await checkRecurringSlotConflicts({
          therapist_id: therapist.id,
          start_date: format(date, 'yyyy-MM-dd'),
          end_date: formData.recurringEndDate,
          weekday: date.getDay(),
          time: formData.start_time + ":00",
          duration_minutes: matchedSlot.calculated_duration || 60
        });

        if (error) throw error;

        // 🔥 INI PENTING (tampilkan modal)
        setConflictData(data);
        setShowConflictModal(true);

      } catch (err) {
        toast({
          variant: "destructive",
          title: "Gagal cek recurring",
          description: err.message
        });
      } finally {
        setLoading(false);
      }

      return;
    }
    setLoading(true);

    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dateTimeStr = `${dateStr}T${formData.start_time}:00`;
      const appointmentDate = new Date(dateTimeStr).toISOString();

      if (formData.patient_type === 'registered' && formData.patient_id) {
        const formattedDate = format(date, 'yyyy-MM-dd');
        const { data: existingQueue } = await checkFollowUpQueueExists(formData.patient_id, formattedDate);
        if (existingQueue?.id) {
          await deleteFollowUpQueueEntry(existingQueue.id);
        }
      }

      const result = await bookAppointmentSafe({
        therapistId: therapist.id,
        clinicId: therapist.clinic_id,
        appointmentDate: appointmentDate,
        durationMinutes: matchedSlot.calculated_duration || 90,
        status: 'confirmed',
        notes: formData.notes,
        is_homecare: isHomecare,
  is_recurring: isRecurring,
        patientId: formData.patient_type === 'registered' ? formData.patient_id : null,
        guestName: formData.patient_type === 'guest' ? formData.guest_name : null,
        guestPhone: formData.patient_type === 'guest' ? formData.guest_phone : null,
      });

      if (result?.error) {
  throw new Error(result.error.message || "Gagal menyimpan jadwal");
}

      toast({ title: "Booking Manual Berhasil", className: "bg-green-50 border-green-200" });
      if (onSuccess) onSuccess();
      onClose();

    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };
const handleConfirmRecurring = async () => {
    setShowConflictModal(false);
    setLoading(true);

    try {
      const { data, error } = await createRecurringAppointmentSafe({
        therapist_id: therapist.id,
        start_date: format(date, 'yyyy-MM-dd'),
        end_date: formData.recurringEndDate,
        weekday: date.getDay(),
        time: formData.start_time + ":00",
        duration_minutes: matchedSlot.calculated_duration || 60,
        patient_id: formData.patient_type === 'registered' ? formData.patient_id : null,
        guest_name: formData.patient_type === 'guest' ? formData.guest_name : null,
        guest_phone: formData.patient_type === 'guest' ? formData.guest_phone : null,
        notes: formData.notes,
        status: 'confirmed'
      });

      if (error) throw error;

      setResultData(data);
      setShowResultModal(true);

    } catch (err) {
      toast({
        variant: "destructive",
        title: "Gagal membuat recurring",
        description: err.message
      });
      setLoading(false);
    }
  };
  
  if (showConflictModal && conflictData) {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <h3 className="font-semibold text-blue-800 mb-2">
            Konfirmasi Booking Berulang
          </h3>
          <p className="text-sm text-blue-700">
            Anda akan membuat <strong>{conflictData.total_planned}</strong> jadwal setiap{' '}
            <strong>{format(date, 'EEEE', { locale: idLocale })}</strong> sampai{' '}
            <strong>{format(new Date(formData.recurringEndDate), 'dd MMM yyyy', { locale: idLocale })}</strong>.
          </p>
        </div>

        {conflictData.conflicts?.length > 0 && (
          <div className="bg-red-50 p-4 rounded-lg border border-red-100">
            <h4 className="font-medium text-red-800 mb-1">
              Terdapat {conflictData.conflicts.length} Bentrok
            </h4>
            <ul className="text-xs text-red-700 list-disc list-inside max-h-32 overflow-y-auto">
              {conflictData.conflicts.map((cDate, i) => (
                <li key={i}>
                  {format(new Date(cDate), 'dd MMMM yyyy')}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowConflictModal(false)}
          >
            Batal
          </Button>
          <Button onClick={handleConfirmRecurring}>
            Lanjutkan
          </Button>
        </DialogFooter>
      </div>
    );
  }
  if (showResultModal && resultData) {
    return (
      <div className="space-y-4 text-center py-6">
        <div className={cn(
          "w-12 h-12 mx-auto rounded-full flex items-center justify-center",
          resultData.failed_dates?.length > 0
            ? "bg-orange-100 text-orange-600"
            : "bg-green-100 text-green-600"
        )}>
          {resultData.failed_dates?.length > 0
            ? <AlertCircle className="w-6 h-6" />
            : <CheckCircle className="w-6 h-6" />}
        </div>

        <h3 className="text-lg font-semibold text-slate-800">
          Booking Selesai
        </h3>

        <p className="text-sm text-slate-600">
          Berhasil: {resultData.created_count} |
          Gagal: {resultData.failed_dates?.length || 0}
        </p>

        <Button
          onClick={() => {
            setShowResultModal(false);
            if (onSuccess) onSuccess();
            onClose();
          }}
          className="w-full"
        >
          Selesai
        </Button>
      </div>
    );
  }
  if (!therapist) {
    return <div className="p-4 text-center text-red-500">Data terapis tidak valid.</div>;
  }
  return (
    <div className="space-y-4">
      <div className={cn(
        "p-5 rounded-2xl border flex flex-col gap-3 shadow-sm",
        isLeave ? "bg-red-50 border-red-100" : "bg-gradient-to-br from-white to-slate-50 border-slate-200"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-700">
            <CalendarDays className={cn("w-4 h-4", isLeave ? "text-red-500" : "text-blue-600")} />
            <span className="text-sm font-medium">
              {date && isValid(date)
                ? format(date, 'EEEE, dd MMMM yyyy', { locale: idLocale })
                : 'Tanggal Invalid'}
            </span>
          </div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {therapist?.name}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className={cn("w-4 h-4", isLeave ? "text-red-500" : "text-blue-600")} />
          <span className="text-3xl font-bold text-slate-900 tracking-tight">
            {formData.start_time}
          </span>
        </div>
      </div>
      {isLeave ? (
        <div className="bg-red-50 text-red-900 p-3 rounded-md text-xs border border-red-200">
          Therapist sedang {leaveStatus}.
        </div>
      ) : (
        <div className="bg-amber-50 text-amber-900 p-3 rounded-md text-xs border border-amber-200">
            Booking manual bebas jam (di dalam atau di luar slot). Jika masuk slot aktif, slot akan otomatis terpakai.
        </div>
      )}

      <div className="space-y-2">
        <Label>Jam Mulai</Label>
        <div className="relative">
          <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="time"
            className="pl-9"
            value={formData.start_time}
            onChange={e => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
            disabled={isLeave}
          />
        </div>
        {slotError && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-2 rounded-md mt-2">
            🔴 {slotError}
          </div>
        )}
      </div>

      <div className="flex bg-slate-100 p-1 rounded-lg">
        <button
          onClick={() => setFormData(prev => ({ ...prev, patient_type: 'registered' }))}
          disabled={isLeave}
          className={cn(
            "flex-1 text-xs font-medium py-2 rounded-md",
            formData.patient_type === 'registered' ? "bg-white shadow-sm" : "text-slate-500"
          )}
        >
          Pasien Terdaftar
        </button>
        <button
          onClick={() => setFormData(prev => ({ ...prev, patient_type: 'guest' }))}
          disabled={isLeave}
          className={cn(
            "flex-1 text-xs font-medium py-2 rounded-md",
            formData.patient_type === 'guest' ? "bg-white shadow-sm" : "text-slate-500"
          )}
        >
          Tamu / Baru
        </button>
      </div>

      {formData.patient_type === 'registered' ? (
  <>
    <div className="space-y-2 relative">
  <Input
    placeholder="Cari nama pasien..."
    value={patientSearch}
    onChange={async (e) => {
      const value = e.target.value;
      setPatientSearch(value);

      if (!value) {
        setFilteredPatients([]);
        return;
      }

      try {
        const { data } = await getPatients(value);
        setFilteredPatients(data || []);
        setShowDropdown(true);
      } catch {}
    }}
  />

  {showDropdown && (
    <div className="absolute z-50 w-full bg-white border rounded mt-1 max-h-48 overflow-auto shadow">
      {filteredPatients.length > 0 ? (
        filteredPatients.map(p => (
          <div
            key={p.id}
            onClick={() => {
              handlePatientSelect(p.id);
              setPatientSearch(p.full_name);
              setShowDropdown(false);
            }}
            className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
          >
            <div className="font-medium">{p.full_name}</div>
            <div className="text-xs text-gray-500">{p.medical_record_number}</div>
          </div>
        ))
      ) : (
        <div className="p-2 text-gray-400 text-sm">
          Tidak ditemukan
        </div>
      )}
    </div>
  )}
</div>

    {packageInfo && (
      <div className="border rounded-lg p-3 bg-green-50 mt-2">
        <div className="flex justify-between items-center">
          <span className="font-semibold">{packageInfo.package_name}</span>
          <span className="text-xs bg-green-200 px-2 py-1 rounded">AKTIF</span>
        </div>

        <div className="flex gap-2 mt-2">
          <div className="flex-1 bg-gray-100 p-2 rounded text-center">
            <div className="text-xs">Terpakai</div>
            <div className="font-bold">
              {packageInfo.sessions_used}/{packageInfo.total_sessions}
            </div>
          </div>

          <div className="flex-1 bg-gray-100 p-2 rounded text-center">
            <div className="text-xs">Sisa</div>
            <div className="font-bold">
              {packageInfo.total_sessions - packageInfo.sessions_used}
            </div>
          </div>
        </div>
      </div>
    )}
  </>
) : (
        <>
          <Input
            placeholder="Nama Pasien"
            value={formData.guest_name}
            onChange={e => setFormData(prev => ({ ...prev, guest_name: e.target.value }))}
            disabled={isLeave}
          />
          <Input
            placeholder="No HP"
            value={formData.guest_phone}
            onChange={e => setFormData(prev => ({ ...prev, guest_phone: e.target.value }))}
            disabled={isLeave}
          />
        </>
      )}
      <div className="flex items-center space-x-2 border p-3 rounded-md bg-slate-50">
        <Checkbox
          id="homecare"
          checked={isHomecare}
          onCheckedChange={(c) => setIsHomecare(!!c)}
          disabled={isLeave}
        />
        <Label htmlFor="homecare" className="text-xs font-medium cursor-pointer">
          Layanan Homecare
        </Label>

        <div className="mx-2 border-l h-4" />

        <Checkbox
          id="recurring"
          checked={isRecurring}
          onCheckedChange={(c) => setIsRecurring(!!c)}
          disabled={isLeave}
        />
        <Label htmlFor="recurring" className="text-xs font-medium cursor-pointer">
          Recurring
        </Label>
      </div>
      {isRecurring && (
        <div className="mt-2">
          <Label className="text-xs">Sampai Tanggal</Label>
          <Input
            type="date"
            value={formData.recurringEndDate}
            onChange={(e) =>
              setFormData(prev => ({
                ...prev,
                recurringEndDate: e.target.value
              }))
            }
            disabled={isLeave}
          />
        </div>
      )}
      <Textarea
        placeholder="Tulis catatan..."
        className="h-20 resize-none"
        value={formData.notes}
        onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
        disabled={isLeave}
      />

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
        <Button onClick={handleSubmit} disabled={loading || isLeave}>
          {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Simpan
        </Button>
      </DialogFooter>
    </div>
  );
};

export default ManualBookingForm;