import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';

const PemilihProtectedRoute = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let active = true;

    const check = async () => {
      if (authLoading) return;
      if (!user) {
        if (active) setStatus('unauthenticated');
        return;
      }
      const { data } = await supabase
        .from('pemilih_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!active) return;
      setStatus(data ? 'ok' : 'forbidden');
    };

    check();
    return () => { active = false; };
  }, [user, authLoading]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (status === 'forbidden') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Akses Ditolak</h2>
          <p className="text-slate-600 mb-6">
            Akun ini tidak terdaftar sebagai admin sistem Pendataan Pemilih.
          </p>
          <a href="/" className="inline-block px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors w-full">
            Kembali ke Beranda
          </a>
        </div>
      </div>
    );
  }

  return children;
};

export default PemilihProtectedRoute;