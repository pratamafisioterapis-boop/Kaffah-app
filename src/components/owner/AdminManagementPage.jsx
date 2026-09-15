import React from 'react';
import { Users, ListChecks, History } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminManager from '@/components/owner/AdminManager';
import AdminChecklistManager from '@/components/owner/AdminChecklistManager';
import AdminChecklistHistory from '@/components/owner/AdminChecklistHistory';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const TABS = [
  { value: 'admin_staff', icon: Users, label: 'Admin & Staff' },
  { value: 'admin_checklist', icon: ListChecks, label: 'Checklist Admin' },
  { value: 'admin_checklist_history', icon: History, label: 'Riwayat Checklist' },
];

const AdminManagementPage = () => {
  const { clinicName } = useAuth();
  const initialTab = new URLSearchParams(window.location.search).get('tab') || 'admin_staff';

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-[18px] sm:rounded-[22px] border border-[#DCE8F2] shadow-sm h-44 sm:h-52 md:h-60 lg:h-72">
        <img
          src="/hero/clinara-physio-hero.webp"
          alt="Kaffah Physiotherapy"
          className="absolute inset-0 w-full h-full object-cover object-[38%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 via-50% to-transparent to-80% pointer-events-none" aria-hidden="true" />
        <div className="absolute inset-0 flex flex-col justify-center px-4 sm:px-6 md:px-10 lg:px-14">
          <div className="max-w-[74%] sm:max-w-[62%] md:max-w-sm">
            <p className="text-[#5B6B7D] text-xs sm:text-sm font-medium mb-1">{clinicName || ''}</p>
            <h1
              style={{ fontFamily: "'Caveat', cursive" }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#102F52] leading-[0.85]"
            >
              Admin<br />
              <span className="text-[#2F8CFF] underline decoration-wavy decoration-2 md:decoration-[3px] underline-offset-4 md:underline-offset-8">
                Management
              </span>
            </h1>
            <p className="text-[#5B6B7D] text-[10px] sm:text-xs md:text-sm mt-1.5 md:mt-3 leading-snug md:leading-relaxed">
              Kelola akun admin, checklist tugas harian, dan riwayat pengerjaannya.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="flex flex-wrap gap-1.5 bg-slate-100/70 rounded-2xl border border-slate-200 p-3 h-auto items-stretch w-full">
          {TABS.map(({ value, icon: Icon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-xl py-2 px-3 flex gap-1.5 items-center text-xs font-medium"
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="admin_staff">
            <AdminManager />
          </TabsContent>
          <TabsContent value="admin_checklist">
            <AdminChecklistManager />
          </TabsContent>
          <TabsContent value="admin_checklist_history">
            <AdminChecklistHistory />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default AdminManagementPage;
