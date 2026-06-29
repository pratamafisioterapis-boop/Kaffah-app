import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Mail, Phone, Upload, Trash2, Edit2, 
  Plus, X, Loader2, Lock, UserPlus, CalendarClock,
  Eye, Monitor, Smartphone, Info, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  getAllPhysiotherapists, savePhysiotherapist, createTherapistAccount, deletePhysiotherapist, 
  uploadTherapistPhoto, getTherapistTimeOff, addTherapistTimeOff, deleteTherapistTimeOff,
  getCurrentClinic, getBadgesByOwner
} from '@/lib/api';
import { cn } from "@/lib/utils";
import { supabase } from '@/lib/customSupabaseClient';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const TherapistManager = () => {
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const { toast } = useToast();
  const navigate = useNavigate();
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clinicId, setClinicId] = useState(null);
  
  // Edit/Add State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTherapist, setEditingTherapist] = useState(null);
  const [formData, setFormData] = useState(initialFormState());
  const [password, setPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableBadges, setAvailableBadges] = useState([]);

  // Time Off State
  const [timeOffDialog, setTimeOffDialog] = useState(false);
  const [selectedTherapistForTimeOff, setSelectedTherapistForTimeOff] = useState(null);
  const [timeOffs, setTimeOffs] = useState([]);
  const [newTimeOff, setNewTimeOff] = useState({ start_date: '', end_date: '', reason: '' });
  const [loadingTimeOff, setLoadingTimeOff] = useState(false);

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  useEffect(() => {
    fetchTherapists();
    fetchClinicId();
    fetchBadges();
  }, []);

  const fetchClinicId = async () => {
    const { data } = await supabase
      .from('clinics')
      .select('id')
      .limit(1)
      .single();
    if (data) setClinicId(data.id);
  };

  const fetchBadges = async () => {
    const { data } = await getBadgesByOwner();
    if (data) setAvailableBadges(data);
  };

  function initialFormState() {
    return {
      name: '',
      email: '',
      phone: '',
      bio: '',
      specialization: 'Physiotherapist',
      avatar_url: '',
      is_active: true,
      services: [],
      salary_scheme: 'full_salary',
      base_salary: 0,
      transport_per_day: 0,
      show_on_landing: false,
      show_on_booking: false,
      badges: [], // Array of badge IDs
      theme_color: ''
    };
  }

  const fetchTherapists = async () => {
    setLoading(true);
    const { data, error } = await getAllPhysiotherapists();
    if (data) {
    const sorted = [...data].sort((a, b) => {
        // Active dulu
        if (a.is_active === b.is_active) {
            return a.name.localeCompare(b.name); // Kalau sama-sama active/inactive → urut nama
        }
        return b.is_active - a.is_active; // true (1) dulu, false (0) terakhir
    });

    setTherapists(sorted);
}
 else {
        toast({ variant: "destructive", title: "Error", description: error?.message });
    }
    setLoading(false);
  };

  const toggleTherapistStatus = async (therapist) => {
    const newStatus = !therapist.is_active;
    
    setTherapists(prev => prev.map(t => 
       t.id === therapist.id ? { ...t, is_active: newStatus } : t
    ));

    const { error } = await supabase
       .from('physiotherapists')
       .update({ is_active: newStatus })
       .eq('id', therapist.id);

    if (error) {
       setTherapists(prev => prev.map(t => 
         t.id === therapist.id ? { ...t, is_active: !newStatus } : t
       ));
       toast({ variant: "destructive", title: "Gagal Update Status", description: error.message });
    } else {
       toast({ 
         title: newStatus ? "Terapis Diaktifkan" : "Terapis Dinonaktifkan", 
         description: `Status ${therapist.name} telah diperbarui.` 
       });
    }
  };

  const handleOpenDialog = (therapist = null) => {
    if (therapist) {
      setEditingTherapist(therapist);
      
      setFormData({
        name: therapist.name || '',
        email: therapist.email || '',
        phone: therapist.phone || '',
        bio: therapist.bio || '',
        specialization: therapist.specialization || 'Physiotherapist',
        avatar_url: therapist.avatar_url || '',
        is_active: therapist.is_active,
        services: Array.isArray(therapist.services) ? therapist.services : [],
        salary_scheme: therapist.salary_scheme || 'full_salary',
        base_salary: therapist.base_salary || 0,
        transport_per_day: therapist.transport_per_day || 0,
        show_on_landing: therapist.show_on_landing || false,
        show_on_booking: therapist.show_on_booking || false,
        badges: Array.isArray(therapist.badges) ? therapist.badges : [],
        theme_color: therapist.theme_color || ''
      });
      setPassword(''); 
    } else {
      setEditingTherapist(null);
      setFormData(initialFormState());
      setPassword('');
    }
    setIsDialogOpen(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const { url, error } = await uploadTherapistPhoto(file);
    if (url) {
      setFormData(prev => ({ ...prev, avatar_url: url }));
      toast({ title: "Upload Sukses", description: "Foto berhasil diunggah." });
    } else {
      toast({ variant: "destructive", title: "Upload Gagal", description: error.message });
    }
    setUploading(false);
  };

  const handleServiceChange = (serviceId, isChecked) => {
      setFormData(prev => {
          const currentServices = prev.services || [];
          if (isChecked) {
              return { ...prev, services: [...currentServices, serviceId] };
          } else {
              return { ...prev, services: currentServices.filter(s => s !== serviceId) };
          }
      });
  };

  const handleBadgeChange = (badgeId, isChecked) => {
    setFormData(prev => {
        const currentBadges = prev.badges || [];
        if (isChecked) {
            return { ...prev, badges: [...currentBadges, badgeId] };
        } else {
            return { ...prev, badges: currentBadges.filter(b => b !== badgeId) };
        }
    });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: "Nama dan Email wajib diisi" });
      return;
    }

    if (!editingTherapist && !password) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: "Password wajib diisi untuk akun baru" });
      return;
    }

    

    setSaving(true);
    
    const payload = {
      ...formData,
      clinic_id: clinicId,
      base_salary: parseFloat(formData.base_salary) || 0,
      transport_per_day: parseFloat(formData.transport_per_day) || 0,
      show_on_landing: Boolean(formData.show_on_landing),
      show_on_booking: Boolean(formData.show_on_booking)
    };

    let error = null;
    let savedData = null;

    if (editingTherapist) {

  // 🔥 UPDATE AUTH VIA RPC — hanya jika ada password baru
  if (editingTherapist?.user_id && password && password.trim() !== '') {
    if (password.length < 6) {
      toast({ variant: "destructive", title: "Password Terlalu Pendek", description: "Password minimal 6 karakter." });
      setSaving(false);
      return;
    }

    const { error: authError } = await supabase.rpc('update_auth_user', {
      p_user_id: editingTherapist.user_id,
      p_email: formData.email || null,
      p_password: password.trim()
    });

    if (authError) {
      console.error('AUTH UPDATE ERROR:', authError);
      toast({ variant: "destructive", title: "Gagal Update Password", description: authError.message || "Password tidak dapat diperbarui." });
      setSaving(false);
      return;
    } else {
      console.log('Password berhasil diupdate untuk user:', editingTherapist.user_id);
    }
  }

  // 🔥 UPDATE DATA TERAPIS
  const { data, error: updateError } = await savePhysiotherapist({
    ...payload,
    id: editingTherapist.id
  });

  error = updateError;
  savedData = data;

} else {
      // 🔥 CREATE TERAPIS BARU
      const { data, error: createError } = await createTherapistAccount(payload, password);
      error = createError;
      savedData = data;
    }

    if (!error) {
      toast({ title: "Berhasil", description: editingTherapist ? "Data terapis diperbarui." : "Akun terapis baru berhasil dibuat." });
      if (editingTherapist) {
        setTherapists(prev => prev.map(t =>
          t.id === editingTherapist.id ? { ...t, ...formData } : t
        ));
      } else {
        setTherapists(prev => [...prev, { ...savedData, ...formData }]);
      }
      setIsDialogOpen(false);
      fetchTherapists();
    } else {
      toast({ 
        variant: "destructive", 
        title: "Gagal Menyimpan", 
        description: `${error.message || ''} ${error.details || ''} ${JSON.stringify(error)}`.slice(0, 200)
      });
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Yakin ingin menghapus terapis ini? Akun login mereka juga akan dinonaktifkan.")) return;
    const { error } = await deletePhysiotherapist(id);
    if (!error) {
      toast({ title: "Terhapus", description: "Data terapis telah dihapus" });
      setTherapists(prev => prev.filter(t => t.id !== id));
    } else {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    }
  };

  // Time Off Logic
  const fetchTimeOffs = async (id) => {
    setLoadingTimeOff(true);
    const { data } = await getTherapistTimeOff(id);
    if (data) setTimeOffs(data);
    setLoadingTimeOff(false);
  };

  const handleAddTimeOff = async () => {
    if (!newTimeOff.start_date || !newTimeOff.end_date) return;
    
    setLoadingTimeOff(true);
    const { error } = await addTherapistTimeOff({
      therapist_id: selectedTherapistForTimeOff.id,
      ...newTimeOff
    });

    if (!error) {
      setNewTimeOff({ start_date: '', end_date: '', reason: '' });
      fetchTimeOffs(selectedTherapistForTimeOff.id);
      toast({ title: "Cuti Ditambahkan", description: "Jadwal libur tersimpan." });
    } else {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
    setLoadingTimeOff(false);
  };

  const handleDeleteTimeOff = async (id) => {
    const { error } = await deleteTherapistTimeOff(id);
    if (!error) {
      fetchTimeOffs(selectedTherapistForTimeOff.id);
    }
  };
const headerColorMap = {
  blue: "from-blue-500 to-blue-600",
  green: "from-green-500 to-green-600",
  purple: "from-purple-500 to-purple-600",
  amber: "from-amber-500 to-amber-600",
  pink: "from-pink-500 to-pink-600",
  indigo: "from-indigo-500 to-indigo-600",
};
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Manajemen Terapis & Akun</h2>
          <p className="text-sm text-slate-500">Kelola profil, akun login, dan status fisioterapis.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
          <UserPlus className="w-4 h-4 mr-2" /> Buat Akun Terapis
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className={isPWA ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"}>
          {therapists.map((therapist) => (
            <motion.div 
              key={therapist.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col transition-all ${!therapist.is_active ? 'opacity-75 border-slate-300 bg-slate-50' : 'border-slate-200'}`}
            >
              <div className={cn(
  "h-24 relative bg-gradient-to-r",
  therapist.is_active
    ? headerColorMap[therapist.theme_color] || "from-blue-500 to-cyan-500"
    : "from-slate-400 to-slate-500"
)}>
                <div className="absolute -bottom-10 left-6">
                  <div className="w-20 h-20 rounded-full border-4 border-white bg-slate-100 overflow-hidden">
                    {therapist.avatar_url ? (
                      <img src={therapist.avatar_url} alt={therapist.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-full h-full p-4 text-slate-400" />
                    )}
                  </div>
                </div>
                
                <div className="absolute top-4 right-4 flex gap-2">
                   <div className="bg-white/90 backdrop-blur rounded-full p-1 flex items-center shadow-sm">
                      <Switch 
                         checked={therapist.is_active} 
                         onCheckedChange={() => toggleTherapistStatus(therapist)}
                         className="data-[state=checked]:bg-green-500"
                      />
                   </div>
                   <Button size="icon" variant="secondary" className="h-8 w-8 bg-white/20 hover:bg-white/40 text-white border-0" onClick={() => handleOpenDialog(therapist)}>
                     <Edit2 className="w-4 h-4" />
                   </Button>
                   <Button size="icon" variant="secondary" className="h-8 w-8 bg-white/20 hover:bg-red-500/80 text-white border-0" onClick={() => handleDelete(therapist.id)}>
                     <Trash2 className="w-4 h-4" />
                   </Button>
                </div>
              </div>
              
              <div className="pt-12 px-6 pb-6 flex-1 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{therapist.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${therapist.is_active ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                          {therapist.is_active ? 'Active' : 'Inactive'}
                       </span>
                       {therapist.user_id && <Lock className="w-3 h-3 text-green-500" title="Akun Login Terhubung" />}
                       <span className="bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded border border-yellow-200">
                         {therapist.salary_scheme === 'full_salary' ? 'Full Salary' : 'Custom Salary'}
                       </span>
                    </div>
                  </div>
                </div>

                <p className="text-blue-600 text-sm font-medium mt-1">{therapist.specialization}</p>

                <div className="space-y-2 text-sm text-slate-600 mt-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="truncate">{therapist.email || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>{therapist.phone || '-'}</span>
                  </div>
                </div>

                {/* Display Badges */}
                {Array.isArray(therapist.badges) && therapist.badges.length > 0 && (
                   <div className="mt-2 flex flex-wrap gap-1">
                      {therapist.badges.map(badgeId => {
                         const badge = availableBadges.find(b => b.id === badgeId);
                         if (!badge) return null;
                         return (
                            <span 
                                key={badge.id} 
                                className="text-[10px] px-2 py-0.5 rounded-full font-semibold border border-black/5"
                                style={{ backgroundColor: badge.color }}
                            >
                                {badge.label}
                            </span>
                         );
                      })}
                   </div>
                )}

                {/* Visibility Badges */}
                <div className="mt-2 flex gap-2">
                    {therapist.show_on_landing && (
                        <span className="flex items-center gap-1 text-[10px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded border border-sky-100">
                            <Monitor className="w-3 h-3" /> Landing Page
                        </span>
                    )}
                    {therapist.show_on_booking && (
                        <span className="flex items-center gap-1 text-[10px] bg-violet-50 text-violet-700 px-2 py-0.5 rounded border border-violet-100">
                            <Smartphone className="w-3 h-3" /> Booking
                        </span>
                    )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Jadwal Aktif</h4>
                  <div className="flex flex-wrap gap-1 text-xs">
                    {days.map((d, i) => {
                       const hours = therapist.working_hours?.[i];
                       const legacyActive = !hours && therapist.working_days?.includes(i);
                       const isActive = hours ? hours.enabled : legacyActive;
                       
                       if (!isActive) return null;
                       return (
                        <span key={i} className={`px-2 py-0.5 rounded-md border ${therapist.is_active ? 'bg-green-50 text-green-700 border-green-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {d.substring(0,3)}
                        </span>
                       );
                    })}
                  </div>
                </div>

                <Button 
                   variant="outline" 
                   size="sm" 
                   className="w-full mt-4 text-blue-600 border-blue-200 hover:bg-blue-50"
                   onClick={() => navigate(`/owner/therapist/${therapist.id}/schedule-settings`)}
                >
                    <CalendarClock className="w-4 h-4 mr-2" /> Atur Jam Praktek (Display)
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTherapist ? 'Edit Profil Terapis' : 'Buat Akun Terapis Baru'}</DialogTitle>
            <DialogDescription>
              {editingTherapist 
                 ? 'Perbarui informasi profil dan data akun.' 
                 : 'Isi formulir untuk membuat user login dan profil terapis baru.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            {/* Top Section */}
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex flex-col items-center gap-3 min-w-[120px]">
                <div className="w-24 h-24 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden shrink-0 relative group">
                  {formData.avatar_url ? (
                    <img src={formData.avatar_url} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-slate-400" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} />
                </div>
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nama Lengkap <span className="text-red-500">*</span></label>
                  <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="dr. Fulan" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Spesialisasi</label>
                  <Input value={formData.specialization} onChange={(e) => setFormData({...formData, specialization: e.target.value})} placeholder="Fisioterapi Olahraga" />
                </div>
                <div className="space-y-2">
  <label className="text-sm font-medium">Warna Terapis</label>
  <Select
    value={formData.theme_color || ""}
    onValueChange={(val) => setFormData({ ...formData, theme_color: val })}
  >
    <SelectTrigger>
      <SelectValue placeholder="Pilih warna" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="blue">Blue</SelectItem>
      <SelectItem value="green">Green</SelectItem>
      <SelectItem value="purple">Purple</SelectItem>
      <SelectItem value="amber">Amber</SelectItem>
      <SelectItem value="pink">Pink</SelectItem>
      <SelectItem value="indigo">Indigo</SelectItem>
    </SelectContent>
  </Select>
</div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email (Untuk Login) <span className="text-red-500">*</span></label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="nama@klinik.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">No. Telepon</label>
                  <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
            </div>

            {/* Salary Configuration Section */}
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100 space-y-4">
                <h4 className="font-semibold text-emerald-800 flex items-center gap-2">
                   <UserPlus className="w-4 h-4" /> Pengaturan Gaji
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                       <label className="text-xs font-medium text-slate-600">Tipe Skema Gaji</label>
                       <Select 
                          value={formData.salary_scheme} 
                          onValueChange={(val) => setFormData({...formData, salary_scheme: val})}
                       >
                          <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                             <SelectItem value="full_salary">Full Salary (Based on Omzet)</SelectItem>
                             <SelectItem value="custom_salary">Custom Salary (Based on Jasa)</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-medium text-slate-600">Gaji Pokok (Bulanan)</label>
                       <Input 
                          type="number" 
                          value={formData.base_salary} 
                          onChange={(e) => setFormData({...formData, base_salary: e.target.value})}
                          className="bg-white"
                          placeholder="0"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-medium text-slate-600">Transport (Per Hari)</label>
                       <Input 
                          type="number" 
                          value={formData.transport_per_day} 
                          onChange={(e) => setFormData({...formData, transport_per_day: e.target.value})}
                          className="bg-white"
                          placeholder="0"
                       />
                    </div>
                </div>
            </div>

            {/* Badge Selection */}
            <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3">
                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-600" /> Badge Profesional (Public)
                </h4>
                <div className="flex flex-wrap gap-2">
                   {availableBadges.length === 0 ? (
                      <p className="text-sm text-slate-400 italic">Belum ada badge. Tambahkan di tab "Badges".</p>
                   ) : (
                      availableBadges.map((badge) => (
                         <div key={badge.id} className="flex items-center space-x-2 bg-slate-50 p-2 rounded border border-slate-100 hover:bg-slate-100 cursor-pointer">
                            <Checkbox 
                                id={`badge-${badge.id}`}
                                checked={formData.badges?.includes(badge.id)}
                                onCheckedChange={(checked) => handleBadgeChange(badge.id, checked)}
                            />
                            <label htmlFor={`badge-${badge.id}`} className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: badge.color }}></span>
                                {badge.label}
                            </label>
                         </div>
                      ))
                   )}
                </div>
                {formData.badges?.length > 0 && (
                   <p className="text-xs text-green-600 font-medium">
                      {formData.badges.length} badge dipilih
                   </p>
                )}
            </div>

            {/* Visibility Controls */}
            <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100 space-y-3">
                <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                    <Eye className="w-4 h-4" /> Pengaturan Tampilan Publik
                </h4>
                <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-100 p-2 rounded">
                    <Info className="w-4 h-4" />
                    💡 Terapis akan ditampilkan di halaman public sesuai pilihan di atas. Jika tidak dipilih, terapis tetap aktif di sistem internal.
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2 bg-white p-3 rounded border border-blue-100">
                        <Checkbox 
                            id="show-landing" 
                            checked={formData.show_on_landing}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_on_landing: checked }))}
                        />
                        <div className="grid gap-1.5 leading-none">
                            <label htmlFor="show-landing" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                Tampilkan di Landing Page
                            </label>
                            <p className="text-[10px] text-slate-500">
                                Profil akan muncul di bagian "Tim Kami" pada halaman depan website.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 bg-white p-3 rounded border border-blue-100">
                        <Checkbox 
                            id="show-booking" 
                            checked={formData.show_on_booking}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_on_booking: checked }))}
                        />
                        <div className="grid gap-1.5 leading-none">
                            <label htmlFor="show-booking" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                Tampilkan di Booking Online
                            </label>
                            <p className="text-[10px] text-slate-500">
                                Pasien umum dapat memilih terapis ini saat melakukan reservasi online.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Services & Password Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3 p-4 bg-slate-50 rounded-lg border">
                    <label className="text-sm font-semibold text-slate-800 block">Layanan / Services</label>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="svc-physio" 
                                checked={formData.services?.includes('physiotherapy')}
                                onCheckedChange={(checked) => handleServiceChange('physiotherapy', checked)}
                            />
                            <label htmlFor="svc-physio" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Physiotherapy
                            </label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="svc-recovery" 
                                checked={formData.services?.includes('recovery')}
                                onCheckedChange={(checked) => handleServiceChange('recovery', checked)}
                            />
                            <label htmlFor="svc-recovery" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Recovery
                            </label>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Pilih jenis layanan yang dapat ditangani oleh terapis ini.</p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                    <h4 className="font-semibold text-yellow-800 flex items-center gap-2 mb-2">
                    <Lock className="w-4 h-4" /> Akses Akun
                    </h4>
                    <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                        {editingTherapist ? 'Reset Password (Biarkan kosong jika tidak diubah)' : 'Password Login *'}
                    </label>
                    <Input 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder={editingTherapist ? "********" : "Minimal 6 karakter"}
                    />
                    </div>
                </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Bio Singkat</label>
              <Textarea 
                value={formData.bio} 
                onChange={(e) => setFormData({...formData, bio: e.target.value})} 
                rows={2}
              />
            </div>
            
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving || uploading} className="bg-blue-600">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Time Off Dialog */}
      <Dialog open={timeOffDialog} onOpenChange={setTimeOffDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Kelola Cuti: {selectedTherapistForTimeOff?.name}</DialogTitle>
            <DialogDescription>Atur tanggal libur atau cuti terapis.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="text-xs font-medium text-slate-500">Dari Tanggal</label>
                 <Input type="date" value={newTimeOff.start_date} onChange={(e) => setNewTimeOff({...newTimeOff, start_date: e.target.value})} />
               </div>
               <div>
                 <label className="text-xs font-medium text-slate-500">Sampai Tanggal</label>
                 <Input type="date" value={newTimeOff.end_date} onChange={(e) => setNewTimeOff({...newTimeOff, end_date: e.target.value})} />
               </div>
             </div>
             <div>
               <label className="text-xs font-medium text-slate-500">Keterangan (Opsional)</label>
               <Input value={newTimeOff.reason} onChange={(e) => setNewTimeOff({...newTimeOff, reason: e.target.value})} placeholder="Contoh: Cuti Tahunan" />
             </div>
             <Button onClick={handleAddTimeOff} disabled={loadingTimeOff} size="sm" className="w-full">
               {loadingTimeOff ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 mr-2" />} Tambah Cuti
             </Button>
          </div>

          <div className="border-t pt-4">
             <h4 className="text-sm font-semibold mb-2">Jadwal Cuti Mendatang</h4>
             <div className="space-y-2 max-h-[200px] overflow-y-auto">
               {timeOffs.length === 0 ? (
                 <p className="text-sm text-slate-400 italic text-center py-2">Tidak ada jadwal cuti aktif.</p>
               ) : (
                 timeOffs.map((off) => (
                   <div key={off.id} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100 text-sm">
                      <div>
                        <div className="font-medium text-slate-700">
                          {format(new Date(off.start_date), 'dd MMM yyyy')} - {format(new Date(off.end_date), 'dd MMM yyyy')}
                        </div>
                        {off.reason && <div className="text-xs text-slate-500">{off.reason}</div>}
                      </div>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => handleDeleteTimeOff(off.id)}>
                        <X className="w-3 h-3" />
                      </Button>
                   </div>
                 ))
               )}
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TherapistManager;