import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
  getAppointments, 
  getPatients, 
  getPhysiotherapists
} from '@/lib/api';
import { startOfMonth, endOfMonth } from 'date-fns';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import AppointmentDetailModal from './AppointmentDetailModal';
import ListViewAppointments from './ListViewAppointments';
import { getCachedData, setCachedData } from '@/lib/dataCache';

const AppointmentManagement = () => {
  const { toast } = useToast();
  const { role } = useAuth();

  const initialCacheKey = `appointments:${startOfMonth(new Date()).toISOString()}`;
  const initialCache = getCachedData(initialCacheKey);

  const [loading, setLoading] = useState(!initialCache);
  const [appointments, setAppointments] = useState(initialCache?.appointments || []);
  const [therapists, setTherapists] = useState(initialCache?.therapists || []);
  const [patients, setPatients] = useState(initialCache?.patients || []);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  const fetchData = async () => {
    const start = startOfMonth(currentDate).toISOString();
    const end = endOfMonth(currentDate).toISOString();
    const cacheKey = `appointments:${start}`;

    // Show the last known data for this month instantly (no spinner) while
    // fresh data loads in the background, instead of blanking the screen
    // every time this page remounts after a menu switch.
    const cached = getCachedData(cacheKey);
    if (cached) {
      setAppointments(cached.appointments);
      setTherapists(cached.therapists);
      setPatients(cached.patients);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const [apptRes, therapistRes, patientRes] = await Promise.all([
        getAppointments({ startDate: start, endDate: end }),
        getPhysiotherapists(),
        getPatients()
      ]);

      const fresh = {
        appointments: apptRes.data || cached?.appointments || [],
        therapists: therapistRes.data || cached?.therapists || [],
        patients: patientRes.data || cached?.patients || []
      };

      if (apptRes.data) setAppointments(fresh.appointments);
      if (therapistRes.data) setTherapists(fresh.therapists);
      if (patientRes.data) setPatients(fresh.patients);
      setCachedData(cacheKey, fresh);

    } catch (error) {
      console.error("Error fetching data:", error);
      if (!cached) toast({ variant: "destructive", title: "Error loading data" });
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (appt = null) => {
    setSelectedAppointment(appt);
    setDetailModalOpen(true);
  };

  const handleModalSuccess = () => {
      fetchData(); 
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Daftar Janji (List View)</h1>
          <p className="text-slate-600">Kelola semua janji temu dalam tampilan daftar.</p>
        </div>
        
      </div>

      <ListViewAppointments 
        appointments={appointments}
        therapists={therapists}
        loading={loading}
        onEditClick={(appt) => openDialog(appt)}
      />

      <AppointmentDetailModal 
         isOpen={detailModalOpen}
         onClose={() => setDetailModalOpen(false)}
         appointment={selectedAppointment}
         therapists={therapists}
         patients={patients}
         onSuccess={handleModalSuccess}
      />
    </div>
  );
};

export default AppointmentManagement;