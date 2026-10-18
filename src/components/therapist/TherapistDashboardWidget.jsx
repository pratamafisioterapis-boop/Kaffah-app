import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getPhysiotherapistByUserId, getDailyRecaps } from '@/lib/api';
import TherapistHero from './TherapistHero';
import PortalInboxCard from './PortalInboxCard';
import TherapistTargetRing from './TherapistTargetRing';
import TherapistWeeklyBars from './TherapistWeeklyBars';
import { usePortalEnabled } from '@/hooks/usePortalEnabled';
import SoapPendingBanner from '@/components/shared/SoapPendingBanner';
import AvailableSlotsWidget from './AvailableSlotsWidget';
import TherapistMetrics from './TherapistMetrics';
import TherapistPerformanceWidget from './TherapistPerformanceWidget';
import MonthlyReportWidget from './MonthlyReportWidget';
import TherapistTodayPatientHistory from './TherapistTodayPatientHistory';
import TherapistPatientTypeDistribution from './TherapistPatientTypeDistribution';
import { Loader2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TherapistDashboardWidget = ({ initialProfile = null, today = null }) => {
  const { user } = useAuth();
  const [therapistProfile, setTherapistProfile] = useState(initialProfile);
  const [loading, setLoading] = useState(!initialProfile);
  const [error, setError] = useState(null);
  const [todayRecapsCount, setTodayRecapsCount] = useState(0);
  const portalEnabled = usePortalEnabled();

  const loadData = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      setError(null);
      
      // 1. Profil: pakai yang sudah dimuat induk bila ada, hindari fetch ganda
      let profileData = initialProfile;
      if (!profileData) {
        const { data, error: profileError } = await getPhysiotherapistByUserId(user.id);

        if (profileError) {
          console.error(`❌ [TherapistDashboardWidget] Error fetching profile:`, profileError);
          throw profileError;
        }

        if (!data) {
          console.warn(`⚠️ [TherapistDashboardWidget] No therapist profile found.`);
          throw new Error("Profil terapis tidak ditemukan.");
        }
        profileData = data;
      }
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
  }, [user?.id, initialProfile?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-app-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 bg-slate-50 rounded-app border border-slate-200">
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

  // Susunan desktop (12 kolom): Pasien Hari Ini memanjang dua baris di kiri; kanan terdiri dari dua baris
  // kartu yang sejajar. Tanpa Clinara pasien, Target melebar mengisi baris pertama.
  const cell = 'min-w-0 [&>*]:h-full empty:hidden';
  return (
    <div className="space-y-4 animate-in fade-in duration-200 ease-out">
      <TherapistHero therapistName={therapistProfile.name} today={today} />
      <SoapPendingBanner therapistId={therapistProfile.id} role="therapist" />
      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-12 lg:gap-4">
        <div className={`${cell} lg:col-span-5 lg:row-span-2`}>
          <TherapistTodayPatientHistory therapist={therapistProfile} />
        </div>
        <div className={`${cell} ${portalEnabled ? 'lg:col-span-3' : 'lg:col-span-7'}`}>
          <TherapistTargetRing therapist={therapistProfile} />
        </div>
        {portalEnabled && (
          <div className={`${cell} lg:col-span-4`}>
            <PortalInboxCard therapistId={therapistProfile.id} />
          </div>
        )}
        <div className={`${cell} lg:col-span-3`}>
          <TherapistPatientTypeDistribution therapist={therapistProfile} />
        </div>
        <div className={`${cell} lg:col-span-4`}>
          <TherapistWeeklyBars therapist={therapistProfile} />
        </div>
      </div>
      <TherapistPerformanceWidget therapist={therapistProfile} userId={user.id} />
      <MonthlyReportWidget therapistId={therapistProfile.id} therapistUserId={therapistProfile.user_id} />
      <TherapistMetrics therapist={therapistProfile} userId={user.id} />
    </div>
  );
};

export default TherapistDashboardWidget;