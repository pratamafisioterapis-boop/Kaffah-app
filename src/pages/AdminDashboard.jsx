import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
const OwnerPackageRecap = React.lazy(lazyRetry(() => import('@/pages/owner/PackageRecaps'), 'OwnerPackageRecap'));
const AdminCheckTransaksi = React.lazy(lazyRetry(() => import('@/pages/admin/AdminCheckTransaksi'), 'AdminCheckTransaksi'));
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';
// Import Pages/Components
const DailyRecap = React.lazy(lazyRetry(() => import('@/components/admin/DailyRecap'), 'DailyRecap'));
const WhatsAppInboxPage = React.lazy(lazyRetry(() => import('@/components/admin/WhatsAppInboxPage'), 'WhatsAppInboxPage'));
const FollowUpManagementPage = React.lazy(lazyRetry(() => import('@/components/admin/FollowUpManagementPage'), 'FollowUpManagementPage'));
const AdminAccountingDashboard = React.lazy(lazyRetry(() => import('@/components/admin/AdminAccountingDashboard'), 'AdminAccountingDashboard'));
import AdminDashboardMetrics from '@/components/admin/AdminDashboardMetrics'; 
import TodaysOverviewWidget from '@/components/admin/TodaysOverviewWidget';
import AdminDailyChecklistWidget from '@/components/admin/AdminDailyChecklistWidget';
import SoapPendingBanner from '@/components/shared/SoapPendingBanner';
import UnpaidSessionsCard from '@/components/shared/UnpaidSessionsCard';
import PatientSourceChart from '@/components/owner/operational/PatientSourceChart';
import PromoUsageWidget from '@/components/owner/operational/PromoUsageWidget';
// Consolidated Pages
const AdminDatabasePatients = React.lazy(lazyRetry(() => import('@/pages/admin/DatabasePatients'), 'AdminDatabasePatients'));
const AppointmentsPage = React.lazy(lazyRetry(() => import('@/pages/AppointmentsPage'), 'AppointmentsPage'));
const MedicalRecordsPage = React.lazy(lazyRetry(() => import('@/pages/MedicalRecordsPage'), 'MedicalRecordsPage'));
import NewDecreeBanner from '@/components/shared/NewDecreeBanner';
const ClinicDecreesViewer = React.lazy(lazyRetry(() => import('@/pages/shared/ClinicDecreesViewer'), 'ClinicDecreesViewer'));
const ClinicalDocuments = React.lazy(lazyRetry(() => import('@/pages/admin/ClinicalDocuments'), 'ClinicalDocuments'));
const AdminPhysiotherapistManagementPage = React.lazy(lazyRetry(() => import('@/pages/admin/AdminPhysiotherapistManagementPage'), 'AdminPhysiotherapistManagementPage'));
const AdminAccountSettings = React.lazy(lazyRetry(() => import('@/components/admin/AdminAccountSettings'), 'AdminAccountSettings'));
const AttendanceManagement = React.lazy(lazyRetry(() => import('@/pages/admin/AttendanceManagement'), 'AttendanceManagement'));
import { ADMIN_NAV_ITEMS } from '@/lib/navItems';
import { isLightLoadModeEnabled } from '@/lib/lightLoadMode';
import { getCachedClinicId } from '@/lib/api';
import PageHero from '@/components/shared/PageHero';
import HeroClock from '@/components/shared/HeroClock';
import { lazyRetry } from '@/lib/lazyRetry';
import PageSkeleton from '@/components/shared/PageSkeleton';
const AdminDashboardHome = () => {
  const location = useLocation();
  const { clinicName } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');
  const [slotData, setSlotData] = useState({
  total: 0,
  filled: 0
});
const [topPatients, setTopPatients] = useState([]);
const [therapistStats, setTherapistStats] = useState([]);
const [trendPatients, setTrendPatients] = useState([]);
const [topDiagnoses, setTopDiagnoses] = useState([]);
const [topServices, setTopServices] = useState([]);
  // Initialize state from localStorage if already set, otherwise default to 1st - end of current month
  const [dateRange, setDateRange] = useState(() => {
    const savedRange = localStorage.getItem('adminDashboardDateRange');
    if (savedRange) {
      try {
        const parsed = JSON.parse(savedRange);
        if (parsed?.startDate && parsed?.endDate) {
          return parsed;
        }
      } catch (e) {}
    }

    const now = new Date();
    return {
      startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
    };
  });

  // Update localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('adminDashboardDateRange', JSON.stringify(dateRange));
  }, [dateRange]);

  // What the date inputs show. `dateRange` (used by every query) only follows after a
  // short pause and only for a valid range, so picking dates does not fire a burst of
  // requests for each intermediate value.
  const [rangeInput, setRangeInput] = useState(dateRange);
  useEffect(() => {
    const { startDate, endDate } = rangeInput;
    if (!startDate || !endDate || startDate > endDate) return undefined;
    const timer = setTimeout(() => {
      setDateRange((prev) => (prev.startDate === startDate && prev.endDate === endDate ? prev : { startDate, endDate }));
    }, 400);
    return () => clearTimeout(timer);
  }, [rangeInput]);
  useEffect(() => {
  let cancelled = false;
  const fetchSlotData = async (range) => {
  const todayDate = new Date();
  const dayOfWeek = todayDate.getDay(); // 0–6

  // ambil slot sesuai hari
  // 🔥 AMBIL SLOT REAL DARI FUNCTION
const today = new Date().toISOString().split('T')[0];

const { data: sessionData } = await supabase.auth.getSession();
const currentUserId = sessionData?.session?.user?.id;
const clinicId = await getCachedClinicId(currentUserId);

// Kartu slot dan kartu statistik tidak saling bergantung — jalan bersamaan,
// masing-masing menampilkan hasilnya begitu selesai.
const loadSlots = async () => {
  const [
    { data: slotsData, error: slotError },
    { data: filledAppointments, error: filledError },
  ] = await Promise.all([
    supabase.rpc('get_available_slots_with_status_by_date', {
      p_date: today,
      p_clinic_id: clinicId
    }),
    // SLOT TERISI = JUMLAH APPOINTMENT (REAL PASIEN)
    supabase
      .from('appointments')
      .select('id')
      .eq('clinic_id', clinicId)
      .gte('appointment_date', today + 'T00:00:00')
      .lte('appointment_date', today + 'T23:59:59')
      .neq('status', 'cancelled'),
  ]);

  if (slotError) { console.error(slotError); return; }
  if (filledError) { console.error(filledError); return; }
  if (cancelled) return;

  setSlotData({ total: slotsData.length, filled: filledAppointments.length });
};

const loadStats = async () => {
  // Satu query daily_recaps untuk semua kartu (sebelumnya 4 query terpisah
  // dengan filter yang sama), plus master diagnosa secara paralel.
  const [
    { data: recaps, error: recapError },
    { data: masterDiagnoses },
  ] = await Promise.all([
    supabase
      .from('daily_recaps')
      .select('therapist_id, recap_date, patient_id, service_type, diagnosis')
      .eq('clinic_id', clinicId)
      .gte('recap_date', range.startDate)
      .lte('recap_date', range.endDate),
    supabase
      .from('operational_options')
      .select('id, label')
      .eq('clinic_id', clinicId)
      .eq('category', 'diagnosa'),
  ]);

  if (recapError) { console.error(recapError); return; }

  const therapistRecaps = recaps || [];
  const patientAppointments = therapistRecaps.filter(r => r.patient_id);

  const therapistIds = [...new Set(therapistRecaps.map(t => t.therapist_id).filter(Boolean))];
  const patientIds = [...new Set(patientAppointments.map(p => p.patient_id))];
  const serviceIds = [...new Set(patientAppointments.map(i => i.service_type).filter(Boolean))];

  // Lookup nama: tiga query independen, dijalankan bersamaan.
  const [
    { data: therapistData },
    { data: patientsData },
    { data: servicesData },
  ] = await Promise.all([
    supabase.from('physiotherapists').select('id, name').in('id', therapistIds),
    supabase.from('patients').select('id, full_name').in('id', patientIds),
    supabase.from('services').select('id, name').in('id', serviceIds),
  ]);

  if (cancelled) return;

  // === THERAPIST PERFORMANCE ===
  const therapistNameMap = {};
  therapistData?.forEach(t => { therapistNameMap[t.id] = t.name; });

  const therapistMap = {};
  therapistRecaps.forEach(item => {
    if (!item.therapist_id) return;
    therapistMap[item.therapist_id] = (therapistMap[item.therapist_id] || 0) + 1;
  });

  setTherapistStats(
    Object.entries(therapistMap)
      .map(([therapist_id, total]) => ({
        therapist_id,
        name: therapistNameMap[therapist_id] || 'Unknown',
        total
      }))
      .sort((a, b) => b.total - a.total)
  );

  // === TOP PATIENT ===
  const patientNameMap = {};
  patientsData?.forEach(p => { patientNameMap[p.id] = p.full_name; });

  const patientMap = {};
  patientAppointments.forEach(item => {
    if (!patientMap[item.patient_id]) {
      patientMap[item.patient_id] = {
        name: patientNameMap[item.patient_id] || 'Unknown',
        total: 0
      };
    }
    patientMap[item.patient_id].total += 1;
  });
  setTopPatients(Object.values(patientMap).sort((a, b) => b.total - a.total));

  // === TOP SERVICES ===
  const serviceNameMap = {};
  servicesData?.forEach(s => { serviceNameMap[s.id] = s.name; });

  const serviceMap = {};
  patientAppointments.forEach(item => {
    if (!item.service_type) return;
    const serviceName = serviceNameMap[item.service_type] || item.service_type;
    serviceMap[serviceName] = (serviceMap[serviceName] || 0) + 1;
  });
  setTopServices(
    Object.entries(serviceMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  );

  // === TOP DIAGNOSIS ===
  const diagnosisNameMap = {};
  masterDiagnoses?.forEach(d => { diagnosisNameMap[d.id] = d.label; });

  const diagnosisMap = {};
  therapistRecaps.forEach(item => {
    if (!item.diagnosis) return;

    let labels = item.diagnosis;

    // handle string JSON
    if (typeof labels === "string") {
      try {
        labels = JSON.parse(labels);
      } catch {
        labels = [labels];
      }
    }

    // kalau string → pecah pakai koma
    if (typeof labels === "string") {
      labels = labels.split(",").map(l => l.trim());
    }

    // kalau bukan array → bungkus jadi array
    if (!Array.isArray(labels)) {
      labels = [labels];
    }

    labels.forEach(label => {
      if (!label) return;

      let name = label;

      // kalau UUID → ubah jadi nama
      if (diagnosisNameMap[label]) {
        name = diagnosisNameMap[label];
      }
      // kalau object → ambil labelnya
      if (typeof label === "object") {
        name = label.label || label.name;
      }

      if (!name) return;
      diagnosisMap[name] = (diagnosisMap[name] || 0) + 1;
    });
  });
  setTopDiagnoses(
    Object.entries(diagnosisMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  );

  // === TREND === (1 titik = 1 hari)
  const trendMap = {};
  therapistRecaps.forEach(item => {
    if (!item.recap_date) return;
    trendMap[item.recap_date] = (trendMap[item.recap_date] || 0) + 1;
  });
  setTrendPatients(
    Object.entries(trendMap)
      .map(([date, total]) => ({ date, total }))
      .sort((x, y) => x.date.localeCompare(y.date))
  );
};

await Promise.all([loadSlots(), loadStats()]);
  };
  fetchSlotData(dateRange);
  return () => { cancelled = true; };
}, [dateRange]);
  return (
    <>
      <Helmet>
        <title>Admin Dashboard - Kaffah System Care</title>
        <meta name="description" content="Admin dashboard for Kaffah System Care" />
      </Helmet>
      
      <div className="space-y-6 animate-in fade-in duration-200 ease-out pb-20">

        {/* ── Hero Banner ── */}
        <PageHero image="/hero/clinara-owner-hero.webp" objectPosition="36% center" kicker={<HeroClock />} title="Selamat datang," highlight={<>Admin {clinicName || ''}!</>} description="Pusat kendali operasional dan manajemen klinik." wide />

        {/* ── Periode Toolbar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div role="group" aria-labelledby="admin-period-label" className="flex items-center gap-2 bg-white border border-app-border rounded-app-sm px-3 py-1.5 w-full sm:w-auto shadow-sm focus-within:ring-2 focus-within:ring-app-accent/40">
              <span id="admin-period-label" className="text-app-accent text-xs font-bold uppercase tracking-wider shrink-0">Periode</span>
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <input
                  type="date"
                  aria-label="Tanggal mulai periode"
                  value={rangeInput.startDate}
                  max={rangeInput.endDate || undefined}
                  onChange={(e) => setRangeInput((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="text-xs border-0 outline-none text-app-ink font-medium bg-transparent w-full sm:w-auto"
                />
                <span className="text-app-muted shrink-0" aria-hidden="true">–</span>
                <input
                  type="date"
                  aria-label="Tanggal akhir periode"
                  value={rangeInput.endDate}
                  min={rangeInput.startDate || undefined}
                  onChange={(e) => setRangeInput((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="text-xs border-0 outline-none text-app-ink font-medium bg-transparent w-full sm:w-auto"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="w-full space-y-8">
             {/* Top Section: Today's Overview */}
             <div className="space-y-3">
               <h3 className="text-lg font-semibold text-slate-800 tracking-tight">Today's Overview</h3>
               <TodaysOverviewWidget />
             </div>

             <SoapPendingBanner role="admin" />
             <UnpaidSessionsCard />

             {/* Daily Admin Checklist */}
             <AdminDailyChecklistWidget />

{/* Slot Utilization */}
<div className="space-y-3">
  <h3 className="text-lg font-semibold text-slate-800 tracking-tight">
    Slot Utilization
  </h3>

  {(() => {
    const percent =
      slotData.total > 0
        ? Math.round((slotData.filled / slotData.total) * 100)
        : 0;

    let color = "bg-app-accent-bright";
    let label = "Normal";

    if (percent < 30) {
      color = "bg-red-500";
      label = "Low Utilization";
    } else if (percent < 70) {
      color = "bg-yellow-500";
      label = "Moderate";
    } else {
      color = "bg-green-500";
      label = "Optimal";
    }

    return (
      <div className="bg-white rounded-app-lg border shadow-sm p-5 space-y-4 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-md transition-[color,background-color,border-color,box-shadow,transform,opacity]">
        
        {/* TOP */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-slate-500">Today Usage</p>
            <p className="text-3xl font-bold text-slate-900">
              {percent}%
            </p>
          </div>

          <div className={`px-3 py-1 text-xs font-semibold rounded-full text-white ${color}`}>
            {label}
          </div>
        </div>

        {/* PROGRESS */}
        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
          <div
            className={`${color} h-3 rounded-full transition-[color,background-color,border-color,box-shadow,transform,opacity]`}
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* DETAIL */}
        <div className="flex justify-between text-sm text-slate-500">
          <span>{slotData.filled} slot terisi</span>
          <span>{slotData.total} total slot</span>
        </div>

      </div>
    );
  })()}
</div>
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

  {/* TOP THERAPIST */}
  <div className="bg-white rounded-app-lg border shadow-sm p-5 space-y-4 h-full flex flex-col">

  <h3 className="text-lg font-semibold text-slate-800">
    Top Therapist
  </h3>

  {therapistStats.length === 0 ? (
    <p className="text-sm text-slate-500">Belum ada data</p>
  ) : (
    therapistStats.slice(0, 5).map((t, i) => (
      <div
        key={t.therapist_id}
        className="flex items-center justify-between p-3 rounded-app bg-slate-50 hover:bg-slate-100 transition min-h-[60px]"
      >
        <div className="flex items-center gap-3">
          <div className="text-lg">
            {
  i === 0
    ? "🥇" // Gold
    : i === 1
    ? "🥈" // Silver
    : i === 2
    ? "🥉" // Bronze
    : i === 3
    ? "🎖️" // Medal (lebih umum)
    : "🏅" // Award (lebih bawah)
}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-800">
              {t.name}
            </p>
            <p className="text-xs text-slate-500">
              Therapist
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-lg font-bold text-slate-900">
            {t.total}
          </p>
          <p className="text-xs text-slate-500">
            pasien
          </p>
        </div>
      </div>
    ))
  )}

</div>
  
{/* TOP PATIENT */}
<div className="bg-white rounded-app-lg border shadow-sm p-5 space-y-4 h-full flex flex-col">

  <h3 className="text-lg font-semibold text-slate-800">
    Top Patient
  </h3>

  {topPatients.length === 0 ? (
  <div className="flex-1 flex items-center justify-center">
    <p className="text-sm text-slate-500">Belum ada data</p>
  </div>
) : (
  <div className="flex-1 flex flex-col justify-between">
    {topPatients.slice(0, 5).map((p, i) => (
      <div
        key={i}
        className="flex items-center justify-between p-3 rounded-app bg-slate-50 hover:bg-slate-100 transition"
      >
        <div className="flex items-center gap-3">
          <div className="text-lg">
            {
  i === 0
    ? "🥇" // Gold
    : i === 1
    ? "🥈" // Silver
    : i === 2
    ? "🥉" // Bronze
    : i === 3
    ? "🎖️" // Medal (lebih umum)
    : "🏅" // Award (lebih bawah)
}
          </div>

          <div>
  <p className="text-sm font-semibold text-slate-800">
    {p.name}
  </p>
  <p className="text-xs text-transparent">
    placeholder
  </p>
</div>
        </div>

        <span className="text-sm font-bold text-slate-900">
          {p.total}x
        </span>
      </div>
        ))}
  </div>
  )}

</div>
 

  </div>
{/* TOP DIAGNOSA + TOP LAYANAN */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

  {/* TOP DIAGNOSA */}
  <div className="bg-white rounded-app-lg border shadow-sm p-5 space-y-4 h-full flex flex-col">

    <h3 className="text-lg font-semibold text-slate-800">
      Top Diagnosa
    </h3>

    {topDiagnoses.length === 0 ? (
  <div className="flex-1 flex items-center justify-center">
    <p className="text-sm text-slate-500">Belum ada data</p>
  </div>
) : (
  <div className="flex-1 flex flex-col gap-3">
    {topDiagnoses.slice(0, 5).map((d, i) => (
      <div
        key={i}
        className="flex items-center justify-between p-3 rounded-app bg-slate-50 hover:bg-slate-100 transition"
      >
        <div className="flex items-center gap-3">
          <div className="text-lg">
            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🏅"}
          </div>

         <p className="text-sm font-semibold text-slate-800 line-clamp-2 sm:line-clamp-1">
  {d.name}
</p>
        </div>

        <span className="text-sm font-bold text-slate-900">
          {d.total}
        </span>
      </div>
    ))}
  </div>
)}

  </div>


  {/* TOP LAYANAN */}
  <div className="bg-white rounded-app-lg border shadow-sm p-5 space-y-4 h-full flex flex-col">

    <h3 className="text-lg font-semibold text-slate-800">
      Top Layanan
    </h3>

   {topServices.length === 0 ? (
  <div className="flex-1 flex items-center justify-center">
    <p className="text-sm text-slate-500">Belum ada data</p>
  </div>
) : (
  <div className="flex-1 flex flex-col gap-3">
    {topServices.slice(0, 5).map((s, i) => (
      <div
        key={i}
        className="flex items-center justify-between p-3 rounded-app bg-slate-50 hover:bg-slate-100 transition"
      >
        <div className="flex items-center gap-3">
          <div className="text-lg">
            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🏅"}
          </div>

          <p className="text-sm font-semibold text-slate-800 line-clamp-2 sm:line-clamp-1">
  {s.name}
</p>
        </div>

        <span className="text-sm font-bold text-slate-900">
          {s.total}
        </span>
      </div>
    ))}
  </div>
)}
</div>
</div>
{/* PEAK ACTIVITY FULL WIDTH */}
<div className="space-y-3 mt-6">
  <h3 className="text-lg font-semibold text-slate-800">
    Trend Patients
  </h3>

  <div className="bg-gradient-to-br from-app-soft to-white rounded-app-lg border shadow-sm p-6">

  {trendPatients.length > 0 ? (
    <div className="w-full h-[250px]">

      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trendPatients}>

          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

          <XAxis
  dataKey="date"
  ticks={trendPatients
    .filter((_, i) => i % Math.ceil(trendPatients.length / 6) === 0)
    .map(d => d.date)
  }
  tickFormatter={(date) =>
    new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short'
    })
  }
  tick={{ fontSize: 12 }}
/>

          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12 }}
          />

          <Tooltip
            formatter={(value) => [`${value} pasien`, 'Jumlah']}
            labelFormatter={(label) =>
              new Date(label).toLocaleDateString('id-ID', {
                weekday: 'short',
                day: 'numeric',
                month: 'short'
              })
            }
          />

          <Line
            type="monotone"
            dataKey="total"
            stroke="#2563eb"
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />

        </LineChart>
      </ResponsiveContainer>

    </div>
  ) : (
    <p className="text-sm text-slate-500">Belum ada data</p>
  )}

</div>
</div>
             {/* Middle Section: Recap Metrics & Evaluation Report */}
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3 space-y-3">
                  <h3 className="text-lg font-semibold text-slate-800 tracking-tight">Recap Metrics</h3>
                  <AdminDashboardMetrics dateRange={dateRange} />
                </div>
                
                
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <PatientSourceChart dateRange={dateRange} />
               <PromoUsageWidget dateRange={dateRange} />
             </div>
        </div>
      </div>
    </>
  );
};

const AdminDashboard = () => {
  const navItems = ADMIN_NAV_ITEMS;
return (
    <DashboardLayout navItems={navItems} role="admin" userName="Admin">
      <NewDecreeBanner to="/admin/decrees" />
      <React.Suspense fallback={<PageSkeleton />}>
        <Routes>
        <Route path="/" element={isLightLoadModeEnabled() ? <Navigate to="/admin/appointments" replace /> : <AdminDashboardHome />} />
        
        {/* Consolidated Routes */}
        <Route path="/database-patients" element={<AdminDatabasePatients />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/medical-records" element={<MedicalRecordsPage />} />
        
        {/* Existing Routes */}
        <Route path="/daily-recap" element={<DailyRecap />} />
        <Route path="/package-recaps" element={<OwnerPackageRecap />} />
        <Route path="/follow-up-management" element={<FollowUpManagementPage />} />
        <Route path="/wa-inbox" element={<WhatsAppInboxPage />} />
        
        {/* Task 2: Add new route */}
        <Route path="/clinical-documents" element={<ClinicalDocuments />} />
        <Route path="/decrees" element={<ClinicDecreesViewer />} />

        {/* Task 3: Physiotherapist Management */}
        <Route path="/physiotherapist-management" element={<AdminPhysiotherapistManagementPage />} />
        
        {/* Accounting Route */}
        <Route path="/accounting" element={<AdminAccountingDashboard />} />
        <Route path="/check-transaksi" element={<AdminCheckTransaksi />} />
        <Route path="/attendance" element={<AttendanceManagement />} />
        <Route path="/settings" element={<AdminAccountSettings />} />

        {/* Redirects for legacy routes */}
        <Route path="/patients" element={<Navigate to="/admin/database-patients" replace />} />
        <Route path="/packages" element={<Navigate to="/admin/database-patients" replace />} />
        <Route path="/schedule" element={<Navigate to="/admin/appointments" replace />} />
        <Route path="/appointment-booking" element={<Navigate to="/admin/appointments" replace />} />
        <Route path="/follow-up" element={<Navigate to="/admin/follow-up-management" replace />} />
        
        {/* Catch-all for sub-dashboard routes if someone tries to access directly */}
        <Route path="/dashboard/*" element={<Navigate to="/admin" replace />} />
      </Routes>
        </React.Suspense>
    </DashboardLayout>
  );
};

export default AdminDashboard;
