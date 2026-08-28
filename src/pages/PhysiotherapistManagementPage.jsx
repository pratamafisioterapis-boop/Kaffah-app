import React, { useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import TherapistScheduleManager from '@/components/owner/TherapistScheduleManager';
import TherapistManager from '@/components/owner/TherapistManager';
import TherapistTargetManager from '@/components/owner/TherapistTargetManager';
import TherapistTimeOffManager from '@/components/owner/TherapistTimeOffManager';
import BadgeManager from '@/components/owner/BadgeManager';
import TherapistSoapLockManager from '@/components/owner/TherapistSoapLockManager';
import RemunerationManager from '@/components/owner/RemunerationManager';
import TherapistMonthlyReportManager from '@/components/owner/TherapistMonthlyReportManager';
import { CalendarClock, Users, Target, CalendarOff, Shield, Lock, Award, FileBarChart2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const dayNames = [
  "Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"
];

const PhysiotherapistManagementPage = () => {

  const [allSchedules, setAllSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    setLoadingSchedules(true);

    const { data, error } = await supabase.rpc(
      "get_all_active_therapist_schedules"
    );

    if (!error && data) {
      setAllSchedules(data);
    }

    setLoadingSchedules(false);
  };

  const grouped = allSchedules.reduce((acc, item) => {
    if (!acc[item.day_of_week]) acc[item.day_of_week] = [];
    acc[item.day_of_week].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">

      {/* Hero Banner */}
      <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #d4af6a 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex items-center gap-4 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 backdrop-blur-sm border border-amber-300/30 flex items-center justify-center shadow-lg">
            <Users className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <p className="text-xs font-bold tracking-widest text-amber-300/80 uppercase mb-1">{useAuth().clinicName || ''}</p>
            <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Physiotherapist Management</h2>
            <p className="text-sm text-slate-400 mt-0.5">Manage therapists, schedules, and performance targets</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full space-y-6">

        {/* TAB MENU */}
        <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-100 p-1 rounded-xl w-full">

          <TabsTrigger value="list" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-3 py-2 text-xs flex-1 min-w-[80px]">
            <Users className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Data Terapis</span>
          </TabsTrigger>

          <TabsTrigger value="schedule" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-3 py-2 text-xs flex-1 min-w-[80px]">
            <CalendarClock className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Jadwal</span>
          </TabsTrigger>

          <TabsTrigger value="timeoff" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-3 py-2 text-xs flex-1 min-w-[80px]">
            <CalendarOff className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Cuti</span>
          </TabsTrigger>

          <TabsTrigger value="targets" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-3 py-2 text-xs flex-1 min-w-[80px]">
            <Target className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Target</span>
          </TabsTrigger>

          <TabsTrigger value="badges" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-3 py-2 text-xs flex-1 min-w-[80px]">
            <Shield className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Badges</span>
          </TabsTrigger>

          <TabsTrigger value="soap-lock" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-3 py-2 text-xs flex-1 min-w-[80px]">
            <Lock className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Kunci SOAP</span>
          </TabsTrigger>

          <TabsTrigger value="remuneration" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-3 py-2 text-xs flex-1 min-w-[80px]">
            <Award className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Remunerasi</span>
          </TabsTrigger>

          <TabsTrigger value="monthly-report" className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-3 py-2 text-xs flex-1 min-w-[80px]">
            <FileBarChart2 className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Laporan Bulanan</span>
          </TabsTrigger>
        </TabsList>

        {/* ================= DATA TERAPIS ================= */}
        <TabsContent value="list">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <TherapistManager />
          </div>
        </TabsContent>

        {/* ================= JADWAL ================= */}
        <TabsContent value="schedule" className="space-y-8">

         

          {/* ====== FITUR LAMA TETAP ADA ====== */}
          <div>
            <TherapistScheduleManager />
          </div>

        </TabsContent>

        {/* ================= CUTI ================= */}
        <TabsContent value="timeoff">
          <TherapistTimeOffManager />
        </TabsContent>

        {/* ================= TARGET ================= */}
        <TabsContent value="targets">
          <TherapistTargetManager />
        </TabsContent>

        {/* ================= BADGES ================= */}
        <TabsContent value="badges">
          <BadgeManager />
        </TabsContent>

        {/* ================= KUNCI SOAP ================= */}
        <TabsContent value="soap-lock">
          <TherapistSoapLockManager />
        </TabsContent>

        {/* ================= REMUNERASI ================= */}
        <TabsContent value="remuneration">
          <RemunerationManager />
        </TabsContent>

        {/* ================= LAPORAN BULANAN ================= */}
        <TabsContent value="monthly-report">
          <TherapistMonthlyReportManager />
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default PhysiotherapistManagementPage;