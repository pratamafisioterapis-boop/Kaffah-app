import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Users, MonitorSmartphone, FileSpreadsheet } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const ROLES = ['owner', 'admin', 'clinic_admin', 'therapist', 'physiotherapist', 'super_admin'];

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
  const [loading, setLoading] = useState(true);
  const [remotingId, setRemotingId] = useState(null);
  const [togglingKonversiId, setTogglingKonversiId] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    const [usersRes, clinicsRes, konversiDokterAdminsRes] = await Promise.all([
      supabase.from('users').select('*').order('created_at', { ascending: false }),
      supabase.from('clinics').select('id, name'),
      supabase.from('konversi_dokter_admins').select('user_id'),
    ]);
    if (usersRes.error) toast({ variant: 'destructive', title: 'Gagal memuat user', description: usersRes.error.message });
    setUsers(usersRes.data || []);
    setClinics(clinicsRes.data || []);
    setKonversiDokterAdminIds(new Set((konversiDokterAdminsRes.data || []).map((r) => r.user_id)));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

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
      if (!user.clinic_id) {
        toast({ variant: 'destructive', title: 'Tidak diizinkan', description: 'User ini belum terhubung ke klinik manapun.' });
        setTogglingKonversiId(null);
        return;
      }
      const { error } = await supabase
        .from('konversi_dokter_admins')
        .insert({ user_id: user.id, clinic_id: user.clinic_id });
      if (error) toast({ variant: 'destructive', title: 'Gagal memberi akses', description: error.message });
      else { toast({ title: 'Akses Konversi Dokter diberikan' }); fetchData(); }
    }
    setTogglingKonversiId(null);
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600" /> Manajemen User
        </h1>
        <p className="text-sm text-slate-500">Semua user lintas klinik, bisa ubah role & klinik.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Mobile / PWA: kartu, tanpa geser horizontal */}
        <div className="sm:hidden divide-y divide-slate-100">
          {users.map((u) => (
            <div key={u.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{u.full_name || '-'}</p>
                  <p className="text-xs text-slate-500 truncate">{u.email}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {u.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-1">Role</p>
                  <Select value={u.role} onValueChange={(val) => handleChangeRole(u.id, val)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-1">Klinik</p>
                  <Select value={u.clinic_id || 'none'} onValueChange={(val) => handleChangeClinic(u.id, val === 'none' ? null : val)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Tanpa klinik" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tanpa klinik</SelectItem>
                      {clinics.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={() => handleToggleActive(u)}>
                  {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  disabled={u.role === 'super_admin' || !u.is_active || remotingId === u.id}
                  onClick={() => handleRemoteLogin(u)}
                >
                  {remotingId === u.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MonitorSmartphone className="w-4 h-4 mr-1" />
                  )}
                  Remote
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                className={`w-full ${konversiDokterAdminIds.has(u.id) ? 'border-indigo-300 text-indigo-700 hover:bg-indigo-50' : ''}`}
                disabled={togglingKonversiId === u.id}
                onClick={() => handleToggleKonversiDokterAccess(u)}
              >
                {togglingKonversiId === u.id ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 mr-1" />
                )}
                {konversiDokterAdminIds.has(u.id) ? 'Cabut Akses Konversi Dokter' : 'Beri Akses Konversi Dokter'}
              </Button>
            </div>
          ))}
        </div>

        {/* Desktop: tabel */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="p-3">Nama</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Klinik</th>
                <th className="p-3">Status</th>
                <th className="p-3">Konversi Dokter</th>
                <th className="p-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="p-3 font-medium text-slate-800">{u.full_name || '-'}</td>
                  <td className="p-3 text-slate-500">{u.email}</td>
                  <td className="p-3">
                    <Select value={u.role} onValueChange={(val) => handleChangeRole(u.id, val)}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <Select value={u.clinic_id || 'none'} onValueChange={(val) => handleChangeClinic(u.id, val === 'none' ? null : val)}>
                      <SelectTrigger className="w-44"><SelectValue placeholder="Tanpa klinik" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tanpa klinik</SelectItem>
                        {clinics.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {u.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="p-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className={konversiDokterAdminIds.has(u.id) ? 'border-indigo-300 text-indigo-700 hover:bg-indigo-50' : ''}
                      disabled={togglingKonversiId === u.id}
                      onClick={() => handleToggleKonversiDokterAccess(u)}
                      title="Akses aplikasi Konversi Jasa/Tindakan Dokter (terpisah dari sistem klinik)"
                    >
                      {togglingKonversiId === u.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="w-4 h-4 mr-1" />
                      )}
                      {konversiDokterAdminIds.has(u.id) ? 'Cabut' : 'Beri Akses'}
                    </Button>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleToggleActive(u)}>
                        {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-300 text-amber-700 hover:bg-amber-50"
                        disabled={u.role === 'super_admin' || !u.is_active || remotingId === u.id}
                        onClick={() => handleRemoteLogin(u)}
                        title="Login sebagai user ini tanpa password"
                      >
                        {remotingId === u.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <MonitorSmartphone className="w-4 h-4 mr-1" />
                        )}
                        Remote
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminUsers;