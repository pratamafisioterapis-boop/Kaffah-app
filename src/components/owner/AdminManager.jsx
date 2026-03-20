import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Mail, Phone, Lock, Trash2, Edit2, 
  Plus, Save, Loader2, ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { 
  getAdmins, createAdminAccount, getCurrentClinic 
} from '@/lib/api';
import { supabase } from '@/lib/customSupabaseClient';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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

  const handleOpenDialog = () => {
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      role: 'clinic_admin'
    });
    setPassword('');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.full_name || !formData.email || !password) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: "Nama, Email dan Password wajib diisi." });
      return;
    }
    
    if (password.length < 6) {
        toast({ variant: "destructive", title: "Password Lemah", description: "Password minimal 6 karakter." });
        return;
    }

    setSaving(true);
    
    const payload = { ...formData, clinic_id: clinicId };
    const { error } = await createAdminAccount(payload, password);

    if (!error) {
      toast({ title: "Admin Berhasil Dibuat", description: `Akun untuk ${formData.email} telah aktif.` });
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
    if (!window.confirm("Nonaktifkan admin ini? Mereka tidak akan bisa mengakses dashboard.")) return;
    
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
        <Button onClick={handleOpenDialog} className="bg-blue-600 hover:bg-blue-700">
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
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
            >
              <div className="h-20 bg-slate-900 relative flex items-center justify-center">
                  <ShieldAlert className="text-slate-700 w-24 h-24 absolute -bottom-8 -right-8 opacity-20" />
                  <div className="z-10 flex flex-col items-center">
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{admin.role.replace('_', ' ')}</span>
                  </div>
              </div>
              
              <div className="p-6 flex-1 flex flex-col gap-3">
                <div className="-mt-12 mb-2 flex justify-center">
                    <div className="w-16 h-16 rounded-full bg-white p-1 shadow-lg">
                        <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center">
                            <User className="w-8 h-8 text-slate-400" />
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
                
                <div className="mt-auto pt-4 border-t border-slate-100 flex justify-center">
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
            <DialogTitle>Buat Akun Admin Baru</DialogTitle>
            <DialogDescription>
              User ini akan memiliki akses penuh ke Dashboard Admin.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
               <label className="text-sm font-medium">Nama Lengkap</label>
               <Input value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})} placeholder="Nama Staff" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <label className="text-sm font-medium">Role Access</label>
                   <Select value={formData.role} onValueChange={(val) => setFormData({...formData, role: val})}>
                      <SelectTrigger>
                         <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                         <SelectItem value="clinic_admin">Clinic Admin</SelectItem>
                         <SelectItem value="admin">Super Admin</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
                <div className="space-y-2">
                   <label className="text-sm font-medium">No. Telepon</label>
                   <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
            </div>

            <div className="space-y-2">
               <label className="text-sm font-medium">Email Login</label>
               <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="admin@klinik.com" />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg space-y-2">
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Buat Akun
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminManager;