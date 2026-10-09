import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TherapistScheduleManager from '@/components/owner/TherapistScheduleManager';
import TherapistTimeOffManager from '@/components/owner/TherapistTimeOffManager';
import TherapistScheduleOverrideManager from '@/components/owner/TherapistScheduleOverrideManager';
import { CalendarClock, CalendarOff, CalendarRange } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { isLightLoadClinic } from '@/lib/lightLoadMode';
import WaveBackground from '@/components/ui/wave-background';

const AdminPhysiotherapistManagementPage = () => {
  const { clinicName, userDetails } = useAuth();
  // Klinik Kaffah: admin tidak boleh menambah izin/cuti/libur terapis.
  const isKaffah = isLightLoadClinic(userDetails?.clinic_id);

  return (
    <div className="space-y-6">

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-[18px] sm:rounded-[22px] border border-app-border shadow-sm h-44 sm:h-52 md:h-60 lg:h-72">
        <img
          src="/hero/clinara-physio-hero.webp"
          alt="Kaffah Physiotherapy"
          className="absolute inset-0 w-full h-full object-cover object-[38%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 via-50% to-transparent to-80% pointer-events-none" aria-hidden="true" />
        <div className="absolute inset-0 flex flex-col justify-center px-4 sm:px-6 md:px-10 lg:px-14">
          <div className="max-w-[74%] sm:max-w-[62%] md:max-w-sm">
            <p className="text-app-muted text-xs sm:text-sm font-medium mb-1">{clinicName || ''}</p>
            <h1
              style={{ fontFamily: "'Caveat', cursive" }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-app-ink leading-[0.85]"
            >
              Kelola<br />
              <span className="text-app-accent-bright underline decoration-wavy decoration-2 md:decoration-[3px] underline-offset-4 md:underline-offset-8">
                Terapis
              </span>
            </h1>
            <p className="text-app-muted text-[10px] sm:text-xs md:text-sm mt-1.5 md:mt-3 leading-snug md:leading-relaxed">
              Kelola terapis, jadwal, dan cuti.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="schedule" className="w-full space-y-6">
        
        <TabsList className="grid w-full md:w-[700px] grid-cols-3 bg-slate-100 p-1 rounded-app-sm">

          <TabsTrigger
            value="schedule"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
          >
            <CalendarClock className="w-4 h-4" />
            Jadwal
          </TabsTrigger>

          <TabsTrigger
            value="overrides"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
          >
            <CalendarRange className="w-4 h-4" />
            Jadwal Pengganti
          </TabsTrigger>

          <TabsTrigger
            value="timeoff"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
          >
            <CalendarOff className="w-4 h-4" />
            Cuti / Izin
          </TabsTrigger>

        </TabsList>

        {/* JADWAL */}
        <TabsContent
          value="schedule"
          className="outline-none animate-in fade-in-50 duration-500"
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
          className="outline-none animate-in fade-in-50 duration-500"
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
          className="outline-none animate-in fade-in-50 duration-500"
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