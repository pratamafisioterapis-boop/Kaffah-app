import React from 'react';
import OwnerBookingCalendar from '@/components/owner/OwnerBookingCalendar';
import PageHero from '@/components/shared/PageHero';

const OwnerAppointmentsPage = () => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero Banner */}
      <PageHero image="/hero/clinara-appointment-hero.webp" title="Kelola" highlight="Appointment" description="Kelola jadwal booking dan kalender pasien." />

      <div className="bg-white rounded-app border border-slate-200 shadow-sm overflow-hidden">
        <OwnerBookingCalendar />
      </div>
    </div>
  );
};

export default OwnerAppointmentsPage;