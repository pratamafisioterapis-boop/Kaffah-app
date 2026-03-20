import React from 'react';
import { format, parseISO, isWithinInterval, addMinutes } from 'date-fns';
import { Plus, User, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const SlotGrid = ({ 
  selectedDate, 
  therapists, 
  appointments, 
  schedules, 
  onSlotClick 
}) => {
  
  // Helper to determine slot status
  const getSlotStatus = (therapist, slot) => {
    // 1. Exact Match Booking
    const exactBooking = appointments.find(app => 
        app.therapist_id === therapist.id && 
        format(parseISO(app.appointment_date), 'HH:mm:00') === slot.slot_start_time &&
        app.status !== 'cancelled'
    );
    
    if (exactBooking) {
        // Check if pending/in-progress logic applies
        const isPending = exactBooking.status === 'pending' || exactBooking.status === 'scheduled';
        const isInProgress = exactBooking.status === 'confirmed' && isNowInProgress(exactBooking);
        
        if (isInProgress) return { status: 'in-progress', app: exactBooking };
        return { status: 'booked', app: exactBooking };
    }

    // 2. Overlap Check (Slot is inside a longer appointment)
    const overlap = appointments.find(a => {
        if (a.therapist_id !== therapist.id || a.status === 'cancelled') return false;
        
        const appStart = new Date(a.appointment_date);
        const appEnd = addMinutes(appStart, a.duration_minutes || 60);
        
        const slotStart = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${slot.slot_start_time}`);
        // We consider the slot occupied if the slot START time is strictly inside the appointment window
        return slotStart >= appStart && slotStart < appEnd;
    });

    if (overlap) return { status: 'occupied', app: overlap };

    return { status: 'available' };
  };

  const isNowInProgress = (app) => {
      const now = new Date();
      const start = new Date(app.appointment_date);
      const end = addMinutes(start, app.duration_minutes || 60);
      return isWithinInterval(now, { start, end });
  };

  return (
    <ScrollArea className="h-[calc(100vh-140px)] border rounded-md bg-white">
      <div className="min-w-[600px]">
        {therapists.map(therapist => {
            const schedule = schedules[therapist.id];
            const slots = schedule?.therapist_slots?.sort((a,b) => a.slot_start_time.localeCompare(b.slot_start_time)) || [];
            
            return (
                <div key={therapist.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                    {/* Therapist Row Header */}
                    <div className="p-4 flex items-center gap-4 border-b border-dashed bg-slate-50/50 sticky left-0 z-10">
                        <Avatar className="h-10 w-10 border">
                            <AvatarImage src={therapist.avatar_url} />
                            <AvatarFallback><User className="w-5 h-5 text-slate-400" /></AvatarFallback>
                        </Avatar>
                        <div>
                            <div className="font-semibold text-slate-800">{therapist.name}</div>
                            <div className="text-xs text-slate-500">{therapist.specialization || 'Physiotherapist'}</div>
                        </div>
                        <div className="ml-auto text-xs font-medium text-slate-400">
                            {slots.length} Slots
                        </div>
                    </div>

                    {/* Slots Grid */}
                    <div className="p-4">
                        {slots.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-md border border-dashed">
                                No slots configured for this day
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                {slots.map(slot => {
                                    const { status, app } = getSlotStatus(therapist, slot);

                                    // If this slot is 'occupied' by a previous booking but isn't the start, 
                                    // we render it as blocked/grayed out to show it's taken by the overlapping appointment.
                                    // Or we can hide it if we want a cleaner look, but grid alignment is better if we show it.
                                    
                                    if (status === 'occupied' && format(parseISO(app.appointment_date), 'HH:mm:00') !== slot.slot_start_time) {
                                       return (
                                           <div key={slot.id} className="opacity-50 grayscale pointer-events-none p-2 border rounded bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                                               Occupied
                                           </div>
                                       );
                                    }

                                    return (
                                        <button
                                            key={slot.id}
                                            onClick={() => status === 'available' && onSlotClick(therapist, slot)}
                                            disabled={status !== 'available'}
                                            className={`
                                                relative flex flex-col items-start justify-between p-3 rounded-lg border text-left transition-all h-[90px] w-full
                                                ${status === 'available' ? 'bg-green-50 border-green-200 hover:bg-green-100 hover:border-green-300 hover:shadow-sm cursor-pointer group' : ''}
                                                ${status === 'booked' ? 'bg-red-50 border-red-200 cursor-not-allowed opacity-90' : ''}
                                                ${status === 'in-progress' ? 'bg-yellow-50 border-yellow-200 cursor-not-allowed' : ''}
                                            `}
                                        >
                                            <div className="flex justify-between w-full">
                                                <span className={`font-bold text-sm ${
                                                    status === 'available' ? 'text-green-700' : 
                                                    status === 'booked' ? 'text-red-700' : 'text-yellow-700'
                                                }`}>
                                                    {slot.slot_start_time.slice(0,5)}
                                                </span>
                                                {status === 'available' ? (
                                                    <Plus className="w-4 h-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                ) : status === 'booked' ? (
                                                    <CheckCircle className="w-4 h-4 text-red-500" />
                                                ) : (
                                                    <Clock className="w-4 h-4 text-yellow-500" />
                                                )}
                                            </div>
                                            
                                            <div className="w-full">
                                                {status === 'available' ? (
                                                    <div className="text-xs text-green-600 font-medium mt-auto">
                                                        {slot.duration_minutes || 60} min
                                                        <span className="block text-[10px] text-green-500 font-normal">Available</span>
                                                    </div>
                                                ) : (
                                                    <div className="text-xs mt-1">
                                                        <div className="font-semibold text-slate-900 truncate">
                                                            {app?.patient?.full_name || app?.guest_name || 'Unknown'}
                                                        </div>
                                                        <div className={`text-[10px] ${status === 'booked' ? 'text-red-600' : 'text-yellow-600'}`}>
                                                            {app?.status} • {app?.duration_minutes}m
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            );
        })}
      </div>
    </ScrollArea>
  );
};

export default SlotGrid;