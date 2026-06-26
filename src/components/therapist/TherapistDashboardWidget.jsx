import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getPhysiotherapistByUserId, getDailyRecaps } from '@/lib/api';
import TherapistGreetingMotivation from './TherapistGreetingMotivation';
import AvailableSlotsWidget from './AvailableSlotsWidget';
import TherapistMetrics from './TherapistMetrics';
import TherapistPerformanceWidget from './TherapistPerformanceWidget';
import { Loader2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TherapistDashboardWidget = () => {
  const { user } = useAuth();
  const [therapistProfile, setTherapistProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [todayRecapsCount, setTodayRecapsCount] = useState(0);

  const loadData = async () => {
    if (!user?.id) return;
    try {
      console.log(`🔄 [TherapistDashboardWidget] Loading dashboard data for user: ${user.id}`);
      setLoading(true);
      setError(null);
      
      // 1. Fetch Profile
      const { data: profileData, error: profileError } = await getPhysiotherapistByUserId(user.id);
      
      if (profileError) {
          console.error(`❌ [TherapistDashboardWidget] Error fetching profile:`, profileError);
          throw profileError;
      }
      
      if (!profileData) {
          console.warn(`⚠️ [TherapistDashboardWidget] No therapist profile found.`);
          throw new Error("Profil terapis tidak ditemukan.");
      }

      console.log(`✅ [TherapistDashboardWidget] Profile loaded:`, profileData.name);
      setTherapistProfile(profileData);

      // 2. Fetch Today's Stats from Daily Recaps (Not Target Progress)
      // Getting count of recaps for today to show simple activity stats if needed
      const today = new Date().toISOString().split('T')[0];
      const { data: recapsData, error: recapsError } = await getDailyRecaps({ 
          therapistId: profileData.id,
          date: today 
      });

      if (recapsError) {
          console.error(`❌ [TherapistDashboardWidget] Error fetching daily recaps:`, recapsError);
          // Don't block whole dashboard if just stats fail
      } else {
          console.log(`✅ [TherapistDashboardWidget] Today's recaps fetched:`, recapsData?.length || 0);
          setTodayRecapsCount(recapsData?.length || 0);
      }

    } catch (err) {
      console.error("❌ [TherapistDashboardWidget] Load Error:", err);
      setError(err.message || "Gagal memuat profil terapis.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200">
        <p className="text-red-500 font-medium">{error}</p>
        <p className="text-sm text-slate-500 mt-2">Pastikan akun Anda terhubung dengan data terapis.</p>
        <Button onClick={loadData} variant="outline" className="mt-4">
            <RefreshCcw className="w-4 h-4 mr-2" /> Coba Lagi
        </Button>
      </div>
    );
  }

  if (!therapistProfile) {
      return null; // Should be handled by error state above, but safety check
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <TherapistGreetingMotivation therapistName={therapistProfile.name} />
      <TherapistMetrics therapist={therapistProfile} userId={user.id} />
      <TherapistPerformanceWidget therapist={therapistProfile} userId={user.id} />
    </div>
  );
};

export default TherapistDashboardWidget;