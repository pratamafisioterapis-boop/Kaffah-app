import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, List, Plus, Loader2 } from 'lucide-react';
import { getAppointments, getPhysiotherapists, getPatients } from '@/lib/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import CalendarView from '@/components/admin/CalendarView';
import ListViewAppointments from '@/components/admin/ListViewAppointments';
import AppointmentDetailModal from '@/components/admin/AppointmentDetailModal';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';

const OwnerAppointmentList = () => {
  const [appointments, setAppointments] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  useEffect(() => {
    // Initial data load
    fetchMetadata();
  }, []);

  useEffect(() => {
    // Fetch appointments whenever the focused month changes
    fetchAppointments();
  }, [currentDate]);

  const fetchMetadata = async () => {
     try {
        const [therapistRes, patientRes] = await Promise.all([
           getPhysiotherapists(),
           getPatients()
        ]);
        if (therapistRes?.data) setTherapists(therapistRes.data);
        if (patientRes?.data) setPatients(patientRes.data);
     } catch (err) {
        console.error("Error loading metadata:", err);
     }
  };

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      // Fetch a generous range to support calendar navigation slightly
      // For ListView, we might want a wider range or pagination, but for now matching calendar month context
      // Actually, list view often wants to see 'all upcoming' or 'past history'. 
      // Let's fetch current month +/- 1 month for smoother UX or just rely on a wider range.
      // Given constraints, let's fetch current month for Calendar, but maybe wider for list?
      // Let's stick to the current month + padding for now to keep it simple and consistent.
      
      // Better approach for List View: Fetch all or a large range? 
      // Let's modify to fetch a broader range for list view if needed, but Calendar drives the date state usually.
      
      const start = startOfMonth(currentDate).toISOString();
      const end = endOfMonth(currentDate).toISOString();
      
      // To support list view seeing more data, let's just fetch ALL if the user switches?
      // Or just keep month-based navigation. Let's keep month-based for consistency.
      
      const response = await getAppointments({ startDate: start, endDate: end });
      // Safely extract data
      setAppointments(response?.data || []);
    } catch (error) {
      console.error("Failed to fetch appointments", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedAppointment(null);
    setIsModalOpen(true);
  };

  const handleEdit = (appointment) => {
    setSelectedAppointment(appointment);
    setIsModalOpen(true);
  };

  const handleSuccess = () => {
     fetchAppointments();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Appointment Management</h1>
          <p className="text-slate-500">Manage schedule and bookings for all therapists.</p>
        </div>
        <div className="flex items-center gap-2">
           <Button onClick={handleCreateNew} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              New Appointment
           </Button>
        </div>
      </div>

      <Tabs defaultValue="calendar" className="w-full">
        <div className="flex justify-between items-center mb-4">
           <TabsList className="grid w-[240px] grid-cols-2">
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                 <Calendar className="w-4 h-4" /> Calendar
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-2">
                 <List className="w-4 h-4" /> List View
              </TabsTrigger>
           </TabsList>
           
           {loading && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                 <Loader2 className="w-4 h-4 animate-spin" />
                 Syncing...
              </div>
           )}
        </div>

        <TabsContent value="calendar" className="mt-0">
           <CalendarView 
              appointments={appointments}
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              onEventClick={handleEdit}
              therapists={therapists}
           />
        </TabsContent>

        <TabsContent value="list" className="mt-0">
           {/* List view might benefit from its own date controls if decoupled from calendar, 
               but sharing state keeps them in sync which is usually better UX here. */}
           <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 flex justify-between items-center">
              <span className="text-sm font-medium text-slate-600">
                 Showing appointments for {format(currentDate, 'MMMM yyyy')}
              </span>
              <div className="flex gap-2">
                 <Button variant="outline" size="sm" onClick={() => setCurrentDate(prev => new Date(prev.setMonth(prev.getMonth() - 1)))}>
                    Previous Month
                 </Button>
                 <Button variant="outline" size="sm" onClick={() => setCurrentDate(prev => new Date(prev.setMonth(prev.getMonth() + 1)))}>
                    Next Month
                 </Button>
              </div>
           </div>
           
           <ListViewAppointments 
              appointments={appointments}
              onEditClick={handleEdit}
              therapists={therapists}
              loading={loading}
           />
        </TabsContent>
      </Tabs>

      <AppointmentDetailModal 
         isOpen={isModalOpen}
         onClose={() => setIsModalOpen(false)}
         appointment={selectedAppointment}
         therapists={therapists}
         patients={patients}
         onSuccess={handleSuccess}
      />
    </div>
  );
};

export default OwnerAppointmentList;