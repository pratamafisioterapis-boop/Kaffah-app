import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Eye, RefreshCw, Loader2 } from 'lucide-react';
import { getAppointments, getDailyRecaps } from '@/lib/api';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const UnfilledMedicalRecords = () => {
  const [loading, setLoading] = useState(false);
  const [unfilledData, setUnfilledData] = useState([]);
  const [selectedTherapist, setSelectedTherapist] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch relevant appointments (pending/scheduled)
      // Note: We might need to filter by date to avoid fetching too many future ones
      // For now fetching all as per prompt instruction
      const { data: appointments } = await getAppointments({ 
        status: 'scheduled' 
      }); 
      // Also fetch pending if any
      const { data: pendingApps } = await getAppointments({ status: 'pending' });
      const allApps = [...(appointments || []), ...(pendingApps || [])];

      if (allApps.length === 0) {
        setUnfilledData([]);
        setLoading(false);
        return;
      }

      // 2. Fetch Daily Recaps to compare
      // We need to fetch recaps for the dates in allApps
      // Optimisation: Find min and max date from apps
      const dates = allApps.map(a => new Date(a.appointment_date));
      const minDate = new Date(Math.min(...dates)).toISOString().split('T')[0];
      const maxDate = new Date(Math.max(...dates)).toISOString().split('T')[0];

      const { data: recaps } = await getDailyRecaps({ startDate: minDate, endDate: maxDate });
      
      // 3. Match logic
      // Unfilled = Appointment exists BUT no recap for that patient on that date
      const unfilled = [];
      const recapsMap = new Set();
      recaps?.forEach(r => {
        recapsMap.add(`${r.patient_id}_${r.recap_date}`);
      });

      allApps.forEach(app => {
        const appDate = app.appointment_date.split('T')[0];
        const key = `${app.patient_id}_${appDate}`;
        if (!recapsMap.has(key)) {
          unfilled.push(app);
        }
      });

      // 4. Group by Therapist
      const grouped = {};
      unfilled.forEach(app => {
        const tName = app.therapist?.name || 'Unknown Therapist';
        if (!grouped[tName]) grouped[tName] = [];
        grouped[tName].push(app);
      });

      const result = Object.keys(grouped).map(name => ({
        therapistName: name,
        count: grouped[name].length,
        appointments: grouped[name]
      }));

      setUnfilledData(result);

    } catch (error) {
      console.error("Error fetching unfilled records:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (item) => {
    setSelectedTherapist(item);
    setIsModalOpen(true);
  };

  return (
    <Card className="border-red-100 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2 bg-red-50/50 rounded-t-xl">
        <CardTitle className="text-lg font-bold text-red-800 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Unfilled Medical Records (Missing Recaps)
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading} className="text-red-600 hover:bg-red-100">
           {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent className="pt-4">
         {unfilledData.length === 0 && !loading ? (
            <div className="text-center py-8 text-slate-500">
               <p>All scheduled appointments have corresponding recaps. Great job!</p>
            </div>
         ) : (
            <div className="space-y-4">
              {unfilledData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold">
                         {item.count}
                      </div>
                      <div>
                         <p className="font-semibold text-slate-800">{item.therapistName}</p>
                         <p className="text-xs text-slate-500">Appointments pending recap</p>
                      </div>
                   </div>
                   <Button variant="outline" size="sm" onClick={() => handleViewDetails(item)} className="border-red-200 text-red-700 hover:bg-red-50">
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                   </Button>
                </div>
              ))}
            </div>
         )}
      </CardContent>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
         <DialogContent className="max-w-2xl bg-white">
            <DialogHeader>
               <DialogTitle>Unfilled Appointments: {selectedTherapist?.therapistName}</DialogTitle>
               <DialogDescription>
                  List of scheduled appointments that do not have a corresponding daily recap entry yet.
               </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
               <Table>
                  <TableHeader>
                     <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Patient Name</TableHead>
                        <TableHead>Status</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {selectedTherapist?.appointments.map((app) => (
                        <TableRow key={app.id}>
                           <TableCell>
                              {format(new Date(app.appointment_date), 'dd MMM yyyy', { locale: idLocale })}
                              <br/>
                              <span className="text-xs text-slate-500">
                                 {format(new Date(app.appointment_date), 'HH:mm', { locale: idLocale })}
                              </span>
                           </TableCell>
                           <TableCell className="font-medium">
                              {app.patient?.full_name || app.guest_name || 'Unknown'}
                           </TableCell>
                           <TableCell>
                              <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-semibold capitalize">
                                 {app.status}
                              </span>
                           </TableCell>
                        </TableRow>
                     ))}
                  </TableBody>
               </Table>
            </div>
         </DialogContent>
      </Dialog>
    </Card>
  );
};

export default UnfilledMedicalRecords;