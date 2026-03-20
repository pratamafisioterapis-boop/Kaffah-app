import React, { useState, useEffect } from 'react';
import { getAppointments, updateAppointmentStatus } from '@/lib/api';
import { formatTimeIndonesia } from '@/lib/utils';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Calendar, Clock, CheckCircle, XCircle, Play } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MedicalRecordForm from './MedicalRecordForm';

const TherapistAppointments = ({ therapist }) => {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);

  useEffect(() => {
    if (therapist?.id) {
      fetchAppointments();
    }
  }, [therapist]);

  const fetchAppointments = async () => {
    setLoading(true);
    // Fetch upcoming and recent appointments
    const { data } = await getAppointments({
      therapistId: therapist.id
      // You can add date filters here if needed
    });
    setAppointments(data || []);
    setLoading(false);
  };

  const handleStatusUpdate = async (id, newStatus) => {
    const { error } = await updateAppointmentStatus(id, newStatus);
    
    if (error) {
      toast({ variant: "destructive", title: "Gagal update status", description: error.message });
    } else {
      if (newStatus === 'cancelled') {
         toast({ title: "Status Diperbarui", description: `Appointment dibatalkan dan recap dihapus.` });
      } else {
         toast({ title: "Status Diperbarui", description: `Appointment marked as ${newStatus}` });
      }
      fetchAppointments();
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'in_progress': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Manajemen Appointment</h2>
          <p className="text-slate-500">Kelola jadwal dan status kunjungan pasien Anda.</p>
        </div>
        <Button onClick={fetchAppointments} variant="outline" size="sm">
          Refresh Data
        </Button>
      </div>

      <div className="bg-white rounded-md border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Pasien</TableHead>
              <TableHead>Kontak</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">Loading...</TableCell>
              </TableRow>
            ) : appointments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">Tidak ada appointment ditemukan.</TableCell>
              </TableRow>
            ) : (
              appointments.map((apt) => (
                <TableRow key={apt.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {/* Display Date - format is fine for date only, as it's less sensitive to short UTC diffs if midday */}
                        {format(new Date(apt.appointment_date), 'dd MMM yyyy')}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {/* Use formatTimeIndonesia to display Jakarta time from UTC stored in DB */}
                        {formatTimeIndonesia(apt.appointment_date)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{apt.patient?.full_name}</div>
                    <div className="text-xs text-slate-500">{apt.patient?.rm_number}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{apt.patient?.phone || '-'}</div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${getStatusColor(apt.status)} border-none shadow-none`}>
                      {apt.status || 'Scheduled'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleStatusUpdate(apt.id, 'in_progress')}>
                          <Play className="mr-2 h-4 w-4 text-amber-500" /> Mulai Sesi
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusUpdate(apt.id, 'completed')}>
                          <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Selesai
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusUpdate(apt.id, 'cancelled')}>
                          <XCircle className="mr-2 h-4 w-4 text-red-500" /> Batal
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Quick Access to Medical Record for Completed/InProgress */}
                    {['completed', 'in_progress'].includes(apt.status) && (
                      <Dialog open={recordDialogOpen && selectedAppointment?.id === apt.id} onOpenChange={(open) => {
                        setRecordDialogOpen(open);
                        if(!open) setSelectedAppointment(null);
                        else setSelectedAppointment(apt);
                      }}>
                        <DialogTrigger asChild>
                           <Button size="sm" variant="link" className="text-blue-600">Isi Rekam Medis</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Evaluasi Harian: {apt.patient?.full_name}</DialogTitle>
                          </DialogHeader>
                          <MedicalRecordForm 
                            patientId={apt.patient_id}
                            appointmentId={apt.id}
                            onComplete={() => setRecordDialogOpen(false)}
                          />
                        </DialogContent>
                      </Dialog>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default TherapistAppointments;