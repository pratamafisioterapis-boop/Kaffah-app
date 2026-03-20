import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import OwnerBookingCalendar from '@/components/owner/OwnerBookingCalendar';
import OwnerAppointmentList from '@/components/owner/OwnerAppointmentList';
import { Calendar, List } from 'lucide-react';

const AppointmentPage = () => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          Appointment Center
        </h1>
        <p className="text-slate-500">
          Manage bookings, schedules, and appointment lists.
        </p>
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
        <TabsContent value="calendar" className="outline-none">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6">
            <OwnerBookingCalendar />
          </div>
        </TabsContent>

        {/* ================= LIST ================= */}
        <TabsContent value="list" className="outline-none">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6">
            <OwnerAppointmentList />
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default AppointmentPage;