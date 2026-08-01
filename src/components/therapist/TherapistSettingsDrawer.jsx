import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getTherapistAnnualLeaveBalance } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

import {
  User, Bell, CalendarOff, KeyRound,
  Camera, Loader2, Plus, Trash2, ChevronRight,
  Check, X, Eye, EyeOff, Umbrella
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

// ─── Tab konstanta ────────────────────────────────────────────────────────────
const TABS = [
  { id: 'profil',    label: 'Profil',      icon: User },
  { id: 'notifikasi',label: 'Notifikasi',  icon: Bell },
  { id: 'cuti',      label: 'Cuti',        icon: CalendarOff },
  { id: 'akun',      label: 'Akun',        icon: KeyRound },
];

// ─── Helper ───────────────────────────────────────────────────────────────────
const Avatar = ({ url, name, size = 'lg' }) => {
  const dim = size === 'lg' ? 'w-20 h-20 text-2xl' : 'w-10 h-10 text-base';
  return url ? (
    <img src={url} alt={name} className={`${dim} rounded-full object-cover border-2 border-white shadow-md`} />
  ) : (
    <div className={`${dim} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold border-2 border-white shadow-md`}>
      {name?.charAt(0)?.toUpperCase() || 'T'}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PROFIL
// ═══════════════════════════════════════════════════════════════════════════════
const TabProfil = ({ therapist, onUpdated }) => {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: therapist?.name || '',
    phone: therapist?.phone || '',
    bio: therapist?.bio || '',
    specialization: therapist?.specialization || '',
    avatar_url: therapist?.avatar_url || '',
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const [splashAvatarUrl, setSplashAvatarUrl] = useState('');
  const [uploadingSplash, setUploadingSplash] = useState(false);
  const splashFileRef = useRef();

  useEffect(() => {
    let active = true;
    const fetchSplashAvatar = async () => {
      if (!user?.id) return;
      const { data } = await supabase.from('users').select('avatar_url').eq('id', user.id).single();
      if (active) setSplashAvatarUrl(data?.avatar_url || '');
    };
    fetchSplashAvatar();
    return () => { active = false; };
  }, [user?.id]);

  const handleUploadSplashAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File terlalu besar', description: 'Maksimal 2MB.' });
      return;
    }
    setUploadingSplash(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `user-avatars/${user.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('images').upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('images').getPublicUrl(path);
      const { error: updateErr } = await supabase.from('users').update({ avatar_url: urlData.publicUrl }).eq('id', user.id);
      if (updateErr) throw updateErr;

      setSplashAvatarUrl(urlData.publicUrl);
      toast({ title: 'Foto splash screen diperbarui' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Upload gagal', description: err.message });
    } finally {
      setUploadingSplash(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File terlalu besar', description: 'Maksimal 2MB.' });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filename = `${therapist.id}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('therapist-photos')
        .upload(filename, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from('therapist-photos')
        .getPublicUrl(filename);

      setForm(f => ({ ...f, avatar_url: urlData.publicUrl }));
      toast({ title: 'Foto berhasil diupload' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Upload gagal', description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('physiotherapists')
        .update({
          name: form.name,
          phone: form.phone,
          bio: form.bio,
          specialization: form.specialization,
          avatar_url: form.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', therapist.id);
      if (error) throw error;
      toast({ title: 'Profil berhasil disimpan' });
      onUpdated?.({ ...therapist, ...form });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Avatar */}
      <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative shrink-0">
          <Avatar url={form.avatar_url} name={form.name} size="lg" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-1.5 shadow-lg hover:bg-blue-700 transition"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">{form.name || 'Nama Terapis'}</p>
          <p className="text-xs text-slate-400 mt-0.5">{form.specialization || 'Spesialisasi'}</p>
          <p className="text-xs text-blue-500 mt-1.5 cursor-pointer" onClick={() => fileRef.current?.click()}>
            Ganti foto profil
          </p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      </div>

      {/* Form fields */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
        <div className="px-4 py-3 space-y-1">
          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nama Lengkap</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="border-0 px-0 shadow-none focus-visible:ring-0 text-sm font-medium text-slate-800 h-8" />
        </div>
        <div className="px-4 py-3 space-y-1">
          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No. HP</Label>
          <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="08xx-xxxx-xxxx" className="border-0 px-0 shadow-none focus-visible:ring-0 text-sm font-medium text-slate-800 h-8" />
        </div>
        <div className="px-4 py-3 space-y-1">
          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Spesialisasi</Label>
          <Input value={form.specialization} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))} className="border-0 px-0 shadow-none focus-visible:ring-0 text-sm font-medium text-slate-800 h-8" />
        </div>
        <div className="px-4 py-3 space-y-1">
          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bio</Label>
          <textarea
            value={form.bio}
            onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
            rows={4}
            className="w-full text-sm text-slate-800 font-medium border-0 px-0 shadow-none resize-none focus:outline-none bg-transparent leading-relaxed"
            placeholder="Ceritakan sedikit tentang kamu..."
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 h-11">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
        Simpan Profil
      </Button>

      {/* Foto Splash Screen (terpisah dari foto di therapist card) */}
      <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative shrink-0">
          <Avatar url={splashAvatarUrl} name={form.name} size="lg" />
          <button
            onClick={() => splashFileRef.current?.click()}
            disabled={uploadingSplash}
            className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-1.5 shadow-lg hover:bg-blue-700 transition"
          >
            {uploadingSplash ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Foto Splash Screen</p>
          <p className="text-xs text-slate-400 mt-0.5">Tampil saat kamu membuka aplikasi. Jika kosong, memakai foto di therapist card.</p>
          <p className="text-xs text-blue-500 mt-1.5 cursor-pointer" onClick={() => splashFileRef.current?.click()}>
            Ganti foto splash screen
          </p>
        </div>
        <input ref={splashFileRef} type="file" accept="image/*" className="hidden" onChange={handleUploadSplashAvatar} />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: NOTIFIKASI
// ═══════════════════════════════════════════════════════════════════════════════
const TabNotifikasi = ({ userId }) => {
  const [prefs, setPrefs] = useState({ notif_soap_enabled: true, notif_guest_enabled: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('fcm_tokens')
        .select('notif_soap_enabled, notif_guest_enabled')
        .eq('user_id', userId)
        .maybeSingle();
      if (data) setPrefs({ notif_soap_enabled: data.notif_soap_enabled, notif_guest_enabled: data.notif_guest_enabled });
      setLoading(false);
    };
    fetch();
  }, [userId]);

  const handleToggle = async (key) => {
    const newVal = !prefs[key];
    setPrefs(p => ({ ...p, [key]: newVal }));
    setSaving(true);
    const { error } = await supabase
      .from('fcm_tokens')
      .update({ [key]: newVal })
      .eq('user_id', userId);
    setSaving(false);
    if (error) {
      setPrefs(p => ({ ...p, [key]: !newVal }));
      toast({ variant: 'destructive', title: 'Gagal menyimpan preferensi' });
    } else {
      toast({ title: 'Preferensi notifikasi disimpan' });
    }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const items = [
    {
      key: 'notif_soap_enabled',
      icon: '📋',
      title: 'SOAP Belum Terisi',
      desc: 'Notifikasi setiap malam jam 21:30 jika masih ada kunjungan yang belum diisi SOAP-nya di periode ini.',
    },
    {
      key: 'notif_guest_enabled',
      icon: '👤',
      title: 'Pasien Belum Terdaftar',
      desc: 'Notifikasi setiap malam jam 21:30 jika ada pasien hari ini yang masih berstatus guest di Daily Recap.',
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Notifikasi dikirim setiap hari jam <span className="font-semibold text-slate-700">21:30 WIB</span>. Kamu bisa matikan jenis notifikasi tertentu di sini.</p>

      {saving && (
        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
        </div>
      )}

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.key} className="flex items-start gap-3 p-4 rounded-xl border border-slate-100 bg-slate-50">
            <span className="text-xl mt-0.5">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{item.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
            </div>
            <Switch
              checked={prefs[item.key]}
              onCheckedChange={() => handleToggle(item.key)}
              className="shrink-0 mt-0.5"
            />
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
        <p className="text-xs text-amber-700">Notifikasi hanya terkirim ke perangkat yang sudah mengaktifkan izin notifikasi di browser/PWA.</p>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: CUTI
// ═══════════════════════════════════════════════════════════════════════════════
const LEAVE_REASONS = [
  { value: 'annual', label: 'Cuti Tahunan' },
  { value: 'sick', label: 'Sakit' },
  { value: 'weekly_off', label: 'Libur' },
  { value: 'training', label: 'Training' },
  { value: 'personal', label: 'Izin Pribadi' },
  { value: 'other', label: 'Lainnya' },
];

const TabCuti = ({ therapistId }) => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState({ start_date: '', end_date: '', leave_type: 'annual', reason: '' });
  const [balance, setBalance] = useState(null);

  const fetchCuti = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('therapist_time_off')
      .select('*')
      .eq('therapist_id', therapistId)
      .order('start_date', { ascending: false });
    setList(data || []);
    setLoading(false);
  };

  const fetchBalance = async () => {
    const { data } = await getTherapistAnnualLeaveBalance(therapistId);
    setBalance(data || null);
  };

  useEffect(() => { fetchCuti(); fetchBalance(); }, [therapistId]);

  const handleAdd = async () => {
    if (!form.start_date || !form.end_date) {
      toast({ variant: 'destructive', title: 'Tanggal wajib diisi' });
      return;
    }
    if (form.end_date < form.start_date) {
      toast({ variant: 'destructive', title: 'Tanggal selesai harus setelah tanggal mulai' });
      return;
    }
    setSaving(true);
    const reasonLabel = LEAVE_REASONS.find(r => r.value === form.leave_type)?.label || 'Lainnya';
    const { error } = await supabase.from('therapist_time_off').insert({
      therapist_id: therapistId,
      start_date: form.start_date,
      end_date: form.end_date,
      leave_type: form.leave_type,
      reason: form.reason ? `${reasonLabel} - ${form.reason}` : reasonLabel,
      created_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menambah cuti', description: error.message });
    } else {
      toast({ title: 'Cuti berhasil ditambahkan' });
      setForm({ start_date: '', end_date: '', leave_type: 'annual', reason: '' });
      setShowForm(false);
      fetchCuti();
      fetchBalance();
    }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    const { error } = await supabase.from('therapist_time_off').delete().eq('id', id);
    setDeleting(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menghapus' });
    } else {
      toast({ title: 'Cuti dihapus' });
      setList(l => l.filter(x => x.id !== id));
      fetchBalance();
    }
  };

  const formatTgl = (d) => {
    try { return format(parseISO(d), 'd MMM yyyy', { locale: idLocale }); }
    catch { return d; }
  };

  const isUpcoming = (d) => new Date(d) >= new Date(new Date().toDateString());

  return (
    <div className="space-y-4">
      {/* Ringkasan sisa cuti tahunan */}
      {balance && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-100 bg-emerald-50/60">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <Umbrella className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Sisa Cuti Tahunan {balance.year}</p>
            <p className="text-2xl font-bold text-emerald-800 leading-none mt-0.5">
              {balance.remaining} <span className="text-sm font-medium text-emerald-600">/ {balance.quota} hari</span>
            </p>
          </div>
        </div>
      )}

      {/* Tombol tambah */}
      {!showForm && (
        <Button onClick={() => setShowForm(true)} variant="outline" className="w-full rounded-xl border-dashed border-blue-300 text-blue-600 hover:bg-blue-50">
          <Plus className="w-4 h-4 mr-2" /> Ajukan Cuti Baru
        </Button>
      )}

      {/* Form tambah */}
      {showForm && (
        <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Pengajuan Cuti Baru</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Mulai</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="rounded-xl text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Selesai</Label>
              <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="rounded-xl text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Jenis Cuti</Label>
            <Select value={form.leave_type} onValueChange={v => setForm(f => ({ ...f, leave_type: v }))}>
              <SelectTrigger className="rounded-xl text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAVE_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Catatan (opsional)</Label>
            <Input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Keterangan tambahan..." className="rounded-xl text-sm" />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAdd} disabled={saving} className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm">
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
              Simpan
            </Button>
            <Button onClick={() => setShowForm(false)} variant="outline" className="rounded-xl text-sm">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Daftar cuti */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : list.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <CalendarOff className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Belum ada data cuti</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(item => {
            const upcoming = isUpcoming(item.start_date);
            return (
              <div key={item.id} className={`flex items-start gap-3 p-3.5 rounded-xl border ${upcoming ? 'border-blue-100 bg-blue-50/40' : 'border-slate-100 bg-slate-50'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">
                      {formatTgl(item.start_date)}
                      {item.start_date !== item.end_date && ` — ${formatTgl(item.end_date)}`}
                    </p>
                    {upcoming && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">MENDATANG</span>
                    )}
                  </div>
                  {item.reason && <p className="text-xs text-slate-500 mt-0.5">{item.reason}</p>}
                </div>
                {upcoming && (
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deleting === item.id}
                    className="text-red-400 hover:text-red-600 transition p-1 rounded-lg hover:bg-red-50"
                  >
                    {deleting === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: AKUN (Ganti Email & Password)
// ═══════════════════════════════════════════════════════════════════════════════
const TabAkun = ({ user }) => {
  const [emailForm, setEmailForm] = useState({ email: user?.email || '', saving: false });
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '', saving: false, showNew: false, showConfirm: false });

  const handleChangeEmail = async () => {
    if (!emailForm.email || emailForm.email === user?.email) return;
    setEmailForm(f => ({ ...f, saving: true }));
    const { error } = await supabase.auth.updateUser(
      { email: emailForm.email },
      { emailRedirectTo: `${window.location.origin}/therapist?settings=akun` }
    );
    setEmailForm(f => ({ ...f, saving: false }));
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal ganti email', description: error.message });
    } else {
      toast({ title: 'Konfirmasi dikirim', description: 'Cek email baru kamu untuk konfirmasi perubahan.' });
    }
  };

  const handleChangePassword = async () => {
    if (!pwForm.newPw) return;
    if (pwForm.newPw.length < 8) {
      toast({ variant: 'destructive', title: 'Password minimal 8 karakter' });
      return;
    }
    if (pwForm.newPw !== pwForm.confirm) {
      toast({ variant: 'destructive', title: 'Konfirmasi password tidak cocok' });
      return;
    }
    setPwForm(f => ({ ...f, saving: true }));
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw });
    setPwForm(f => ({ ...f, saving: false }));
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal ganti password', description: error.message });
    } else {
      toast({ title: 'Password berhasil diubah' });
      setPwForm({ current: '', newPw: '', confirm: '', saving: false, showNew: false, showConfirm: false });
    }
  };

  return (
    <div className="space-y-6">
      {/* Ganti Email */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">Ganti Email</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">Email Baru</Label>
          <Input
            type="email"
            value={emailForm.email}
            onChange={e => setEmailForm(f => ({ ...f, email: e.target.value }))}
            className="rounded-xl"
          />
        </div>
        <Button
          onClick={handleChangeEmail}
          disabled={emailForm.saving || emailForm.email === user?.email}
          variant="outline"
          className="w-full rounded-xl"
        >
          {emailForm.saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Kirim Konfirmasi Email
        </Button>
        <p className="text-xs text-slate-400">Setelah disimpan, link konfirmasi akan dikirim ke email baru.</p>
      </div>

      {/* Ganti Password */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">Ganti Password</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">Password Baru</Label>
          <div className="relative">
            <Input
              type={pwForm.showNew ? 'text' : 'password'}
              value={pwForm.newPw}
              onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))}
              placeholder="Minimal 8 karakter"
              className="rounded-xl pr-10"
            />
            <button
              type="button"
              onClick={() => setPwForm(f => ({ ...f, showNew: !f.showNew }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {pwForm.showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">Konfirmasi Password Baru</Label>
          <div className="relative">
            <Input
              type={pwForm.showConfirm ? 'text' : 'password'}
              value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
              placeholder="Ulangi password baru"
              className="rounded-xl pr-10"
            />
            <button
              type="button"
              onClick={() => setPwForm(f => ({ ...f, showConfirm: !f.showConfirm }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {pwForm.showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {pwForm.confirm && pwForm.newPw !== pwForm.confirm && (
            <p className="text-xs text-red-500">Password tidak cocok</p>
          )}
        </div>
        <Button
          onClick={handleChangePassword}
          disabled={pwForm.saving || !pwForm.newPw || !pwForm.confirm}
          className="w-full rounded-xl bg-blue-600 hover:bg-blue-700"
        >
          {pwForm.saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
          Ubah Password
        </Button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
const TherapistSettingsDrawer = ({ open, onClose, therapist, onTherapistUpdated, initialTab = 'profil' }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (open) setActiveTab(initialTab);
  }, [open, initialTab]);

  const activeTabData = TABS.find(t => t.id === activeTab);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-0 gap-0 max-w-lg w-full rounded-2xl overflow-hidden border-0 shadow-2xl">

        {/* ── Header ── */}
        <div className="bg-white border-b border-slate-100">
          <div className="px-5 pt-5 pb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base border-2 border-slate-100">
              {therapist?.avatar_url
                ? <img src={therapist.avatar_url} alt="" className="w-full h-full object-cover" />
                : therapist?.name?.charAt(0)?.toUpperCase()
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-slate-900 leading-none truncate">Pengaturan</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{therapist?.name}</p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="grid grid-cols-4 px-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-all border-b-2 ${
                    active
                      ? 'text-blue-600 border-blue-600'
                      : 'text-slate-400 border-transparent hover:text-slate-500'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="overflow-y-auto bg-slate-50/60 max-h-[70vh]">
          <div className="px-5 pt-5 pb-1 flex items-center gap-2">
            {activeTabData && <activeTabData.icon className="w-3.5 h-3.5 text-blue-500" />}
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{activeTabData?.label}</p>
          </div>

          <div className="px-5 pt-3 pb-8">
            {activeTab === 'profil' && (
              <TabProfil therapist={therapist} onUpdated={onTherapistUpdated} />
            )}
            {activeTab === 'notifikasi' && (
              <TabNotifikasi userId={user?.id} />
            )}
            {activeTab === 'cuti' && (
              <TabCuti therapistId={therapist?.id} />
            )}
            {activeTab === 'akun' && (
              <TabAkun user={user} />
            )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
};

export default TherapistSettingsDrawer;
