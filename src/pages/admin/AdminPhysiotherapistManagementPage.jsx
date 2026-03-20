import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TherapistManager from '@/components/owner/TherapistManager';
import TherapistScheduleManager from '@/components/owner/TherapistScheduleManager';
import TherapistTimeOffManager from '@/components/owner/TherapistTimeOffManager';
import { Users, CalendarClock, CalendarOff } from 'lucide-react';

const AdminPhysiotherapistManagementPage = () => {
  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          Physiotherapist Management
        </h1>
        <p className="text-slate-500">
          Manage therapists, schedules, and time off.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="data" className="w-full space-y-6">
        
        <TabsList className="grid w-full md:w-[700px] grid-cols-3 bg-slate-100 p-1 rounded-lg">
          
          <TabsTrigger
            value="data"
            className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
          >
            <Users className="w-4 h-4" />
            Data Terapis
          </TabsTrigger>

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

        {/* DATA TERAPIS */}
        <TabsContent
          value="data"
          className="outline-none animate-in fade-in-50 duration-500"
        >
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <TherapistManager />
          </div>
        </TabsContent>

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