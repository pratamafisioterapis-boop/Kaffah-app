import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading, userDetails } = useAuth();
  const location = useLocation();

  // Show loading state while auth is being determined
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Extract user role with safe fallbacks
  const userRole = userDetails?.role || user?.user_metadata?.role || 'user';

  // Check role authorization if allowedRoles are specified
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-600 mb-6">
            You don't have the required permissions to access this page. 
            Your current role is <span className="font-semibold text-slate-800">{userRole}</span>.
          </p>
          <a 
            href="/" 
            className="inline-block px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors w-full"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  // If authenticated and authorized (or no specific roles required), render children
  return children;
};

export default ProtectedRoute;