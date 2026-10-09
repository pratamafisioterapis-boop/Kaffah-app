import React from 'react';
import AdminAppointmentBooking from '@/components/admin/AdminAppointmentBooking';
import PageHero from '@/components/shared/PageHero';

const AppointmentsPage = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200 ease-out">

      {/* Hero Banner */}
      <PageHero image="/hero/clinara-appointment-hero.webp" title="Kelola" highlight="Appointment" description="Kelola jadwal booking kalender pasien." />

      <div className="bg-white rounded-app border border-slate-200 shadow-sm overflow-hidden">
        <AdminAppointmentBooking />
      </div>
    </div>
  );
};

export default AppointmentsPage;