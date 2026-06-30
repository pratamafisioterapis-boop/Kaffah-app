import React, { useState } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Edit, Search, User, SortAsc, SortDesc, Lock } from 'lucide-react';
import { cn, formatTimeIndonesia } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const ListViewAppointments = ({ appointments, onEditClick, therapists = [], loading }) => {
  const { role } = useAuth();
  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [therapistFilter, setTherapistFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  // Filtering Logic
  const filteredAppointments = appointments.filter(app => {
    const matchesSearch = 
       (app.patient?.full_name || app.guest_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
       (app.patient?.rm_number || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesTherapist = therapistFilter === 'all' || app.therapist_id === therapistFilter;

    return matchesSearch && matchesStatus && matchesTherapist;
  });

  // Sorting Logic
  const sortedAppointments = [...filteredAppointments].sort((a, b) => {
    let aValue, bValue;

    switch (sortConfig.key) {
       case 'date':
          aValue = new Date(a.appointment_date);
          bValue = new Date(b.appointment_date);
          break;
       case 'patient':
          aValue = (a.patient?.full_name || a.guest_name || '').toLowerCase();
          bValue = (b.patient?.full_name || b.guest_name || '').toLowerCase();
          break;
       case 'therapist':
          aValue = (a.therapist?.name || '').toLowerCase();
          bValue = (b.therapist?.name || '').toLowerCase();
          break;
       case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
       default: 
          return 0;
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key) => {
     let direction = 'asc';
     if (sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
     }
     setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
     if (sortConfig.key !== key) return null;
     return sortConfig.direction === 'asc' ? <SortAsc className="w-3 h-3 ml-1" /> : <SortDesc className="w-3 h-3 ml-1" />;
  };

  const getStatusBadge = (status) => {
    const styles = {
       scheduled: "bg-blue-50 text-blue-800 border-blue-200",
       confirmed: "bg-blue-100 text-blue-800 border-blue-200",
       completed: "bg-green-100 text-green-800 border-green-200",
       cancelled: "bg-red-100 text-red-800 border-red-200",
       rescheduled: "bg-orange-100 text-orange-800 border-orange-200",
       'no-show': "bg-slate-200 text-slate-700 border-slate-300"
    };
    return cn("px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize", styles[status] || styles.scheduled);
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
         <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input 
               placeholder="Search patient name or RM..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="pl-9"
            />
         </div>
         <div className="w-full md:w-48">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
               <SelectTrigger>
                  <SelectValue placeholder="Filter Status" />
               </SelectTrigger>
               <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="rescheduled">Rescheduled</SelectItem>
               </SelectContent>
            </Select>
         </div>
         <div className="w-full md:w-48">
            <Select value={therapistFilter} onValueChange={setTherapistFilter}>
               <SelectTrigger>
                  <SelectValue placeholder="Filter Therapist" />
               </SelectTrigger>
               <SelectContent>
                  <SelectItem value="all">All Therapists</SelectItem>
                  {therapists.map(t => (
                     <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
               </SelectContent>
            </Select>
         </div>
      </div>

      {/* Table — desktop / browser biasa */}
      {!isPWA && (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
         <div className="overflow-x-auto">
            <Table>
               <TableHeader className="bg-slate-50">
                  <TableRow>
                     <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('date')}>
                        <div className="flex items-center">Date & Time {getSortIcon('date')}</div>
                     </TableHead>
                     <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('patient')}>
                        <div className="flex items-center">Patient {getSortIcon('patient')}</div>
                     </TableHead>
                     <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('therapist')}>
                        <div className="flex items-center">Physiotherapist {getSortIcon('therapist')}</div>
                     </TableHead>
                     <TableHead className="cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>
                        <div className="flex items-center">Status {getSortIcon('status')}</div>
                     </TableHead>
                     <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {loading ? (
                     <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-slate-500">Loading appointments...</TableCell>
                     </TableRow>
                  ) : sortedAppointments.length === 0 ? (
                     <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-slate-500">No appointments found matching filters.</TableCell>
                     </TableRow>
                  ) : (
                     sortedAppointments.map((app) => (
                        <TableRow key={app.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onEditClick(app)}>
                           <TableCell>
                              <div className="flex flex-col">
                                 <span className="font-medium text-slate-900">
                                    {format(new Date(app.appointment_date), 'dd MMM yyyy', { locale: idLocale })}
                                 </span>
                                 <span className="text-xs text-slate-500">
                                    {formatTimeIndonesia(app.appointment_date)} ({app.duration_minutes || 60}m)
                                 </span>
                              </div>
                           </TableCell>
                           <TableCell>
                              <div className="font-medium flex items-center gap-2">
                                  {app.patient?.full_name || app.guest_name || 'Nama tidak tersedia'}
                                  <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger><Lock className="w-3 h-3 text-slate-300" /></TooltipTrigger>
                                        <TooltipContent>Patient name cannot be edited</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                              </div>
                              <div className="text-xs text-slate-500">{app.patient?.phone || app.guest_phone || '-'}</div>
                           </TableCell>
                           <TableCell>
                              <div className="flex items-center gap-2">
                                 {app.therapist?.avatar_url ? (
                                    <img src={app.therapist.avatar_url} className="w-6 h-6 rounded-full object-cover" alt="" />
                                 ) : (
                                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                                       <User className="w-3 h-3 text-slate-400" />
                                    </div>
                                 )}
                                 <span className="text-sm">{app.therapist?.name || 'Unassigned'}</span>
                              </div>
                           </TableCell>
                           <TableCell>
                              <span className={getStatusBadge(app.status)}>{app.status}</span>
                           </TableCell>
                           <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onEditClick(app); }}>
                                 <Edit className="w-4 h-4 text-slate-500" />
                              </Button>
                           </TableCell>
                        </TableRow>
                     ))
                  )}
               </TableBody>
            </Table>
         </div>
      </div>
      )}

      {/* Card List — khusus PWA / mobile */}
      {isPWA && (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
         {loading ? (
            <div className="h-24 flex items-center justify-center text-sm text-slate-500">Loading appointments...</div>
         ) : sortedAppointments.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-sm text-slate-500">No appointments found matching filters.</div>
         ) : (
            sortedAppointments.map((app) => (
               <div
                  key={app.id}
                  onClick={() => onEditClick(app)}
                  className="p-4 active:bg-slate-50 cursor-pointer space-y-2"
               >
                  <div className="flex items-start justify-between gap-2">
                     <div className="flex flex-col">
                        <span className="font-semibold text-sm text-slate-900">
                           {format(new Date(app.appointment_date), 'dd MMM yyyy', { locale: idLocale })}
                        </span>
                        <span className="text-xs text-slate-500">
                           {formatTimeIndonesia(app.appointment_date)} ({app.duration_minutes || 60}m)
                        </span>
                     </div>
                     <span className={getStatusBadge(app.status)}>{app.status}</span>
                  </div>

                  <div className="flex items-center gap-2">
                     <div className="font-medium text-sm text-slate-800 flex items-center gap-1.5">
                        {app.patient?.full_name || app.guest_name || 'Nama tidak tersedia'}
                        <Lock className="w-3 h-3 text-slate-300 shrink-0" />
                     </div>
                  </div>
                  <div className="text-xs text-slate-500">{app.patient?.phone || app.guest_phone || '-'}</div>

                  <div className="flex items-center justify-between pt-1">
                     <div className="flex items-center gap-2">
                        {app.therapist?.avatar_url ? (
                           <img src={app.therapist.avatar_url} className="w-6 h-6 rounded-full object-cover" alt="" />
                        ) : (
                           <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                              <User className="w-3 h-3 text-slate-400" />
                           </div>
                        )}
                        <span className="text-xs text-slate-600">{app.therapist?.name || 'Unassigned'}</span>
                     </div>
                     <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); onEditClick(app); }}>
                        <Edit className="w-4 h-4 text-slate-500" />
                     </Button>
                  </div>
               </div>
            ))
         )}
      </div>
      )}
    </div>
  );
};

export default ListViewAppointments;