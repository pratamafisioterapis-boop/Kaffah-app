import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import DashboardLayout from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { format, subDays } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from '@/lib/customSupabaseClient';

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

setTherapists(activeTherapistsOnly);

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
      
      <div className="space-y-8 animate-in fade-in duration-500 pb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Owner Dashboard</h1>
            <p className="text-slate-500">Executive overview of clinic performance.</p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Button
              variant="outline"
              size="icon"
              onClick={handleManualRefresh}
              disabled={isRefreshing || isLoading}
              className={isRefreshing ? "animate-spin" : ""}
              title="Refresh Data"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              <span className="text-sm font-semibold text-slate-600">
                Periode
              </span>

              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) =>
                  setDateRange({ ...dateRange, startDate: e.target.value })
                }
                className="w-32 md:w-40 text-xs md:text-sm
                          px-2 md:px-3 py-1.5 md:py-2
                          border border-slate-300 rounded-lg
                          outline-none focus:border-indigo-500
                          focus:ring-1 focus:ring-indigo-500"
              />

              <span className="text-slate-400 font-medium">–</span>

              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) =>
                  setDateRange({ ...dateRange, endDate: e.target.value })
                }
                className="w-32 md:w-40 text-xs md:text-sm
                          px-2 md:px-3 py-1.5 md:py-2
                          border border-slate-300 rounded-lg
                          outline-none focus:border-indigo-500
                          focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <Tabs defaultValue="operational" className="w-full space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-slate-100 p-1">
            <TabsTrigger 
              value="operational"
              className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all"
            >
              Operational
            </TabsTrigger>
            <TabsTrigger 
              value="finance"
              className="data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-sm transition-all"
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
             <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TrendSessionChart />
                
                <CapacityVsDemandChart />
                
                <SlotUtilizationChart />
                <SessionTimelinessChart dateRange={dateRange} />
                
                {/* Fixed and Verified Bullet Chart */}
                <BulletChartTargetVsRealization dateRange={dateRange} />
                
                <ServiceDistributionChart />
             </section>
          </TabsContent>
          
          <TabsContent value="finance" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
            <Card className="rounded-xl border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
                  <TrendingUp className="w-5 h-5 text-teal-600" />
                  Financial Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="min-h-[400px] flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30">
                  <div className="p-4 rounded-full bg-teal-50 mb-4">
                    <TrendingUp className="w-8 h-8 text-teal-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700">Financial Reports Area</h3>
                  <p className="text-slate-500 mt-2 max-w-sm text-center">
                     Showing data from <span className="font-semibold">{dateRange.startDate}</span> to <span className="font-semibold">{dateRange.endDate}</span>.
                  </p>
                   <p className="text-slate-400 text-sm mt-1">
                    This section is reserved for detailed revenue analysis, profit margins, and expense tracking.
                  </p>
                </div>
              </CardContent>
            </Card>
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