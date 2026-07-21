import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TherapistScheduleManager from '@/components/owner/TherapistScheduleManager';
import TherapistTimeOffManager from '@/components/owner/TherapistTimeOffManager';
import { Users, CalendarClock, CalendarOff } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const AdminPhysiotherapistManagementPage = () => {
  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');

  return (
    <div className="space-y-6">

      {/* Hero Banner — desktop & PWA */}
      <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #d4af6a 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className={`relative flex items-center gap-4 ${isPWA ? 'px-4 py-4' : 'px-5 py-5 sm:px-7 sm:py-6'}`}>
          <div className={`flex-shrink-0 ${isPWA ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 backdrop-blur-sm border border-amber-300/30 flex items-center justify-center shadow-lg`}>
            <Users className={`${isPWA ? 'w-5 h-5' : 'w-6 h-6'} text-amber-300`} />
          </div>
          <div>
            <p className={`${isPWA ? 'text-[10px]' : 'text-xs'} font-bold tracking-widest text-amber-300/80 uppercase mb-1`}>{useAuth().clinicName || ''}</p>
            <h2 className={`${isPWA ? 'text-base' : 'text-lg sm:text-xl'} font-bold text-white leading-tight`}>Physiotherapist Management</h2>
            <p className={`${isPWA ? 'text-xs' : 'text-sm'} text-slate-400 mt-0.5`}>Kelola terapis, jadwal, dan cuti</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="schedule" className="w-full space-y-6">
        
        <TabsList className="grid w-full md:w-[467px] grid-cols-2 bg-slate-100 p-1 rounded-lg">

          <TabsTrigger
            value="schedule"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
          >
            <CalendarClock className="w-4 h-4" />
            Jadwal
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