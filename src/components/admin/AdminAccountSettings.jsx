import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Mail, Lock, UserCircle, Upload } from 'lucide-react';
import TherapistDriveUploadsManager from '@/components/owner/TherapistDriveUploadsManager';

const AdminAccountSettings = () => {
  const { user, userDetails, clinicName } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState(userDetails?.avatar_url || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

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

  const handleUploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `user-avatars/${user.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('images').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from('images').getPublicUrl(path);
      const { error: updateError } = await supabase.from('users').update({ avatar_url: pub.publicUrl }).eq('id', user.id);
      if (updateError) throw updateError;
      setAvatarUrl(pub.publicUrl);
      toast({ title: 'Foto splash screen diperbarui' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal upload foto', description: err.message });
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-[18px] sm:rounded-[22px] border border-[#DCE8F2] shadow-sm h-44 sm:h-52 md:h-60 lg:h-72">
        <img
          src="/hero/clinara-setup-hero.png"
          alt="Kaffah Physiotherapy"
          className="absolute inset-0 w-full h-full object-cover object-[38%_center]"
        />
        <div className="absolute inset-0 flex flex-col justify-center px-4 sm:px-6 md:px-10 lg:px-14">
          <div className="max-w-[74%] sm:max-w-[62%] md:max-w-sm">
            <p className="text-[#5B6B7D] text-xs sm:text-sm font-medium mb-1">{clinicName || ''}</p>
            <h1
              style={{ fontFamily: "'Caveat', cursive" }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#102F52] leading-[0.85]"
            >
              Pengaturan<br />
              <span className="text-[#2F8CFF] underline decoration-wavy decoration-2 md:decoration-[3px] underline-offset-4 md:underline-offset-8">
                Akun
              </span>
            </h1>
            <p className="text-[#5B6B7D] text-[10px] sm:text-xs md:text-sm mt-1.5 md:mt-3 leading-snug md:leading-relaxed">
              Kelola profil, email, dan password akun Anda.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 max-w-xl">
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2"><UserCircle className="w-4 h-4" /> Foto Profil (Splash Screen)</h3>
          <p className="text-sm text-slate-500">Foto ini hanya tampil di splash screen saat Anda membuka aplikasi. Jika tidak diganti, splash screen akan memakai logo klinik.</p>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border">
              {avatarUrl ? <img src={avatarUrl} alt="Foto Profil" className="w-full h-full object-cover" /> : <UserCircle className="w-6 h-6 text-slate-400" />}
            </div>
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-slate-50">
                {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Ganti Foto
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handleUploadAvatar} disabled={uploadingAvatar} />
            </label>
          </div>
        </div>

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
      </div>

      <div className="max-w-3xl">
        <TherapistDriveUploadsManager allowDelete={false} />
      </div>
    </div>
  );
};

export default AdminAccountSettings;
