import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Search } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { PageHead, Panel, Pill, EmptyState, Spinner } from '@/components/superadmin/ui';

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'pasien', label: 'Pasien' },
  { key: 'terapis', label: 'Terapis' },
  { key: 'jadwal', label: 'Jadwal Hari Ini' },
  { key: 'recap', label: 'Riwayat Recap' },
];

const formatCurrency = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

const Fact = ({ label, value }) => (
  <div className="bg-white px-5 py-3.5 min-w-0">
    <dt className="text-[12.5px] text-app-muted">{label}</dt>
    <dd className="mt-0.5 font-semibold tabular-nums break-words">{value}</dd>
  </div>
);

// Tabel responsif: kartu bertumpuk di layar sempit, kolom di >=1180px.
// cells[0] = kolom utama (lebar penuh di layar sempit); sisanya diberi label dari `heads`.
const RTable = ({ cols, heads, rows, empty, footer }) => (
  <Panel className="overflow-hidden">
    {rows.length === 0 ? (
      <EmptyState title={empty.title}>{empty.text}</EmptyState>
    ) : (
      <>
        <div className={cn('hidden min-[1180px]:grid gap-4 px-5 py-2.5 bg-slate-50 border-b border-app-border text-xs font-semibold text-app-muted', cols)}>
          {heads.map((h, i) => <span key={h} className={heads.rightLast && i === heads.length - 1 ? 'text-right' : undefined}>{h}</span>)}
        </div>
        {rows.map((r) => (
          <div key={r.key} className={cn('grid grid-cols-2 gap-x-3 gap-y-2.5 p-4 border-t border-app-border first:border-t-0 items-center min-[1180px]:gap-4 min-[1180px]:px-5 min-[1180px]:py-3', cols)}>
            {r.cells.map((c, i) => (
              <div key={i} className={cn('min-w-0 text-sm', i === 0 && 'col-span-2 min-[1180px]:col-auto font-semibold break-words')}>
                {i > 0 && <span className="min-[1180px]:hidden block text-xs font-medium text-app-muted mb-0.5">{heads[i]}</span>}
                {c}
              </div>
            ))}
          </div>
        ))}
        {footer}
      </>
    )}
  </Panel>
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

  const toggleAdminSoap = async (therapist, enabled) => {
    setTherapists((prev) => prev.map((t) => (t.id === therapist.id ? { ...t, admin_soap_enabled: enabled } : t)));
    const { error } = await supabase.from('physiotherapists').update({ admin_soap_enabled: enabled }).eq('id', therapist.id);
    if (error) {
      setTherapists((prev) => prev.map((t) => (t.id === therapist.id ? { ...t, admin_soap_enabled: !enabled } : t)));
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
    }
  };
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
          .select('id, name, phone, specialization, is_active, user_id, admin_soap_enabled')
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
          .select('id, recap_date, amount, patient:patients!patient_id(full_name), therapist:physiotherapists(name)')
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

  const tone = (st) => (['active', 'completed', 'selesai'].includes(String(st).toLowerCase()) ? 'ok' : 'neutral');

  return (
    <>
      <PageHead
        title="Lihat Data Klinik"
        description="Pantau data operasional setiap klinik tanpa login ke akun klinik tersebut. Mode ini hanya untuk melihat, kecuali izin SOAP admin di tab Terapis."
      />

      <div className="flex flex-wrap items-center gap-3">
        {loadingClinics ? (
          <Spinner />
        ) : clinics.length === 0 ? (
          <p className="text-sm text-app-muted italic">Belum ada klinik terdaftar.</p>
        ) : (
          <div className="flex-1 basis-72 max-w-md min-w-0">
            <label htmlFor="viewer-clinic" className="block text-[12.5px] font-medium text-app-muted mb-1.5">Klinik</label>
            <select
              id="viewer-clinic"
              value={selectedClinicId}
              onChange={(e) => setSelectedClinicId(e.target.value)}
              className="w-full min-h-11 border border-slate-300 rounded-xl px-3 bg-white text-base md:text-sm focus:outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/25"
            >
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.subscription_status !== 'active' ? ' (nonaktif)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        {selectedClinic && (
          <Pill tone={selectedClinic.subscription_status === 'active' ? 'ok' : 'neutral'} className="self-end mb-2.5">
            {selectedClinic.subscription_status === 'active' ? 'Aktif' : 'Nonaktif'}
          </Pill>
        )}
      </div>

      {selectedClinicId && (
        <>
          <div role="tablist" aria-label="Data klinik" className="flex gap-1 overflow-x-auto border-b border-app-border -mx-4 px-4 min-[700px]:mx-0 min-[700px]:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-3.5 min-h-11 -mb-px whitespace-nowrap text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.key ? 'border-app-accent text-app-accent font-semibold' : 'border-transparent text-app-muted hover:text-app-ink'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loadingData || !stats ? (
            <Spinner />
          ) : (
            <>
              {activeTab === 'ringkasan' && (
                <Panel className="overflow-hidden">
                  <dl className="grid grid-cols-2 min-[760px]:grid-cols-3 gap-px bg-app-border">
                    <Fact label="Total pasien" value={stats.totalPatients.toLocaleString('id-ID')} />
                    <Fact label="Total terapis" value={stats.totalTherapists} />
                    <Fact label="Terapis aktif" value={`${stats.activeTherapists} dari ${stats.totalTherapists}`} />
                    <Fact label="Jadwal hari ini" value={stats.todayAppointments} />
                    <Fact label="Sesi bulan ini" value={stats.monthlySessions} />
                    <Fact label="Pendapatan bulan ini" value={formatCurrency(stats.monthlyRevenue)} />
                  </dl>
                </Panel>
              )}

              {activeTab === 'pasien' && (
                <>
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-app-muted pointer-events-none" />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cari nama, no. RM, atau telepon"
                      aria-label="Cari pasien"
                      className="w-full min-h-11 pl-10 pr-3 rounded-xl border border-slate-300 bg-white text-base md:text-sm focus:outline-none focus:border-app-accent focus:ring-2 focus:ring-app-accent/25"
                    />
                  </div>
                  <RTable
                    cols="min-[1180px]:grid-cols-[minmax(0,2fr)_150px_minmax(0,1.3fr)_120px]"
                    heads={['Nama', 'No. RM', 'Telepon', 'Status']}
                    empty={{ title: 'Pasien tidak ditemukan', text: 'Periksa ejaan nama, nomor RM, atau telepon.' }}
                    rows={filteredPatients.map((p) => ({
                      key: p.id,
                      cells: [p.full_name, <span key="rm" className="tabular-nums">{p.medical_record_number || '-'}</span>, <span key="ph" className="tabular-nums">{p.phone || '-'}</span>, <Pill key="st" tone={tone(p.status)} className="capitalize">{p.status || '-'}</Pill>],
                    }))}
                    footer={patients.length >= 200 && <p className="px-5 py-2.5 text-xs text-app-muted border-t border-app-border">Menampilkan 200 pasien pertama.</p>}
                  />
                </>
              )}

              {activeTab === 'terapis' && (
                <RTable
                  cols="min-[1180px]:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_110px_130px]"
                  heads={['Nama', 'Spesialisasi', 'Telepon', 'Status', 'Isi SOAP via admin']}
                  empty={{ title: 'Belum ada terapis', text: 'Terapis klinik ini akan muncul di sini.' }}
                  rows={therapists.map((t) => ({
                    key: t.id,
                    cells: [
                      t.name,
                      t.specialization || '-',
                      <span key="ph" className="tabular-nums">{t.phone || '-'}</span>,
                      <Pill key="st" tone={t.is_active ? 'ok' : 'neutral'}>{t.is_active ? 'Aktif' : 'Nonaktif'}</Pill>,
                      <Switch
                        key="sw"
                        checked={!!t.admin_soap_enabled}
                        disabled={!t.user_id}
                        onCheckedChange={(v) => toggleAdminSoap(t, v)}
                        aria-label={`Izinkan admin mengisi SOAP untuk ${t.name}`}
                      />,
                    ],
                  }))}
                />
              )}

              {activeTab === 'jadwal' && (
                <RTable
                  cols="min-[1180px]:grid-cols-[90px_minmax(0,1.5fr)_minmax(0,1.5fr)_140px]"
                  heads={['Jam', 'Pasien', 'Terapis', 'Status']}
                  empty={{ title: 'Tidak ada jadwal hari ini', text: 'Jadwal yang masuk hari ini akan tampil di sini.' }}
                  rows={todayAppointments.map((a) => ({
                    key: a.id,
                    cells: [
                      <span key="hr" className="tabular-nums">{format(new Date(a.appointment_date), 'HH:mm')}</span>,
                      a.patient?.full_name || '-',
                      a.therapist?.name || '-',
                      <Pill key="st" tone={tone(a.status)} className="capitalize">{a.status || '-'}</Pill>,
                    ],
                  }))}
                />
              )}

              {activeTab === 'recap' && (
                <RTable
                  cols="min-[1180px]:grid-cols-[120px_minmax(0,1.5fr)_minmax(0,1.5fr)_140px]"
                  heads={Object.assign(['Tanggal', 'Pasien', 'Terapis', 'Nominal'], { rightLast: true })}
                  empty={{ title: 'Belum ada riwayat recap', text: 'Recap harian klinik ini akan tampil di sini.' }}
                  rows={recentRecaps.map((r) => ({
                    key: r.id,
                    cells: [
                      <span key="dt" className="tabular-nums">{r.recap_date ? format(new Date(r.recap_date), 'dd MMM yyyy') : '-'}</span>,
                      r.patient?.full_name || '-',
                      r.therapist?.name || '-',
                      <span key="am" className="tabular-nums font-semibold min-[1180px]:block min-[1180px]:text-right">{formatCurrency(r.amount)}</span>,
                    ],
                  }))}
                />
              )}
            </>
          )}
        </>
      )}
    </>
  );
};

export default SuperAdminClinicViewer;
