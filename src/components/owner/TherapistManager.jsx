import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Phone, Upload, Trash2, Edit2,
  Plus, X, Loader2, Lock, UserPlus,
  Monitor, Smartphone, Shield, CalendarRange, CalendarDays,
  Wallet, Check, Megaphone, Stethoscope, Award, Receipt
} from 'lucide-react';
import PayrollManagerModal from '@/components/owner/PayrollManagerModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  getAllPhysiotherapists, savePhysiotherapist, createTherapistAccount, deletePhysiotherapist, 
  uploadTherapistPhoto, getTherapistTimeOff, addTherapistTimeOff, deleteTherapistTimeOff,
  getCurrentClinic, getBadgesByOwner
} from '@/lib/api';
import { cn, formatTherapistPeriodLabel } from "@/lib/utils";
import { COMPLAINT_TAGS } from "@/lib/complaintTags";
import { supabase } from '@/lib/customSupabaseClient';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { format } from 'date-fns';

const SectionCard = ({ icon: Icon, iconClass, title, description, children }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
    <div className="flex items-center gap-2">
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", iconClass)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <h4 className="font-semibold text-sm text-slate-800">{title}</h4>
    </div>
    {description && <p className="text-xs text-slate-500 -mt-1.5">{description}</p>}
    {children}
  </div>
);

const TherapistManager = () => {
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const { toast } = useToast();
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

  // Payroll State
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false);
  const [selectedTherapistForPayroll, setSelectedTherapistForPayroll] = useState(null);

  useEffect(() => {
    fetchTherapists();
    fetchClinicId();
    fetchBadges();
  }, []);

  const fetchClinicId = async () => {
    const { data } = await getCurrentClinic();
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
      period_start_day: 28,
      period_end_day: 27,
      show_on_landing: false,
      show_on_booking: false,
      remuneration_enabled: true,
      badges: [], // Array of badge IDs
      complaint_tags: [], // Array of complaint-tag slugs, for Smart Booking matching
      theme_color: '',
      signature_url: '',
      join_date: format(new Date(), 'yyyy-MM-dd')
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

  const toggleRemunerationEnabled = async (therapist) => {
    const newValue = !therapist.remuneration_enabled;

    setTherapists(prev => prev.map(t =>
      t.id === therapist.id ? { ...t, remuneration_enabled: newValue } : t
    ));

    const { error } = await supabase
      .from('physiotherapists')
      .update({ remuneration_enabled: newValue })
      .eq('id', therapist.id);

    if (error) {
      setTherapists(prev => prev.map(t =>
        t.id === therapist.id ? { ...t, remuneration_enabled: !newValue } : t
      ));
      toast({ variant: "destructive", title: "Gagal Update Remunerasi", description: error.message });
    } else {
      toast({
        title: newValue ? "Remunerasi Diaktifkan" : "Remunerasi Dinonaktifkan",
        description: `Status remunerasi ${therapist.name} telah diperbarui.`
      });
    }
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
        period_start_day: therapist.period_start_day || 28,
        period_end_day: therapist.period_end_day || 27,
        show_on_landing: therapist.show_on_landing || false,
        show_on_booking: therapist.show_on_booking || false,
        remuneration_enabled: therapist.remuneration_enabled ?? true,
        badges: Array.isArray(therapist.badges) ? therapist.badges : [],
        complaint_tags: Array.isArray(therapist.complaint_tags) ? therapist.complaint_tags : [],
        theme_color: therapist.theme_color || '',
        signature_url: therapist.signature_url || '',
        join_date: therapist.join_date || (therapist.created_at ? format(new Date(therapist.created_at), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
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

  const handleComplaintTagChange = (slug, isChecked) => {
    setFormData(prev => {
        const current = prev.complaint_tags || [];
        if (isChecked) {
            return { ...prev, complaint_tags: [...current, slug] };
        } else {
            return { ...prev, complaint_tags: current.filter(s => s !== slug) };
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

    if (!editingTherapist) {
      const normalizedName = formData.name.trim().toLowerCase();
      const possibleDuplicate = therapists.find(t => t.name.trim().toLowerCase() === normalizedName);
      if (possibleDuplicate) {
        const confirmed = window.confirm(
          `Sudah ada terapis dengan nama "${possibleDuplicate.name}" di daftar.\n\n` +
          `Kalau maksudnya mengubah data/foto terapis yang sudah ada, tekan Batal lalu pakai tombol Edit (ikon pensil) di kartu terapis tersebut — bukan "Buat Akun Terapis".\n\n` +
          `Lanjutkan buat akun BARU yang terpisah?`
        );
        if (!confirmed) return;
      }
    }

    setSaving(true);
    
    const payload = {
      ...formData,
      clinic_id: clinicId,
      base_salary: parseFloat(formData.base_salary) || 0,
      transport_per_day: formData.salary_scheme === 'probation' ? 0 : (parseFloat(formData.transport_per_day) || 0),
      period_start_day: Math.min(31, Math.max(1, parseInt(formData.period_start_day) || 28)),
      period_end_day: Math.min(31, Math.max(1, parseInt(formData.period_end_day) || 27)),
      show_on_landing: Boolean(formData.show_on_landing),
      show_on_booking: Boolean(formData.show_on_booking),
      remuneration_enabled: Boolean(formData.remuneration_enabled),
      join_date: formData.join_date || null
    };

    let error = null;
    let savedData = null;

    if (editingTherapist) {

  const hasExistingLogin = !!editingTherapist?.user_id;
  const emailChanged = formData.email && formData.email !== editingTherapist.email;
  const passwordChanged = password && password.trim() !== '';

  if (hasExistingLogin) {
    // 🔥 UPDATE AUTH VIA RPC — jika email login berubah dan/atau ada password baru.
    // Login sebenarnya disimpan di auth.users, terpisah dari kolom email di
    // tabel physiotherapists (yang cuma tampilan kartu) — keduanya harus
    // disinkronkan lewat RPC ini, bukan hanya saat password diganti.
    if (emailChanged || passwordChanged) {
      if (passwordChanged && password.length < 6) {
        toast({ variant: "destructive", title: "Password Terlalu Pendek", description: "Password minimal 6 karakter." });
        setSaving(false);
        return;
      }

      const { error: authError } = await supabase.rpc('update_auth_user', {
        p_user_id: editingTherapist.user_id,
        p_email: emailChanged ? formData.email : null,
        p_password: passwordChanged ? password.trim() : null
      });

      if (authError) {
        console.error('AUTH UPDATE ERROR:', authError);
        toast({ variant: "destructive", title: "Gagal Update Akun Login", description: authError.message || "Email/Password tidak dapat diperbarui." });
        setSaving(false);
        return;
      } else {
        console.log('Akun login berhasil diupdate untuk user:', editingTherapist.user_id);
      }
    }
  } else {
    // 🔥 Terapis ini belum pernah punya akun login (mis. pembuatan akun
    // sempat gagal saat pertama kali ditambahkan) — buat sekarang.
    if (!passwordChanged) {
      toast({ variant: "destructive", title: "Password Wajib Diisi", description: "Terapis ini belum punya akun login. Isi password untuk membuat akunnya." });
      setSaving(false);
      return;
    }
    if (password.length < 6) {
      toast({ variant: "destructive", title: "Password Terlalu Pendek", description: "Password minimal 6 karakter." });
      setSaving(false);
      return;
    }

    const { error: createAuthError } = await supabase.rpc('create_auth_user_for_therapist', {
      p_email: formData.email,
      p_password: password.trim(),
      p_therapist_id: editingTherapist.id
    });

    if (createAuthError) {
      console.error('AUTH CREATE ERROR:', createAuthError);
      toast({ variant: "destructive", title: "Gagal Membuat Akun Login", description: createAuthError.message || "Akun login tidak dapat dibuat." });
      setSaving(false);
      return;
    } else {
      console.log('Akun login berhasil dibuat untuk terapis:', editingTherapist.id);
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
      <div className={cn("flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3", isPWA && "gap-2")}>
        <div className="min-w-0">
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
          {therapists.map((therapist) => {
            const visibleBadges = Array.isArray(therapist.badges) ? therapist.badges : [];

            return (
            <motion.div
              key={therapist.id}
              initial={{ opacity: 0, scale: 0.97, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={cn(
                "group bg-white rounded-2xl border overflow-hidden flex flex-col transition-all duration-200 shadow-sm hover:shadow-lg",
                !therapist.is_active ? "opacity-70 border-slate-200 bg-slate-50" : "border-slate-200/80"
              )}
            >
              <div className={cn(
                "h-16 relative bg-gradient-to-r",
                therapist.is_active
                  ? headerColorMap[therapist.theme_color] || "from-blue-500 to-cyan-500"
                  : "from-slate-400 to-slate-500"
              )}>
                <div className={cn("absolute top-3 right-3 flex", isPWA ? "gap-1" : "gap-1.5")}>
                   <div className="bg-white/90 backdrop-blur rounded-full p-0.5 flex items-center shadow-sm">
                      <Switch
                         checked={therapist.is_active}
                         onCheckedChange={() => toggleTherapistStatus(therapist)}
                         className="data-[state=checked]:bg-green-500 scale-90"
                      />
                   </div>
                   <Button size="icon" variant="secondary" className="h-7 w-7 bg-white/20 hover:bg-white/40 text-white border-0" onClick={() => { setSelectedTherapistForPayroll(therapist); setPayrollDialogOpen(true); }} title="Payroll / Slip Gaji">
                     <Receipt className="w-3.5 h-3.5" />
                   </Button>
                   <Button size="icon" variant="secondary" className="h-7 w-7 bg-white/20 hover:bg-white/40 text-white border-0" onClick={() => handleOpenDialog(therapist)}>
                     <Edit2 className="w-3.5 h-3.5" />
                   </Button>
                   <Button size="icon" variant="secondary" className="h-7 w-7 bg-white/20 hover:bg-red-500/80 text-white border-0" onClick={() => handleDelete(therapist.id)}>
                     <Trash2 className="w-3.5 h-3.5" />
                   </Button>
                </div>
              </div>

              <div className="relative px-5 pb-5 flex-1 flex flex-col">
                <div className="absolute -top-8 left-5 w-16 h-16 rounded-full ring-4 ring-white bg-slate-100 overflow-hidden shadow-md">
                  {therapist.avatar_url ? (
                    <img src={therapist.avatar_url} alt={therapist.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-full h-full p-3.5 text-slate-400" />
                  )}
                </div>
                <div className="pl-[76px] min-h-[64px] flex flex-col justify-center">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-base text-slate-900 truncate">{therapist.name}</h3>
                    {therapist.user_id && <Lock className="w-3 h-3 text-green-500 shrink-0" title="Akun Login Terhubung" />}
                  </div>
                  <p className="text-slate-500 text-xs font-medium truncate">{therapist.specialization}</p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                    therapist.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", therapist.is_active ? "bg-emerald-500" : "bg-slate-400")} />
                    {therapist.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                    {therapist.salary_scheme === 'full_salary'
                      ? 'Full Salary'
                      : therapist.salary_scheme === 'probation'
                        ? 'Probation'
                        : 'Custom Salary'}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100"
                    title="Periode dipakai untuk penggajian, hari kerja, target, dan kunci SOAP"
                  >
                    <CalendarRange className="w-2.5 h-2.5" /> {formatTherapistPeriodLabel(therapist)}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleRemunerationEnabled(therapist)}
                    title="Klik untuk mengaktifkan/nonaktifkan program remunerasi terapis ini"
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors",
                      therapist.remuneration_enabled
                        ? "bg-violet-50 text-violet-700 border-violet-100 hover:bg-violet-100"
                        : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200"
                    )}
                  >
                    <Award className="w-2.5 h-2.5" /> {therapist.remuneration_enabled ? 'Remunerasi Aktif' : 'Remunerasi Nonaktif'}
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-3 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{therapist.email || '-'}</span>
                  <span className="text-slate-300 shrink-0">•</span>
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="shrink-0">{therapist.phone || '-'}</span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1.5 min-w-0">
                  <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">
                    Bergabung {(() => {
                      const joinDate = therapist.join_date || therapist.created_at;
                      return joinDate ? format(new Date(joinDate), 'dd MMM yyyy') : '-';
                    })()}
                  </span>
                </div>

                {(visibleBadges.length > 0 || therapist.show_on_landing || therapist.show_on_booking) && (
                  <div className="flex items-center justify-between gap-2 mt-3">
                    <div className="flex flex-wrap gap-1 min-w-0">
                      {visibleBadges.slice(0, 2).map(badgeId => {
                        const badge = availableBadges.find(b => b.id === badgeId);
                        if (!badge) return null;
                        return (
                          <span
                            key={badge.id}
                            className="text-[10px] px-2 py-0.5 rounded-full font-semibold border border-black/5 truncate max-w-[110px]"
                            style={{ backgroundColor: badge.color }}
                          >
                            {badge.label}
                          </span>
                        );
                      })}
                      {visibleBadges.length > 2 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          +{visibleBadges.length - 2}
                        </span>
                      )}
                    </div>
                    {(therapist.show_on_landing || therapist.show_on_booking) && (
                      <div className="flex items-center gap-1 shrink-0">
                        {therapist.show_on_landing && (
                          <span title="Tampil di Landing Page" className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-50 text-sky-600 border border-sky-100">
                            <Monitor className="w-3 h-3" />
                          </span>
                        )}
                        {therapist.show_on_booking && (
                          <span title="Tampil di Booking Online" className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-50 text-violet-600 border border-violet-100">
                            <Smartphone className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </motion.div>
          );})}
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
          
          <div className="grid gap-4 py-2">
            {/* Identitas */}
            <SectionCard icon={User} iconClass="bg-slate-100 text-slate-600" title="Identitas & Kontak">
              <div className="flex flex-col sm:flex-row gap-5">
                <div className="flex flex-col items-center gap-2.5 min-w-[104px]">
                  <div className="w-20 h-20 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden shrink-0 relative group">
                    {formData.avatar_url ? (
                      <img src={formData.avatar_url} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-slate-400" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload className="w-5 h-5 text-white" />
                    </div>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} />
                  </div>
                  <div className="space-y-1 w-full">
                    <label className="text-[10px] font-medium text-slate-500">Tanda Tangan</label>
                    {formData.signature_url && <img src={formData.signature_url} alt="TTD" className="h-9 mx-auto object-contain border rounded bg-slate-50 mb-1" />}
                    <input type="file" accept="image/*" onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      setUploading(true);
                      const { url, error } = await uploadTherapistPhoto(file);
                      if (url) setFormData(prev => ({ ...prev, signature_url: url }));
                      else toast({ variant: "destructive", title: "Upload Gagal", description: error.message });
                      setUploading(false);
                    }} className="text-[10px] w-full" disabled={uploading} />
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">Nama Lengkap <span className="text-red-500">*</span></label>
                    <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="dr. Fulan" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">Spesialisasi</label>
                    <Input value={formData.specialization} onChange={(e) => setFormData({...formData, specialization: e.target.value})} placeholder="Fisioterapi Olahraga" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">Email (Untuk Login) <span className="text-red-500">*</span></label>
                    <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="nama@klinik.com" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">No. Telepon</label>
                    <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">Tanggal Bergabung</label>
                    <Input type="date" value={formData.join_date} onChange={(e) => setFormData({...formData, join_date: e.target.value})} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-slate-600">Warna Kartu</label>
                    <Select
                      value={formData.theme_color || ""}
                      onValueChange={(val) => setFormData({ ...formData, theme_color: val })}
                    >
                      <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Pilih warna" /></SelectTrigger>
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
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-medium text-slate-600">Bio Singkat</label>
                <Textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({...formData, bio: e.target.value})}
                  rows={2}
                  placeholder="Ditampilkan di profil publik & dokumen medis"
                />
              </div>
            </SectionCard>

            {/* Gaji & Periode */}
            <div className={isPWA ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
              <SectionCard icon={Wallet} iconClass="bg-emerald-50 text-emerald-600" title="Pengaturan Gaji">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">Tipe Skema Gaji</label>
                    <Select
                      value={formData.salary_scheme}
                      onValueChange={(val) => setFormData(prev => ({
                        ...prev,
                        salary_scheme: val,
                        // Probation has no transport allowance — clear it so a
                        // stale value doesn't silently get paid out anyway.
                        transport_per_day: val === 'probation' ? 0 : prev.transport_per_day
                      }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_salary">Full Salary (Based on Omzet)</SelectItem>
                        <SelectItem value="custom_salary">Custom Salary (Based on Jasa)</SelectItem>
                        <SelectItem value="probation">Probation (Take Home Pay Saja)</SelectItem>
                      </SelectContent>
                    </Select>
                    {formData.salary_scheme === 'probation' && (
                      <p className="text-[11px] text-amber-600">Skema probation: hanya take home pay tetap, tanpa jasa/insentif dan tanpa uang transport.</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">
                        {formData.salary_scheme === 'probation' ? 'Take Home Pay' : 'Gaji Pokok'}
                      </label>
                      <Input
                        type="number"
                        value={formData.base_salary}
                        onChange={(e) => setFormData({...formData, base_salary: e.target.value})}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-600">Transport/Hari</label>
                      <Input
                        type="number"
                        value={formData.salary_scheme === 'probation' ? 0 : formData.transport_per_day}
                        onChange={(e) => setFormData({...formData, transport_per_day: e.target.value})}
                        placeholder="0"
                        disabled={formData.salary_scheme === 'probation'}
                        className={formData.salary_scheme === 'probation' ? 'bg-slate-50 text-slate-400' : ''}
                      />
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                icon={CalendarRange}
                iconClass="bg-indigo-50 text-indigo-600"
                title="Periode"
                description="Siklus bulanan berulang, dipakai otomatis untuk penggajian, hari kerja, target, dan kunci SOAP."
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">Dari Tanggal</label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={formData.period_start_day}
                      onChange={(e) => setFormData({...formData, period_start_day: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">Sampai Tanggal</label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={formData.period_end_day}
                      onChange={(e) => setFormData({...formData, period_end_day: e.target.value})}
                    />
                  </div>
                </div>
              </SectionCard>
            </div>

            <SectionCard
              icon={Award}
              iconClass="bg-violet-50 text-violet-600"
              title="Remunerasi"
              description="Aktifkan/nonaktifkan program penilaian performa & remunerasi untuk terapis ini."
            >
              <div className="flex items-center justify-between gap-3 py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <Award className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  <span className="text-sm font-medium text-slate-700 truncate">Ikutkan dalam program remunerasi</span>
                </div>
                <Switch
                  checked={formData.remuneration_enabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, remuneration_enabled: checked }))}
                />
              </div>
            </SectionCard>

            {/* Publikasi & Layanan */}
            <SectionCard
              icon={Megaphone}
              iconClass="bg-blue-50 text-blue-600"
              title="Publikasi & Layanan"
              description="Mengatur tampilan profil di halaman publik dan jenis layanan yang bisa dipesan."
            >
              <div className="flex items-center justify-between gap-3 py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <Monitor className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <span className="text-sm font-medium text-slate-700 truncate">Tampilkan di Landing Page</span>
                </div>
                <Switch
                  checked={formData.show_on_landing}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_on_landing: checked }))}
                />
              </div>
              <div className="flex items-center justify-between gap-3 py-1 border-t border-slate-100 pt-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Smartphone className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  <span className="text-sm font-medium text-slate-700 truncate">Tampilkan di Booking Online</span>
                </div>
                <Switch
                  checked={formData.show_on_booking}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_on_booking: checked }))}
                />
              </div>

              <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Layanan</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'physiotherapy', label: 'Physiotherapy' },
                    { id: 'recovery', label: 'Recovery' }
                  ].map(svc => {
                    const selected = formData.services?.includes(svc.id);
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => handleServiceChange(svc.id, !selected)}
                        className={cn(
                          "text-xs px-3 py-1 rounded-full font-semibold border transition-all",
                          selected ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        )}
                      >
                        {svc.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-blue-500" /> Badge Profesional
                </label>
                {availableBadges.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Belum ada badge. Tambahkan di tab "Badges".</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {availableBadges.map((badge) => {
                      const selected = formData.badges?.includes(badge.id);
                      return (
                        <button
                          key={badge.id}
                          type="button"
                          onClick={() => handleBadgeChange(badge.id, !selected)}
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-full font-semibold border flex items-center gap-1 transition-all",
                            selected ? "border-black/10" : "opacity-45 hover:opacity-80 border-transparent"
                          )}
                          style={{ backgroundColor: badge.color }}
                        >
                          {selected && <Check className="w-3 h-3" />}
                          {badge.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Keahlian Menangani Keluhan — dipakai untuk rekomendasi Smart Booking */}
            <SectionCard
              icon={Stethoscope}
              iconClass="bg-rose-50 text-rose-600"
              title="Keahlian Menangani Keluhan"
              description="Pilih kondisi/keluhan yang jadi keahlian terapis ini. Dipakai otomatis untuk mencocokkan rekomendasi terapis di Smart Booking — pilih minimal satu."
            >
              <div className="flex flex-wrap gap-1.5">
                {COMPLAINT_TAGS.map((tag) => {
                  const selected = formData.complaint_tags?.includes(tag.slug);
                  return (
                    <button
                      key={tag.slug}
                      type="button"
                      onClick={() => handleComplaintTagChange(tag.slug, !selected)}
                      className={cn(
                        "text-xs px-3 py-1 rounded-full font-semibold border flex items-center gap-1 transition-all",
                        selected ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-600 border-slate-200 hover:border-rose-200"
                      )}
                    >
                      {selected && <Check className="w-3 h-3" />}
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            {/* Akses Akun */}
            <SectionCard icon={Lock} iconClass="bg-amber-50 text-amber-600" title="Akses Akun">
              <div className="space-y-1.5 max-w-sm">
                <label className="text-xs font-medium text-slate-600">
                  {editingTherapist?.user_id
                    ? 'Reset Password (biarkan kosong jika tidak diubah)'
                    : editingTherapist
                      ? 'Password Login * (terapis ini belum punya akun login)'
                      : 'Password Login *'}
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingTherapist?.user_id ? "********" : "Minimal 6 karakter"}
                />
              </div>
            </SectionCard>
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
             <div className={isPWA ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-4"}>
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

      <PayrollManagerModal
        open={payrollDialogOpen}
        onClose={() => setPayrollDialogOpen(false)}
        therapist={selectedTherapistForPayroll}
      />
    </div>
  );
};

export default TherapistManager;