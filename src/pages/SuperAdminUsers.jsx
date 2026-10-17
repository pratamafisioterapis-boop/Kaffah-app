import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, MonitorSmartphone, FileSpreadsheet, Plus, KeyRound, Eye, EyeOff, Search, ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { PageHead, Panel, Pill, EmptyState, Spinner, Initials, RowAction, SHEET_DIALOG } from '@/components/superadmin/ui';
import { cn } from '@/lib/utils';
import { validatePassword } from '@/lib/passwordPolicy';

const ROLES = ['owner', 'admin', 'clinic_admin', 'therapist', 'physiotherapist', 'super_admin'];

// Dedicated accounts made only for the standalone Konversi Jasa/Tindakan
// Dokter app — this role has no dashboard of its own in ROLE_HOME_PATH, so
// it never grants access anywhere in the clinic system (see ProtectedRoute
// / LoginPage's CLINIC_ROLES check).
const KONVERSI_DOKTER_ROLE = 'konversi_dokter';

const CATEGORIES = [
  { key: 'owner', label: 'Owner', tone: 'info' },
  { key: 'terapis', label: 'Terapis', tone: 'ok' },
  { key: 'admin', label: 'Admin', tone: 'info' },
  { key: 'pemilih', label: 'Akun Pemilih', tone: 'warn' },
  { key: 'non_klinik', label: 'Non Klinik', tone: 'neutral' },
  { key: 'super_admin', label: 'Super Admin', tone: 'bad' },
];
const categoryMeta = (key) => CATEGORIES.find((c) => c.key === key);

const emptyKonversiDokterForm = { full_name: '', email: '', password: '' };

const ROLE_HOME_PATH = {
  super_admin: '/super-admin',
  owner: '/owner',
  admin: '/admin',
  clinic_admin: '/admin',
  therapist: '/therapist',
  physiotherapist: '/therapist',
};

const SuperAdminUsers = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { impersonateUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [konversiDokterAdminIds, setKonversiDokterAdminIds] = useState(new Set());
  const [pemilihUserIds, setPemilihUserIds] = useState(new Set());
  const [query, setQuery] = useState('');
  const [groupBy, setGroupBy] = useState('clinic'); // 'clinic' | 'cat'
  const [openGroups, setOpenGroups] = useState({});
  const [loading, setLoading] = useState(true);
  const [remotingId, setRemotingId] = useState(null);
  const [togglingKonversiId, setTogglingKonversiId] = useState(null);
  const [createKonversiOpen, setCreateKonversiOpen] = useState(false);
  const [createKonversiForm, setCreateKonversiForm] = useState(emptyKonversiDokterForm);
  const [creatingKonversi, setCreatingKonversi] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [usersRes, clinicsRes, konversiDokterAdminsRes, pemilihAdminsRes, pemilihDpcRes] = await Promise.all([
      supabase.from('users').select('*').order('created_at', { ascending: false }),
      supabase.from('clinics').select('id, name'),
      supabase.from('konversi_dokter_admins').select('user_id'),
      supabase.from('pemilih_admins').select('user_id'),
      supabase.from('pemilih_dpc').select('user_id'),
    ]);
    if (usersRes.error) toast({ variant: 'destructive', title: 'Gagal memuat user', description: usersRes.error.message });
    setUsers(usersRes.data || []);
    setClinics(clinicsRes.data || []);
    setKonversiDokterAdminIds(new Set((konversiDokterAdminsRes.data || []).map((r) => r.user_id)));
    setPemilihUserIds(new Set([
      ...(pemilihAdminsRes.data || []).map((r) => r.user_id),
      ...(pemilihDpcRes.data || []).map((r) => r.user_id),
    ]));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Akun modul Pemilih & akun khusus Konversi Dokter (mis. RSPB) bukan staf
  // klinik, jadi dicek sebelum role klinik.
  const categoryOf = (u) => {
    if (u.role === 'super_admin') return 'super_admin';
    if (pemilihUserIds.has(u.id)) return 'pemilih';
    if (u.role === 'owner') return 'owner';
    if (u.role === 'therapist' || u.role === 'physiotherapist') return 'terapis';
    if (u.role === 'admin' || u.role === 'clinic_admin') return 'admin';
    return 'non_klinik';
  };

  const clinicName = (id) => clinics.find(c => c.id === id)?.name || '-';

  const handleChangeRole = async (userId, newRole) => {
    const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId);
    if (error) toast({ variant: 'destructive', title: 'Gagal ubah role', description: error.message });
    else { toast({ title: 'Role diperbarui' }); fetchData(); }
  };

  const handleChangeClinic = async (userId, newClinicId) => {
    const { error } = await supabase.from('users').update({ clinic_id: newClinicId || null }).eq('id', userId);
    if (error) toast({ variant: 'destructive', title: 'Gagal ubah klinik', description: error.message });
    else { toast({ title: 'Klinik user diperbarui' }); fetchData(); }
  };

  const handleRemoteLogin = async (u) => {
    if (u.role === 'super_admin') {
      toast({ variant: 'destructive', title: 'Tidak diizinkan', description: 'Tidak bisa remote ke sesama super admin.' });
      return;
    }
    if (!u.is_active) {
      toast({ variant: 'destructive', title: 'Tidak diizinkan', description: 'Akun nonaktif tidak bisa diremote.' });
      return;
    }
    setRemotingId(u.id);
    const { error, target } = await impersonateUser(u.id);
    setRemotingId(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal remote ke akun', description: error.message });
      return;
    }
    toast({ title: `Berhasil remote sebagai ${u.full_name || u.email}` });
    navigate(ROLE_HOME_PATH[target?.role || u.role] || '/', { replace: true });
  };

  const handleToggleActive = async (user) => {
    const { error } = await supabase.from('users').update({ is_active: !user.is_active }).eq('id', user.id);
    if (error) toast({ variant: 'destructive', title: 'Gagal update status', description: error.message });
    else fetchData();
  };

  // Grants/revokes access to the standalone Konversi Jasa/Tindakan Dokter
  // app (separate from the clinic system — see konversi_dokter_admins).
  const handleToggleKonversiDokterAccess = async (user) => {
    setTogglingKonversiId(user.id);
    const hasAccess = konversiDokterAdminIds.has(user.id);
    if (hasAccess) {
      const { error } = await supabase.from('konversi_dokter_admins').delete().eq('user_id', user.id);
      if (error) toast({ variant: 'destructive', title: 'Gagal mencabut akses', description: error.message });
      else { toast({ title: 'Akses Konversi Dokter dicabut' }); fetchData(); }
    } else {
      const { error } = await supabase
        .from('konversi_dokter_admins')
        .insert({ user_id: user.id });
      if (error) toast({ variant: 'destructive', title: 'Gagal memberi akses', description: error.message });
      else { toast({ title: 'Akses Konversi Dokter diberikan' }); fetchData(); }
    }
    setTogglingKonversiId(null);
  };

  // Creates a brand-new account dedicated to the Konversi Dokter app — a
  // plain "beri akses" only works for someone who already has a user row
  // (e.g. an existing clinic staff member); this covers the common case of
  // an account that exists for nothing else.
  const handleCreateKonversiDokterAccount = async () => {
    const { full_name, email, password } = createKonversiForm;
    if (!full_name || !email || !password) {
      toast({ variant: 'destructive', title: 'Nama, email, dan password wajib diisi' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ variant: 'destructive', title: 'Format email tidak valid', description: 'Contoh: admin@rumahsakit.com' });
      return;
    }
    const pwError = await validatePassword(password);
    if (pwError) {
      toast({ variant: 'destructive', title: 'Password kurang aman', description: pwError });
      return;
    }
    setCreatingKonversi(true);
    try {
      // Force a fresh token instead of trusting whatever getSession() has
      // cached — a stale/expired access token here fails silently as a
      // confusing "Invalid session" from the edge function.
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session?.access_token) {
        toast({
          variant: 'destructive',
          title: 'Sesi login sudah berakhir',
          description: 'Silakan refresh halaman dan login ulang sebagai Super Admin, lalu coba lagi.',
        });
        return;
      }
      const res = await fetch('https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/admin-create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          email,
          password,
          full_name,
          role: KONVERSI_DOKTER_ROLE,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Gagal membuat akun', description: result.error });
        return;
      }

      const { error: grantError } = await supabase
        .from('konversi_dokter_admins')
        .insert({ user_id: result.user_id });
      if (grantError) {
        toast({
          variant: 'destructive',
          title: 'Akun dibuat, tapi gagal memberi akses Konversi Dokter',
          description: `${grantError.message} — gunakan tombol "Beri Akses" di daftar user untuk mencoba lagi.`,
        });
      } else {
        toast({ title: 'Akun Konversi Dokter berhasil dibuat', description: `${email} kini bisa login ke /konversi-dokter` });
      }
      setCreateKonversiOpen(false);
      setCreateKonversiForm(emptyKonversiDokterForm);
      fetchData();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal membuat akun', description: err.message });
    } finally {
      setCreatingKonversi(false);
    }
  };

  // Passwords are hashed by Supabase Auth and are never stored or
  // retrievable in plaintext — Super Admin can only set a new one, not view
  // the existing one.
  const handleResetPassword = async () => {
    if (!resetPasswordUser) return;
    const resetPwError = await validatePassword(newPassword);
    if (resetPwError) {
      toast({ variant: 'destructive', title: 'Password kurang aman', description: resetPwError });
      return;
    }
    setResettingPassword(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session?.access_token) {
        toast({
          variant: 'destructive',
          title: 'Sesi login sudah berakhir',
          description: 'Silakan refresh halaman dan login ulang sebagai Super Admin, lalu coba lagi.',
        });
        return;
      }
      const res = await fetch('https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/admin-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ user_id: resetPasswordUser.id, new_password: newPassword }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Gagal mengganti password', description: result.error });
        return;
      }
      toast({ title: 'Password berhasil diganti', description: `Password baru untuk ${resetPasswordUser.email} telah diset.` });
      setResetPasswordUser(null);
      setNewPassword('');
      setShowNewPassword(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal mengganti password', description: err.message });
    } finally {
      setResettingPassword(false);
    }
  };


  const q = query.trim().toLowerCase();
  const visibleUsers = users.filter((u) => {
    if (!q) return true;
    return [u.full_name, u.email, categoryMeta(categoryOf(u)).label, clinicName(u.clinic_id)]
      .some((v) => String(v || '').toLowerCase().includes(q));
  });

  // Grup: per klinik (staf klinik yang sama) atau per kategori. Akun Pemilih,
  // Non Klinik, dan Super Admin selalu punya grup sendiri karena bukan staf klinik.
  const SPECIAL = ['pemilih', 'non_klinik', 'super_admin'];
  const groups = [];
  if (groupBy === 'clinic') {
    const staff = visibleUsers.filter((u) => !SPECIAL.includes(categoryOf(u)));
    clinics.forEach((c) => {
      const m = staff.filter((u) => u.clinic_id === c.id);
      if (m.length) groups.push({ key: `c:${c.id}`, title: c.name, members: m, kind: 'clinic' });
    });
    const orphans = staff.filter((u) => !u.clinic_id || !clinics.some((c) => c.id === u.clinic_id));
    if (orphans.length) groups.push({ key: 'c:none', title: 'Tanpa klinik', members: orphans, kind: 'clinic' });
    SPECIAL.forEach((k) => {
      const m = visibleUsers.filter((u) => categoryOf(u) === k);
      if (m.length) groups.push({ key: `k:${k}`, title: categoryMeta(k).label, members: m, kind: 'special', catKey: k });
    });
  } else {
    CATEGORIES.forEach((c) => {
      const m = visibleUsers.filter((u) => categoryOf(u) === c.key);
      if (m.length) groups.push({ key: `k:${c.key}`, title: c.label, members: m, kind: 'cat', catKey: c.key });
    });
  }

  const groupSubtitle = (g) => {
    if (g.kind === 'clinic') {
      return CATEGORIES.map((c) => [c.label, g.members.filter((u) => categoryOf(u) === c.key).length])
        .filter(([, n]) => n).map(([l, n]) => `${n} ${l.toLowerCase()}`).join(' · ');
    }
    if (g.kind === 'cat') {
      const n = new Set(g.members.map((u) => u.clinic_id).filter(Boolean)).size;
      return n ? `dari ${n} klinik` : 'tidak terikat klinik';
    }
    return { pemilih: 'Modul Pemilih, terpisah dari klinik', non_klinik: 'Akun khusus, tanpa akses klinik', super_admin: 'Akses penuh sistem' }[g.catKey];
  };

  const isOpen = (key, index) => (q ? true : (openGroups[key] ?? index === 0));
  const setAll = (value) => setOpenGroups(Object.fromEntries(groups.map((g) => [g.key, value])));

  const ROW_COLS = 'min-[1180px]:grid-cols-[minmax(0,2.2fr)_140px_minmax(0,1.8fr)_76px_96px_96px]';
  const FieldLabel = ({ children }) => <span className="min-[1180px]:hidden block text-xs font-medium text-app-muted mb-1">{children}</span>;

  const renderRow = (u) => {
    const cat = categoryMeta(categoryOf(u));
    const hasKonversi = konversiDokterAdminIds.has(u.id);
    return (
      <div key={u.id} className={cn('grid grid-cols-2 gap-x-3 gap-y-3 p-4 border-t border-app-border items-center min-[1180px]:gap-4 min-[1180px]:px-5 min-[1180px]:py-3', ROW_COLS)}>
        <div className="col-span-2 min-[1180px]:col-auto min-w-0 flex items-center gap-3">
          <Initials name={u.full_name || u.email} />
          <div className="min-w-0">
            <p className="font-semibold leading-snug break-words">{u.full_name || '-'}</p>
            <p className="text-[13px] text-app-muted break-all">{u.email}</p>
            <Pill tone={cat.tone} dot={false} className="mt-1 h-5 text-[11px]">{cat.label}</Pill>
          </div>
        </div>
        <div className="min-w-0">
          <FieldLabel>Role</FieldLabel>
          <Select value={u.role} onValueChange={(val) => handleChangeRole(u.id, val)}>
            <SelectTrigger className="w-full min-h-11" aria-label={`Role ${u.full_name || u.email}`}><SelectValue /></SelectTrigger>
            <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <FieldLabel>Klinik</FieldLabel>
          <Select value={u.clinic_id || 'none'} onValueChange={(val) => handleChangeClinic(u.id, val === 'none' ? null : val)}>
            <SelectTrigger className="w-full min-h-11 [&>span]:truncate [&>span]:text-left" aria-label={`Klinik ${u.full_name || u.email}`}><SelectValue placeholder="Tanpa klinik" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Tanpa klinik</SelectItem>
              {clinics.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2.5 min-h-11 cursor-pointer">
          <Switch checked={!!u.is_active} onCheckedChange={() => handleToggleActive(u)} aria-label={`Akun aktif ${u.full_name || u.email}`} />
          <span className="min-[1180px]:hidden text-[13px] text-app-muted">{u.is_active ? 'Akun aktif' : 'Akun nonaktif'}</span>
        </label>
        <label className="flex items-center gap-2.5 min-h-11 cursor-pointer" title="Akses aplikasi Konversi Jasa/Tindakan Dokter (terpisah dari sistem klinik)">
          {togglingKonversiId === u.id
            ? <Loader2 className="w-5 h-5 animate-spin text-app-accent" />
            : <Switch checked={hasKonversi} onCheckedChange={() => handleToggleKonversiDokterAccess(u)} aria-label={`Akses Konversi Dokter ${u.full_name || u.email}`} />}
          <span className="min-[1180px]:hidden text-[13px] text-app-muted">{hasKonversi ? 'Konversi Dokter diizinkan' : 'Konversi Dokter tidak'}</span>
        </label>
        <div className="col-span-2 min-[1180px]:col-auto flex flex-wrap gap-2 min-[1180px]:justify-end min-[1180px]:gap-0.5">
          <RowAction
            icon={remotingId === u.id ? Loader2 : MonitorSmartphone}
            label="Remote login"
            title="Login sebagai user ini tanpa password"
            disabled={u.role === 'super_admin' || !u.is_active || remotingId === u.id}
            onClick={() => handleRemoteLogin(u)}
          />
          <RowAction icon={KeyRound} label="Ganti password" title="Ganti password user ini" onClick={() => setResetPasswordUser(u)} />
        </div>
      </div>
    );
  };

  if (loading) return <Spinner />;

  return (
    <>
      <PageHead
        title="Manajemen User"
        description="Atur role, klinik, dan akses akun. Dikelompokkan supaya mudah dicari."
        actions={(
          <Button variant="outline" className="gap-1.5 min-h-11" onClick={() => setCreateKonversiOpen(true)}>
            <Plus className="w-4 h-4" /> Buat Akun Konversi Dokter
          </Button>
        )}
      />

      <Dialog open={createKonversiOpen} onOpenChange={setCreateKonversiOpen}>
        <DialogContent className={SHEET_DIALOG}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" /> Buat Akun Konversi Dokter
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 -mt-2">
            Akun ini hanya bisa login ke aplikasi Konversi Jasa/Tindakan Dokter (<code>/konversi-dokter</code>), terpisah dari sistem klinik.
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Nama Lengkap</label>
              <Input
                value={createKonversiForm.full_name}
                onChange={(e) => setCreateKonversiForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="Nama akun"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Email</label>
              <Input
                type="email"
                value={createKonversiForm.email}
                onChange={(e) => setCreateKonversiForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="akun@contoh.com"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Password</label>
              <Input
                type="password"
                value={createKonversiForm.password}
                onChange={(e) => setCreateKonversiForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Minimal 6 karakter"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateKonversiOpen(false)} disabled={creatingKonversi}>
              Batal
            </Button>
            <Button onClick={handleCreateKonversiDokterAccount} disabled={creatingKonversi} className="gap-1.5">
              {creatingKonversi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Buat Akun
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!resetPasswordUser}
        onOpenChange={(open) => {
          if (!open) {
            setResetPasswordUser(null);
            setNewPassword('');
            setShowNewPassword(false);
          }
        }}
      >
        <DialogContent className={SHEET_DIALOG}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-blue-600" /> Ganti Password
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 -mt-2">
            Set password baru untuk <span className="font-medium">{resetPasswordUser?.full_name || resetPasswordUser?.email}</span>.
            Password lama tidak bisa dilihat karena disimpan terenkripsi oleh sistem — hanya bisa diganti.
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Password Baru</label>
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowNewPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordUser(null)} disabled={resettingPassword}>
              Batal
            </Button>
            <Button onClick={handleResetPassword} disabled={resettingPassword} className="gap-1.5">
              {resettingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Simpan Password Baru
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap gap-2.5">
        <div className="relative flex-1 basis-64 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-app-muted pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, email, klinik, atau kategori"
            aria-label="Cari user"
            className="w-full min-h-11 pl-10 pr-3 rounded-xl border border-slate-300 bg-white text-base md:text-sm focus:outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/25"
          />
        </div>
        <div className="inline-flex p-[3px] gap-0.5 rounded-xl border border-app-border bg-white self-start" role="group" aria-label="Kelompokkan berdasarkan">
          {[['clinic', 'Per klinik'], ['cat', 'Per kategori']].map(([k, l]) => (
            <button
              key={k}
              type="button"
              aria-pressed={groupBy === k}
              onClick={() => { setGroupBy(k); setOpenGroups({}); }}
              className={cn('min-h-10 px-3.5 rounded-lg text-[13px] font-medium transition-colors', groupBy === k ? 'bg-app-accent text-white' : 'text-app-muted hover:text-app-ink')}
            >{l}</button>
          ))}
        </div>
        <Button variant="outline" className="min-h-11" onClick={() => setAll(true)}>Buka semua</Button>
        <Button variant="outline" className="min-h-11" onClick={() => setAll(false)}>Tutup semua</Button>
      </div>

      {groups.length === 0 ? (
        <Panel><EmptyState title="Tidak ada user yang cocok">Ubah kata kunci pencarian.</EmptyState></Panel>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g, i) => {
            const open = isOpen(g.key, i);
            const inactive = g.members.filter((u) => !u.is_active).length;
            return (
              <Panel key={g.key} className="overflow-hidden">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenGroups((p) => ({ ...p, [g.key]: !open }))}
                  className={cn('w-full flex items-center gap-3 p-3.5 min-h-16 text-left transition-colors hover:bg-slate-50', open && 'border-b border-app-border')}
                >
                  <Initials name={g.title} className={g.kind === 'special' ? 'bg-amber-50 text-amber-800' : undefined} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold break-words leading-snug">{g.title}</span>
                    <span className="block text-[13px] text-app-muted">{groupSubtitle(g)}</span>
                  </span>
                  <span className="flex flex-wrap justify-end gap-1.5">
                    <Pill tone="neutral" dot={false} className="tabular-nums">{g.members.length} user</Pill>
                    {inactive > 0 && <Pill tone="bad" className="tabular-nums max-sm:hidden">{inactive} nonaktif</Pill>}
                  </span>
                  <ChevronDown className={cn('w-5 h-5 text-app-muted shrink-0 transition-transform duration-200', open && 'rotate-180')} />
                </button>
                {open && (
                  <div>
                    <div className={cn('hidden min-[1180px]:grid gap-4 px-5 py-2.5 bg-slate-50 border-b border-app-border text-xs font-semibold text-app-muted', ROW_COLS)}>
                      <span>User</span><span>Role</span><span>Klinik</span><span>Aktif</span><span>Konversi</span><span className="text-right">Aksi</span>
                    </div>
                    <div className="[&>*:first-child]:border-t-0">{g.members.map(renderRow)}</div>
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
};

export default SuperAdminUsers;
