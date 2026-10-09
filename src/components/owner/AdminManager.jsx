import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Mail, Phone, Lock, Trash2, Edit2, 
  Plus, Save, Loader2, ShieldAlert, KeyRound, Eye, EyeOff, Camera
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { 
  getAdmins, createAdminAccount, getCurrentClinic 
} from '@/lib/api';
import { supabase } from '@/lib/customSupabaseClient';
import { prepareImageForUpload } from '@/lib/imageUpload';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { confirmAction } from '@/lib/confirmAction';

const AdminManager = () => {
  const { toast } = useToast();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clinicId, setClinicId] = useState(null);
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'clinic_admin'
  });
  const [password, setPassword] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');

  // Password reset state
  const [resetAdmin, setResetAdmin] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAdmins();
    fetchClinicId();
  }, []);

  const fetchClinicId = async () => {
    const { data } = await getCurrentClinic();
    if (data) setClinicId(data.id);
  };

  const fetchAdmins = async () => {
    setLoading(true);
    const { data, error } = await getAdmins();
    if (data) setAdmins(data);
    else toast({ variant: "destructive", title: "Error", description: error?.message });
    setLoading(false);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ variant: "destructive", title: "File tidak valid", description: "Pilih file gambar (JPG/PNG/WebP)." });
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  // Uploads the chosen photo and stores it as users.avatar_url, which the
  // splash screen reads for the logged-in account.
  const uploadAvatar = async (userId) => {
    const uploadFile = await prepareImageForUpload(avatarFile);
    const ext = uploadFile.name.split('.').pop();
    const path = `user-avatars/${userId}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('images').upload(path, uploadFile, { upsert: true });
    if (uploadError) throw uploadError;
    const { data: pub } = supabase.storage.from('images').getPublicUrl(path);
    const { data: updated, error: updateError } = await supabase.from('users').update({ avatar_url: pub.publicUrl }).eq('id', userId).select('id');
    if (updateError) throw updateError;
    if (!updated?.length) throw new Error('Tidak punya izin menyimpan foto untuk akun ini.');
  };

  const handleOpenDialog = () => {
    setEditingId(null);
    setAvatarFile(null);
    setAvatarPreview('');
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      role: 'clinic_admin'
    });
    setPassword('');
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (admin) => {
    setEditingId(admin.id);
    setAvatarFile(null);
    setAvatarPreview(admin.avatar_url || '');
    setFormData({
      full_name: admin.full_name || '',
      email: admin.email || '',
      phone: admin.phone || '',
      role: admin.role
    });
    setPassword('');
    setIsDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!formData.full_name.trim()) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: "Nama wajib diisi." });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('users')
      .update({ full_name: formData.full_name.trim(), phone: formData.phone.trim() || null })
      .eq('id', editingId);

    if (!error) {
      if (avatarFile) {
        try {
          await uploadAvatar(editingId);
        } catch (err) {
          toast({ variant: "destructive", title: "Foto Gagal Diupload", description: err.message });
          fetchAdmins();
          setSaving(false);
          return;
        }
      }
      toast({ title: "Admin Diperbarui", description: "Data admin berhasil disimpan." });
      fetchAdmins();
      setIsDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Gagal Menyimpan", description: error.message });
    }
    setSaving(false);
  };

  const handleResetPassword = async () => {
    if (!resetAdmin) return;
    if (newPassword.length < 6) {
      toast({ variant: "destructive", title: "Password Lemah", description: "Password minimal 6 karakter." });
      return;
    }
    setResetting(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session?.access_token) {
        toast({ variant: "destructive", title: "Sesi login sudah berakhir", description: "Silakan login ulang lalu coba lagi." });
        return;
      }
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { user_id: resetAdmin.id, new_password: newPassword },
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (error || data?.error) {
        let message = data?.error || error?.message;
        try { message = (await error?.context?.json?.())?.error || message; } catch { /* ignore */ }
        toast({ variant: "destructive", title: "Gagal Mengganti Password", description: message });
        return;
      }
      toast({ title: "Password Diganti", description: `Password baru untuk ${resetAdmin.email} telah diset.` });
      closeResetDialog();
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal Mengganti Password", description: err.message });
    } finally {
      setResetting(false);
    }
  };

  const closeResetDialog = () => {
    setResetAdmin(null);
    setNewPassword('');
    setShowNewPassword(false);
  };

  const handleSave = async () => {
    if (editingId) return handleUpdate();
    if (!formData.full_name || !formData.email || !password) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: "Nama, Email dan Password wajib diisi." });
      return;
    }
    
    if (password.length < 6) {
        toast({ variant: "destructive", title: "Password Lemah", description: "Password minimal 6 karakter." });
        return;
    }

    setSaving(true);
    
    // Owner hanya boleh membuat Admin Klinik, bukan Super Admin.
    const payload = { ...formData, role: 'clinic_admin', clinic_id: clinicId };
    const { data: created, error } = await createAdminAccount(payload, password);

    if (!error) {
      let photoFailed = false;
      if (avatarFile && created?.user_id) {
        try {
          await uploadAvatar(created.user_id);
        } catch (err) {
          photoFailed = true;
          toast({ variant: "destructive", title: "Akun dibuat, foto gagal diupload", description: `${err.message}. Anda bisa menambahkan foto lewat tombol Edit.` });
        }
      }
      if (!photoFailed) toast({ title: "Admin Berhasil Dibuat", description: `Akun untuk ${formData.email} telah aktif.` });
      fetchAdmins();
      setIsDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Gagal Menyimpan", description: error.message });
    }
    setSaving(false);
  };
  
  // Note: Currently just supporting deletion by updating isActive or similar, 
  // but for now Supabase Auth doesn't have a simple 'delete' from client without Edge Function for admin.
  // We will just disable the user in the public table for now, or use a restricted edge function if needed.
  // For simplicity in this demo environment, we will soft delete from public.users which effectively hides them from this list,
  // though they might still technically be in Auth. 
  const handleDelete = async (id) => {
    if (!await confirmAction("Nonaktifkan admin ini? Mereka tidak akan bisa mengakses dashboard.")) return;
    
    const { error } = await supabase.from('users').update({ is_active: false }).eq('id', id);
    
    if (!error) {
      toast({ title: "Admin Dinonaktifkan", description: "User telah dihapus dari daftar aktif." });
      fetchAdmins();
    } else {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Manajemen Admin & Staff</h2>
          <p className="text-sm text-slate-500">Buat akun untuk resepsionis atau admin klinik.</p>
        </div>
        <Button onClick={handleOpenDialog} className="bg-app-accent hover:bg-app-accent-hover">
          <Plus className="w-4 h-4 mr-2" /> Tambah Admin
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {admins.map((admin) => (
            <motion.div 
              key={admin.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-app border border-slate-200 shadow-sm overflow-hidden flex flex-col"
            >
              <div className="h-20 bg-slate-900 relative flex items-center justify-center">
                  <ShieldAlert className="text-slate-700 w-24 h-24 absolute -bottom-8 -right-8 opacity-20" />
                  <div className="z-10 flex flex-col items-center">
                     <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{admin.role.replace('_', ' ')}</span>
                  </div>
              </div>
              
              <div className="p-6 flex-1 flex flex-col gap-3">
                <div className="-mt-12 mb-2 flex justify-center">
                    <div className="w-16 h-16 rounded-full bg-white p-1 shadow-lg">
                        <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                            {admin.avatar_url
                              ? <img src={admin.avatar_url} alt={admin.full_name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                              : <User className="w-8 h-8 text-slate-500" />}
                        </div>
                    </div>
                </div>
                
                <div className="text-center">
                  <h3 className="font-bold text-lg text-slate-900">{admin.full_name}</h3>
                  <p className="text-slate-500 text-sm flex items-center justify-center gap-2 mt-1">
                      <Mail className="w-3 h-3" /> {admin.email}
                  </p>
                  {admin.phone && (
                     <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
                        <Phone className="w-3 h-3" /> {admin.phone}
                    </p>
                  )}
                </div>
                
                <div className="mt-auto pt-4 border-t border-slate-100 flex justify-center gap-2">
                   <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(admin)} className="text-app-accent hover:bg-app-soft hover:text-app-accent-hover">
                      <Edit2 className="w-4 h-4 mr-2" /> Edit
                   </Button>
                   <Button variant="ghost" size="sm" onClick={() => setResetAdmin(admin)} className="text-amber-600 hover:bg-amber-50 hover:text-amber-700">
                      <KeyRound className="w-4 h-4 mr-2" /> Password
                   </Button>
                   <Button variant="ghost" size="sm" onClick={() => handleDelete(admin.id)} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                      <Trash2 className="w-4 h-4 mr-2" /> Nonaktifkan Akun
                   </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Akun Admin' : 'Buat Akun Admin Baru'}</DialogTitle>
            <DialogDescription>
              User ini akan memiliki akses penuh ke Dashboard Admin.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-2">
               <label className="relative w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-app-accent-bright">
                  {avatarPreview
                    ? <img src={avatarPreview} alt="Foto profil" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    : <User className="w-10 h-10 text-slate-500" />}
                  <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white flex justify-center py-1">
                    <Camera className="w-4 h-4" />
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
               </label>
               <p className="text-xs text-slate-500">Foto profil (tampil di splash screen akun ini)</p>
            </div>

            <div className="space-y-2">
               <label className="text-sm font-medium">Nama Lengkap</label>
               <Input value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} placeholder="Nama Staff" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <label className="text-sm font-medium">Role Access</label>
                   <Input value="Clinic Admin" disabled readOnly />
                </div>
                <div className="space-y-2">
                   <label className="text-sm font-medium">No. Telepon</label>
                   <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
            </div>

            <div className="space-y-2">
               <label className="text-sm font-medium">Email Login</label>
               <Input type="email" disabled={!!editingId} value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="admin@klinik.com" />
            </div>

            {!editingId && (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-app-sm space-y-2">
                <h4 className="font-semibold text-yellow-800 flex items-center gap-2 text-sm">
                   <Lock className="w-3 h-3" /> Set Password
                </h4>
                <Input 
                   type="password" 
                   value={password} 
                   onChange={(e) => setPassword(e.target.value)} 
                   placeholder="Minimal 6 karakter"
                   className="bg-white"
                />
            </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-app-accent">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} {editingId ? 'Simpan Perubahan' : 'Buat Akun'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetAdmin} onOpenChange={(open) => { if (!open) closeResetDialog(); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Ganti Password Admin</DialogTitle>
            <DialogDescription>
              Set password baru untuk {resetAdmin?.full_name} ({resetAdmin?.email}). Password lama tidak bisa dilihat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium">Password Baru</label>
            <div className="relative">
              <Input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
                aria-label={showNewPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeResetDialog}>Batal</Button>
            <Button onClick={handleResetPassword} disabled={resetting} className="bg-app-accent">
              {resetting && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminManager;