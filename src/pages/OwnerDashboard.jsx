import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import DashboardLayout from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { format, subDays } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '@/lib/customSupabaseClient';
import { Activity } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// Pages
import OwnerAppointmentsPage from '@/pages/OwnerAppointmentsPage';
import DatabasePatients from '@/pages/owner/DatabasePatients'; // Updated Import
import PhysiotherapistManagementPage from '@/pages/PhysiotherapistManagementPage';
import MedicalRecordsPage from '@/pages/MedicalRecordsPage';
import OwnerFollowUpManagementPage from '@/components/admin/FollowUpManagementPage';

// Components
import SettingsPage from '@/components/owner/SettingsPage';
import OwnerDailyRecap from '@/components/owner/OwnerDailyRecap';
import OwnerFinanceDashboardComponent from '@/components/owner/OwnerFinanceDashboard';
import RevenueOverview from '@/components/owner/RevenueOverview';



// Operational Components
import OperationalDashboardUI from '@/components/owner/operational/OperationalDashboardUI';
import SessionTimelinessChart from '@/components/owner/operational/SessionTimelinessChart';
import TrendSessionChart from '@/components/owner/operational/TrendSessionChart';
import TherapistStatusCards from '@/components/owner/operational/TherapistStatusCards';
import SlotUtilizationChart from '@/components/owner/operational/SlotUtilizationChart';
import CapacityVsDemandChart from '@/components/owner/operational/CapacityVsDemandChart';
import BulletChartTargetVsRealization from '@/components/owner/operational/BulletChartTargetVsRealization';
import ServiceDistributionChart from '@/components/owner/operational/ServiceDistributionChart';

// API
import { 
  fetchTotalSessions, 
  fetchTotalPatients, 
  fetchTotalPackages, 
  fetchTodaySessions,
  fetchOngoingSessions,
  fetchCompletedSessions,
  fetchCancelledAppointments,
  fetchActiveTherapists,
  fetchEmptySlots,
  fetchAllTherapists,
  fetchTodaySessionsPerTherapist
} from '@/lib/api';
const BSIMutasiReconciliation = React.lazy(() =>
  import('@/pages/owner/BSIMutasiReconciliation').catch(err => ({
    default: () => (
      <div style={{ padding: 24, background: '#fef2f2', border: '2px solid #ef4444', borderRadius: 12, margin: 16 }}>
        <h2 style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: 8 }}>❌ Gagal Load BSIMutasiReconciliation</h2>
        <pre style={{ color: '#7f1d1d', fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{err?.toString()}{'\n'}{err?.stack}</pre>
      </div>
    )
  }))
);
// Helper to safely extract numeric values
const safeExtractNumber = (response) => {
  if (typeof response === 'number') return response;
  if (response && typeof response === 'object') {
    if (typeof response.count === 'number') return response.count;
    if (typeof response.data === 'number') return response.data;
    if (Array.isArray(response.data)) return response.data.length;
  }
  return 0;
};

const OwnerDashboardHome = () => {
  const { toast } = useToast();
  const location = useLocation(); 
  
  // Initialize state from localStorage or default to last 30 days
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      startDate: format(firstDay, 'yyyy-MM-dd'),
      endDate: format(lastDay, 'yyyy-MM-dd')
    };
  });

  // KPI States
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalPatients, setTotalPatients] = useState(0);
  const [totalPackages, setTotalPackages] = useState(0);
  const [todaySessions, setTodaySessions] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // New Operational KPI States
  const [ongoingSessions, setOngoingSessions] = useState(0);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [cancelledAppointments, setCancelledAppointments] = useState(0);
  const [activeTherapists, setActiveTherapists] = useState(0);
  const [emptySlots, setEmptySlots] = useState(0);
  const [isLoadingKPI, setIsLoadingKPI] = useState(true);
  const [kpiError, setKpiError] = useState(null);

  // Therapist Status States
  const [therapists, setTherapists] = useState([]);
  const [therapistSessions, setTherapistSessions] = useState({});
  const [isLoadingTherapists, setIsLoadingTherapists] = useState(true);

  // Update localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('ownerDashboardDateRange', JSON.stringify(dateRange));
  }, [dateRange]);

  const loadKPIData = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
      setIsLoadingKPI(true);
    }
    setKpiError(null);
    try {
      console.log("Fetching Dashboard KPI Data...");
      const [
        sessionsRes, 
        patientsRes, 
        packagesRes, 
        todayRes,
        ongoingRes,
        completedRes,
        cancelledRes,
        activeRes,
        slotsRes
      ] = await Promise.all([
        fetchTotalSessions(dateRange.startDate, dateRange.endDate),
        fetchTotalPatients(dateRange.startDate, dateRange.endDate),
        fetchTotalPackages(dateRange.startDate, dateRange.endDate),
        fetchTodaySessions(),
        fetchOngoingSessions(),
        fetchCompletedSessions(),
        fetchCancelledAppointments(),
        fetchActiveTherapists(),
        fetchEmptySlots()
      ]);

      // Safely extract values using helper
      setTotalSessions(safeExtractNumber(sessionsRes));
      setTotalPatients(safeExtractNumber(patientsRes));
      setTotalPackages(safeExtractNumber(packagesRes));
      setTodaySessions(safeExtractNumber(todayRes));
      
      setOngoingSessions(safeExtractNumber(ongoingRes));
      setCompletedSessions(safeExtractNumber(completedRes));
      setCancelledAppointments(safeExtractNumber(cancelledRes));
      setActiveTherapists(safeExtractNumber(activeRes));
      setEmptySlots(safeExtractNumber(slotsRes));

    } catch (error) {
      console.error("Failed to fetch KPI data:", error);
      setKpiError(error);
      toast({
        title: "Error fetching data",
        description: "Could not load dashboard metrics. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setIsLoadingKPI(false);
      setIsRefreshing(false);
    }
  }, [dateRange, toast]);

  const loadTherapistData = useCallback(async () => {
    setIsLoadingTherapists(true);
    try {
      // 1. Fetch all therapists details
      const response = await fetchAllTherapists();
      // Handle both { data: [...] } and direct array
      const therapistList = Array.isArray(response) ? response : (response?.data || []);
      

// 🔥 hanya therapist aktif
const activeTherapistsOnly = (therapistList || []).filter(
  t => t.is_active === true
);

// 🔥 ambil slot hari ini
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Makassar',
  year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

const { data: sessionData } = await supabase.auth.getSession();
const currentUserId = sessionData?.session?.user?.id;
const { data: currentUserRow } = await supabase.from('users').select('clinic_id').eq('id', currentUserId).single();

// 🔥 Gunakan RPC yang sama persis dengan halaman Appointments
// agar konsisten (tabel therapist_schedules tidak memperhitungkan
// override/pengecualian jadwal untuk tanggal spesifik)
const { data: rpcData } = await supabase.rpc(
  'get_available_slots_with_status_by_date',
  { p_date: today, p_clinic_id: currentUserRow?.clinic_id }
);

let slotCountMap = {};
(rpcData || []).forEach(slot => {
  const tid = slot.therapist_id || slot.therapistId || slot.therapist;
  if (!tid) return;
  slotCountMap[tid] = (slotCountMap[tid] || 0) + 1;
});

// 🔥 Cek terapis yang sedang cuti/sakit pada tanggal hari ini
const { data: timeOffData } = await supabase
  .from('therapist_time_off')
  .select('therapist_id, reason')
  .lte('start_date', today)
  .gte('end_date', today);

const leaveMap = {};
(timeOffData || []).forEach(t => {
  leaveMap[t.therapist_id] = (t.reason || '').toLowerCase().includes('sakit') ? 'sakit' : 'cuti';
});

// Inject total_slots & leave_status ke therapist
const enrichedTherapists = activeTherapistsOnly.map(t => ({
  ...t,
  total_slots: slotCountMap[t.id] || 0,
  leave_status: leaveMap[t.id] || null
}));

setTherapists(enrichedTherapists);

      // 2. Fetch session counts for each therapist
      const sessionCounts = {};
      if (therapistList && therapistList.length > 0) {
        // Parallel fetch for better performance
        const results = await Promise.all(
          therapistList.map(async (t) => {
            const countRes = await fetchTodaySessionsPerTherapist(t.id);
            return { id: t.id, count: safeExtractNumber(countRes) };
          })
        );
        
        results.forEach(r => {
          sessionCounts[r.id] = r.count;
        });
      }
      setTherapistSessions(sessionCounts);

    } catch (error) {
      console.error("Failed to fetch therapist status:", error);
      toast({
        title: "Error fetching therapist status",
        description: "Could not load therapist availability.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingTherapists(false);
    }
  }, [toast]);

  // Initial Load & Refresh on Location Change
  useEffect(() => {
    loadKPIData();
    loadTherapistData();
  }, [loadKPIData, loadTherapistData, location]);


  // Real-time Subscription
  useEffect(() => {
    console.log("Setting up Realtime Subscription for Dashboard...");
    const channel = supabase
      .channel('dashboard-appointments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          console.log('Realtime change detected in appointments:', payload);
          // Refresh data on any appointment change
          loadKPIData(false); // Silent refresh
          loadTherapistData(); // Update therapist stats too
        }
      )
      .subscribe();

    return () => {
      console.log("Cleaning up Dashboard Subscription...");
      supabase.removeChannel(channel);
    };
  }, [loadKPIData, loadTherapistData]);


  const handleManualRefresh = () => {
    setIsRefreshing(true);
    loadKPIData(true);
    loadTherapistData();
  };

  return (
    <>
      <Helmet>
        <title>Owner Dashboard - Kaffah System Care</title>
        <meta name="description" content="Owner dashboard for Kaffah System Care" />
      </Helmet>
      
      <div className="space-y-4 animate-in fade-in duration-500 pb-24 md:pb-12">

        {/* ── Hero Header ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 md:p-7 shadow-xl">
          {/* Decorative blobs */}
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-1">{useAuth().clinicName || 'Kaffah Physiotherapy'}</p>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Owner Dashboard</h1>
              <p className="text-slate-400 text-xs mt-1">Executive overview of clinic performance.</p>
            </div>

            {/* Periode Selector */}
            <div className="flex flex-col gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-3 py-2.5 w-full sm:w-auto">
              <span className="text-indigo-300 text-[10px] font-bold uppercase tracking-wider">Periode</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  className="text-xs border-0 outline-none text-white font-medium bg-transparent w-full [color-scheme:dark]"
                />
                <span className="text-white/30 shrink-0">–</span>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  className="text-xs border-0 outline-none text-white font-medium bg-transparent w-full [color-scheme:dark]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="operational" className="w-full space-y-5">
          <TabsList className="grid w-full grid-cols-2 bg-white border border-slate-200 p-1 rounded-2xl shadow-sm sticky top-2 z-10">
            <TabsTrigger
              value="operational"
              className="rounded-xl text-sm font-semibold transition-all duration-200 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500"
            >
              Operational
            </TabsTrigger>
            <TabsTrigger
              value="finance"
              className="rounded-xl text-sm font-semibold transition-all duration-200 data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500"
            >
              Finance
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="operational" className="space-y-8 focus-visible:outline-none focus-visible:ring-0">
             {/* Section 1: Top Level KPI Cards */}
             <section className="space-y-4">
                <OperationalDashboardUI 
                  totalSessions={totalSessions}
                  totalPatients={totalPatients}
                  totalPackages={totalPackages}
                  todaySessions={todaySessions}
                  ongoingSessions={ongoingSessions}
                  completedSessions={completedSessions}
                  cancelledAppointments={cancelledAppointments}
                  activeTherapists={activeTherapists}
                  emptySlots={emptySlots}
                  isLoading={isLoading || isLoadingKPI}
                />
             </section>

             {/* Section 2: Therapist Status Strip */}
             <section className="space-y-4">
                <TherapistStatusCards 
                  therapists={therapists}
                  therapistSessions={therapistSessions}
                  isLoading={isLoadingTherapists}
                />
             </section>

             {/* Section 3: Charts Grid */}
             <section className="space-y-4 md:space-y-5">
               {/* Row 1: Tren + Kapasitas */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
                 <TrendSessionChart />
                 <CapacityVsDemandChart />
               </div>
               {/* Row 2: Utilisasi + Ketepatan */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
                 <SlotUtilizationChart />
                 <SessionTimelinessChart dateRange={dateRange} />
               </div>
               {/* Row 3: Target vs Realisasi + Distribusi Layanan SEBELAHAN */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 items-start">
                 <BulletChartTargetVsRealization dateRange={dateRange} />
                 <ServiceDistributionChart dateRange={dateRange} />
               </div>
             </section>
          </TabsContent>
          
          <TabsContent value="finance" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
            <RevenueOverview dateRange={dateRange} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

const OwnerDashboard = () => {
  const navItems = [
    { label: 'Dashboard', path: '/owner/dashboard', icon: 'Home' },
    { label: 'Appointments', path: '/owner/appointments', icon: 'Calendar' },
    { label: 'Daily Recaps', path: '/owner/daily-recap', icon: 'FileText' },
    { label: 'Database Patients', path: '/owner/database-patients', icon: 'Database' },
    { label: 'Medical Records', path: '/owner/medical-records', icon: 'Activity' },
    { label: 'Follow Up Management', path: '/owner/follow-up-management', icon: 'ClipboardList' },
    { label: 'Physiotherapist Management', path: '/owner/physiotherapist-management', icon: 'Users' },
    { label: 'Accounting System', path: '/owner/accounting', icon: 'BriefcaseMedical' },
    { label: 'Stok Barang', path: '/owner/inventory', icon: 'Boxes' },
    { label: 'Rekonsiliasi BSI', path: '/owner/bsi-reconciliation', icon: 'FileSearch' },
    { label: 'Setup', path: '/owner/settings', icon: 'Settings' },
  ];

  return (
    <DashboardLayout navItems={navItems} role="owner" userName="Owner">
      <Routes>
        {/* Redirect root /owner to dashboard */}
        <Route path="/" element={<Navigate to="/owner/dashboard" replace />} />
        
        {/* Main Dashboard (Tabbed) */}
        <Route path="/dashboard" element={<OwnerDashboardHome />} />
        
        {/* Pages */}
        <Route path="/appointments" element={<OwnerAppointmentsPage />} />
        <Route path="/database-patients" element={<DatabasePatients />} />
        
        {/* Other Existing Routes */}
        <Route path="/physiotherapist-management" element={<PhysiotherapistManagementPage />} />
        <Route path="/medical-records" element={<MedicalRecordsPage />} />
        <Route path="/follow-up-management" element={<OwnerFollowUpManagementPage />} />
        
        {/* Functional Pages */}
        <Route path="/accounting" element={<OwnerFinanceDashboardComponent />} />
        <Route path="/daily-recap" element={<OwnerDailyRecap />} />
        <Route path="/settings" element={<SettingsPage />} />
        

        {/* Fallback for old routes */}
        <Route path="/appointment" element={<Navigate to="/owner/appointments" replace />} />
        <Route path="/patients" element={<Navigate to="/owner/database-patients" replace />} />
        <Route path="/packages" element={<Navigate to="/owner/database-patients" replace />} />
        
        <Route path="/bsi-reconciliation" element={
          <React.Suspense fallback={<div style={{ padding: 24 }}>⏳ Memuat Rekonsiliasi BSI...</div>}>
            <BSIMutasiReconciliation />
          </React.Suspense>
        } />

        {/* Catch-all */}
        <Route path="/dashboard/*" element={<Navigate to="/owner/dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  );
};

export default OwnerDashboard;