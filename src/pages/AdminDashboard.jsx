
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import OwnerPackageRecap from '@/pages/owner/PackageRecaps';
import DashboardLayout from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign } from 'lucide-react'; 
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
import { supabase } from '@/lib/supabase';
// Import Pages/Components
import DailyRecap from '@/components/admin/DailyRecap';
import FollowUpManagementPage from '@/components/admin/FollowUpManagementPage'; 
import AdminAccountingDashboard from '@/components/admin/AdminAccountingDashboard';
import AdminDashboardMetrics from '@/components/admin/AdminDashboardMetrics'; 
import TodaysOverviewWidget from '@/components/admin/TodaysOverviewWidget';
// Consolidated Pages
import AdminDatabasePatients from '@/pages/admin/DatabasePatients'; 
import AppointmentsPage from '@/pages/AppointmentsPage';
import MedicalRecordsPage from '@/pages/MedicalRecordsPage';
import ClinicalDocuments from '@/pages/admin/ClinicalDocuments'; 
import AdminPhysiotherapistManagementPage from '@/pages/admin/AdminPhysiotherapistManagementPage';
import AdminAppointmentBooking from '@/components/admin/AdminAppointmentBooking';
const HeroClock = () => {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="flex items-center gap-2.5 bg-white/10 border border-white/15 backdrop-blur-sm px-3 py-2 rounded-xl">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="text-sm font-bold text-white font-mono tracking-wider">
        {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </span>
      <div className="h-3.5 w-px bg-white/20"></div>
      <span className="text-xs font-semibold text-slate-300 uppercase tracking-widest">
        {now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
      </span>
    </div>
  );
};
const AdminDashboardHome = () => {
  const location = useLocation(); 
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
  useEffect(() => {
  const fetchSlotData = async (range) => {
  const todayDate = new Date();
  const dayOfWeek = todayDate.getDay(); // 0–6

  // ambil slot sesuai hari
  // 🔥 AMBIL SLOT REAL DARI FUNCTION
const today = new Date().toISOString().split('T')[0];

const { data: slotsData, error: slotError } = await supabase
  .rpc('get_available_slots_with_status_by_date', {
    p_date: today
  });

if (slotError) {
  console.error(slotError);
  return;
}

// TOTAL SLOT
const total = slotsData.length;

// SLOT TERISI
// 🔥 SLOT TERISI = JUMLAH APPOINTMENT (REAL PASIEN)
const { data: filledAppointments, error: filledError } = await supabase
  .from('appointments')
  .select('id')
  .gte('appointment_date', today + 'T00:00:00')
.lte('appointment_date', today + 'T23:59:59')
  .neq('status', 'cancelled');

if (filledError) {
  console.error(filledError);
  return;
}

const filled = filledAppointments.length;

// SET STATE
setSlotData({
  total,
  filled
});
  const { data: therapistRecaps, error: recapError } = await supabase
  .from('daily_recaps')
  .select(`
    therapist_id,
    recap_date
  `)
  .gte('recap_date', range.startDate)
  .lte('recap_date', range.endDate);

if (recapError) {
  console.error(recapError);
  return;
}
const therapistIds = [...new Set(therapistRecaps.map(t => t.therapist_id))];

const { data: therapistData } = await supabase
  .from('physiotherapists')
  .select('id, name')
  .in('id', therapistIds);

const therapistNameMap = {};
therapistData.forEach(t => {
  therapistNameMap[t.id] = t.name;
});


  // === THERAPIST PERFORMANCE ===
const therapistMap = {};

therapistRecaps.forEach(item => {
  if (!item.therapist_id) return;

  if (!therapistMap[item.therapist_id]) {
    therapistMap[item.therapist_id] = 0;
  }

  therapistMap[item.therapist_id] += 1;
});

const therapistStatsArray = Object.entries(therapistMap)
  .map(([therapist_id, total]) => {
  const therapist = therapistNameMap[therapist_id];

  return {
    therapist_id,
    name: therapistNameMap[therapist_id] || 'Unknown',
    total
  };
})
  .sort((a, b) => b.total - a.total);

setTherapistStats(therapistStatsArray);

// === TOP PATIENT ===
const { data: patientAppointments, error: patientError } = await supabase
  .from('daily_recaps')
  .select('patient_id, recap_date, service_type')
   .not('patient_id', 'is', null)
  .gte('recap_date', range.startDate)
  .lte('recap_date', range.endDate);

if (patientError) {
  console.error(patientError);
  return;
}

// ambil ID dulu (INI YANG TADI SALAH POSISI)
const patientIds = [...new Set(patientAppointments.map(p => p.patient_id))];

// ambil data pasien
const { data: patientsData } = await supabase
  .from('patients')
  .select('id, full_name')
  .in('id', patientIds);

// mapping nama
const patientNameMap = {};
patientsData?.forEach(p => {
  patientNameMap[p.id] = p.full_name;
});

// hitung jumlah kunjungan
const patientMap = {};

patientAppointments.forEach(item => {
  if (!item.patient_id) return;

  if (!patientMap[item.patient_id]) {
    patientMap[item.patient_id] = {
      name: patientNameMap[item.patient_id] || 'Unknown',
      total: 0
    };
  }

  patientMap[item.patient_id].total += 1;
});

// convert ke array
const topPatientsArray = Object.values(patientMap)
  .sort((a, b) => b.total - a.total);

setTopPatients(topPatientsArray);
// === TOP SERVICES ===
// === TOP SERVICES ===
const serviceMap = {};

// ambil semua service_id unik
const serviceIds = [
  ...new Set(
    patientAppointments
      .map(item => item.service_type)
      .filter(Boolean)
  )
];

// ambil nama service dari tabel services
const { data: servicesData } = await supabase
  .from('services')
  .select('id, name')
  .in('id', serviceIds);

// mapping id → nama
const serviceNameMap = {};
servicesData?.forEach(s => {
  serviceNameMap[s.id] = s.name;
});

// hitung total
patientAppointments.forEach(item => {
  if (!item.service_type) return;

  const serviceName =
    serviceNameMap[item.service_type] || item.service_type;

  if (!serviceMap[serviceName]) {
    serviceMap[serviceName] = 0;
  }

  serviceMap[serviceName] += 1;
});

const topServicesArray = Object.entries(serviceMap)
  .map(([name, total]) => ({ name, total }))
  .sort((a, b) => b.total - a.total);

setTopServices(topServicesArray);


// === TOP DIAGNOSIS ===
const diagnosisMap = {};
// ambil master diagnosa
const { data: masterDiagnoses } = await supabase
  .from('operational_options')
  .select('id, label')
  .eq('category', 'diagnosa');

const diagnosisNameMap = {};
masterDiagnoses?.forEach(d => {
  diagnosisNameMap[d.id] = d.label;
});
const { data: diagnosisData } = await supabase
  .from('daily_recaps')
  .select('diagnosis')
  .gte('recap_date', range.startDate)
  .lte('recap_date', range.endDate);

diagnosisData?.forEach(item => {
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

// pastikan array
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

  // kalau object → ambil labelnya
  let name = label;

// kalau UUID → ubah jadi nama
if (diagnosisNameMap[label]) {
  name = diagnosisNameMap[label];
}
  if (typeof label === "object") {
    name = label.label || label.name;
  }

  if (!name) return;

  if (!diagnosisMap[name]) {
    diagnosisMap[name] = 0;
  }

  diagnosisMap[name] += 1;
});
});
    

const topDiagnosisArray = Object.entries(diagnosisMap)
  .map(([name, total]) => ({ name, total }))
  .sort((a, b) => b.total - a.total);

setTopDiagnoses(topDiagnosisArray);

const { data: trendData, error: trendError } = await supabase
  .from('daily_recaps')
  .select('recap_date')
  .gte('recap_date', range.startDate)
  .lte('recap_date', range.endDate);

if (trendError) {
  console.error(trendError);
} else {
  const trendMap = {};

trendData.forEach(item => {
  if (!item.recap_date) return;

  const date = new Date(item.recap_date);

  // kelompokkan per 3 hari
  const groupKey = Math.floor(date.getDate() / 3);

  const key = `${date.getFullYear()}-${date.getMonth()}-${groupKey}`;

  if (!trendMap[key]) {
    trendMap[key] = {
      label: item.recap_date,
      total: 0
    };
  }

  trendMap[key].total += 1;
});

const trendArray = Object.values(trendMap)
  .map(item => ({
    date: item.label,
    total: item.total
  }))
  .sort((a, b) => a.date.localeCompare(b.date));

setTrendPatients(trendArray);
}
  };
  fetchSlotData(dateRange);
}, [dateRange]);
  return (
    <>
      <Helmet>
        <title>Admin Dashboard - Kaffah System Care</title>
        <meta name="description" content="Admin dashboard for Kaffah System Care" />
      </Helmet>
      
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">

        {/* ===== HERO BANNER — sembunyikan di PWA ===== */}
        {!isPWA && (
        <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-600/80 flex items-center justify-center shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold tracking-widest text-indigo-300 uppercase mb-1">Kaffah Physiotherapy</p>
                <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Admin Dashboard</h2>
                <p className="text-sm text-slate-400 mt-0.5">Pusat kendali operasional dan manajemen klinik</p>
              </div>
            </div>
            <div className="flex flex-col sm:items-end gap-2 shrink-0">
              <HeroClock />
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-sm px-3 py-2 rounded-xl">
                <span className="text-xs font-semibold text-indigo-200 whitespace-nowrap">Periode</span>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  className="w-28 text-xs px-2 py-1.5 rounded-lg outline-none bg-white/10 border border-white/20 text-white [color-scheme:dark] focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300"
                />
                <span className="text-slate-400 font-medium">–</span>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  className="w-28 text-xs px-2 py-1.5 rounded-lg outline-none bg-white/10 border border-white/20 text-white [color-scheme:dark] focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300"
                />
              </div>
            </div>
          </div>
        </div>
        )}

        {/* ===== Compact Header & Date Filter khusus PWA ===== */}
        {isPWA && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">Admin Dashboard</h2>
              <p className="text-xs text-slate-500">Pusat kendali operasional klinik</p>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-500">
              {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-slate-700"
            />
            <span className="text-slate-300">–</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-slate-700"
            />
          </div>
        </div>
        )}
        {/* ===== END HERO BANNER ===== */}

        <Tabs defaultValue="operational" className="w-full space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-slate-100 p-1">
            <TabsTrigger 
              value="operational"
              className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all"
            >
              Operational
            </TabsTrigger>
            <TabsTrigger 
              value="finance"
              className="data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm transition-all"
            >
              Finance
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="operational" className="space-y-8 focus-visible:outline-none focus-visible:ring-0">
             {/* Top Section: Today's Overview */}
             <div className="space-y-3">
               <h3 className="text-lg font-semibold text-slate-800 tracking-tight">Today's Overview</h3>
               <TodaysOverviewWidget />
             </div>
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

    let color = "bg-blue-500";
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
      <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4 hover:shadow-md transition-all">
        
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
            className={`${color} h-3 rounded-full transition-all`}
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
  <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4 h-full flex flex-col">

  <h3 className="text-lg font-semibold text-slate-800">
    Top Therapist
  </h3>

  {therapistStats.length === 0 ? (
    <p className="text-sm text-slate-400">Belum ada data</p>
  ) : (
    therapistStats.slice(0, 5).map((t, i) => (
      <div
        key={t.therapist_id}
        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition min-h-[60px]"
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
            <p className="text-xs text-slate-400">
              Therapist
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-lg font-bold text-slate-900">
            {t.total}
          </p>
          <p className="text-xs text-slate-400">
            pasien
          </p>
        </div>
      </div>
    ))
  )}

</div>
  
{/* TOP PATIENT */}
<div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4 h-full flex flex-col">

  <h3 className="text-lg font-semibold text-slate-800">
    Top Patient
  </h3>

  {topPatients.length === 0 ? (
  <div className="flex-1 flex items-center justify-center">
    <p className="text-sm text-slate-400">Belum ada data</p>
  </div>
) : (
  <div className="flex-1 flex flex-col justify-between">
    {topPatients.slice(0, 5).map((p, i) => (
      <div
        key={i}
        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition"
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
  <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4 h-full flex flex-col">

    <h3 className="text-lg font-semibold text-slate-800">
      Top Diagnosa
    </h3>

    {topDiagnoses.length === 0 ? (
  <div className="flex-1 flex items-center justify-center">
    <p className="text-sm text-slate-400">Belum ada data</p>
  </div>
) : (
  <div className="flex-1 flex flex-col gap-3">
    {topDiagnoses.slice(0, 5).map((d, i) => (
      <div
        key={i}
        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition"
      >
        <div className="flex items-center gap-3">
          <div className="text-lg">
            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🏅"}
          </div>

         <p className="text-sm font-semibold text-slate-800 line-clamp-1">
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
  <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4 h-full flex flex-col">

    <h3 className="text-lg font-semibold text-slate-800">
      Top Layanan
    </h3>

   {topServices.length === 0 ? (
  <div className="flex-1 flex items-center justify-center">
    <p className="text-sm text-slate-400">Belum ada data</p>
  </div>
) : (
  <div className="flex-1 flex flex-col gap-3">
    {topServices.slice(0, 5).map((s, i) => (
      <div
        key={i}
        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition"
      >
        <div className="flex items-center gap-3">
          <div className="text-lg">
            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🏅"}
          </div>

          <p className="text-sm font-semibold text-slate-800 line-clamp-1">
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

  <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl border shadow-sm p-6">

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
    <p className="text-sm text-slate-400">Belum ada data</p>
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

             <div className="min-h-[200px] flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-8">
               <h3 className="text-lg font-semibold text-slate-700">Detailed Operational Reports</h3>
               <p className="text-slate-500 mt-2 max-w-sm text-center">
                 More specific operational breakdown charts can be added here.
               </p>
             </div>
          </TabsContent>
          
          <TabsContent value="finance" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
            <div className="min-h-[400px] flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-8">
              <div className="p-4 rounded-full bg-emerald-50 mb-4">
                <DollarSign className="w-8 h-8 text-emerald-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700">Financial Overview Coming Soon</h3>
              <p className="text-slate-500 mt-2 max-w-sm text-center">
                This section is reserved for financial reports, revenue charts, and transaction summaries for the selected date range from <span className="font-semibold">{dateRange.startDate}</span> to <span className="font-semibold">{dateRange.endDate}</span>.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

const AdminDashboard = () => {
  const navItems = [
    { label: 'Dashboard', path: '/admin', icon: 'Home' },
    { label: 'Database Patients', path: '/admin/database-patients', icon: 'Database' },
    { label: 'Appointments', path: '/admin/appointments', icon: 'Calendar' },
    { label: 'Medical Records', path: '/admin/medical-records', icon: 'Activity' },
    { label: 'Daily Recaps', path: '/admin/daily-recap', icon: 'FileText' },
    { label: 'Package Recaps', path: '/admin/package-recaps', icon: 'Package' },
    { label: 'Physiotherapist Management', path: '/admin/physiotherapist-management', icon: 'Users' },
    { label: 'Follow Up Management', path: '/admin/follow-up-management', icon: 'ClipboardList' },
    { label: 'Clinical Documents', path: '/admin/clinical-documents', icon: 'FileText' }, 
    { label: 'Accounting', path: '/admin/accounting', icon: 'DollarSign' },
  ];
return (
    <DashboardLayout navItems={navItems} role="admin" userName="Admin">
      <Routes>
        <Route path="/" element={<AdminDashboardHome />} />
        
        {/* Consolidated Routes */}
        <Route path="/database-patients" element={<AdminDatabasePatients />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/medical-records" element={<MedicalRecordsPage />} />
        
        {/* Existing Routes */}
        <Route path="/daily-recap" element={<DailyRecap />} />
        <Route path="/package-recaps" element={<OwnerPackageRecap />} />
        <Route path="/follow-up-management" element={<FollowUpManagementPage />} />
        
        {/* Task 2: Add new route */}
        <Route path="/clinical-documents" element={<ClinicalDocuments />} />

        {/* Task 3: Physiotherapist Management */}
        <Route path="/physiotherapist-management" element={<AdminPhysiotherapistManagementPage />} />
        
        {/* Accounting Route */}
        <Route path="/accounting" element={<AdminAccountingDashboard />} />

        {/* Redirects for legacy routes */}
        <Route path="/patients" element={<Navigate to="/admin/database-patients" replace />} />
        <Route path="/packages" element={<Navigate to="/admin/database-patients" replace />} />
        <Route path="/schedule" element={<Navigate to="/admin/appointments" replace />} />
        <Route path="/appointment-booking" element={<Navigate to="/admin/appointments" replace />} />
        <Route path="/follow-up" element={<Navigate to="/admin/follow-up-management" replace />} />
        
        {/* Catch-all for sub-dashboard routes if someone tries to access directly */}
        <Route path="/dashboard/*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </DashboardLayout>
  );
};

export default AdminDashboard;
