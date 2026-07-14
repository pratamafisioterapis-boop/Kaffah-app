import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { getPhysiotherapists, getPatients, createAppointment, getUser } from '@/lib/api';
import { Calendar, AlertTriangle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import SearchableSelect from '@/components/ui/searchable-select';
import { supabase } from '@/lib/customSupabaseClient';


const AdminAppointmentScheduler = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState('admin');
  
  const [therapists, setTherapists] = useState([]);
  const [patients, setPatients] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [therapistStatus, setTherapistStatus] = useState(null);
  const [conflicts, setConflicts] = useState([]);

  // Form
  const [formData, setFormData] = useState({
    therapist_id: '',
    patient_type: 'registered', // registered, guest
    patient_id: '',
    guest_name: '',
    guest_phone: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    duration: '60',
    notes: ''
  });

  useEffect(() => {
    if (user) {
        getUser(user.id).then(res => {
            if (res.data) setUserRole(res.data.role);
        });
    }
    loadData();
  }, [user]);
  
  // Re-fetch slots when date or therapist changes
  useEffect(() => {
     if (formData.date && formData.therapist_id) {
        fetchSlots();
     } else {
        setAvailableSlots([]);
        setTherapistStatus(null);
     }
  }, [formData.date, formData.therapist_id]);

  const loadData = async () => {
    const [tRes, pRes] = await Promise.all([getPhysiotherapists(), getPatients()]);
    if (tRes.data) setTherapists(tRes.data);
    if (pRes.data) setPatients(pRes.data);
  };
  
  const fetchSlots = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUserId = sessionData?.session?.user?.id;
    const { data: currentUserRow } = await supabase.from('users').select('clinic_id').eq('id', currentUserId).single();

    const { data, error } = await supabase.rpc(
        'get_available_slots_with_status_by_date',
        { p_date: formData.date, p_clinic_id: currentUserRow?.clinic_id }
    );

    if (error) {
        console.error(error);
        setAvailableSlots([]);
        setTherapistStatus(null);
        return;
    }

    // 🔹 AMBIL STATUS TERAPIS (SATU KALI SAJA)
    // Find status row or 'aktif' row for this therapist
    const statusEntry = data.find(
        s => s.therapist_id === formData.therapist_id
    );
    // If multiple rows (slots), status is 'aktif'. If single status row, use that.
    // get_available_slots_with_status_by_date returns 'aktif' for available slots, 
    // and specific status for others.
    // If a therapist is active, they will have multiple rows with status='aktif'.
    // If 'cuti', one row with status='cuti'.
    
    let status = 'tidak_ada_jadwal';
    if (statusEntry) {
         if (statusEntry.status === 'aktif') status = 'aktif';
         else status = statusEntry.status;
    }

    setTherapistStatus(status);

    // 🔹 AMBIL SLOT YANG BOLEH DIBOOKING
    const slotsForTherapist = data
        .filter(s => s.therapist_id === formData.therapist_id)
        .filter(s => s.status === 'aktif')
        .map(s => ({
            slot_start_time: s.slot_start,
            slot_end_time: s.slot_end,
            duration_minutes: s.duration_minutes || 60
        }));

    setAvailableSlots(slotsForTherapist);
  };
  
  const handleSlotClick = (slot) => {
      setFormData(prev => ({
          ...prev,
          time: slot.slot_start_time.slice(0,5),
          duration: (slot.duration_minutes || 60).toString()
      }));
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  if (!formData.therapist_id) {
    toast({ variant: "destructive", title: "Pilih Terapis" });
    return;
  }

  setLoading(true);

  try {
    // 🔥 Cari slot yang mengandung jam tersebut
    const matchedSlot = availableSlots.find(slot => {
      const start = slot.slot_start_time.slice(0,5);
      const end = slot.slot_end_time.slice(0,5);
      return formData.time >= start && formData.time < end;
    });

    if (!matchedSlot) {
      toast({
        variant: "destructive",
        title: "Jam Tidak Valid",
        description: "Jam berada di luar rentang slot aktif."
      });
      setLoading(false);
      return;
    }

    const appointmentDate = `${formData.date}T${formData.time}:00`;

    const therapist = therapists.find(
      t => t.id === formData.therapist_id
    );

    const payload = {
  therapist_id: formData.therapist_id,
  clinic_id: therapist?.clinic_id,
  appointment_date: appointmentDate,
  duration_minutes: matchedSlot.duration_minutes,
  status: 'confirmed',
  notes: formData.notes,

  patient_id:
    formData.patient_type === 'registered'
      ? formData.patient_id
      : null,

  guest_name:
    formData.patient_type === 'guest'
      ? formData.guest_name
      : null,

  guest_phone:
    formData.patient_type === 'guest'
      ? formData.guest_phone
      : null,

  action_by: 'TEST_ACTION_BY',
action_by_name: 'TEST_NAME',
action_by_role: 'TEST_ROLE'
};

    const { error } = await createAppointment(payload, userRole);

    if (error) throw error;

    toast({ title: "Appointment Created Successfully" });

    setFormData(prev => ({
      ...prev,
      notes: '',
      guest_name: '',
      guest_phone: ''
    }));

    fetchSlots();

  } catch (error) {
    toast({
      variant: "destructive",
      title: "Error",
      description: error.message
    });
  } finally {
    setLoading(false);
  }
};

  const therapistOptions = therapists.map(t => ({
    value: t.id,
    label: t.name
  }));

  const patientOptions = patients.map(p => ({
    value: p.id,
    label: `${p.full_name} (${p.rm_number})`,
    description: p.phone
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Scheduler
            </CardTitle>
          </CardHeader>
          <CardContent>
            {conflicts.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2 text-red-700 text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <div>
                        <span className="font-bold block">Schedule Conflict!</span>
                        There is an overlap with existing appointment(s).
                    </div>
                </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
               {/* Therapist */}
               <div className="space-y-2">
                  <label className="text-sm font-medium">Therapist</label>
                  <SearchableSelect 
                     options={therapistOptions}
                     value={formData.therapist_id}
                     onChange={(v) => setFormData({...formData, therapist_id: v})}
                     placeholder="Select therapist..."
                  />
                  {therapistStatus && therapistStatus !== 'aktif' && (
                     <div className="text-xs text-red-500 font-medium px-1">
                        Status: {therapistStatus.toUpperCase()}
                     </div>
                  )}
               </div>
    
               {/* Date Time */}
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <label className="text-sm font-medium">Date</label>
                     <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                     <label className="text-sm font-medium">Time</label>
                     <Input type="time" value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} />
                  </div>
               </div>

    
               {/* Patient Type */}
               <div className="space-y-2">
                  <label className="text-sm font-medium">Patient</label>
                  <div className="flex gap-4 mb-2">
                     <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="ptype" checked={formData.patient_type === 'registered'} onChange={() => setFormData({...formData, patient_type: 'registered'})} />
                        Registered
                     </label>
                     <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="ptype" checked={formData.patient_type === 'guest'} onChange={() => setFormData({...formData, patient_type: 'guest'})} />
                        Guest / New
                     </label>
                  </div>
    
                  {formData.patient_type === 'registered' ? (
                     <SearchableSelect 
                        options={patientOptions}
                        value={formData.patient_id}
                        onChange={(v) => setFormData({...formData, patient_id: v})}
                        placeholder="Select patient..."
                     />
                  ) : (
                     <div className="grid grid-cols-2 gap-4">
                        <Input placeholder="Guest Name" value={formData.guest_name} onChange={(e) => setFormData({...formData, guest_name: e.target.value})} />
                        <Input placeholder="Guest Phone" value={formData.guest_phone} onChange={(e) => setFormData({...formData, guest_phone: e.target.value})} />
                     </div>
                  )}
               </div>
    
               <div className="space-y-2">
                  <label className="text-sm font-medium">Notes / Complaint</label>
                  <Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
               </div>
    
               <Button type="submit" className={`w-full ${conflicts.length > 0 ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-900'}`} disabled={loading || (therapistStatus && therapistStatus !== 'aktif')}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : conflicts.length > 0 ? 'Force Create (Overlap)' : 'Create Appointment'}
               </Button>
            </form>
          </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">Available Slots</CardTitle>
            </CardHeader>
            <CardContent>
                {!formData.therapist_id ? (
                    <div className="text-center py-8 text-slate-400 text-sm">Select a therapist first</div>
                ) : availableSlots.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                        {availableSlots.map((slot, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => handleSlotClick(slot)}
                                className={`py-2 px-1 rounded text-sm border transition-all hover:bg-slate-50 flex flex-col items-center justify-center gap-1 ${
                                    formData.time === slot.slot_start_time.slice(0,5) ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-slate-200'
                                }`}
                            >
                                <span className="font-semibold">{slot.slot_start_time.slice(0,5)}</span>
                                <span className="text-[10px] text-slate-500">{slot.duration_minutes || 60}m</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-400 text-sm">
                       {therapistStatus === 'cuti' && 'Therapist is on leave'}
                       {therapistStatus === 'full_booked' && 'All slots booked'}
                       {therapistStatus === 'tidak_ada_jadwal' && 'No schedule for this day'}
                       {!therapistStatus && 'No slots found for this day'}
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
};

export default AdminAppointmentScheduler;