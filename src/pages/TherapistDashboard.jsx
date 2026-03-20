import React, { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import DashboardLayout from '@/components/DashboardLayout';
import TherapistPatients from '@/components/therapist/TherapistPatients';
import TherapistAppointments from '@/components/therapist/TherapistAppointments';
import TherapistMedicalRecords from '@/components/therapist/TherapistMedicalRecords';
import MedicalRecordForm from '@/components/therapist/MedicalRecordForm';
import TherapistAppointmentScheduler from '@/components/therapist/TherapistAppointmentScheduler';
import TherapistBookingCalendar from '@/components/therapist/TherapistBookingCalendar';
import TherapistDashboardWidget from '@/components/therapist/TherapistDashboardWidget';
import TherapistTargetWidget from '@/components/therapist/TherapistTargetWidget';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getPhysiotherapistByUserId } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const TherapistDashboard = () => {
  const { user, signOut } = useAuth();
  const [therapistProfile, setTherapistProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      try {
        console.log(`🔄 [TherapistDashboard] Initializing dashboard for user: ${user.id}`);
        setLoading(true);
        const { data, error } = await getPhysiotherapistByUserId(user.id);
        
        if (error) {
          console.error("❌ [TherapistDashboard] Failed to fetch therapist profile:", error);
          toast({ variant: "destructive", title: "Profile Fetch Error", description: "Could not load therapist profile." });
        } else {
          console.log(`✅ [TherapistDashboard] Therapist profile loaded:`, data?.name);
          setTherapistProfile(data);
        }
      } catch (err) {
        console.error("❌ [TherapistDashboard] Unexpected error in dashboard data fetch:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const navItems = [
    { label: 'Dashboard', path: '/therapist', icon: 'Home' },
    { label: 'Booking Calendar', path: '/therapist/booking', icon: 'Calendar' }, 
    { label: 'Daftar Appointment', path: '/therapist/appointments', icon: 'Settings' },
    { label: 'Evaluasi Pasien', path: '/therapist/records', icon: 'BriefcaseMedical' },
  ];

  // Dashboard Home Layout Component
  const DashboardHome = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
       <div className="lg:col-span-2">
          {/* Main Stats & Operational Widgets */}
          <TherapistDashboardWidget />
       </div>
       <div className="lg:col-span-1">
          {/* Target & Performance Widget */}
          <TherapistTargetWidget userId={user?.id} />
       </div>
    </div>
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin w-8 h-8 text-blue-600" /></div>;

  if (!therapistProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-gray-50">
         <h2 className="text-2xl font-bold text-red-600">Profil Terapis Tidak Ditemukan</h2>
         <p className="text-slate-700 mt-2 text-lg">Akun Anda terdaftar ({user?.email}), namun data profil Fisioterapis belum terhubung.</p>
         <button onClick={signOut} className="mt-6 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-md">Logout</button>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Therapist Dashboard - Kaffah System Care</title>
        <meta name="description" content="Therapist dashboard" />
      </Helmet>
      <DashboardLayout navItems={navItems} role="therapist" userName={therapistProfile.name}>
        <Routes>
          {/* Grid Layout for Home */}
          <Route path="/" element={<DashboardHome />} />
          
          {/* Other Routes */}
          <Route path="/booking" element={<TherapistBookingCalendar therapist={therapistProfile} />} />
          <Route path="/schedule-appointment" element={<TherapistAppointmentScheduler therapist={therapistProfile} />} />
          <Route path="/appointments" element={<TherapistAppointments therapist={therapistProfile} />} />
          <Route path="/records" element={<TherapistMedicalRecords therapist={therapistProfile} />} />
          <Route path="/records/new/:patientId" element={<MedicalRecordForm therapist={therapistProfile} />} />
          <Route path="/patients" element={<TherapistPatients therapist={therapistProfile} />} />
        </Routes>
      </DashboardLayout>
    </>
  );
};

export default TherapistDashboard;