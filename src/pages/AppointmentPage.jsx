import React from 'react';
import { Calendar, List } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OwnerBookingCalendar from '@/components/owner/OwnerBookingCalendar';
import OwnerAppointmentList from '@/components/owner/OwnerAppointmentList';
import PageHero from '@/components/shared/PageHero';

// Calendar + list view of appointments in one page (tabs). The routed owner page is
// OwnerAppointmentsPage; this page is kept for the tabbed layout.
const AppointmentPage = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200 ease-out">
      <PageHero
        image="/hero/clinara-appointment-hero.webp"
        title="Kelola"
        highlight="Appointment"
        description="Kelola booking, jadwal, dan daftar janji pasien."
      />

      <Tabs defaultValue="calendar" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 rounded-app bg-slate-100 p-1 md:w-[420px]">
          <TabsTrigger
            value="calendar"
            className="flex items-center gap-2 rounded-app-sm data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Calendar className="h-4 w-4" /> Booking Calendar
          </TabsTrigger>
          <TabsTrigger
            value="list"
            className="flex items-center gap-2 rounded-app-sm data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <List className="h-4 w-4" /> Daftar Janji
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="outline-none">
          <div className="rounded-app-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <OwnerBookingCalendar />
          </div>
        </TabsContent>

        <TabsContent value="list" className="outline-none">
          <div className="rounded-app-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <OwnerAppointmentList />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AppointmentPage;
