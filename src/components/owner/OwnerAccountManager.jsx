import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User, Mail, Phone, Lock, Trash2,
  Plus, Loader2, Crown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  getOwners, createAdminAccount, getCurrentClinic
} from '@/lib/api';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";

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

    if (password.length < 6) {
      toast({ variant: "destructive", title: "Password Lemah", description: "Password minimal 6 karakter." });
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

  const handleDelete = async (id) => {
    if (id === user?.id) {
      toast({ variant: "destructive", title: "Tidak Diizinkan", description: "Anda tidak bisa menonaktifkan akun Anda sendiri." });
      return;
    }
    if (!window.confirm("Nonaktifkan akun owner ini? Mereka tidak akan bisa mengakses dashboard.")) return;

    const { error } = await supabase.from('users').update({ is_active: false }).eq('id', id);

    if (!error) {
      toast({ title: "Akun Dinonaktifkan", description: "Owner telah dihapus dari daftar aktif." });
      fetchOwners();
    } else {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Manajemen Akun Owner</h2>
          <p className="text-sm text-slate-500">Tambahkan owner lain yang memiliki akses penuh ke klinik ini.</p>
        </div>
        <Button onClick={handleOpenDialog} className="bg-blue-600 hover:bg-blue-700">
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
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
            >
              <div className="h-20 bg-slate-900 relative flex items-center justify-center">
                <Crown className="text-amber-700 w-24 h-24 absolute -bottom-8 -right-8 opacity-20" />
                <div className="z-10 flex flex-col items-center">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Owner</span>
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
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(owner.id)} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                      <Trash2 className="w-4 h-4 mr-2" /> Nonaktifkan Akun
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

export default OwnerAccountManager;
