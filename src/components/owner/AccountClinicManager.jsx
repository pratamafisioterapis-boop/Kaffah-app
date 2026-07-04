import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Mail, Lock, Building2, Upload } from 'lucide-react';

const AccountClinicManager = () => {
  const { user, userDetails } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [clinic, setClinic] = useState(null);
  const [clinicName, setClinicName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [savingClinic, setSavingClinic] = useState(false);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

  useEffect(() => {
    const fetchClinic = async () => {
      if (!userDetails?.clinic_id) return;
      const { data } = await supabase.from('clinics').select('*').eq('id', userDetails.clinic_id).single();
      if (data) { setClinic(data); setClinicName(data.name); }
    };
    fetchClinic();
  }, [userDetails]);

  const handleUpdateEmail = async () => {
    if (!email) return;
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email });
    setSavingEmail(false);
    if (error) toast({ variant: 'destructive', title: 'Gagal ubah email', description: error.message });
    else toast({ title: 'Cek email baru Anda', description: 'Link konfirmasi telah dikirim.' });
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      toast({ variant: 'destructive', title: 'Password minimal 6 karakter' });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) toast({ variant: 'destructive', title: 'Gagal ubah password', description: error.message });
    else { toast({ title: 'Password berhasil diubah' }); setNewPassword(''); }
  };

  const handleSaveClinicName = async () => {
    if (!clinicName.trim() || !clinic) return;
    setSavingClinic(true);
    const { error } = await supabase.from('clinics').update({ name: clinicName }).eq('id', clinic.id);
    setSavingClinic(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal update nama klinik', description: error.message });
    } else {
      toast({ title: 'Nama klinik diperbarui, memuat ulang...' });
      setTimeout(() => window.location.reload(), 800);
    }
  };

  const handleUploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !clinic) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `clinic-logos/${clinic.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('clinic-assets').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from('clinic-assets').getPublicUrl(path);
      const { error: updateError } = await supabase.from('clinics').update({ logo_url: pub.publicUrl }).eq('id', clinic.id);
      if (updateError) throw updateError;
      setClinic({ ...clinic, logo_url: pub.publicUrl });
      toast({ title: 'Foto profil klinik diperbarui, memuat ulang...' });
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal upload foto', description: err.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Mail className="w-4 h-4" /> Ubah Email Login</h3>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button onClick={handleUpdateEmail} disabled={savingEmail} className="bg-blue-600">
          {savingEmail && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan Email
        </Button>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Lock className="w-4 h-4" /> Ubah Password</h3>
        <Input type="password" placeholder="Password baru (min. 6 karakter)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <Button onClick={handleUpdatePassword} disabled={savingPassword} className="bg-blue-600">
          {savingPassword && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan Password
        </Button>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Building2 className="w-4 h-4" /> Profil Klinik</h3>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center border">
            {clinic?.logo_url ? <img src={clinic.logo_url} alt="Logo" className="w-full h-full object-cover" /> : <Building2 className="w-6 h-6 text-slate-400" />}
          </div>
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-slate-50">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Ganti Foto
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={handleUploadLogo} disabled={uploading} />
          </label>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Nama Klinik</label>
          <Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
        </div>
        <Button onClick={handleSaveClinicName} disabled={savingClinic} className="bg-blue-600">
          {savingClinic && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan Nama Klinik
        </Button>
      </div>
    </div>
  );
};

export default AccountClinicManager;