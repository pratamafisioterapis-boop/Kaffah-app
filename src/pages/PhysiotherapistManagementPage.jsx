import React, { useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import TherapistScheduleManager from '@/components/owner/TherapistScheduleManager';
import TherapistManager from '@/components/owner/TherapistManager';
import TherapistTargetManager from '@/components/owner/TherapistTargetManager';
import TherapistTimeOffManager from '@/components/owner/TherapistTimeOffManager';
import BadgeManager from '@/components/owner/BadgeManager';
import { CalendarClock, Users, Target, CalendarOff, Shield } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

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
    <div className="space-y-8">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          Physiotherapist Management
        </h1>
        <p className="text-slate-500 mt-1">
          Manage therapists, schedules, and performance targets.
        </p>
      </div>

      <Tabs defaultValue="list" className="w-full space-y-8">

        {/* TAB MENU */}
        <TabsList className="grid w-full md:w-[900px] grid-cols-2 md:grid-cols-5 bg-slate-100 p-1 rounded-xl">

          <TabsTrigger value="list" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Users className="w-4 h-4" /> Data Terapis
          </TabsTrigger>

          <TabsTrigger value="schedule" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <CalendarClock className="w-4 h-4" /> Jadwal
          </TabsTrigger>

          <TabsTrigger value="timeoff" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <CalendarOff className="w-4 h-4" /> Cuti
          </TabsTrigger>

          <TabsTrigger value="targets" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Target className="w-4 h-4" /> Target
          </TabsTrigger>

          <TabsTrigger value="badges" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Shield className="w-4 h-4" /> Badges
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

      </Tabs>
    </div>
  );
};

export default PhysiotherapistManagementPage;