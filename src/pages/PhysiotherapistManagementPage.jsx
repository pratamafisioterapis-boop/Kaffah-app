import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import TherapistScheduleManager from '@/components/owner/TherapistScheduleManager';
import TherapistManager from '@/components/owner/TherapistManager';
import TherapistTargetManager from '@/components/owner/TherapistTargetManager';
import TherapistTimeOffManager from '@/components/owner/TherapistTimeOffManager';
import BadgeManager from '@/components/owner/BadgeManager';
import TherapistSoapLockManager from '@/components/owner/TherapistSoapLockManager';
import RemunerationManager from '@/components/owner/RemunerationManager';
import TherapistMonthlyReportManager from '@/components/owner/TherapistMonthlyReportManager';
import { CalendarClock, Users, Target, CalendarOff, Shield, Lock, Award, FileBarChart2, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const dayNames = [
  "Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"
];

const MENU_ITEMS = [
  { value: 'list', label: 'Data Terapis', icon: Users, iconBg: 'bg-[#EEF5FC]', iconColor: 'text-[#1683F4]' },
  { value: 'schedule', label: 'Jadwal', icon: CalendarClock, iconBg: 'bg-[#EAF3FF]', iconColor: 'text-[#1683F4]' },
  { value: 'timeoff', label: 'Cuti', icon: CalendarOff, iconBg: 'bg-[#FDEEEF]', iconColor: 'text-[#E4626F]' },
  { value: 'targets', label: 'Target', icon: Target, iconBg: 'bg-[#EAFBF3]', iconColor: 'text-[#22A86B]' },
  { value: 'badges', label: 'Badges', icon: Shield, iconBg: 'bg-[#F1EEFC]', iconColor: 'text-[#7C5CE0]' },
  { value: 'soap-lock', label: 'Kunci Jadwal', icon: Lock, iconBg: 'bg-[#FEF6E8]', iconColor: 'text-[#D89A2A]' },
  { value: 'remuneration', label: 'Remunerasi', icon: Award, iconBg: 'bg-[#FDEEF0]', iconColor: 'text-[#E0607A]' },
  { value: 'monthly-report', label: 'Laporan Bulanan', icon: FileBarChart2, iconBg: 'bg-[#EAF3FF]', iconColor: 'text-[#1683F4]', span: 2 },
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
    <div>

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-[18px] sm:rounded-[22px] border border-[#DCE8F2] shadow-sm h-44 sm:h-52 md:h-60 lg:h-72 mb-8 sm:mb-9">
        <img
          src="/hero/clinara-physio-hero.webp"
          alt="Kaffah Physiotherapy"
          className="absolute inset-0 w-full h-full object-cover object-[38%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 via-50% to-transparent to-80% pointer-events-none" aria-hidden="true" />
        <div className="absolute inset-0 flex flex-col justify-center px-4 sm:px-6 md:px-10 lg:px-14">
          <div className="max-w-[74%] sm:max-w-[62%] md:max-w-sm">
            <p className="text-[#5B6B7D] text-xs sm:text-sm font-medium mb-1">{useAuth().clinicName || ''}</p>
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
              Kelola terapis, jadwal, dan target performa.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full space-y-6">

        {/* MENU GRID */}
        <TabsList className="grid grid-cols-3 gap-1.5 sm:gap-2 h-auto w-full bg-white p-2.5 sm:p-3 rounded-[20px] border border-[#DCE7F1] shadow-[0_1px_6px_rgba(23,50,77,0.05)]">
          {MENU_ITEMS.map(({ value, label, icon: Icon, iconBg, iconColor, span }) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                'group relative flex items-center rounded-[12px] border border-[#E1EAF2] bg-white text-center whitespace-normal transition-all min-h-[76px]',
                span === 2
                  ? 'col-span-2 flex-row justify-center gap-2.5 px-3 py-2.5'
                  : 'flex-col justify-center gap-1 px-1 py-2.5',
                'hover:border-[#C7DEF4] hover:bg-[#F8FBFE]',
                'data-[state=active]:bg-[#EEF5FC] data-[state=active]:border-[#1683F4]/40 data-[state=active]:shadow-[0_2px_10px_rgba(22,131,244,0.12)]'
              )}
            >
              <ChevronRight className="absolute top-1.5 right-1.5 w-3 h-3 shrink-0 text-[#8FA8BD] group-data-[state=active]:text-[#1683F4]" strokeWidth={2} />
              <span className={cn('flex items-center justify-center w-7 h-7 shrink-0 rounded-[9px]', iconBg)}>
                <Icon className={cn('w-3.5 h-3.5', iconColor)} strokeWidth={2} />
              </span>
              <span className={cn('text-[10px] sm:text-[11px] font-semibold text-[#17324D] leading-tight break-words', span === 2 ? 'text-left' : 'w-full px-0.5')}>
                {label}
              </span>
            </TabsTrigger>
          ))}
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