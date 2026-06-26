import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import DashboardLayout from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { format, subDays } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '@/lib/customSupabaseClient';
import {
  DollarSign,
  Wallet,
  CreditCard,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Activity
} from 'lucide-react';

// Pages
import OwnerAppointmentsPage from '@/pages/OwnerAppointmentsPage';
import DatabasePatients from '@/pages/owner/DatabasePatients'; // Updated Import
import PhysiotherapistManagementPage from '@/pages/PhysiotherapistManagementPage';
import MedicalRecordsPage from '@/pages/MedicalRecordsPage';

// Components
import SettingsPage from '@/components/owner/SettingsPage';
import OwnerDailyRecap from '@/components/owner/OwnerDailyRecap';
import OwnerFinanceDashboardComponent from '@/components/owner/OwnerFinanceDashboard'; 

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
    const savedRange = localStorage.getItem('ownerDashboardDateRange');
    if (savedRange) {
      try {
        return JSON.parse(savedRange);
      } catch (e) {
        console.error("Failed to parse date range from local storage", e);
      }
    }
    
    // Default: Last 30 days
    const end = new Date();
    const start = subDays(end, 30);
    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd')
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
const today = new Date(
  new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' })
).toISOString().split('T')[0];

// Langsung query dari tabel appointments/schedules lebih reliable
// daripada RPC yang field-nya tidak pasti
const { data: slotData, error: slotError } = await supabase
  .from('therapist_schedules')
  .select('therapist_id, id')
  .eq('day_of_week', new Date().getDay())
  .eq('is_active', true);

// Fallback: coba RPC jika tabel schedules tidak ada
let slotCountMap = {};

if (slotError || !slotData) {
  // Gunakan RPC sebagai fallback
  const { data: rpcData } = await supabase.rpc(
    'get_available_slots_with_status_by_date',
    { p_date: today }
  );
  
  (rpcData || []).forEach(slot => {
    // Coba semua kemungkinan nama field
    const tid = slot.therapist_id || slot.therapistId || slot.therapist;
    if (!tid) return;
    slotCountMap[tid] = (slotCountMap[tid] || 0) + 1;
  });
} else {
  (slotData || []).forEach(s => {
    const tid = s.therapist_id;
    if (!tid) return;
    slotCountMap[tid] = (slotCountMap[tid] || 0) + 1;
  });
}

// Inject total_slots ke therapist
const enrichedTherapists = activeTherapistsOnly.map(t => ({
  ...t,
  total_slots: slotCountMap[t.id] || 0
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
              <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-1">Kaffah Physiotherapy</p>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Owner Dashboard</h1>
              <p className="text-slate-400 text-xs mt-1">Executive overview of clinic performance.</p>
            </div>

            {/* Periode Selector */}
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-3 py-2.5 w-full sm:w-auto">
              <span className="text-indigo-300 text-[10px] font-bold uppercase tracking-wider shrink-0">Periode</span>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="text-xs border-0 outline-none text-white font-medium bg-transparent flex-1 min-w-0"
              />
              <span className="text-white/30 shrink-0">–</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="text-xs border-0 outline-none text-white font-medium bg-transparent flex-1 min-w-0"
              />
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
             <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <TrendSessionChart />
                
                <CapacityVsDemandChart />
                
                <SlotUtilizationChart />
                <SessionTimelinessChart dateRange={dateRange} />
                
                {/* Fixed and Verified Bullet Chart */}
                <BulletChartTargetVsRealization dateRange={dateRange} />
                
                <ServiceDistributionChart />
             </section>
          </TabsContent>
          
          <TabsContent
  value="finance"
  className="space-y-6 focus-visible:outline-none focus-visible:ring-0"
>

  {/* KPI CAROUSEL MOBILE */}

  <div className="md:hidden flex gap-3 overflow-x-auto pb-2 snap-x">

    {[
      {
        title: 'Revenue',
        value: 'Rp 125 Jt',
        icon: DollarSign,
        color: 'bg-emerald-500'
      },
      {
        title: 'Profit',
        value: 'Rp 62 Jt',
        icon: TrendingUp,
        color: 'bg-indigo-500'
      },
      {
        title: 'Cash',
        value: 'Rp 318 Jt',
        icon: Wallet,
        color: 'bg-blue-500'
      },
      {
        title: 'Receivable',
        value: 'Rp 12 Jt',
        icon: CreditCard,
        color: 'bg-amber-500'
      }
    ].map((item, index) => {
      const Icon = item.icon;

      return (
        <Card
          key={index}
          className="min-w-[240px] snap-start rounded-3xl border-0 shadow-lg"
        >
          <CardContent className="p-5">

            <div className="flex justify-between items-center">

              <div>

                <div className="text-xs text-slate-500">
                  {item.title}
                </div>

                <div className="text-2xl font-bold mt-1">
                  {item.value}
                </div>

              </div>

              <div
                className={`${item.color} p-3 rounded-2xl text-white`}
              >
                <Icon className="w-5 h-5" />
              </div>

            </div>

          </CardContent>
        </Card>
      );
    })}
  </div>

  

  {/* EXECUTIVE HERO */}

<Card
  className="
  overflow-hidden
  border-0
  rounded-[32px]
  bg-gradient-to-br
  from-slate-950
  via-indigo-900
  to-slate-950
  text-white
  shadow-[0_25px_80px_rgba(15,23,42,0.35)]
"
>
  <CardContent className="p-6 md:p-10">

    <div className="flex flex-col xl:flex-row xl:justify-between gap-8">

      <div>
        <p className="text-indigo-200 text-sm font-medium">
          Financial Health Score
        </p>

        <h2 className="text-6xl md:text-7xl font-black mt-2">
          92
        </h2>

        <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
          <TrendingUp className="w-4 h-4" />
          Excellent Performance
        </div>

        <p className="text-indigo-200 mt-5 max-w-md">
          Revenue growing steadily, cash flow remains healthy,
          and receivables are under control.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">

        <div className="bg-white/10 backdrop-blur rounded-3xl p-5">
          <p className="text-indigo-200 text-xs">
            REVENUE
          </p>
          <h3 className="text-2xl font-bold mt-2">
            Rp 125 Jt
          </h3>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-3xl p-5">
          <p className="text-indigo-200 text-xs">
            PROFIT
          </p>
          <h3 className="text-2xl font-bold mt-2">
            Rp 62 Jt
          </h3>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-3xl p-5">
          <p className="text-indigo-200 text-xs">
            CASH
          </p>
          <h3 className="text-2xl font-bold mt-2">
            Rp 318 Jt
          </h3>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-3xl p-5">
          <p className="text-indigo-200 text-xs">
            RECEIVABLE
          </p>
          <h3 className="text-2xl font-bold mt-2">
            Rp 12 Jt
          </h3>
        </div>

      </div>

    </div>

  </CardContent>
</Card>

{/* EXECUTIVE ALERTS + FORECAST */}

<div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

  <Card className="rounded-[28px] border-0 shadow-xl bg-white">

    <CardHeader>
      <CardTitle className="text-xl">
        Executive Alerts
      </CardTitle>
    </CardHeader>

    <CardContent className="space-y-4">

      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600" />

          <div>
            <div className="font-semibold text-amber-700">
              Outstanding Receivable
            </div>

            <div className="text-sm text-slate-600">
              Rp 12.000.000 belum tertagih
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-emerald-600" />

          <div>
            <div className="font-semibold text-emerald-700">
              Revenue Growth
            </div>

            <div className="text-sm text-slate-600">
              Meningkat +18% dibanding periode sebelumnya
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
        <div className="flex items-center gap-3">
          <Wallet className="w-5 h-5 text-blue-600" />

          <div>
            <div className="font-semibold text-blue-700">
              Cash Flow Stable
            </div>

            <div className="text-sm text-slate-600">
              Posisi kas sangat sehat
            </div>
          </div>
        </div>
      </div>

    </CardContent>

  </Card>

  <Card className="rounded-[28px] border-0 shadow-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white">

    <CardContent className="p-8 h-full flex flex-col justify-center">

      <p className="opacity-80">
        Forecast Bulan Ini
      </p>

      <h2 className="text-5xl font-black mt-3">
        112%
      </h2>

      <p className="mt-2 opacity-90">
        Target Revenue
      </p>

      <div className="grid grid-cols-2 gap-4 mt-8">

        <div>
          <div className="text-sm opacity-80">
            Revenue
          </div>
          <div className="text-2xl font-bold">
            Rp 180 Jt
          </div>
        </div>

        <div>
          <div className="text-sm opacity-80">
            Profit
          </div>
          <div className="text-2xl font-bold">
            Rp 92 Jt
          </div>
        </div>

      </div>

    </CardContent>

  </Card>

</div>

{/* ANALYTICS */}

<div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

  <Card className="rounded-[28px] border-0 shadow-xl">

    <CardHeader>
      <CardTitle>
        Revenue Trend
      </CardTitle>
    </CardHeader>

    <CardContent>

      <div className="h-[350px] rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center text-slate-400">
        Revenue Analytics Chart
      </div>

    </CardContent>

  </Card>

  <Card className="rounded-[28px] border-0 shadow-xl">

    <CardHeader>
      <CardTitle>
        Expense Breakdown
      </CardTitle>
    </CardHeader>

    <CardContent>

      <div className="h-[350px] rounded-3xl bg-gradient-to-br from-rose-50 to-orange-50 flex items-center justify-center text-slate-400">
        Expense Analytics Chart
      </div>

    </CardContent>

  </Card>

</div>

{/* RANKING */}

<div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

  <Card className="rounded-[28px] border-0 shadow-xl">

    <CardHeader>
      <CardTitle>
        Top Revenue Therapist
      </CardTitle>
    </CardHeader>

    <CardContent className="space-y-3">

      {[
        ['🥇', 'Annisa', '42 Jt'],
        ['🥈', 'Dilah', '35 Jt'],
        ['🥉', 'Alma', '28 Jt'],
        ['4', 'Adi', '21 Jt']
      ].map(([rank, name, amount]) => (
        <div
          key={name}
          className="flex items-center justify-between p-4 rounded-2xl bg-slate-50"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">
              {rank}
            </span>

            <span className="font-semibold">
              {name}
            </span>
          </div>

          <span className="font-bold text-slate-900">
            Rp {amount}
          </span>
        </div>
      ))}

    </CardContent>

  </Card>

  <Card className="rounded-[28px] border-0 shadow-xl">

    <CardHeader>
      <CardTitle>
        Cash Position
      </CardTitle>
    </CardHeader>

    <CardContent className="space-y-4">

      <div className="flex justify-between">
        <span>BCA</span>
        <span className="font-bold">Rp 180 Jt</span>
      </div>

      <div className="flex justify-between">
        <span>Mandiri</span>
        <span className="font-bold">Rp 90 Jt</span>
      </div>

      <div className="flex justify-between">
        <span>Cash</span>
        <span className="font-bold">Rp 48 Jt</span>
      </div>

      <div className="border-t pt-4 flex justify-between font-bold text-lg">
        <span>Total</span>
        <span>Rp 318 Jt</span>
      </div>

    </CardContent>

  </Card>

</div>

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
    { label: 'Physiotherapist Management', path: '/owner/physiotherapist-management', icon: 'Users' },
    { label: 'Accounting System', path: '/owner/accounting', icon: 'BriefcaseMedical' },
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
        
        {/* Functional Pages */}
        <Route path="/accounting" element={<OwnerFinanceDashboardComponent />} />
        <Route path="/daily-recap" element={<OwnerDailyRecap />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* Fallback for old routes */}
        <Route path="/appointment" element={<Navigate to="/owner/appointments" replace />} />
        <Route path="/patients" element={<Navigate to="/owner/database-patients" replace />} />
        <Route path="/packages" element={<Navigate to="/owner/database-patients" replace />} />
        
        {/* Catch-all */}
        <Route path="/dashboard/*" element={<Navigate to="/owner/dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  );
};

export default OwnerDashboard;