import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar, List } from 'lucide-react';
import OwnerBookingCalendar from '@/components/owner/OwnerBookingCalendar';
import OwnerAppointmentList from '@/components/owner/OwnerAppointmentList';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const OwnerAppointmentsPage = () => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero Banner */}
      <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex items-center gap-4 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-600/80 flex items-center justify-center shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold tracking-widest text-indigo-300 uppercase mb-1">{useAuth().clinicName || 'Kaffah Physiotherapy'}</p>
            <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">Appointments Center</h2>
            <p className="text-sm text-slate-400 mt-0.5">Kelola jadwal booking kalender dan daftar janji temu pasien</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <OwnerBookingCalendar />
      </div>
    </div>
  );
};

export default OwnerAppointmentsPage;