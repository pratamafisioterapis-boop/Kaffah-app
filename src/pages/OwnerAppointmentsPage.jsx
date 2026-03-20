import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar, List } from 'lucide-react';
import OwnerBookingCalendar from '@/components/owner/OwnerBookingCalendar';
import OwnerAppointmentList from '@/components/owner/OwnerAppointmentList';

const OwnerAppointmentsPage = () => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Appointments Center</h1>
        <p className="text-slate-500 mt-1">Kelola jadwal booking kalender dan daftar janji temu pasien.</p>
      </div>

      <Tabs defaultValue="calendar" className="w-full space-y-6">
        <TabsList className="grid w-full md:w-[400px] grid-cols-2 p-1 bg-slate-100/80 rounded-xl">
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

        <TabsContent value="calendar" className="mt-0 outline-none">
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
             <OwnerBookingCalendar />
           </div>
        </TabsContent>
        
        <TabsContent value="list" className="mt-0 outline-none">
           <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
             <OwnerAppointmentList />
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OwnerAppointmentsPage;