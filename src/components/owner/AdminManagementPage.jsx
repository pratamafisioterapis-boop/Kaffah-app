import React from 'react';
import { Users, ListChecks, History, UserCog } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminManager from '@/components/owner/AdminManager';
import AdminChecklistManager from '@/components/owner/AdminChecklistManager';
import AdminChecklistHistory from '@/components/owner/AdminChecklistHistory';

const TABS = [
  { value: 'admin_staff', icon: Users, label: 'Admin & Staff' },
  { value: 'admin_checklist', icon: ListChecks, label: 'Checklist Admin' },
  { value: 'admin_checklist_history', icon: History, label: 'Riwayat Checklist' },
];

const AdminManagementPage = () => {
  const initialTab = new URLSearchParams(window.location.search).get('tab') || 'admin_staff';

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      {/* Hero Banner */}
      <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #d4af6a 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex items-center gap-4 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 backdrop-blur-sm border border-amber-300/30 flex items-center justify-center shadow-lg">
            <UserCog className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Admin Management</h2>
            <p className="text-sm text-slate-400 mt-0.5">Kelola akun admin, checklist tugas harian, dan riwayat pengerjaannya</p>
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
