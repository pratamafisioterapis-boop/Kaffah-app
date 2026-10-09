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
import { lazyRetry } from '@/lib/lazyRetry';

// Pages
const OwnerAppointmentsPage = React.lazy(lazyRetry(() => import('@/pages/OwnerAppointmentsPage'), 'OwnerAppointmentsPage'));
const OwnerPresentationPage = React.lazy(lazyRetry(() => import('@/pages/owner/OwnerPresentationPage'), 'OwnerPresentationPage'));
const DatabasePatients = React.lazy(lazyRetry(() => import('@/pages/owner/DatabasePatients'), 'DatabasePatients'));
const PhysiotherapistManagementPage = React.lazy(lazyRetry(() => import('@/pages/PhysiotherapistManagementPage'), 'PhysiotherapistManagementPage'));
const MedicalRecordsPage = React.lazy(lazyRetry(() => import('@/pages/MedicalRecordsPage'), 'MedicalRecordsPage'));
const OwnerFollowUpManagementPage = React.lazy(lazyRetry(() => import('@/components/admin/FollowUpManagementPage'), 'OwnerFollowUpManagementPage'));

// Components
const SettingsPage = React.lazy(lazyRetry(() => import('@/components/owner/SettingsPage'), 'SettingsPage'));
const OwnerDailyRecap = React.lazy(lazyRetry(() => import('@/components/owner/OwnerDailyRecap'), 'OwnerDailyRecap'));
const OwnerFinanceDashboardComponent = React.lazy(lazyRetry(() => import('@/components/owner/OwnerFinanceDashboard'), 'OwnerFinanceDashboardComponent'));
import RevenueOverview from '@/components/owner/RevenueOverview';
const ModalAwalManagement = React.lazy(lazyRetry(() => import('@/components/owner/ModalAwalManagement'), 'ModalAwalManagement'));
const AdminManagementPage = React.lazy(lazyRetry(() => import('@/components/owner/AdminManagementPage'), 'AdminManagementPage'));
const OwnerManagementPage = React.lazy(lazyRetry(() => import('@/components/owner/OwnerManagementPage'), 'OwnerManagementPage'));
import OnboardingChecklist from '@/components/owner/OnboardingChecklist';
import TargetFillReminder from '@/components/owner/TargetFillReminder';



// Operational Components
import OperationalDashboardUI from '@/components/owner/operational/OperationalDashboardUI';
import SessionTimelinessChart from '@/components/owner/operational/SessionTimelinessChart';
import TrendSessionChart from '@/components/owner/operational/TrendSessionChart';
import TherapistStatusCards from '@/components/owner/operational/TherapistStatusCards';
import CapacityVsDemandChart from '@/components/owner/operational/CapacityVsDemandChart';
import BulletChartTargetVsRealization from '@/components/owner/operational/BulletChartTargetVsRealization';
import ServiceDistributionChart from '@/components/owner/operational/ServiceDistributionChart';
import PatientSourceChart from '@/components/owner/operational/PatientSourceChart';
import PromoUsageWidget from '@/components/owner/operational/PromoUsageWidget';
import PromoDiscountWidget from '@/components/owner/PromoDiscountWidget';
import { OWNER_NAV_ITEMS } from '@/lib/navItems';
const AttendanceManagement = React.lazy(lazyRetry(() => import('@/pages/admin/AttendanceManagement'), 'AttendanceManagement'));
const ClinicalDocuments = React.lazy(lazyRetry(() => import('@/pages/admin/ClinicalDocuments'), 'ClinicalDocuments'));

// Reused for clinics where the owner is also the therapist (see
// linkOwnerAsTherapist in Super Admin > Manajemen Klinik): no extra
// sidebar menu is added, the SOAP form itself is only reachable from the
// "Evaluasi Harian" tab inside Medical Records (see MedicalRecordsPage /
// DailyEvaluationReadOnly), which routes here for a given patient.
const MedicalRecordForm = React.lazy(lazyRetry(() => import('@/components/therapist/MedicalRecordForm'), 'MedicalRecordForm'));

// API
import { fetchTotalSessions, fetchTotalPatients, fetchTotalPackages, fetchTodaySessions, fetchOngoingSessions, fetchCompletedSessions, fetchCancelledAppointments, fetchActiveTherapists, fetchEmptySlots, fetchTodayNewPatients, fetchTodayReturningPatients, fetchAllTherapists, fetchTodaySessionsByTherapist, getClinicTherapistsSoapLockStatus, getCachedClinicId, getPhysiotherapistByUserId } from '@/lib/api';
import { getTherapistsPatientMetrics } from '@/lib/therapistDataUtils';
import PageHero from '@/components/shared/PageHero';
import HeroClock from '@/components/shared/HeroClock';
import PageSkeleton from '@/components/shared/PageSkeleton';
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
  const { clinicName } = useAuth();

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

  // Nilai yang sedang diketik/dipilih di input tanggal. `dateRange` (yang dipakai
  // semua query) hanya ikut berubah setelah jeda singkat dan bila rentangnya valid,
  // supaya mengubah tanggal tidak memicu belasan query di setiap perubahan.
  const [rangeInput, setRangeInput] = useState(dateRange);
  useEffect(() => {
    const { startDate, endDate } = rangeInput;
    if (!startDate || !endDate || startDate > endDate) return undefined;
    const timer = setTimeout(() => {
      setDateRange((prev) => (prev.startDate === startDate && prev.endDate === endDate ? prev : { startDate, endDate }));
    }, 400);
    return () => clearTimeout(timer);
  }, [rangeInput]);

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
const currentUserRow = { clinic_id: await getCachedClinicId(currentUserId) };

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
  else if (category.includes('organisasi')) leaveMap[t.therapist_id] = 'organisasi';
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
  }, [loadKPIData, loadTherapistData, location.key]);

  useEffect(() => {
    loadUnfilledSoapCounts();
  }, [loadUnfilledSoapCounts]);

  useEffect(() => {
    loadPatientMetrics();
  }, [loadPatientMetrics]);


  // Real-time Subscription. Perubahan appointment sering datang beruntun
  // (mis. jadwal digeser massal), jadi refresh digabung dalam satu jeda 1,5 detik.
  useEffect(() => {
    let refreshTimer;
    const channel = supabase
      .channel('dashboard-appointments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => {
            loadKPIData(false); // Silent refresh
            loadTherapistData(); // Update therapist stats too
          }, 1500);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(refreshTimer);
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
      
      <div className="space-y-4 animate-in fade-in duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] pb-24 md:pb-12">

        {/* ── Hero Banner ── */}
        <PageHero
          image="/hero/clinara-owner-hero.webp"
          objectPosition="36% center"
          kicker={<HeroClock />}
          title="Selamat datang,"
          highlight={<>Owner {clinicName || ''}!</>}
          description="Mari terus memberikan pelayanan terbaik untuk kesehatan yang lebih baik."
          wide
        />

        {/* ── Periode Toolbar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2">
          <div role="group" aria-labelledby="owner-period-label" className="flex items-center gap-2 bg-white border border-app-border rounded-app-sm px-3 py-1.5 w-full sm:w-auto shadow-sm focus-within:ring-2 focus-within:ring-app-accent-bright/40">
            <span id="owner-period-label" className="text-app-accent text-xs font-bold uppercase tracking-wider shrink-0">Periode</span>
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

        {/* ── Tabs ── */}
        <Tabs defaultValue="operational" className="w-full space-y-5">
          <TabsList className="grid w-full grid-cols-2 bg-white border border-app-border p-1 rounded-app-lg shadow-sm sticky top-2 z-10">
            <TabsTrigger
              value="operational"
              className="rounded-app text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none data-[state=active]:bg-app-accent data-[state=active]:text-white data-[state=active]:shadow-md text-app-muted"
            >
              Operational
            </TabsTrigger>
            <TabsTrigger
              value="finance"
              className="rounded-app text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none data-[state=active]:bg-[#35C8C1] data-[state=active]:text-white data-[state=active]:shadow-md text-app-muted"
            >
              Finance
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="operational" className="space-y-8 animate-in fade-in-0 duration-150 focus-visible:outline-none focus-visible:ring-0">
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
               {/* Row 2: Ketepatan (Utilisasi Slot Hari Ini dipindah ke section KPI operational) */}
               <div className="grid grid-cols-1 gap-4 md:gap-5">
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

          <TabsContent value="finance" className="space-y-4 animate-in fade-in-0 duration-150 focus-visible:outline-none focus-visible:ring-0">
            <RevenueOverview dateRange={dateRange} />
            <PromoDiscountWidget dateRange={dateRange} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

const OwnerDashboard = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [therapistProfile, setTherapistProfile] = useState(null);

  // Klinik yang ownernya juga terapis: physiotherapists.user_id akan
  // menunjuk ke akun owner ini sendiri (lihat linkOwnerAsTherapist), tanpa
  // mengubah role owner di public.users maupun menambah menu sidebar baru.
  // Dipakai supaya tab "Evaluasi Harian" di Medical Records bisa menawarkan
  // input SOAP untuk pasien yang ditangani owner sendiri.
  useEffect(() => {
    let isMounted = true;
    const loadTherapistProfile = async () => {
      if (!user?.id) return;
      const { data } = await getPhysiotherapistByUserId(user.id);
      if (isMounted) setTherapistProfile(data && data.is_active !== false ? data : null);
    };
    loadTherapistProfile();
    return () => { isMounted = false; };
  }, [user]);

  const navItems = OWNER_NAV_ITEMS;

  return (
    <DashboardLayout navItems={navItems} role="owner" userName="Owner">
      <OnboardingChecklist />
      {location.pathname === '/owner/dashboard' && <TargetFillReminder />}
      <React.Suspense fallback={<PageSkeleton />}>
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

        {/* Reached only from the "Evaluasi Harian" tab's "Isi SOAP" button
            for a patient the owner (as therapist) actually handles — not
            listed in the sidebar. */}
        {therapistProfile && (
          <Route
            path="/medical-records-soap/new/:patientId"
            element={<MedicalRecordForm therapist={therapistProfile} basePath="/owner/medical-records" />}
          />
        )}

        {/* Functional Pages */}
        <Route path="/accounting" element={<OwnerFinanceDashboardComponent />} />
        <Route path="/modal-awal" element={<ModalAwalManagement />} />
        <Route path="/daily-recap" element={<OwnerDailyRecap />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin-management" element={<AdminManagementPage />} />
        <Route path="/owner-management" element={<OwnerManagementPage />} />
        <Route path="/attendance" element={<AttendanceManagement />} />
        <Route path="/clinical-documents" element={<ClinicalDocuments />} />
        

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
      </React.Suspense>
    </DashboardLayout>
  );
};

export default OwnerDashboard;