import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Eye, Building2, Users, Stethoscope, CalendarClock, Wallet, Search } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'pasien', label: 'Pasien' },
  { key: 'terapis', label: 'Terapis' },
  { key: 'jadwal', label: 'Jadwal Hari Ini' },
  { key: 'recap', label: 'Riwayat Recap' },
];

const formatCurrency = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-2xl font-bold text-slate-800 truncate">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  </div>
);

// Read-only cross-clinic viewer: super_admin already bypasses tenant RLS
// (see get_my_role() = 'super_admin' checks on patients/appointments/etc.),
// so we query every table straight by the selected clinic_id instead of
// going through src/lib/api.js — those helpers derive clinic_id from the
// *logged-in* user, not an arbitrary clinic, and mostly include write paths
// we don't want reachable from this "peek at a clinic" screen.
const SuperAdminClinicViewer = () => {
  const { toast } = useToast();
  const [clinics, setClinics] = useState([]);
  const [loadingClinics, setLoadingClinics] = useState(true);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ringkasan');

  const [loadingData, setLoadingData] = useState(false);
  const [stats, setStats] = useState(null);
  const [patients, setPatients] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [recentRecaps, setRecentRecaps] = useState([]);

  useEffect(() => {
    const fetchClinics = async () => {
      setLoadingClinics(true);
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, subscription_status')
        .order('name', { ascending: true });
      if (error) {
        toast({ variant: 'destructive', title: 'Gagal memuat daftar klinik', description: error.message });
      } else {
        setClinics(data || []);
        setSelectedClinicId((prev) => prev || data?.[0]?.id || '');
      }
      setLoadingClinics(false);
    };
    fetchClinics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedClinicId) return;
    let active = true;

    const fetchClinicData = async () => {
      setLoadingData(true);
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const now = new Date();
      const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');

      const [
        patientsCountRes,
        therapistsRes,
        patientsRes,
        appointmentsRes,
        recapsRes,
        monthlyRecapsRes,
      ] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact', head: true }).eq('clinic_id', selectedClinicId),
        supabase
          .from('physiotherapists')
          .select('id, name, phone, specialization, is_active')
          .eq('clinic_id', selectedClinicId)
          .order('name', { ascending: true }),
        supabase
          .from('patients')
          .select('id, full_name, medical_record_number, phone, status')
          .eq('clinic_id', selectedClinicId)
          .order('full_name', { ascending: true })
          .limit(200),
        supabase
          .from('appointments')
          .select('id, appointment_date, status, patient:patients(full_name, phone), therapist:physiotherapists(name)')
          .eq('clinic_id', selectedClinicId)
          .gte('appointment_date', `${todayStr}T00:00:00`)
          .lte('appointment_date', `${todayStr}T23:59:59`)
          .order('appointment_date', { ascending: true }),
        supabase
          .from('daily_recaps')
          .select('id, recap_date, amount, patient:patients(full_name), therapist:physiotherapists(name)')
          .eq('clinic_id', selectedClinicId)
          .order('recap_date', { ascending: false })
          .limit(50),
        supabase.from('daily_recaps').select('amount').eq('clinic_id', selectedClinicId).gte('recap_date', monthStart),
      ]);

      if (!active) return;

      const firstError = [patientsCountRes, therapistsRes, patientsRes, appointmentsRes, recapsRes, monthlyRecapsRes]
        .map((r) => r.error)
        .find(Boolean);
      if (firstError) {
        toast({ variant: 'destructive', title: 'Gagal memuat data klinik', description: firstError.message });
      }

      const therapistRows = therapistsRes.data || [];
      const monthlyRecapRows = monthlyRecapsRes.data || [];

      setTherapists(therapistRows);
      setPatients(patientsRes.data || []);
      setTodayAppointments(appointmentsRes.data || []);
      setRecentRecaps(recapsRes.data || []);
      setStats({
        totalPatients: patientsCountRes.count || 0,
        totalTherapists: therapistRows.length,
        activeTherapists: therapistRows.filter((t) => t.is_active).length,
        todayAppointments: (appointmentsRes.data || []).length,
        monthlySessions: monthlyRecapRows.length,
        monthlyRevenue: monthlyRecapRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
      });
      setLoadingData(false);
    };

    fetchClinicData();
    return () => { active = false; };
  }, [selectedClinicId, toast]);

  const selectedClinic = clinics.find((c) => c.id === selectedClinicId);
  const filteredPatients = useMemo(() => {
    if (!search.trim()) return patients;
    const q = search.trim().toLowerCase();
    return patients.filter(
      (p) =>
        p.full_name?.toLowerCase().includes(q) ||
        p.phone?.includes(q) ||
        p.medical_record_number?.toLowerCase().includes(q)
    );
  }, [patients, search]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Eye className="w-6 h-6 text-blue-600" /> Lihat Data Klinik
        </h1>
        <p className="text-sm text-slate-500">
          Pantau menu dan data operasional setiap klinik tanpa perlu login ke akun klinik tersebut. Mode ini hanya untuk melihat (read-only).
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <Building2 className="w-5 h-5 text-slate-400 shrink-0" />
        {loadingClinics ? (
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        ) : clinics.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Belum ada klinik terdaftar.</p>
        ) : (
          <select
            value={selectedClinicId}
            onChange={(e) => setSelectedClinicId(e.target.value)}
            className="w-full sm:w-80 border border-slate-300 rounded-md px-3 py-2 text-sm"
          >
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.subscription_status !== 'active' ? ' (nonaktif)' : ''}
              </option>
            ))}
          </select>
        )}
        {selectedClinic && (
          <span
            className={cn(
              'text-xs px-2 py-1 rounded-full shrink-0',
              selectedClinic.subscription_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
            )}
          >
            {selectedClinic.subscription_status === 'active' ? 'Aktif' : 'Nonaktif'}
          </span>
        )}
      </div>

      {selectedClinicId && (
        <>
          <div className="flex gap-1.5 flex-wrap">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors',
                  activeTab === tab.key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loadingData || !stats ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : (
            <>
              {activeTab === 'ringkasan' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <StatCard icon={Users} label="Total Pasien" value={stats.totalPatients} color="bg-orange-500" />
                  <StatCard icon={Stethoscope} label="Terapis Aktif" value={`${stats.activeTherapists}/${stats.totalTherapists}`} color="bg-purple-600" />
                  <StatCard icon={CalendarClock} label="Jadwal Hari Ini" value={stats.todayAppointments} color="bg-blue-600" />
                  <StatCard icon={CalendarClock} label="Sesi Bulan Ini" value={stats.monthlySessions} color="bg-emerald-600" />
                  <StatCard icon={Wallet} label="Pendapatan Bulan Ini" value={formatCurrency(stats.monthlyRevenue)} color="bg-green-600" />
                </div>
              )}

              {activeTab === 'pasien' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cari nama, no. RM, atau telepon..."
                      className="flex-1 text-sm outline-none"
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="text-left px-4 py-2">Nama</th>
                          <th className="text-left px-4 py-2">No. RM</th>
                          <th className="text-left px-4 py-2">Telepon</th>
                          <th className="text-left px-4 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPatients.length === 0 ? (
                          <tr><td colSpan={4} className="text-center py-8 text-slate-400">Tidak ada data pasien.</td></tr>
                        ) : filteredPatients.map((p) => (
                          <tr key={p.id} className="border-t border-slate-100">
                            <td className="px-4 py-2 font-medium text-slate-700">{p.full_name}</td>
                            <td className="px-4 py-2 text-slate-500">{p.medical_record_number || '-'}</td>
                            <td className="px-4 py-2 text-slate-500">{p.phone || '-'}</td>
                            <td className="px-4 py-2 text-slate-500 capitalize">{p.status || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {patients.length >= 200 && (
                    <p className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">Menampilkan 200 pasien pertama.</p>
                  )}
                </div>
              )}

              {activeTab === 'terapis' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2">Nama</th>
                        <th className="text-left px-4 py-2">Spesialisasi</th>
                        <th className="text-left px-4 py-2">Telepon</th>
                        <th className="text-left px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {therapists.length === 0 ? (
                        <tr><td colSpan={4} className="text-center py-8 text-slate-400">Belum ada terapis.</td></tr>
                      ) : therapists.map((t) => (
                        <tr key={t.id} className="border-t border-slate-100">
                          <td className="px-4 py-2 font-medium text-slate-700">{t.name}</td>
                          <td className="px-4 py-2 text-slate-500">{t.specialization || '-'}</td>
                          <td className="px-4 py-2 text-slate-500">{t.phone || '-'}</td>
                          <td className="px-4 py-2">
                            <span className={cn('text-xs px-2 py-0.5 rounded-full', t.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500')}>
                              {t.is_active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'jadwal' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2">Jam</th>
                        <th className="text-left px-4 py-2">Pasien</th>
                        <th className="text-left px-4 py-2">Terapis</th>
                        <th className="text-left px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayAppointments.length === 0 ? (
                        <tr><td colSpan={4} className="text-center py-8 text-slate-400">Tidak ada jadwal hari ini.</td></tr>
                      ) : todayAppointments.map((a) => (
                        <tr key={a.id} className="border-t border-slate-100">
                          <td className="px-4 py-2 text-slate-500">{format(new Date(a.appointment_date), 'HH:mm')}</td>
                          <td className="px-4 py-2 font-medium text-slate-700">{a.patient?.full_name || '-'}</td>
                          <td className="px-4 py-2 text-slate-500">{a.therapist?.name || '-'}</td>
                          <td className="px-4 py-2 text-slate-500 capitalize">{a.status || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'recap' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2">Tanggal</th>
                        <th className="text-left px-4 py-2">Pasien</th>
                        <th className="text-left px-4 py-2">Terapis</th>
                        <th className="text-right px-4 py-2">Nominal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRecaps.length === 0 ? (
                        <tr><td colSpan={4} className="text-center py-8 text-slate-400">Belum ada riwayat recap.</td></tr>
                      ) : recentRecaps.map((r) => (
                        <tr key={r.id} className="border-t border-slate-100">
                          <td className="px-4 py-2 text-slate-500">{r.recap_date ? format(new Date(r.recap_date), 'dd MMM yyyy') : '-'}</td>
                          <td className="px-4 py-2 font-medium text-slate-700">{r.patient?.full_name || '-'}</td>
                          <td className="px-4 py-2 text-slate-500">{r.therapist?.name || '-'}</td>
                          <td className="px-4 py-2 text-right text-slate-700">{formatCurrency(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default SuperAdminClinicViewer;
