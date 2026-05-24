import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, User, Lock, Check, MessageCircle } from 'lucide-react';
import SearchableSelect from '@/components/ui/searchable-select';
import { createAppointment, getPhysiotherapistByUserId, updateAppointment } from '@/lib/api'; 
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useAppointmentState } from '@/contexts/AppointmentStateContext';
import { supabase } from '@/lib/customSupabaseClient';
import { cn, isFieldChanged, validateAppointmentStatus } from '@/lib/utils'; 

const AppointmentDetailModal = ({ 
  isOpen, 
  onClose, 
  appointment, 
  therapists = [], 
  patients = [],
  onSuccess 
}) => {
  const { toast } = useToast();
  const { user, role } = useAuth(); 
  const { deleteAppointment } = useAppointmentState();
  
  const [loading, setLoading] = useState(false);
  const [isRescheduleMode, setIsRescheduleMode] = useState(false);
  const [showRescheduleConfirm, setShowRescheduleConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [originalData, setOriginalData] = useState(null);
  const [formData, setFormData] = useState({
    patient_id: '',
    therapist_id: '',
    appointment_date: '',
    appointment_time: '',
    duration_minutes: 60,
    status: 'scheduled',
    notes: ''
  });
  
  const [availableSlots, setAvailableSlots] = useState([]);
  const [whatsappQueues, setWhatsappQueues] = useState([]);
const [loadingWhatsApp, setLoadingWhatsApp] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [therapistStatus, setTherapistStatus] = useState(null);

  const isTherapistRole = role === 'therapist' || role === 'physiotherapist';
  const isAdminRole = role === 'admin' || role === 'clinic_admin';
  const isOwnerRole = role === 'owner' || role === 'super_admin';

  const canEditTherapist = isOwnerRole || isAdminRole;
  const canEditDateTime = isOwnerRole || isAdminRole || isTherapistRole; 
  const canEditStatus = isOwnerRole || isAdminRole;
  
  const isCompleted = formData.status === 'completed';
  const canDelete = isOwnerRole || isAdminRole;

  useEffect(() => {
    if (isOpen) {
      if (appointment) {
        const dateObj = new Date(appointment.appointment_date);
        const initialData = {
          patient_id: appointment.patient_id,
          therapist_id: appointment.therapist_id,
          appointment_date: format(dateObj, 'yyyy-MM-dd'),
          appointment_time: format(dateObj, 'HH:mm'),
          duration_minutes: appointment.duration_minutes || 60,
          status: appointment.status || 'scheduled',
          notes: appointment.notes || ''
        };
        setFormData(initialData);
        setOriginalData(initialData);
      } else {
        const initialData = {
          patient_id: '',
          therapist_id: '',
          appointment_date: format(new Date(), 'yyyy-MM-dd'),
          appointment_time: '', 
          duration_minutes: 60,
          status: 'scheduled',
          notes: ''
        };
        setFormData(initialData);
        setOriginalData(initialData);
      }
      
      if (isTherapistRole && user) {
          fetchMyTherapistId();
      }
    }
  }, [isOpen, appointment, user]);
const fetchWhatsAppQueues = async () => {
  if (!appointment?.patient_id) return;

  setLoadingWhatsApp(true);

  const { data, error } = await supabase
    .from('follow_up_queue')
    .select('*')
    .eq('patient_id', appointment.patient_id)
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: false });

  if (!error) {
    setWhatsappQueues(data || []);
  }

  setLoadingWhatsApp(false);
};
  const fetchMyTherapistId = async () => {
      if (user?.id) {
          const { data } = await getPhysiotherapistByUserId(user.id);
          if (data) {
              setFormData(prev => ({ ...prev, therapist_id: data.id }));
          }
      }
  };

 useEffect(() => {
  const fetchSlots = async () => {
    if (!formData.therapist_id || !formData.appointment_date) {
      setAvailableSlots([]);
      setTherapistStatus(null);
      return;
    }

    setLoadingSlots(true);

    const { data, error } = await supabase.rpc(
      'get_available_slots_with_status_by_date',
      { p_date: formData.appointment_date }
    );

    if (error) {
      setAvailableSlots([]);
      setTherapistStatus(null);
      setLoadingSlots(false);
      return;
    }

    const statusEntry = data.find(
      s => s.therapist_id === formData.therapist_id
    );
    let status = 'tidak_ada_jadwal';
    if (statusEntry) {
         if (statusEntry.status === 'aktif') status = 'aktif';
         else status = statusEntry.status;
    }
    setTherapistStatus(status);

    if (status !== 'aktif' && !appointment?.id) {
      setAvailableSlots([]);
      setLoadingSlots(false);
      return;
    }

    const slots = data
      .filter(s => s.therapist_id === formData.therapist_id && s.status === 'aktif')
      .map(s => ({
        time: s.slot_start.slice(0,5),
        endTime: s.slot_end.slice(0,5)
      }));

    setAvailableSlots(slots);
    setLoadingSlots(false);
  };

  if (isOpen) fetchSlots();
}, [formData.therapist_id, formData.appointment_date, isOpen]);

  useEffect(() => {
    if (appointment && originalData) {
      const dateChanged = isFieldChanged(originalData.appointment_date, formData.appointment_date);
      const timeChanged = isFieldChanged(originalData.appointment_time, formData.appointment_time);
      
      if ((dateChanged || timeChanged) && formData.status !== 'rescheduled' && formData.status !== 'cancelled' && formData.status !== 'completed') {
         setFormData(prev => ({ ...prev, status: 'rescheduled' }));
      }
    }
  }, [formData.appointment_date, formData.appointment_time, originalData, appointment]);
useEffect(() => {
  if (showWhatsAppModal) {
    fetchWhatsAppQueues();
  }
}, [showWhatsAppModal]);
  const handleSubmit = async () => {
  if (isRescheduleMode) {
    setShowRescheduleConfirm(true);
    return;
  }

  if (!formData.patient_id && !appointment?.guest_name && !appointment?.id) {
    toast({ variant: "destructive", title: "Missing Information", description: "Please select a patient." });
    return;
  }
    
    if (!formData.appointment_time) {
        toast({ variant: "destructive", title: "Time Required", description: "Please select an appointment time." });
        return;
    }
    
    setLoading(true);
    try {
      const fullDateTime = new Date(`${formData.appointment_date}T${formData.appointment_time}`).toISOString();
      const payload = {
        patient_id: formData.patient_id || null,
        therapist_id: formData.therapist_id || null,
        appointment_date: fullDateTime,
        duration_minutes: parseInt(formData.duration_minutes),
        status: formData.status,
        notes: formData.notes
      };

      if (appointment?.id) {
        await updateAppointment(appointment.id, payload);
        toast({ title: "Success", description: "Appointment updated successfully." });
      } else {
        await createAppointment(payload, true);
        toast({ title: "Success", description: "Appointment created successfully." });
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save appointment." });
    } finally {
      setLoading(false);
    }
  };
const handleConfirmReschedule = async () => {
  setShowRescheduleConfirm(false);

  setLoading(true);
  try {
    const fullDateTime = new Date(`${formData.appointment_date}T${formData.appointment_time}`).toISOString();

    const payload = {
      patient_id: formData.patient_id || null,
      therapist_id: formData.therapist_id || null,
      appointment_date: fullDateTime,
      duration_minutes: parseInt(formData.duration_minutes),
      status: 'rescheduled',
      notes: formData.notes
    };

    await updateAppointment(appointment.id, payload);

    toast({ title: "Rescheduled", description: "Appointment berhasil di-reschedule." });

    if (onSuccess) onSuccess();
    onClose();
  } catch (error) {
    toast({ variant: "destructive", title: "Error", description: "Gagal reschedule." });
  } finally {
    setLoading(false);
  }
};
  const handleConfirmDelete = async () => {
    if (!appointment?.id) return;
    setLoading(true);
    try {
      await deleteAppointment(appointment.id, true);
      toast({ title: "Deleted", description: "Appointment removed." });
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete." });
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const patientOptions = patients.map(p => ({ label: `${p.full_name} (${p.rm_number})`, value: p.id }));
  const therapistOptions = therapists.map(t => ({ label: t.name, value: t.id }));

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
       <DialogContent 
  className="sm:max-w-[500px]"
  onOpenAutoFocus={(e) => e.preventDefault()}
>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                {appointment ? 'Edit Appointment' : 'New Appointment'}
                {appointment?.status === 'completed' && <Badge variant="secondary" className="bg-green-100 text-green-800"><Check className="w-3 h-3 mr-1"/>Completed</Badge>}
            </DialogTitle>
          </DialogHeader>
          {isRescheduleMode && (
  <div className="bg-orange-50 border border-orange-200 text-orange-800 px-3 py-2 rounded-md flex justify-between items-center text-sm">
    <span>⚠️ Reschedule Mode Active</span>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        setIsRescheduleMode(false);
        setFormData(originalData); // balik ke data awal
      }}
      className="text-orange-700 hover:text-orange-900"
      type="button"
    >
      Keluar
    </Button>
  </div>
)}
          <div className="grid gap-4 py-4">
            {!formData.patient_id && appointment?.guest_name && (
                <div className="bg-amber-50 p-3 rounded-md border border-amber-200 text-sm">
                    <div className="flex items-center gap-2 font-semibold text-amber-800 mb-1"><User className="w-4 h-4" /> Guest (Online Booking)</div>
                    <div className="grid grid-cols-2 gap-2 text-amber-700">
                        <div><span className="text-amber-600 text-xs">Name:</span> {appointment.guest_name}</div>
                        <div><span className="text-amber-600 text-xs">Phone:</span> {appointment.guest_phone || '-'}</div>
                    </div>
                </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center justify-between">Patient <Lock className="w-3 h-3 text-slate-400" /></label>
              <div className="opacity-80 pointer-events-none">
                <SearchableSelect options={patientOptions} value={formData.patient_id} onChange={() => {}} placeholder={appointment?.guest_name ? "Guest" : "Select Patient..."} disabled={true} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center justify-between">
                  Physiotherapist {!canEditTherapist && <Lock className="w-3 h-3 text-slate-400" />}
              </label>
              <div className={cn(!canEditTherapist && "opacity-80 pointer-events-none")}>
                <SearchableSelect 
    options={therapistOptions} 
    value={formData.therapist_id} 
    onChange={(val) => setFormData(prev => ({ ...prev, therapist_id: val, appointment_time: '' }))} 
    placeholder="Select Therapist..." 
    disabled={!canEditTherapist && !isRescheduleMode}
    autoFocus={false}
/>
              </div>
              {therapistStatus && therapistStatus !== 'aktif' && !appointment?.id && (
                  <span className="text-xs text-red-500 font-medium">Therapist Status: {therapistStatus.toUpperCase()}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">Date {!canEditDateTime && <Lock className="w-3 h-3 text-slate-400" />}</label>
                <Input 
                    type="date" 
                    value={formData.appointment_date} 
                    onChange={(e) => setFormData(prev => ({ ...prev, appointment_date: e.target.value, appointment_time: '' }))} 
                    disabled={(!canEditDateTime && !isRescheduleMode) || isCompleted}
                    autoFocus={false}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                    Time 
                    {!canEditDateTime && <Lock className="w-3 h-3 text-slate-400" />}
                    {loadingSlots && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                </label>
                <Select 
                    value={formData.appointment_time} 
                    onValueChange={(val) => setFormData(prev => ({ ...prev, appointment_time: val }))} 
disabled={(!canEditDateTime && !isRescheduleMode) || isCompleted || !formData.appointment_date || !formData.therapist_id}                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingSlots ? "Loading..." : "Select Time"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.length > 0 ? (
                        availableSlots.map((slot, idx) => (
                            <SelectItem key={idx} value={slot.time}>
                                {slot.time} - {slot.endTime}
                            </SelectItem>
                        ))
                    ) : (
                        <div className="p-2 text-xs text-slate-500 text-center">
                            {therapistStatus === 'cuti' ? 'On Leave' : 'No slots available'}
                        </div>
                    )}
                    {originalData?.appointment_time && !availableSlots.find(s => s.time === originalData.appointment_time) && (
                        <SelectItem value={originalData.appointment_time}>{originalData.appointment_time} (Current)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Duration (mins)</label>
                <Input type="number" value={formData.duration_minutes} onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: e.target.value }))} disabled={isCompleted || (!isOwnerRole && !isAdminRole)} autoFocus={false} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">Status {!canEditStatus && <Lock className="w-3 h-3 text-slate-400" />}</label>
                <Select value={formData.status} onValueChange={(val) => setFormData(prev => ({ ...prev, status: val }))} disabled={!canEditStatus || formData.status === 'rescheduled'} >
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="rescheduled" disabled>Rescheduled (Auto)</SelectItem>
                    <SelectItem value="no-show">No Show</SelectItem>
                  </SelectContent>
                </Select>
                {formData.status === 'rescheduled' && (<span className="text-[10px] text-orange-600 block">Auto-set to rescheduled.</span>)}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="Notes..." className="resize-none" disabled={isTherapistRole} autoFocus={false} />
            </div>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between items-center w-full">
  <div className="flex gap-2">
    {appointment?.id && canDelete && (
      <Button 
        variant="destructive" 
        size="sm" 
        onClick={() => setShowDeleteConfirm(true)} 
        disabled={loading} 
        type="button"
      >
        <Trash2 className="w-4 h-4 mr-2" /> Delete
      </Button>
    )}

    {appointment?.id && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => setFormData(prev => ({ ...prev, status: 'cancelled' }))}
    disabled={loading || formData.status === 'cancelled'}
    type="button"
  >
    Cancelled
  </Button>
)}

{appointment?.id && (
  <Button
    variant="secondary"
    size="sm"
    onClick={() => {
  setIsRescheduleMode(true);
  setFormData(prev => ({ ...prev, status: 'rescheduled' }));
}}
    disabled={loading}
    type="button"
  >
    Reschedule
  </Button>
)}
{appointment?.id && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => setShowWhatsAppModal(true)}
    disabled={loading}
    type="button"
  >
    <MessageCircle className="w-4 h-4 mr-2" />
    WhatsApp
  </Button>
)}
</div>

  <div className="flex gap-2">
    <Button variant="outline" onClick={onClose} disabled={loading} type="button">
      Close
    </Button>
    <Button onClick={handleSubmit} disabled={loading}>
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      Save
    </Button>
  </div>
</DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Confirm Deletion</DialogTitle><DialogDescription>Are you sure?</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showRescheduleConfirm} onOpenChange={setShowRescheduleConfirm}>
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>Confirm Reschedule</DialogTitle>
      <DialogDescription>
        Yakin ingin merubah jadwal ini?
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button 
        variant="outline" 
        onClick={() => setShowRescheduleConfirm(false)}
      >
        Batal
      </Button>
      <Button onClick={handleConfirmReschedule}>
        Ya, Reschedule
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
<Dialog open={showWhatsAppModal} onOpenChange={setShowWhatsAppModal}>
  <DialogContent className="sm:max-w-[700px]">
    <DialogHeader>
      <DialogTitle>WhatsApp Follow Up</DialogTitle>
      <DialogDescription>
        Pending & failed WhatsApp queue untuk pasien ini
      </DialogDescription>
    </DialogHeader>

    <div className="py-4 max-h-[500px] overflow-y-auto space-y-3">
  {loadingWhatsApp ? (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
    </div>
  ) : whatsappQueues.length === 0 ? (
    <div className="text-center text-sm text-slate-500 py-10">
      Tidak ada WhatsApp pending / failed
    </div>
  ) : (
    whatsappQueues.map((item) => (
      <div
        key={item.id}
        className="border rounded-xl p-4 space-y-3 bg-white"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">
              {item.follow_up_type || '-'}
            </div>

            <div className="text-xs text-slate-500">
              {item.phone_number || item.guest_phone || '-'}
            </div>
          </div>

          <Badge
            variant={
              item.status === 'failed'
                ? 'destructive'
                : 'secondary'
            }
          >
            {item.status}
          </Badge>
        </div>

        <div className="text-sm whitespace-pre-wrap bg-slate-50 rounded-lg p-3 border">
          {item.message_content || '-'}
        </div>

        {item.failed_reason && (
          <div className="text-xs text-red-500">
            Failed: {item.failed_reason}
          </div>
        )}
      </div>
    ))
  )}
</div>

    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => setShowWhatsAppModal(false)}
      >
        Tutup
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
    </>
  );
};

export default AppointmentDetailModal;