import React from 'react';
import { Users, ListChecks, History } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminManager from '@/components/owner/AdminManager';
import AdminChecklistManager from '@/components/owner/AdminChecklistManager';
import AdminChecklistHistory from '@/components/owner/AdminChecklistHistory';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import PageHero from '@/components/shared/PageHero';

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
      <PageHero image="/hero/clinara-physio-hero.webp" title="Admin" highlight="Management" description="Kelola akun admin, checklist tugas harian, dan riwayat pengerjaannya." />

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="flex flex-wrap gap-1.5 bg-slate-100/70 rounded-app-lg border border-slate-200 p-3 h-auto items-stretch w-full">
          {TABS.map(({ value, icon: Icon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-app py-2 px-3 flex gap-1.5 items-center text-xs font-medium"
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
