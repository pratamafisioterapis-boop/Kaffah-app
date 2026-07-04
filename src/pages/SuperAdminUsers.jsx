import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const ROLES = ['owner', 'admin', 'clinic_admin', 'therapist', 'physiotherapist', 'super_admin'];

const SuperAdminUsers = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [usersRes, clinicsRes] = await Promise.all([
      supabase.from('users').select('*').order('created_at', { ascending: false }),
      supabase.from('clinics').select('id, name'),
    ]);
    if (usersRes.error) toast({ variant: 'destructive', title: 'Gagal memuat user', description: usersRes.error.message });
    setUsers(usersRes.data || []);
    setClinics(clinicsRes.data || []);
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

  const handleToggleActive = async (user) => {
    const { error } = await supabase.from('users').update({ is_active: !user.is_active }).eq('id', user.id);
    if (error) toast({ variant: 'destructive', title: 'Gagal update status', description: error.message });
    else fetchData();
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

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="p-3">Nama</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Klinik</th>
              <th className="p-3">Status</th>
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
                  <Button size="sm" variant="outline" onClick={() => handleToggleActive(u)}>
                    {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SuperAdminUsers;