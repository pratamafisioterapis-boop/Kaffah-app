import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Building2, Users, UserCog, Activity, Loader2 } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  </div>
);

const SuperAdminOverview = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      const [clinics, users, patients, therapists] = await Promise.all([
        supabase.from('clinics').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('patients').select('*', { count: 'exact', head: true }),
        supabase.from('physiotherapists').select('*', { count: 'exact', head: true }),
      ]);
      setStats({
        clinics: clinics.count || 0,
        users: users.count || 0,
        patients: patients.count || 0,
        therapists: therapists.count || 0,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Ringkasan Sistem</h1>
        <p className="text-sm text-slate-500">Statistik seluruh klinik dalam sistem.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Total Klinik" value={stats.clinics} color="bg-blue-600" />
        <StatCard icon={Users} label="Total User" value={stats.users} color="bg-emerald-600" />
        <StatCard icon={Activity} label="Total Pasien" value={stats.patients} color="bg-orange-500" />
        <StatCard icon={UserCog} label="Total Terapis" value={stats.therapists} color="bg-purple-600" />
      </div>
    </div>
  );
};

export default SuperAdminOverview;