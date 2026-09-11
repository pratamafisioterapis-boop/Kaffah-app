import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TherapistScheduleManager from '@/components/owner/TherapistScheduleManager';
import TherapistTimeOffManager from '@/components/owner/TherapistTimeOffManager';
import TherapistScheduleOverrideManager from '@/components/owner/TherapistScheduleOverrideManager';
import { CalendarClock, CalendarOff, CalendarRange } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const AdminPhysiotherapistManagementPage = () => {
  const { clinicName } = useAuth();

  return (
    <div className="space-y-6">

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-[18px] sm:rounded-[22px] border border-[#DCE8F2] shadow-sm h-44 sm:h-52 md:h-60 lg:h-72">
        <img
          src="/hero/clinara-physio-hero.png"
          alt="Kaffah Physiotherapy"
          className="absolute inset-0 w-full h-full object-cover object-[38%_center]"
        />
        <div className="absolute inset-0 flex flex-col justify-center px-4 sm:px-6 md:px-10 lg:px-14">
          <div className="max-w-[74%] sm:max-w-[62%] md:max-w-sm">
            <p className="text-[#5B6B7D] text-xs sm:text-sm font-medium mb-1">{clinicName || ''}</p>
            <h1
              style={{ fontFamily: "'Caveat', cursive" }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#102F52] leading-[0.85]"
            >
              Kelola<br />
              <span className="text-[#2F8CFF] underline decoration-wavy decoration-2 md:decoration-[3px] underline-offset-4 md:underline-offset-8">
                Terapis
              </span>
            </h1>
            <p className="text-[#5B6B7D] text-[10px] sm:text-xs md:text-sm mt-1.5 md:mt-3 leading-snug md:leading-relaxed">
              Kelola terapis, jadwal, dan cuti.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="schedule" className="w-full space-y-6">
        
        <TabsList className="grid w-full md:w-[700px] grid-cols-3 bg-slate-100 p-1 rounded-lg">

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
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <TherapistScheduleManager />
          </div>
        </TabsContent>

        {/* JADWAL PENGGANTI */}
        <TabsContent
          value="overrides"
          className="outline-none animate-in fade-in-50 duration-500"
        >
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <TherapistScheduleOverrideManager />
          </div>
        </TabsContent>

        {/* CUTI / IZIN */}
        <TabsContent
          value="timeoff"
          className="outline-none animate-in fade-in-50 duration-500"
        >
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <TherapistTimeOffManager />
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default AdminPhysiotherapistManagementPage;