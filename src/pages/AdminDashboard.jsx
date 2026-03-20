
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import OwnerPackageRecap from '@/pages/owner/PackageRecaps';
import DashboardLayout from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign } from 'lucide-react'; 
import { format, startOfMonth, endOfMonth } from 'date-fns';

// Import Pages/Components
import DailyRecap from '@/components/admin/DailyRecap';
import FollowUpManagementPage from '@/components/admin/FollowUpManagementPage'; 
import AdminAccountingDashboard from '@/components/admin/AdminAccountingDashboard';
import AdminDashboardMetrics from '@/components/admin/AdminDashboardMetrics'; 
import TodaysOverviewWidget from '@/components/admin/TodaysOverviewWidget';
import DailyEvaluationReportWidget from '@/components/admin/DailyEvaluationReportWidget';

// Consolidated Pages
import AdminDatabasePatients from '@/pages/admin/DatabasePatients'; 
import AppointmentsPage from '@/pages/AppointmentsPage';
import MedicalRecordsPage from '@/pages/MedicalRecordsPage';
import ClinicalDocuments from '@/pages/admin/ClinicalDocuments'; 
import AdminPhysiotherapistManagementPage from '@/pages/admin/AdminPhysiotherapistManagementPage';

const AdminDashboardHome = () => {
  const location = useLocation(); 
  const today = new Date().toISOString().split('T')[0];

  // Initialize state from localStorage or default to current date
  const [dateRange, setDateRange] = useState(() => {
    const savedRange = localStorage.getItem('adminDashboardDateRange');
    if (savedRange) {
      try {
        return JSON.parse(savedRange);
      } catch (e) {}
    }

    return {
      startDate: today,
      endDate: today,
    };
  });

  // Update localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('adminDashboardDateRange', JSON.stringify(dateRange));
  }, [dateRange]);
  
  return (
    <>
      <Helmet>
        <title>Admin Dashboard - Kaffah System Care</title>
        <meta name="description" content="Admin dashboard for Kaffah System Care" />
      </Helmet>
      
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Dashboard</h1>
            <p className="text-slate-500">Manage daily clinic operations and financial performance.</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <div className="flex items-center text-sm font-semibold text-slate-600">
              Periode
            </div>

            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) =>
                setDateRange({ ...dateRange, startDate: e.target.value })
              }
              className="w-32 md:w-40 text-xs md:text-sm px-2 md:px-3 py-1.5 md:py-2
                        border border-slate-300 rounded-lg outline-none
                        focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />

            <span className="text-slate-400 font-medium">–</span>

            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) =>
                setDateRange({ ...dateRange, endDate: e.target.value })
              }
              className="w-32 md:w-40 text-xs md:text-sm px-2 md:px-3 py-1.5 md:py-2
                        border border-slate-300 rounded-lg outline-none
                        focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

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

             {/* Middle Section: Recap Metrics & Evaluation Report */}
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-3">
                  <h3 className="text-lg font-semibold text-slate-800 tracking-tight">Recap Metrics</h3>
                  <AdminDashboardMetrics dateRange={dateRange} />
                </div>
                
                <div className="space-y-3">
                   {/* Unfilled Evaluations Widget - Placed in side column for better layout */}
                   <DailyEvaluationReportWidget dateRange={dateRange} />
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
