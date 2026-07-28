import React, { Suspense, useEffect, useState } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import SplashScreen from "@/components/SplashScreen";
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import { Toaster } from '@/components/ui/toaster';
import ErrorBoundary from '@/components/ErrorBoundary';
import { supabase } from '@/lib/customSupabaseClient';
import DashboardLayout from '@/components/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import RotasiProtectedRoute from '@/components/RotasiProtectedRoute';
import PemilihProtectedRoute from '@/components/PemilihProtectedRoute';
import PemilihRelawanProtectedRoute from '@/components/PemilihRelawanProtectedRoute';

// Lazy Pages
const SimpleTestPage = React.lazy(() => import('@/pages/SimpleTestPage'));
const LandingPage = React.lazy(() => import('@/pages/LandingPage'));
const LoginPage = React.lazy(() => import('@/pages/LoginPage'));
const SmartBookingPage = React.lazy(() => import('@/pages/SmartBookingPage'));
const InvoiceViewPage = React.lazy(() => import('@/pages/InvoiceViewPage'));
const PricingPage = React.lazy(() => import('@/pages/PricingPage'));
const AboutPage = React.lazy(() => import('@/pages/AboutPage'));
const TeamPage = React.lazy(() => import('@/pages/TeamPage'));
const LocationPage = React.lazy(() => import('@/pages/LocationPage'));
const FaqPage = React.lazy(() => import('@/pages/FaqPage'));
const ServicesIndexPage = React.lazy(() => import('@/pages/layanan/ServicesIndexPage'));
const ServiceDetailPage = React.lazy(() => import('@/pages/layanan/ServiceDetailPage'));
const BlogIndexPage = React.lazy(() => import('@/pages/artikel/BlogIndexPage'));
const BlogArticlePage = React.lazy(() => import('@/pages/artikel/BlogArticlePage'));
const PackageRecapsOwner = React.lazy(() => import('@/pages/owner/PackageRecaps'));
const PackageRecapsAdmin = React.lazy(() => import('@/pages/admin/PackageRecaps'));
const InventoryStockPage = React.lazy(() => import('@/pages/owner/InventoryStock'));
const InventoryTakeOutPage = React.lazy(() => import('@/pages/admin/InventoryTakeOut'));
const FollowUpManagementPage = React.lazy(() => import('@/pages/admin/FollowUpManagementPage'));

// Dashboard Imports
const OwnerDashboard = React.lazy(() => import('@/pages/OwnerDashboard'));
const SuperAdminDashboard = React.lazy(() => import('@/pages/SuperAdminDashboard'));
const AdminDashboard = React.lazy(() => import('@/pages/AdminDashboard'));
const TherapistDashboard = React.lazy(() => import('@/pages/TherapistDashboard'));
const RotasiApp = React.lazy(() => import('@/pages/rotasi/RotasiApp'));
const PemilihApp = React.lazy(() => import('@/pages/pemilih/PemilihApp'));
const RelawanUploadKTP = React.lazy(() => import('@/pages/relawan/RelawanUploadKTP'));


// Loading Component
const LoadingFallback = () => (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 z-50">
    <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
    <div className="relative z-10 flex flex-col items-center gap-8">
      {/* Spinner ring */}
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-white/10" />
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-400"
          style={{ animation: 'spin 0.9s linear infinite' }}
        />
      </div>
      <p className="text-indigo-300/60 text-xs font-semibold uppercase tracking-widest">Memuat...</p>
    </div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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

    // AuthProvider wraps the whole routed app, so it's the boundary that
    // actually catches stale-chunk errors from lazy-loaded routes/pages
    // after a new deploy (ErrorBoundary further up never sees them). Reload
    // once instead of stranding the user on this dead-end screen.
    const isStaleChunkError = /dynamically imported module|loading chunk .* failed|failed to fetch dynamically/i.test(error?.message || '');
    if (isStaleChunkError && !sessionStorage.getItem('stale-chunk-reloaded')) {
      sessionStorage.setItem('stale-chunk-reloaded', '1');
      sessionStorage.setItem('last-auto-reload-reason', JSON.stringify({
        type: 'stale-chunk-auth-boundary',
        message: error?.message || '',
        at: new Date().toISOString(),
        path: window.location.pathname,
      }));
      window.location.reload();
    }
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
            {this.state.error && (
              <p className="mb-6 text-left text-xs font-mono text-red-700 bg-red-50 border border-red-100 rounded-lg p-3 break-words whitespace-pre-wrap">
                {this.state.error.message || String(this.state.error)}
              </p>
            )}
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
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return window.matchMedia('(display-mode: standalone)').matches ||
             window.navigator.standalone === true;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // App mounted successfully — clear the stale-chunk reload guard so a
    // future deploy can trigger one more auto-reload if needed.
    sessionStorage.removeItem('stale-chunk-reloaded');
  }, []);

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
          <ThemeProvider>

  

          <Helmet>
            <title>Kaffah Physiotherapy - Klinik Fisioterapi Terpercaya di Balikpapan</title>
            <meta name="description" content="Kaffah Physiotherapy - klinik fisioterapi di Batu Ampar, Balikpapan Utara. Terapis bersertifikat SIPF, pendekatan evidence-based." />
            <meta name="theme-color" content="#1e3a5f" />
            <meta name="facebook-domain-verification" content="mbetron48yku8aj5ixdi8u68irh8sf" />
            <link rel="manifest" href="/manifest.json" />
          </Helmet>
          <Router>
            {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
            {/* <PWAInstallPrompt /> */}
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/test" element={<SimpleTestPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/booking" element={<SmartBookingPage />} />
                <Route path="/book" element={<Navigate to="/booking" replace />} />
                <Route path="/booking/smart" element={<Navigate to="/booking" replace />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/tentang-kami" element={<AboutPage />} />
                <Route path="/tim-fisioterapis" element={<TeamPage />} />
                <Route path="/lokasi" element={<LocationPage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/layanan" element={<ServicesIndexPage />} />
                <Route path="/layanan/:slug" element={<ServiceDetailPage />} />
                <Route path="/artikel" element={<BlogIndexPage />} />
                <Route path="/artikel/:slug" element={<BlogArticlePage />} />
                <Route path="/i/:recapId" element={<InvoiceViewPage />} />
                
                {/* Protected Routes */}
                <Route
  path="/admin/appointment-booking"
  element={<Navigate to="/admin/appointments" replace />}
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
                  path="/owner/inventory"
                  element={
                    <ProtectedRoute allowedRoles={['owner', 'super_admin']}>
                      <InventoryStockPage />
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
                    <ProtectedRoute allowedRoles={['owner']}>
                      <OwnerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin/*"
                  element={
                    <ProtectedRoute allowedRoles={['super_admin']}>
                      <SuperAdminDashboard />
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
  path="/admin/inventory-takeout"
  element={
    <ProtectedRoute allowedRoles={['admin', 'clinic_admin']}>
      <InventoryTakeOutPage />
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

                <Route
                  path="/rotasi/*"
                  element={
                    <RotasiProtectedRoute>
                      <RotasiApp />
                    </RotasiProtectedRoute>
                  }
                />

                <Route
                  path="/pemilih/*"
                  element={
                    <PemilihProtectedRoute>
                      <PemilihApp />
                    </PemilihProtectedRoute>
                  }
                />

                <Route
                  path="/relawan"
                  element={
                    <PemilihRelawanProtectedRoute>
                      <RelawanUploadKTP />
                    </PemilihRelawanProtectedRoute>
                  }
                />

                {/* Fallback Route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Router>
          <Toaster />
        </ThemeProvider>
        </AuthProvider>
      </AuthErrorBoundary>
    </ErrorBoundary>
  );
}

export default App;
