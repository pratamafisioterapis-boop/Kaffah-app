import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TherapistScheduleManager from '@/components/owner/TherapistScheduleManager';
import TherapistTimeOffManager from '@/components/owner/TherapistTimeOffManager';
import TherapistScheduleOverrideManager from '@/components/owner/TherapistScheduleOverrideManager';
import { CalendarClock, CalendarOff, CalendarRange } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { isLightLoadClinic } from '@/lib/lightLoadMode';
import WaveBackground from '@/components/ui/wave-background';
import PageHero from '@/components/shared/PageHero';

const AdminPhysiotherapistManagementPage = () => {
  const { clinicName, userDetails } = useAuth();
  // Klinik Kaffah: admin tidak boleh menambah izin/cuti/libur terapis.
  const isKaffah = isLightLoadClinic(userDetails?.clinic_id);

  return (
    <div className="space-y-6">

      {/* Hero Banner */}
      <PageHero image="/hero/clinara-physio-hero.webp" title="Kelola" highlight="Terapis" description="Kelola terapis, jadwal, dan cuti." />

      {/* Tabs */}
      <Tabs defaultValue="schedule" className="w-full space-y-6">
        
        <TabsList className="grid w-full md:w-[700px] grid-cols-3 bg-slate-100 p-1 rounded-app-sm">

          <TabsTrigger
            value="schedule"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-[color,background-color,border-color,box-shadow,transform,opacity]"
          >
            <CalendarClock className="w-4 h-4" />
            Jadwal
          </TabsTrigger>

          <TabsTrigger
            value="overrides"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-[color,background-color,border-color,box-shadow,transform,opacity]"
          >
            <CalendarRange className="w-4 h-4" />
            Jadwal Pengganti
          </TabsTrigger>

          <TabsTrigger
            value="timeoff"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-[color,background-color,border-color,box-shadow,transform,opacity]"
          >
            <CalendarOff className="w-4 h-4" />
            Cuti / Izin
          </TabsTrigger>

        </TabsList>

        {/* JADWAL */}
        <TabsContent
          value="schedule"
          className="outline-none animate-in fade-in duration-200 ease-out"
        >
          <div className="relative overflow-hidden rounded-app border border-slate-200 p-6 shadow-sm bg-white">
            <WaveBackground />
            <div className="relative z-10">
              <TherapistScheduleManager />
            </div>
          </div>
        </TabsContent>

        {/* JADWAL PENGGANTI */}
        <TabsContent
          value="overrides"
          className="outline-none animate-in fade-in duration-200 ease-out"
        >
          <div className="relative overflow-hidden rounded-app border border-slate-200 p-6 shadow-sm bg-white">
            <WaveBackground />
            <div className="relative z-10">
              <TherapistScheduleOverrideManager />
            </div>
          </div>
        </TabsContent>

        {/* CUTI / IZIN */}
        <TabsContent
          value="timeoff"
          className="outline-none animate-in fade-in duration-200 ease-out"
        >
          <div className="relative overflow-hidden rounded-app border border-slate-200 p-6 shadow-sm bg-white">
            <WaveBackground />
            <div className="relative z-10">
              <TherapistTimeOffManager readOnly={isKaffah} />
            </div>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default AdminPhysiotherapistManagementPage;