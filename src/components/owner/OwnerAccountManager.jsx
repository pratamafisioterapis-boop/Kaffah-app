import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User, Mail, Phone, Lock, Trash2,
  Plus, Loader2, Crown, UserCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { useToast } from '@/components/ui/use-toast';
import {
  getOwners, createAdminAccount, getCurrentClinic
} from '@/lib/api';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { confirmAction } from '@/lib/confirmAction';
import { validatePassword } from '@/lib/passwordPolicy';

const OwnerAccountManager = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clinicId, setClinicId] = useState(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ full_name: '', email: '', phone: '' });
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchOwners();
    fetchClinicId();
  }, []);

  const fetchClinicId = async () => {
    const { data } = await getCurrentClinic();
    if (data) setClinicId(data.id);
  };

  const fetchOwners = async () => {
    setLoading(true);
    const { data, error } = await getOwners();
    if (data) setOwners(data);
    else toast({ variant: "destructive", title: "Error", description: error?.message });
    setLoading(false);
  };

  const handleOpenDialog = () => {
    setFormData({ full_name: '', email: '', phone: '' });
    setPassword('');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.full_name || !formData.email || !password) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: "Nama, Email dan Password wajib diisi." });
      return;
    }

    const pwError = await validatePassword(password);
    if (pwError) {
      toast({ variant: "destructive", title: "Password Kurang Aman", description: pwError });
      return;
    }

    setSaving(true);

    const payload = { ...formData, role: 'owner', clinic_id: clinicId };
    const { error } = await createAdminAccount(payload, password);

    if (!error) {
      toast({ title: "Akun Owner Berhasil Dibuat", description: `Akun untuk ${formData.email} telah aktif.` });
      fetchOwners();
      setIsDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Gagal Menyimpan", description: error.message });
    }
    setSaving(false);
  };

  const handleToggleActive = async (owner) => {
    const id = owner.id;
    const activate = owner.is_active === false;
    if (id === user?.id) {
      toast({ variant: "destructive", title: "Tidak Diizinkan", description: "Anda tidak bisa menonaktifkan akun Anda sendiri." });
      return;
    }
    const message = activate
      ? "Aktifkan kembali akun owner ini?"
      : "Nonaktifkan akun owner ini? Mereka tidak akan bisa mengakses dashboard.";
    if (!await confirmAction(message)) return;

    const { data, error } = await supabase
      .from('users').update({ is_active: activate }).eq('id', id).select('id');

    if (!error && data?.length) {
      toast({ title: activate ? "Akun Diaktifkan" : "Akun Dinonaktifkan", description: activate ? "Owner bisa login kembali." : "Owner tidak bisa login lagi." });
      fetchOwners();
    } else {
      toast({ variant: "destructive", title: "Gagal", description: error?.message || "Perubahan ditolak oleh database (tidak ada baris yang berubah)." });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Manajemen Akun Owner</h2>
          <p className="text-sm text-slate-500">Tambahkan owner lain yang memiliki akses penuh ke klinik ini.</p>
        </div>
        <Button onClick={handleOpenDialog} className="bg-app-accent hover:bg-app-accent-hover">
          <Plus className="w-4 h-4 mr-2" /> Tambah Owner
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {owners.map((owner) => (
            <motion.div
              key={owner.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`bg-white rounded-app border border-slate-200 shadow-sm overflow-hidden flex flex-col ${owner.is_active === false ? 'opacity-60' : ''}`}
            >
              <div className="h-20 bg-slate-900 relative flex items-center justify-center">
                <Crown className="text-amber-700 w-24 h-24 absolute -bottom-8 -right-8 opacity-20" />
                <div className="z-10 flex flex-col items-center">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Owner{owner.is_active === false ? ' · Nonaktif' : ''}</span>
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col gap-3">
                <div className="-mt-12 mb-2 flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-white p-1 shadow-lg">
                    <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center">
                      <User className="w-8 h-8 text-slate-500" />
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <h3 className="font-bold text-lg text-slate-900">
                    {owner.full_name}{owner.id === user?.id ? ' (Anda)' : ''}
                  </h3>
                  <p className="text-slate-500 text-sm flex items-center justify-center gap-2 mt-1">
                    <Mail className="w-3 h-3" /> {owner.email}
                  </p>
                  {owner.phone && (
                    <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
                      <Phone className="w-3 h-3" /> {owner.phone}
                    </p>
                  )}
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100 flex justify-center">
                  {owner.id !== user?.id && (
                    <Button variant="ghost" size="sm" onClick={() => handleToggleActive(owner)} className={owner.is_active === false ? "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700" : "text-red-600 hover:bg-red-50 hover:text-red-700"}>
                      {owner.is_active === false
                        ? <><UserCheck className="w-4 h-4 mr-2" /> Aktifkan Akun</>
                        : <><Trash2 className="w-4 h-4 mr-2" /> Nonaktifkan Akun</>}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Buat Akun Owner Baru</DialogTitle>
            <DialogDescription>
              User ini akan memiliki akses penuh sebagai Owner klinik ini, setara dengan akun Anda.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nama Lengkap</label>
              <Input value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} placeholder="Nama Owner" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">No. Telepon</label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email Login</label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="owner@klinik.com" />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-app-sm space-y-2">
              <h4 className="font-semibold text-yellow-800 flex items-center gap-2 text-sm">
                <Lock className="w-3 h-3" /> Set Password
              </h4>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 karakter, huruf & angka"
                className="bg-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-app-accent">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Buat Akun
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OwnerAccountManager;
