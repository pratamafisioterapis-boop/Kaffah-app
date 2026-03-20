import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { 
  Calendar, Clock, User, Phone, MapPin, 
  CheckCircle2, XCircle, AlertCircle, Search, Filter, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { updateAppointmentStatus } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';
import { formatTimeIndonesia } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';

const AppointmentList = ({ appointments, onUpdate, loading, isAdmin = false }) => {
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [processingId, setProcessingId] = useState(null);

 const handleStatusChange = async (id, newStatus) => {
  setProcessingId(id);

  try {
    // =========================
    // KHUSUS JIKA CANCELLED
    // =========================
    if (newStatus === 'cancelled') {
      try {
        // 1️⃣ Ambil appointment (sekali)
        const { data: apt, error: aptError } = await supabase
          .from('appointments')
          .select('id, patient_id, therapist_id, appointment_date, duration_minutes')
          .eq('id', id)
          .single();

        if (aptError) throw aptError;

        const dateObj = new Date(apt.appointment_date);
        const startTime = dateObj.toISOString().substring(11, 16); // HH:mm

        // 2️⃣ Hapus daily_recaps by appointment_id
        const { error: delError } = await supabase
          .from('daily_recaps')
          .delete()
          .eq('appointment_id', id);

        if (delError) throw delError;

        // 3️⃣ Fallback orphan recap
        const recapDate = apt.appointment_date.split('T')[0];
        await supabase
          .from('daily_recaps')
          .delete()
          .eq('patient_id', apt.patient_id)
          .eq('recap_date', recapDate)
          .is('appointment_id', null);

        // 4️⃣ 🔓 BUKA SLOT YANG SESUAI JAM
        const { error: slotError } = await supabase
          .from('therapist_slots')
          .update({ is_available: true })
          .eq('therapist_id', apt.therapist_id)
          .eq('slot_start_time', startTime);

        if (slotError) throw slotError;

        toast({
          title: "Appointment Cancelled",
          description: "Appointment dibatalkan & slot dibuka kembali.",
          className: "bg-green-50 border-green-200 text-green-800"
        });

      } catch (innerErr) {
        console.error("Cancellation cleanup error:", innerErr);
        toast({
          variant: "destructive",
          title: "Warning",
          description: "Appointment dibatalkan, tapi ada data yang gagal dibersihkan."
        });
      }
    }

    // =========================
    // UPDATE STATUS
    // =========================
    const { error } = await updateAppointmentStatus(id, newStatus);
    if (error) throw error;

    if (newStatus !== 'cancelled') {
      toast({
        title: "Status Diperbarui",
        description: `Appointment status berubah ke ${newStatus}`
      });
    }

    if (onUpdate) onUpdate();

  } catch (error) {
    console.error("Update status error:", error);
    toast({
      variant: "destructive",
      title: "Error",
      description: "Gagal memperbarui status appointment"
    });
  } finally {
    setProcessingId(null);
  }
};


  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700 hover:bg-green-100';
      case 'completed': return 'bg-blue-100 text-blue-700 hover:bg-blue-100';
      case 'cancelled': return 'bg-red-100 text-red-700 hover:bg-red-100';
      default: return 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100';
    }
  };

  const filteredAppointments = appointments.filter(apt => {
    const matchesText = 
      (apt.guest_name || apt.patient?.full_name || '').toLowerCase().includes(filterText.toLowerCase()) ||
      (apt.therapist?.name || '').toLowerCase().includes(filterText.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || apt.status === statusFilter;
    
    return matchesText && matchesStatus;
  });

  const formatTime = (dateString) => formatTimeIndonesia(dateString);

  const formatDate = (dateString) => {
     if (!dateString) return '-';
     try {
         return dateString.split('T')[0];
     } catch(e) { return dateString; }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading appointments...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search patient or therapist..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map(status => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-md border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & Time</TableHead>
              <TableHead>Patient</TableHead>
              {isAdmin && <TableHead>Therapist</TableHead>}
              <TableHead>Complaint</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAppointments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                  No appointments found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredAppointments.map((apt) => (
                <TableRow key={apt.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {formatDate(apt.appointment_date)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatTime(apt.appointment_date)} ({apt.duration_minutes}m)
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{apt.guest_name || apt.patient?.full_name}</div>
                    <div className="text-xs text-slate-500 capitalize">{apt.guest_name ? 'Guest' : 'Registered'}</div>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="text-sm">{apt.therapist?.name || '-'}</div>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="max-w-[150px] truncate text-sm" title={apt.guest_complaint || apt.notes}>
                      {apt.guest_complaint || apt.notes || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {apt.guest_phone || apt.patient?.phone}
                      </span>
                      {(apt.guest_address || apt.patient?.address) && (
                        <span className="flex items-center gap-1 mt-0.5 truncate max-w-[120px]">
                          <MapPin className="w-3 h-3" /> {apt.guest_address || apt.patient?.address}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(apt.status)}>
                      {apt.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {processingId === apt.id ? (
                      <div className="flex justify-end p-2">
                         <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <Filter className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleStatusChange(apt.id, 'confirmed')}>
                            <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> Confirm
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(apt.id, 'completed')}>
                            <CheckCircle2 className="mr-2 h-4 w-4 text-blue-500" /> Mark Completed
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(apt.id, 'cancelled')}
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                          >
                            <XCircle className="mr-2 h-4 w-4" /> Cancel & Delete Recap
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

export default AppointmentList;