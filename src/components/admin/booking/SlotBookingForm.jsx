import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, User, Phone, FileText, Clock, CalendarDays, AlertCircle, Search, ChevronDown, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { 
  bookAppointmentSafe, 
  getPatients, 
  getPatientById, 
  getPatientLatestPackage, 
  checkFollowUpQueueExists, 
  deleteFollowUpQueueEntry, 
  checkRecurringSlotConflicts, 
  createRecurringAppointmentSafe,
  extendPackage
} from '@/lib/api';
import { format, isValid, addDays, isBefore, startOfDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

const SlotBookingForm = ({ slot, therapist, date, onClose, onSuccess, leaveStatus = 'aktif' }) => {
  const getLastValidDate = (pkg) => {
    if (!pkg) return null;
    return pkg.extended_until || pkg.end_date;
  };

  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  
  const [packageInfo, setPackageInfo] = useState(null);
  const [isJustActivated, setIsJustActivated] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendDate, setExtendDate] = useState('');
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [isSelecting, setIsSelecting] = useState(false);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef(null);
  
  const [formData, setFormData] = useState({
    patient_type: 'registered', // 'registered' | 'guest'
    patient_id: '',
    guest_name: '',
    guest_phone: '',
    notes: '',
    duration: 60,
    isRecurring: false,
    recurringEndDate: '',
    is_homecare: false
  });

  const [conflictData, setConflictData] = useState(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [isBablastEnabled, setIsBablastEnabled] = useState(false);

  const isLeave = ['cuti', 'sakit', 'non_active'].includes(leaveStatus);

  // Global scope calculation for package state
  const lastDateGlobal = getLastValidDate(packageInfo);
  const isExpiredGlobal = lastDateGlobal ? isBefore(new Date(lastDateGlobal), startOfDay(new Date())) : false;

  useEffect(() => {
    loadPatients();
  }, []);
useEffect(() => {

  const fetchWASettings = async () => {
    const { data } = await supabase
      .from('wa_settings')
      .select('enabled')
      .single();

    if (data) {
      setIsBablastEnabled(data.enabled);
    }
  };

  fetchWASettings();

}, []);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadPatients = async () => {
    try {
      const { data } = await getPatients();
      if (Array.isArray(data)) {
        setPatients(data);
        setFilteredPatients(data);
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Gagal memuat data pasien" });
    }
  };

  const handlePatientSelect = async (val) => {
  setIsSelecting(true); // 🔥 lock supaya onChange ga ganggu

  setShowDropdown(false);
  setFormData(prev => ({ ...prev, patient_id: val }));

  if (!val) return;

  const selectedPatient = patients.find(p => p.id === val);
  if (selectedPatient) {
    setPatientSearchTerm(selectedPatient.full_name);
  }

  try {
    const { data: pkg } = await getPatientLatestPackage(val);

setPackageInfo(pkg);

    if (!pkg || pkg.sessions_remaining === 0) {
  toast({
    title: "Info Paket",
    description: "Pasien tidak memiliki paket yang aktif/expired"
  });
} else if (!isExpired) {
  toast({
    title: "Paket Aktif",
    description: `Pasien memiliki paket: ${pkg.package_name}`
  });
}

    setIsJustActivated(true);
    setTimeout(() => setIsJustActivated(false), 2000);

    const { data: patientData } = await getPatientById(val);
    if (patientData && patientData.medical_history) {
      setFormData(prev => ({ ...prev, notes: patientData.medical_history }));
    }

    if (pkg) {
      const lastDate = getLastValidDate(pkg);
      const isExpired = lastDate
        ? isBefore(new Date(lastDate), startOfDay(new Date()))
        : false;

      
    }
  } catch (err) {
    console.error("Error loading patient package info:", err);
  }

  setTimeout(() => setIsSelecting(false), 100); // 🔥 unlock lagi
};

  const handleSubmit = async () => {
    if (loading) return;
    if (!therapist?.id || !slot?.slot_start_time || !date || !isValid(date)) {
        toast({ variant: "destructive", title: "Error", description: "Data tidak valid." });
        return;
    }

    if (isLeave) {
      toast({
         variant: "destructive",
         title: "Tidak Dapat Booking",
         description: `Fisioterapis sedang ${leaveStatus === 'non_active' ? 'tidak aktif' : leaveStatus}, tidak dapat membuat appointment.`
       });
       return;
    }

    if (formData.patient_type === 'registered' && !formData.patient_id) {
      toast({ variant: "destructive", title: "Mohon pilih pasien" });
      return;
    }
    if (formData.patient_type === 'guest' && !formData.guest_name) {
      toast({ variant: "destructive", title: "Mohon isi nama pasien" });
      return;
    }

    if (formData.isRecurring) {
        if (!formData.recurringEndDate) {
            toast({ variant: "destructive", title: "Tanggal Akhir Diperlukan" });
            return;
        }
        await handleCheckRecurring();
        return;
    }

    setLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const timeStr = slot.slot_start_time.substring(0, 5);
      const dateTimeStr = `${dateStr}T${timeStr}:00`;
      const appointmentDate = new Date(dateTimeStr).toISOString();

      if (formData.patient_type === 'registered' && formData.patient_id) {
          const formattedDate = format(date, 'yyyy-MM-dd');
          const { data: existingQueue } = await checkFollowUpQueueExists(formData.patient_id, formattedDate);
          if (existingQueue && existingQueue.id) {
              await deleteFollowUpQueueEntry(existingQueue.id);
          }
      }

     const result = await bookAppointmentSafe({
  p_therapist_id: therapist.id,
  p_clinic_id: therapist.clinic_id,
  p_appointment_date: appointmentDate,
  p_duration_minutes: formData.duration,
  p_status: 'confirmed',
  p_notes: formData.notes,
  p_patient_id: formData.patient_type === 'registered' ? formData.patient_id : null,
  p_guest_name: formData.patient_type === 'guest' ? formData.guest_name : null,
  p_guest_phone: formData.patient_type === 'guest' ? formData.guest_phone : null,
  p_service_id: null,
  p_is_homecare: formData.is_homecare,
  p_is_manual: false,

  // 🔥 TAMBAHAN
  p_disable_whatsapp: !isBablastEnabled
});

      if (!result || result.error) throw result?.error || new Error("Gagal menyimpan jadwal");
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal Booking", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckRecurring = async () => {
      setLoading(true);
      try {
          const { data, error } = await checkRecurringSlotConflicts({
              therapist_id: therapist.id,
              start_date: format(date, 'yyyy-MM-dd'),
              end_date: formData.recurringEndDate,
              weekday: date.getDay(),
              time: slot.slot_start_time,
              duration_minutes: formData.duration
          });
          if (error) throw error;
          setConflictData(data);
          setShowConflictModal(true);
      } catch (err) {
          toast({ variant: "destructive", title: "Gagal Mengecek Jadwal", description: err.message });
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
              time: slot.slot_start_time,
              duration_minutes: formData.duration,
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
           toast({ variant: "destructive", title: "Gagal Membuat Booking Berulang", description: err.message });
           setLoading(false);
      }
  };

  const startTimeStr = slot?.slot_start_time ? slot.slot_start_time.substring(0, 5) : "00:00";
  const [startH, startM] = startTimeStr.split(':').map(Number);
  const durationMins = formData.duration || 60;
  let endH = (startH + Math.floor((startM + durationMins) / 60)) % 24;
  let endM = (startM + durationMins) % 60;
  const formattedEndTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  if (showConflictModal && conflictData) {
      return (
          <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <h3 className="font-semibold text-blue-800 mb-2">Konfirmasi Booking Berulang</h3>
                  <p className="text-sm text-blue-700">
                      Anda akan membuat <strong>{conflictData.total_planned}</strong> jadwal setiap <strong>{format(date, 'EEEE', { locale: idLocale })}</strong> sampai <strong>{format(new Date(formData.recurringEndDate), 'dd MMM yyyy', { locale: idLocale })}</strong>.
                  </p>
              </div>
              {conflictData.conflicts?.length > 0 && (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                      <h4 className="font-medium text-red-800 mb-1">Terdapat {conflictData.conflicts.length} Bentrok</h4>
                      <ul className="text-xs text-red-700 list-disc list-inside max-h-32 overflow-y-auto">
                          {conflictData.conflicts.map((cDate, i) => (
                              <li key={i}>{format(new Date(cDate), 'dd MMMM yyyy', { locale: idLocale })}</li>
                          ))}
                      </ul>
                  </div>
              )}
              <DialogFooter>
                  <Button variant="outline" onClick={() => setShowConflictModal(false)}>Batal</Button>
                  <Button onClick={handleConfirmRecurring}>Lanjutkan</Button>
              </DialogFooter>
          </div>
      );
  }

  if (showResultModal && resultData) {
      return (
          <div className="space-y-4 text-center py-6">
              <div className={cn("w-12 h-12 mx-auto rounded-full flex items-center justify-center", resultData.failed_dates?.length > 0 ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600")}>
                  {resultData.failed_dates?.length > 0 ? <AlertCircle className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
              </div>
              <h3 className="text-lg font-semibold text-slate-800">Booking Selesai</h3>
              <p className="text-sm text-slate-600">Berhasil: {resultData.created_count} | Gagal: {resultData.failed_dates?.length || 0}</p>
              <Button onClick={() => { setShowResultModal(false); onSuccess(); onClose(); }} className="w-full">Selesai</Button>
          </div>
      );
  }

  return (
    <div className="space-y-5">
      <div className={cn("p-5 rounded-2xl border flex flex-col gap-3 shadow-sm", isLeave ? "bg-red-50 border-red-100" : "bg-gradient-to-br from-white to-slate-50 border-slate-200")}>
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
               <CalendarDays className={cn("w-4 h-4", isLeave ? "text-red-500" : "text-blue-600")} />
               <span className="text-sm font-medium">{date && isValid(date) ? format(date, 'EEEE, dd MMMM yyyy', { locale: idLocale }) : 'Tanggal Invalid'}</span>
            </div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{therapist.name}</div>
         </div>
         <div className="flex items-center gap-2">
            <Clock className={cn("w-4 h-4", isLeave ? "text-red-500" : "text-blue-600")} />
            <span className="text-3xl font-bold text-slate-900 tracking-tight">{startTimeStr}</span>
            <span className="text-slate-400 text-sm">- {formattedEndTime}</span>
         </div>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-lg">
        <button onClick={() => setFormData(prev => ({ ...prev, patient_type: 'registered' }))} disabled={isLeave || loading} className={cn("flex-1 text-sm font-medium py-2 rounded-md transition-all", formData.patient_type === 'registered' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>Pasien Terdaftar</button>
        <button onClick={() => setFormData(prev => ({ ...prev, patient_type: 'guest' }))} disabled={isLeave || loading} className={cn("flex-1 text-sm font-medium py-2 rounded-md transition-all", formData.patient_type === 'guest' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>Pasien Baru</button>
      </div>

      {formData.patient_type === 'registered' ? (
        <div className="space-y-2 relative" ref={searchContainerRef}>
          <Label>Cari Pasien</Label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Ketik nama atau No. RM..." 
              value={patientSearchTerm}
              onChange={async (e) => {
  const value = e.target.value;

  // 🔥 TAMBAHAN INI
  setFormData(prev => ({ ...prev, patient_id: '' }));

  setPatientSearchTerm(value);

  try {
    const { data } = await getPatients(value || '');
    setFilteredPatients(data || []);
    setShowDropdown(true);
  } catch (err) {
    console.error(err);
  }
}}
              onFocus={() => {
  setFilteredPatients(patients);
  setShowDropdown(true);
}}
              className="pl-9"
              disabled={isLeave || loading}
            />
          </div>
          {showDropdown && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
              {filteredPatients.length > 0 ? filteredPatients.map(p => (
                <div key={p.id} className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm" onClick={() => handlePatientSelect(p.id)}>
                  <div className="font-medium">{p.full_name}</div>
                  <div className="text-xs text-slate-500">{p.medical_record_number}</div>
                </div>
              )) : <div className="p-3 text-xs text-slate-500">Pasien tidak ditemukan.</div>}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Nama Pasien</Label><Input value={formData.guest_name} onChange={e => setFormData(prev => ({ ...prev, guest_name: e.target.value }))} disabled={isLeave || loading} /></div>
          <div className="space-y-1"><Label>No. WhatsApp</Label><Input value={formData.guest_phone} onChange={e => setFormData(prev => ({ ...prev, guest_phone: e.target.value }))} disabled={isLeave || loading} /></div>
        </div>
      )}

      {formData.patient_type === 'registered' && packageInfo && packageInfo.sessions_remaining > 0 && (() => {
        const lastDate = getLastValidDate(packageInfo);
        const isExpired = 
  packageInfo.sessions_remaining > 0 &&
  lastDate &&
  isBefore(new Date(lastDate), startOfDay(new Date()));
        return (
          <div className={cn("p-4 rounded-xl border text-sm transition-all duration-300", isExpired ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200", isJustActivated && "ring-2 ring-emerald-400 scale-[1.01]")}>
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-slate-800">{packageInfo.package_name}</span>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", isExpired ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700")}>{isExpired ? 'Expired' : 'Aktif'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2 rounded border text-center"><p className="text-slate-500">Terpakai</p><p className="font-bold">{packageInfo.sessions_used}/{packageInfo.total_sessions}</p></div>
              <div className="bg-white p-2 rounded border text-center"><p className="text-slate-500">Sisa</p><p className="font-bold text-blue-600">{packageInfo.sessions_remaining}</p></div>
            </div>
            {isExpired && (
              <Button size="sm" className="w-full mt-3 bg-red-600 hover:bg-red-700" onClick={() => setShowExtendModal(true)}>Perpanjang Masa Aktif</Button>
            )}
          </div>
        );
      })()}

      <div className="flex items-center space-x-2 border p-3 rounded-md bg-slate-50">
          <Checkbox id="homecare" checked={formData.is_homecare} onCheckedChange={(c) => setFormData(p => ({ ...p, is_homecare: !!c }))} disabled={isLeave || loading} />
          <Label htmlFor="homecare" className="text-xs font-medium cursor-pointer">Layanan Homecare</Label>
          <div className="mx-2 border-l h-4" />
          <Checkbox id="recurring" checked={formData.isRecurring} onCheckedChange={(c) => setFormData(p => ({ ...p, isRecurring: !!c }))} disabled={isLeave || loading} />
          <Label htmlFor="recurring" className="text-xs font-medium cursor-pointer">Recurring</Label>
      </div>

      {formData.isRecurring && (
        <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-top-1">
          <div className="space-y-1"><Label className="text-[10px] text-slate-500">Hari</Label><Input value={format(date, 'EEEE', { locale: idLocale })} disabled className="h-8 text-xs bg-slate-100" /></div>
          <div className="space-y-1"><Label className="text-[10px] text-slate-500">Sampai Tanggal</Label><Input type="date" value={formData.recurringEndDate} onChange={e => setFormData(p => ({ ...p, recurringEndDate: e.target.value }))} className="h-8 text-xs" /></div>
        </div>
      )}

      <div className="space-y-1"><Label>Keluhan / Catatan</Label><Textarea value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))} disabled={isLeave || loading} className="text-sm h-20" /></div>

      <DialogFooter className="pt-2">
        <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
        <Button onClick={handleSubmit} disabled={loading || isLeave} className="bg-slate-900 text-white px-8">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Konfirmasi"}</Button>
      </DialogFooter>

      {showExtendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-xs space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg">Perpanjang Paket</h3>
            <div className="space-y-1 p-3 bg-slate-50 rounded border text-xs">
              <p className="text-slate-500">Expired Terakhir</p>
              <p className="font-semibold">{lastDateGlobal ? format(new Date(lastDateGlobal), 'dd MMM yyyy', { locale: idLocale }) : '-'}</p>
              {(() => {
                if (!lastDateGlobal) return null;
                const lastDate = startOfDay(new Date(lastDateGlobal));
                const today = startOfDay(new Date());
                const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

                if (diffDays > 0) {
                  return <p className="text-red-600 mt-1 font-medium">Sudah expired {diffDays} hari</p>;
                }
                if (diffDays < 0) {
                  return <p className="text-emerald-600 mt-1 font-medium">Masih aktif {Math.abs(diffDays)} hari lagi</p>;
                }
                return <p className="text-slate-500 mt-1">Hari ini hari terakhir</p>;
              })()}
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs">Tanggal Expired Baru</Label>
              <Input type="date" value={extendDate} min={format(new Date(), 'yyyy-MM-dd')} onChange={e => setExtendDate(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowExtendModal(false)}>Batal</Button>
              <Button className="flex-1 bg-blue-600" onClick={async () => {
                try {
                  const today = startOfDay(new Date());
                  const selected = startOfDay(new Date(extendDate));
                  const diffDays = Math.ceil((selected - today) / (1000 * 60 * 60 * 24));
                  await extendPackage(packageInfo.id, diffDays);
                  toast({ title: "Berhasil", description: "Paket diperpanjang" });
                  const { data } = await getPatientLatestPackage(formData.patient_id);
setPackageInfo(data);
                  setIsJustActivated(true);
                  setTimeout(() => setIsJustActivated(false), 2000);
                  setShowExtendModal(false);
                } catch (err) {
                  toast({ variant: "destructive", title: "Gagal", description: err.message });
                }
              }}>Simpan</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlotBookingForm;