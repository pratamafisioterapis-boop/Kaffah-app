
import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import { Toaster } from '@/components/ui/toaster';
import ErrorBoundary from '@/components/ErrorBoundary';
import { supabase } from '@/lib/customSupabaseClient';
import PackageRecapsAdmin from '@/pages/admin/PackageRecaps';
// Import Pages
const SimpleTestPage = React.lazy(() => import('@/pages/SimpleTestPage'));
const LandingPage = React.lazy(() => import('@/pages/LandingPage'));
const LoginPage = React.lazy(() => import('@/pages/LoginPage'));
const PublicBookingPage = React.lazy(() => import('@/pages/PublicBookingPage'));
const PricingPage = React.lazy(() => import('@/pages/PricingPage'));
import TherapistScheduleSettingsPage from '@/pages/owner/TherapistScheduleSettings';
const PackageRecapsOwner = React.lazy(() => import('@/pages/owner/PackageRecaps'));
const FollowUpManagementPage = React.lazy(() => import('@/pages/admin/FollowUpManagementPage'));

// Dashboard Imports
const OwnerDashboard = React.lazy(() => import('@/pages/OwnerDashboard'));
const AdminDashboard = React.lazy(() => import('@/pages/AdminDashboard'));
const TherapistDashboard = React.lazy(() => import('@/pages/TherapistDashboard'));
import DashboardLayout from '@/components/DashboardLayout';

// Components
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminAppointmentBooking from '@/components/admin/AdminAppointmentBooking';

// Loading Component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

// Auth Error Boundary
class AuthErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Auth Context Error Boundary Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
          <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md border border-red-100">
            <h2 className="text-xl font-bold text-red-800 mb-4 flex items-center justify-center gap-2">
              <span className="bg-red-100 p-2 rounded-full">⚠️</span>
              System Initialization Error
            </h2>
            <p className="text-slate-600 mb-6 text-sm">
              We encountered a problem loading the authentication system. This might be due to a temporary network issue.
            </p>
            <div className="space-y-3">
               <button 
                 onClick={() => window.location.reload()}
                 className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
               >
                 Refresh Application
               </button>
               <button 
                 onClick={() => {
                    localStorage.clear();
                    window.location.href = '/login';
                 }}
                 className="w-full px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors text-sm"
               >
                 Clear Cache & Login
               </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

function App() {
  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-red-200 text-center max-w-md">
          <h2 className="text-lg font-bold text-red-600 mb-2">Configuration Error</h2>
          <p className="text-slate-600 text-sm">
             Supabase client failed to initialize. Please check your environment variables and connection settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AuthErrorBoundary>
        <AuthProvider>
          <Helmet>
            <title>Kaffah Physiotherapy</title>
            <meta name="description" content="Kaffah Physiotherapy - Professional Management System" />
            <meta name="theme-color" content="#1e3a5f" />
            <link rel="manifest" href="/manifest.json" />
          </Helmet>
          <Helmet>
  <title>Kaffah Physiotherapy</title>
  <meta name="description" content="Kaffah Physiotherapy - Professional Management System" />
  <meta name="theme-color" content="#1e3a5f" />

  <meta
    name="facebook-domain-verification"
    content="mbetron48yku8aj5ixdi8u68irh8sf"
  />

  <link rel="manifest" href="/manifest.json" />
</Helmet>
          <Router>
            {/* <PWAInstallPrompt /> */}
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/test" element={<SimpleTestPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/booking" element={<PublicBookingPage />} />
                <Route path="/book" element={<Navigate to="/booking" replace />} />
                <Route path="/pricing" element={<PricingPage />} />
                
                {/* Protected Routes */}
                <Route
                  path="/admin/appointment-booking"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'owner', 'super_admin']}>
                       <div className="min-h-screen bg-slate-50 p-6">
                          <AdminAppointmentBooking />
                       </div>
                    </ProtectedRoute>
                  }
                />

                <Route 
                  path="/owner/therapist/:therapistId/schedule-settings" 
                  element={
                    <ProtectedRoute allowedRoles={['owner', 'super_admin']}>
                       <TherapistScheduleSettingsPage />
                    </ProtectedRoute>
                  } 
                />
                
                <Route
                  path="/owner/package-recaps"
                  element={
                    <ProtectedRoute allowedRoles={['owner', 'super_admin']}>
                      <PackageRecapsOwner />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/follow-up"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'owner', 'super_admin']}>
                      <DashboardLayout>
                        <FollowUpManagementPage />
                      </DashboardLayout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/owner/*"
                  element={
                    <ProtectedRoute allowedRoles={['owner', 'super_admin']}>
                      <OwnerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
  path="/admin/package-recaps"
  element={
    <ProtectedRoute allowedRoles={['admin', 'clinic_admin']}>
      <PackageRecapsAdmin />
    </ProtectedRoute>
  }
/>
                <Route
                  path="/admin/*"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'clinic_admin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                
                <Route
                  path="/therapist/*"
                  element={
                    <ProtectedRoute allowedRoles={['therapist', 'physiotherapist']}>
                      <TherapistDashboard />
                    </ProtectedRoute>
                  }
                />
                
                {/* Fallback Route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Router>
          <Toaster />
        </AuthProvider>
      </AuthErrorBoundary>
    </ErrorBoundary>
  );
}

export default App;
