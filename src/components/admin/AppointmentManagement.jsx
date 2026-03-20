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

const AppointmentManagement = () => {
  const { toast } = useToast();
  const { role } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [patients, setPatients] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const start = startOfMonth(currentDate).toISOString();
      const end = endOfMonth(currentDate).toISOString();

      const [apptRes, therapistRes, patientRes] = await Promise.all([
        getAppointments({ startDate: start, endDate: end }),
        getPhysiotherapists(),
        getPatients()
      ]);

      if (apptRes.data) setAppointments(apptRes.data);
      if (therapistRes.data) setTherapists(therapistRes.data);
      if (patientRes.data) setPatients(patientRes.data);
      
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ variant: "destructive", title: "Error loading data" });
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