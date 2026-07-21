import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar, List } from 'lucide-react';
import AdminAppointmentBooking from '@/components/admin/AdminAppointmentBooking';
import AppointmentManagement from '@/components/admin/AppointmentManagement';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const AppointmentsPage = () => {
  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Hero Banner — desktop & PWA */}
      <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #d4af6a 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className={`relative flex items-center gap-4 ${isPWA ? 'px-4 py-4' : 'px-5 py-5 sm:px-7 sm:py-6'}`}>
          <div className={`flex-shrink-0 ${isPWA ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 backdrop-blur-sm border border-amber-300/30 flex items-center justify-center shadow-lg`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`${isPWA ? 'w-5 h-5' : 'w-6 h-6'} text-amber-300`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className={`${isPWA ? 'text-[10px]' : 'text-xs'} font-bold tracking-widest text-amber-300/80 uppercase mb-1`}>{useAuth().clinicName || ''}</p>
            <h2 className={`${isPWA ? 'text-base' : 'text-lg sm:text-xl'} font-bold text-white leading-tight`}>Appointments</h2>
            <p className={`${isPWA ? 'text-xs' : 'text-sm'} text-slate-400 mt-0.5`}>Kelola jadwal booking kalender dan janji temu pasien</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="calendar" className="w-full space-y-6">

        {/* Tabs Menu */}
        <TabsList className="grid w-full md:w-[420px] grid-cols-2 p-1 bg-slate-100 rounded-xl">
          <TabsTrigger
            value="calendar"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" /> Booking Calendar
          </TabsTrigger>

          <TabsTrigger
            value="list"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"
          >
            <List className="w-4 h-4" /> Daftar Janji
          </TabsTrigger>
        </TabsList>

        {/* ================= CALENDAR ================= */}
        <TabsContent value="calendar" className="mt-0 outline-none">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6">
            <AdminAppointmentBooking />
          </div>
        </TabsContent>

        {/* ================= LIST ================= */}
        <TabsContent value="list" className="mt-0 outline-none">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6">
            <AppointmentManagement />
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default AppointmentsPage;