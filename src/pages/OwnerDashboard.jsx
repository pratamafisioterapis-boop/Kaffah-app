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
import OwnerPresentationPage from '@/pages/owner/OwnerPresentationPage';
import DatabasePatients from '@/pages/owner/DatabasePatients'; // Updated Import
import PhysiotherapistManagementPage from '@/pages/PhysiotherapistManagementPage';
import MedicalRecordsPage from '@/pages/MedicalRecordsPage';
import OwnerFollowUpManagementPage from '@/components/admin/FollowUpManagementPage';

// Components
import SettingsPage from '@/components/owner/SettingsPage';
import JournalKnowledgeBaseManager from '@/components/owner/JournalKnowledgeBaseManager';
import OwnerDailyRecap from '@/components/owner/OwnerDailyRecap';
import OwnerFinanceDashboardComponent from '@/components/owner/OwnerFinanceDashboard';
import RevenueOverview from '@/components/owner/RevenueOverview';
import ModalAwalManagement from '@/components/owner/ModalAwalManagement';
import AdminManagementPage from '@/components/owner/AdminManagementPage';



// Operational Components
import OperationalDashboardUI from '@/components/owner/operational/OperationalDashboardUI';
import SessionTimelinessChart from '@/components/owner/operational/SessionTimelinessChart';
import TrendSessionChart from '@/components/owner/operational/TrendSessionChart';
import TherapistStatusCards from '@/components/owner/operational/TherapistStatusCards';
import SlotUtilizationChart from '@/components/owner/operational/SlotUtilizationChart';
import CapacityVsDemandChart from '@/components/owner/operational/CapacityVsDemandChart';
import BulletChartTargetVsRealization from '@/components/owner/operational/BulletChartTargetVsRealization';
import ServiceDistributionChart from '@/components/owner/operational/ServiceDistributionChart';
import PatientSourceChart from '@/components/owner/operational/PatientSourceChart';
import PromoUsageWidget from '@/components/owner/operational/PromoUsageWidget';
import PromoDiscountWidget from '@/components/owner/PromoDiscountWidget';
import { OWNER_NAV_ITEMS } from '@/lib/navItems';
import AttendanceManagement from '@/pages/admin/AttendanceManagement';

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
  fetchTodayNewPatients,
  fetchTodayReturningPatients,
  fetchAllTherapists,
  fetchTodaySessionsByTherapist,
  getClinicTherapistsSoapLockStatus
} from '@/lib/api';
import { getTherapistsPatientMetrics } from '@/lib/therapistDataUtils';
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
const InsentifDokterConverter = React.lazy(() =>
  import('@/pages/owner/InsentifDokterConverter').catch(err => ({
    default: () => (
      <div style={{ padding: 24, background: '#fef2f2', border: '2px solid #ef4444', borderRadius: 12, margin: 16 }}>
        <h2 style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: 8 }}>❌ Gagal Load InsentifDokterConverter</h2>
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
  const todayLabel = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

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
  const [newPatientsToday, setNewPatientsToday] = useState(0);
  const [returningPatientsToday, setReturningPatientsToday] = useState(0);
  const [isLoadingKPI, setIsLoadingKPI] = useState(true);
  const [kpiError, setKpiError] = useState(null);

  // Therapist Status States
  const [therapists, setTherapists] = useState([]);
  const [therapistSessions, setTherapistSessions] = useState({});
  const [isLoadingTherapists, setIsLoadingTherapists] = useState(true);
  const [unfilledSoapCounts, setUnfilledSoapCounts] = useState({});
  const [isLoadingSoap, setIsLoadingSoap] = useState(true);
  const [patientMetrics, setPatientMetrics] = useState({});
  const [isLoadingPatientMetrics, setIsLoadingPatientMetrics] = useState(true);

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
        slotsRes,
        newPatientsRes,
        returningPatientsRes
      ] = await Promise.all([
        fetchTotalSessions(dateRange.startDate, dateRange.endDate),
        fetchTotalPatients(dateRange.startDate, dateRange.endDate),
        fetchTotalPackages(dateRange.startDate, dateRange.endDate),
        fetchTodaySessions(),
        fetchOngoingSessions(),
        fetchCompletedSessions(),
        fetchCancelledAppointments(),
        fetchActiveTherapists(),
        fetchEmptySlots(),
        fetchTodayNewPatients(),
        fetchTodayReturningPatients()
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
      setNewPatientsToday(safeExtractNumber(newPatientsRes));
      setReturningPatientsToday(safeExtractNumber(returningPatientsRes));

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

// 🔥 Cek terapis yang sedang libur/cuti/sakit dsb pada tanggal hari ini
const { data: timeOffData } = await supabase
  .from('therapist_time_off')
  .select('therapist_id, reason')
  .lte('start_date', today)
  .gte('end_date', today);

// Reason disimpan sebagai "<Kategori> - <catatan>" (lihat TherapistTimeOffForm),
// kategori valid: Cuti, Sakit, Libur, Training, Izin Pribadi, Lainnya. Ambil
// kategorinya saja alih-alih memaksa semua non-"sakit" menjadi label "cuti".
const leaveMap = {};
(timeOffData || []).forEach(t => {
  const category = (t.reason || '').split(' - ')[0].trim().toLowerCase();
  if (category.includes('sakit')) leaveMap[t.therapist_id] = 'sakit';
  else if (category.includes('training')) leaveMap[t.therapist_id] = 'training';
  else if (category.includes('cuti')) leaveMap[t.therapist_id] = 'cuti';
  else if (category.includes('izin')) leaveMap[t.therapist_id] = 'izin';
  else if (category.includes('libur')) leaveMap[t.therapist_id] = 'libur';
  else leaveMap[t.therapist_id] = 'lainnya';
});

// Inject total_slots & leave_status ke therapist
const enrichedTherapists = activeTherapistsOnly.map(t => ({
  ...t,
  total_slots: slotCountMap[t.id] || 0,
  leave_status: leaveMap[t.id] || null
}));

setTherapists(enrichedTherapists);

      // 2. Fetch today's session count for all therapists in one query
      const { data: sessionCounts } = await fetchTodaySessionsByTherapist();
      setTherapistSessions(sessionCounts || {});

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

  // SOAP belum diisi per terapis. Menggunakan RPC get_clinic_therapists_soap_lock_status
  // yang sama dengan Booking Calendar, agar kedua tempat menampilkan angka yang konsisten
  // (periode per-terapis, clamp ke hari ini, dan grace period 60 menit setelah sesi selesai).
  const loadUnfilledSoapCounts = useCallback(async () => {
    if (!therapists.length) {
      setUnfilledSoapCounts({});
      setIsLoadingSoap(false);
      return;
    }
    setIsLoadingSoap(true);
    try {
      const { data, error } = await getClinicTherapistsSoapLockStatus();
      if (error) throw error;
      const counts = {};
      (data || []).forEach(r => { counts[r.therapist_id] = r.unfilled_count || 0; });
      setUnfilledSoapCounts(counts);
    } catch (error) {
      console.error("Failed to fetch unfilled SOAP counts:", error);
    } finally {
      setIsLoadingSoap(false);
    }
  }, [therapists]);

  // Pasien unik & pasien kembali per terapis, mengikuti filter tanggal (dateRange) di dashboard ini
  const loadPatientMetrics = useCallback(async () => {
    if (!therapists.length) {
      setPatientMetrics({});
      setIsLoadingPatientMetrics(false);
      return;
    }
    setIsLoadingPatientMetrics(true);
    try {
      const therapistIds = therapists.map(t => t.id);
      const { data: metrics, error } = await getTherapistsPatientMetrics(therapistIds, dateRange.startDate, dateRange.endDate);
      if (error) throw error;
      setPatientMetrics(metrics || {});
    } catch (error) {
      console.error("Failed to fetch therapist patient metrics:", error);
    } finally {
      setIsLoadingPatientMetrics(false);
    }
  }, [therapists, dateRange]);

  // Initial Load & Refresh on Location Change
  useEffect(() => {
    loadKPIData();
    loadTherapistData();
  }, [loadKPIData, loadTherapistData, location]);

  useEffect(() => {
    loadUnfilledSoapCounts();
  }, [loadUnfilledSoapCounts]);

  useEffect(() => {
    loadPatientMetrics();
  }, [loadPatientMetrics]);


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

        {/* ── Hero Banner ── */}
        <div className="relative overflow-hidden rounded-[22px] border border-[#DCE8F2] shadow-sm md:h-56 lg:h-64">
          <img
            src="/hero/clinara-owner-hero.png"
            alt="Kaffah Physiotherapy"
            className="w-full h-auto block md:absolute md:inset-0 md:w-full md:h-full md:object-cover md:object-[36%_center]"
          />
          <div className="absolute inset-0 flex flex-col justify-center px-5 sm:px-8 md:px-10 lg:px-14">
            <div className="max-w-[62%] sm:max-w-sm md:max-w-md">
              <p className="text-[#5B6B7D] text-[11px] sm:text-sm font-medium mb-1">{todayLabel}</p>
              <h1
                style={{ fontFamily: "'Caveat', cursive" }}
                className="text-3xl sm:text-5xl md:text-6xl font-bold text-[#102F52] leading-[0.9]"
              >
                Selamat datang,<br />
                <span className="text-[#2F8CFF] underline decoration-wavy decoration-2 sm:decoration-[3px] underline-offset-4 sm:underline-offset-8">
                  Owner!
                </span>
              </h1>
              <p className="text-[#5B6B7D] text-[11px] sm:text-sm mt-1.5 sm:mt-3 leading-snug sm:leading-relaxed">
                Mari terus memberikan pelayanan terbaik untuk kesehatan yang lebih baik.
              </p>
            </div>
          </div>
        </div>

        {/* ── Periode Toolbar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-[#5B6B7D]">{useAuth().clinicName || ''}</p>
          <div className="flex flex-col gap-1.5 bg-white border border-[#DCE8F2] rounded-xl px-3 py-2.5 w-full sm:w-auto shadow-sm">
            <span className="text-[#1677D2] text-[10px] font-bold uppercase tracking-wider">Periode</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="text-xs border-0 outline-none text-[#102F52] font-medium bg-transparent w-full"
              />
              <span className="text-[#DCE8F2] shrink-0">–</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="text-xs border-0 outline-none text-[#102F52] font-medium bg-transparent w-full"
              />
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="operational" className="w-full space-y-5">
          <TabsList className="grid w-full grid-cols-2 bg-white border border-[#DCE8F2] p-1 rounded-2xl shadow-sm sticky top-2 z-10">
            <TabsTrigger
              value="operational"
              className="rounded-xl text-sm font-semibold transition-all duration-200 data-[state=active]:bg-[#1677D2] data-[state=active]:text-white data-[state=active]:shadow-md text-[#5B6B7D]"
            >
              Operational
            </TabsTrigger>
            <TabsTrigger
              value="finance"
              className="rounded-xl text-sm font-semibold transition-all duration-200 data-[state=active]:bg-[#35C8C1] data-[state=active]:text-white data-[state=active]:shadow-md text-[#5B6B7D]"
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
                  newPatientsToday={newPatientsToday}
                  returningPatientsToday={returningPatientsToday}
                  isLoading={isLoading || isLoadingKPI}
                />
             </section>

             {/* Section 2: Therapist Status Strip */}
             <section className="space-y-4">
                <TherapistStatusCards
                  therapists={therapists}
                  therapistSessions={therapistSessions}
                  isLoading={isLoadingTherapists}
                  unfilledSoapCounts={unfilledSoapCounts}
                  isLoadingSoap={isLoadingSoap}
                  patientMetrics={patientMetrics}
                  isLoadingPatientMetrics={isLoadingPatientMetrics}
                  dateRange={dateRange}
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
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 items-stretch">
                 <BulletChartTargetVsRealization dateRange={dateRange} />
                 <ServiceDistributionChart dateRange={dateRange} />
               </div>
               {/* Row 4: Sumber Pasien + Promo */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 items-start">
                 <PatientSourceChart dateRange={dateRange} />
                 <PromoUsageWidget dateRange={dateRange} />
               </div>
             </section>
          </TabsContent>

          <TabsContent value="finance" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
            <RevenueOverview dateRange={dateRange} />
            <PromoDiscountWidget dateRange={dateRange} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

const OwnerDashboard = () => {
  const navItems = OWNER_NAV_ITEMS;

  return (
    <DashboardLayout navItems={navItems} role="owner" userName="Owner">
      <Routes>
        {/* Redirect root /owner to dashboard */}
        <Route path="/" element={<Navigate to="/owner/dashboard" replace />} />
        
        {/* Main Dashboard (Tabbed) */}
        <Route path="/dashboard" element={<OwnerDashboardHome />} />

        {/* Board Presentation Slideshow */}
        <Route path="/presentation" element={<OwnerPresentationPage />} />

        {/* Pages */}
        <Route path="/appointments" element={<OwnerAppointmentsPage />} />
        <Route path="/database-patients" element={<DatabasePatients />} />
        
        {/* Other Existing Routes */}
        <Route path="/physiotherapist-management" element={<PhysiotherapistManagementPage />} />
        <Route path="/medical-records" element={<MedicalRecordsPage />} />
        <Route path="/follow-up-management" element={<OwnerFollowUpManagementPage />} />
        
        {/* Functional Pages */}
        <Route path="/accounting" element={<OwnerFinanceDashboardComponent />} />
        <Route path="/modal-awal" element={<ModalAwalManagement />} />
        <Route path="/daily-recap" element={<OwnerDailyRecap />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/journal-knowledge-base" element={<JournalKnowledgeBaseManager />} />
        <Route path="/admin-management" element={<AdminManagementPage />} />
        <Route path="/attendance" element={<AttendanceManagement />} />
        

        {/* Fallback for old routes */}
        <Route path="/appointment" element={<Navigate to="/owner/appointments" replace />} />
        <Route path="/patients" element={<Navigate to="/owner/database-patients" replace />} />
        <Route path="/packages" element={<Navigate to="/owner/database-patients" replace />} />
        
        <Route path="/bsi-reconciliation" element={
          <React.Suspense fallback={<div style={{ padding: 24 }}>⏳ Memuat Rekonsiliasi BSI...</div>}>
            <BSIMutasiReconciliation />
          </React.Suspense>
        } />

        <Route path="/insentif-dokter" element={
          <React.Suspense fallback={<div style={{ padding: 24 }}>⏳ Memuat Konversi Insentif Dokter...</div>}>
            <InsentifDokterConverter />
          </React.Suspense>
        } />

        {/* Catch-all */}
        <Route path="/dashboard/*" element={<Navigate to="/owner/dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  );
};

export default OwnerDashboard;