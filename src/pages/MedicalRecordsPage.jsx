import React, { useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import MedicalRecordsManagement from '@/components/admin/MedicalRecordsManagement';
import DailyEvaluationReadOnly from '@/components/admin/DailyEvaluationReadOnly';
import { FileText, Stethoscope } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getPhysiotherapistByUserId } from '@/lib/api';
import { useMedicalRecordsFilledBy } from '@/hooks/useMedicalRecordsFilledBy';
import PageHero from '@/components/shared/PageHero';

const MedicalRecordsPage = () => {
  const { user, role, clinicName } = useAuth();
  const [therapistProfile, setTherapistProfile] = useState(null);
  const { filledBy } = useMedicalRecordsFilledBy();
  // Klinik dengan mode 'therapist': admin hanya melihat, terapis yang mengisi.
  const readOnly = role === 'admin' && filledBy === 'therapist';

  // Klinik yang ownernya (atau, secara umum, akun manapun yang membuka
  // halaman ini) juga terdaftar sebagai terapis lewat fitur "Jadikan
  // Terapis" di Super Admin: physiotherapists.user_id menunjuk ke akun ini
  // sendiri. Kalau ketemu, tab "Evaluasi Harian" boleh menawarkan input
  // SOAP untuk pasien yang ditangani sendiri, tanpa menu sidebar baru.
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

  const basePath = role === 'owner' ? '/owner' : '/admin';

  return (
    <div className="space-y-5 animate-in fade-in duration-200 ease-out">

      {/* Hero Banner */}
      <PageHero image="/hero/clinara-medrec-hero.webp" title="Rekam" highlight="Medis" description="Pusat data rekam medis pasien dan evaluasi SOAP." />

      {/* Tab Navigation */}
      <Tabs defaultValue="records" className="w-full space-y-5">
        <TabsList className="flex gap-1.5 p-1 w-fit rounded-app h-auto" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
          <TabsTrigger value="records"
            className="flex items-center gap-2 px-5 py-2 rounded-app-sm text-xs font-bold transition-[color,background-color,border-color,box-shadow,transform,opacity] data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-500">
            <FileText className="w-3.5 h-3.5" />
            Rekam Medis
          </TabsTrigger>
          <TabsTrigger value="evaluasi-harian"
            className="flex items-center gap-2 px-5 py-2 rounded-app-sm text-xs font-bold transition-[color,background-color,border-color,box-shadow,transform,opacity] data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-500">
            <Stethoscope className="w-3.5 h-3.5" />
            Evaluasi Harian
          </TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-0 outline-none">
          <MedicalRecordsManagement readOnly={readOnly} />
        </TabsContent>

        <TabsContent value="evaluasi-harian" className="mt-0 outline-none">
          <DailyEvaluationReadOnly therapistProfile={therapistProfile} basePath={`${basePath}/medical-records-soap`} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MedicalRecordsPage;