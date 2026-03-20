import React from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, parseISO, addDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatTimeIndonesia } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const CalendarView = ({ appointments, currentDate, onDateChange, onEventClick, therapists = [] }) => {
  
  const getTherapistColor = (therapistId) => {
    // Generate a consistent color based on therapist ID or index
    if (!therapistId) return 'bg-slate-500 border-slate-600';
    
    // Some preset pleasant colors
    const colors = [
      'bg-indigo-500 border-indigo-600',
      'bg-pink-500 border-pink-600',
      'bg-orange-500 border-orange-600',
      'bg-teal-500 border-teal-600',
      'bg-cyan-500 border-cyan-600',
      'bg-purple-500 border-purple-600',
      'bg-lime-500 border-lime-600',
      'bg-rose-500 border-rose-600',
    ];

    const index = therapists.findIndex(t => t.id === therapistId);
    if (index >= 0) return colors[index % colors.length];
    
    // Fallback if not found
    return 'bg-blue-500 border-blue-600';
  };

  const getStatusIndicator = (status) => {
    switch(status) {
      case 'completed': return 'bg-green-400';
      case 'cancelled': return 'bg-red-400';
      case 'no-show': return 'bg-gray-400';
      default: return 'bg-blue-400'; // scheduled/confirmed
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getDayAppointments = (day) => {
    return appointments.filter(apt => isSameDay(parseISO(apt.appointment_date), day))
      .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2">
           <h2 className="text-lg font-bold text-slate-800 capitalize">
             {format(currentDate, 'MMMM yyyy', { locale: idLocale })}
           </h2>
           <div className="flex gap-1 ml-4">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onDateChange(subMonths(currentDate, 1))}>
                 <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onDateChange(new Date())}>
                 Today
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onDateChange(addMonths(currentDate, 1))}>
                 <ChevronRight className="w-4 h-4" />
              </Button>
           </div>
        </div>
        
        {/* Legend */}
        <div className="hidden md:flex items-center gap-4 text-xs">
           <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span> Scheduled
           </div>
           <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400"></span> Completed
           </div>
           <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400"></span> Cancelled
           </div>
        </div>
      </div>

      {/* Week Header */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((day) => (
          <div key={day} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 grid-rows-6 flex-1 bg-slate-100 gap-px">
        {calendarDays.map((day, idx) => {
          const dayAppointments = getDayAppointments(day);
          const isCurrentMonth = isSameMonth(day, monthStart);

          return (
            <div 
              key={idx}
              className={cn(
                "bg-white relative p-1 md:p-2 min-h-[80px] hover:bg-slate-50 transition-colors flex flex-col gap-1 overflow-hidden",
                !isCurrentMonth && "bg-slate-50/50 text-slate-400"
              )}
              onClick={() => {
                // Could open a day view or create modal prefilled with date
              }}
            >
              <div className="flex justify-between items-start">
                 <span className={cn(
                   "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                   isToday(day) ? "bg-blue-600 text-white" : "text-slate-700"
                 )}>
                   {format(day, 'd')}
                 </span>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                 {dayAppointments.map((apt) => (
                    <TooltipProvider key={apt.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <button
                             onClick={(e) => {
                               e.stopPropagation();
                               onEventClick(apt);
                             }}
                             className={cn(
                               "w-full text-left text-[10px] md:text-xs px-1.5 py-1 rounded border-l-2 shadow-sm truncate transition-all hover:brightness-95",
                               "text-white mb-0.5 block",
                               getTherapistColor(apt.therapist_id)
                             )}
                           >
                             <div className="flex items-center gap-1">
                               <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", getStatusIndicator(apt.status))} />
                               <span className="font-bold">{formatTimeIndonesia(apt.appointment_date)}</span>
                               <span className="truncate flex-1">{apt.patient?.full_name || apt.guest_name || 'Nama tidak tersedia'}</span>
                             </div>
                           </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs">
                             <p className="font-bold">{formatTimeIndonesia(apt.appointment_date)} - {apt.patient?.full_name || apt.guest_name || 'Nama tidak tersedia'}</p>
                             <p>Therapist: {apt.therapist?.name || 'Unassigned'}</p>
                             <p className="capitalize">Status: {apt.status}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                 ))}
                 {dayAppointments.length > 4 && (
                    <div className="text-[10px] text-slate-400 text-center font-medium">
                       + {dayAppointments.length - 4} more
                    </div>
                 )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarView;