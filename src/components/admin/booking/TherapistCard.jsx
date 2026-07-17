import React from 'react';
import { Plus, CalendarOff } from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { formatTimeIndonesia } from '@/lib/utils';
import { cn } from "@/lib/utils";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TherapistCard = ({ 
  therapist, 
  appointments = [], 
  scheduleSlots = [], // Raw slots with 'status'
  onSlotClick, 
  onManualBooking,
  onAppointmentClick,
  onPatientClick,
  date, 
  leaveStatus = 'aktif',
  leaveReason = ''
}) => {
  
  // Safety check for therapist data
  if (!therapist) {
      return (
          <Card className="border-slate-200 shadow-sm h-full flex items-center justify-center p-6 bg-slate-50">
              <p className="text-slate-400 text-sm">Data terapis tidak tersedia</p>
          </Card>
      );
  }

  const isLeave = ['cuti', 'non_active', 'libur_mingguan'].includes(leaveStatus);
  const isWeeklyOff = leaveStatus === 'libur_mingguan';
  const isNoSchedule = leaveStatus === 'tidak_ada_jadwal';
  const isFullBooked = leaveStatus === 'full_booked';
  const shouldGrayScale =
  (isLeave || isNoSchedule) && !isFullBooked;
  
  // Robust filtering of slots
  const availableSlots = isLeave
  ? []
  : (Array.isArray(scheduleSlots) ? scheduleSlots : [])
      .filter(s => s.status === 'aktif' || !s.status)
      .sort((a, b) => {
        const timeA = a.slot_start_time || "00:00";
        const timeB = b.slot_start_time || "00:00";
        return timeA.localeCompare(timeB);
      });
  // Sort appointments safely
  const sortedAppointments = Array.isArray(appointments) ? [...appointments].sort((a, b) => {
      const timeA = formatTimeIndonesia(a.appointment_date) || "00:00";
      const timeB = formatTimeIndonesia(b.appointment_date) || "00:00";
      return timeA.localeCompare(timeB);
  }) : [];
  const colorMap = {
    blue: "from-blue-50 to-blue-100 border-blue-200",
    green: "from-green-50 to-green-100 border-green-200",
    purple: "from-purple-50 to-purple-100 border-purple-200",
    amber: "from-amber-50 to-amber-100 border-amber-200",
    pink: "from-pink-50 to-pink-100 border-pink-200",
    indigo: "from-indigo-50 to-indigo-100 border-indigo-200",
  };
  const headerColorMap = {
    blue: "from-blue-500 to-blue-600",
    green: "from-green-500 to-green-600",
    purple: "from-purple-500 to-purple-600",
    amber: "from-amber-500 to-amber-600",
    pink: "from-pink-500 to-pink-600",
    indigo: "from-indigo-500 to-indigo-600",
  };
  return (
    <TooltipProvider>
      <Card className={cn(
        "group relative h-full flex flex-col rounded-2xl overflow-hidden",

        // 🔥 PREMIUM BASE
        "bg-white/80 backdrop-blur-xl border border-white/40",

        // 🔥 FLOATING EFFECT
        "shadow-[0_10px_30px_rgba(0,0,0,0.08)]",
        "hover:shadow-[0_20px_60px_rgba(0,0,0,0.15)]",
        "hover:-translate-y-1",

        // 🔥 SMOOTH TRANSITION
        "transition-all duration-300 ease-out",

        // 🔥 SOFT GLOW BORDER
        "before:absolute before:inset-0 before:rounded-2xl before:ring-1 before:ring-white/20",

        shouldGrayScale && "bg-slate-100",
        isWeeklyOff && "ring-2 ring-violet-300"
      )}>
        <CardHeader className={cn(
  "relative py-4 md:py-6 px-3 md:px-5 border-b text-white",
  "bg-gradient-to-br backdrop-blur-xl",
  isWeeklyOff ? "from-violet-800/90 to-violet-950/90" : "from-slate-800/90 to-slate-900/90",
  "border-white/10"
)}>

          {/* Manual Booking Button – Top Right */}
          <div className="absolute top-3 md:top-5 right-3 md:right-5 z-20">
            {isLeave ? (
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed"
                disabled
              >
                <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </Button>
            ) : (
              <Button
  variant="outline"
  size="icon"
  className={cn(
    "h-8 w-8 md:h-9 md:w-9 rounded-full transition-all duration-300",
    "bg-white text-slate-800 border border-white shadow-xl",
    "hover:bg-slate-100 hover:text-black",
    "hover:scale-105 active:scale-95",
    "relative z-30",

    // NORMAL
    "border-slate-300 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50",

    // 🔥 HIGHLIGHT
    (isFullBooked || isNoSchedule) && 
    "border-blue-500 text-blue-600 bg-blue-50 shadow-md ring-2 ring-blue-200 animate-pulse"
  )}
  onClick={() => onManualBooking(therapist)}
>
  <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
</Button>
            )}
          </div>

  {/* Avatar + Info */}
  <div className="flex items-center gap-3 md:gap-5">

    <Avatar
  className={cn(
    "h-12 w-12 md:h-16 md:w-16 border border-white/20 shadow-xl",
    "ring-2 ring-white/10 backdrop-blur",
    shouldGrayScale && "opacity-50 grayscale"
  )}
>
      <AvatarImage src={therapist.avatar_url || ''} />
      <AvatarFallback className="bg-slate-900 text-white text-base font-bold">
        {therapist.name ? therapist.name.charAt(0) : 'T'}
      </AvatarFallback>
    </Avatar>

    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <CardTitle className="text-sm md:text-lg font-semibold text-white leading-tight break-words">
          {therapist.name || 'Unnamed Therapist'}
        </CardTitle>

                {(isLeave || isFullBooked) && (
          <span className={cn(
            "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border flex items-center gap-1",
            isFullBooked
              ? "bg-red-100 text-red-700 border-red-200"
              : isWeeklyOff
              ? "bg-violet-100 text-violet-700 border-violet-300"
              : "bg-gray-200 text-gray-700 border-gray-300"
          )}>
            {isWeeklyOff && <CalendarOff className="w-3 h-3" />}
            {leaveStatus === 'non_active'
              ? 'NON-ACTIVE'
              : isWeeklyOff
              ? (leaveReason || 'LIBUR MINGGUAN')
              : leaveStatus.toUpperCase().replace(/_/g, ' ')}
          </span>
        )}
      </div>

      <p className="text-xs md:text-sm text-white/80">
        {therapist.specialization || 'Fisioterapis'}
      </p>
    </div>

  </div>

</CardHeader>
        
        <CardContent className="flex-1 flex flex-col gap-4 md:gap-8 pt-4 md:pt-6 px-3 md:px-5 pb-4 md:pb-6">
          {/* Available Slots Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
               <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <div className={cn("w-1.5 h-1.5 rounded-full", isLeave ? "bg-gray-400" : "bg-emerald-500")}></div>
                 Slot Kosong
               </h4>
              <span className="hidden md:block text-[10px] text-slate-400 font-medium">{isLeave ? 0 : availableSlots.length} available</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {availableSlots.length > 0 ? (
                availableSlots.map((slot, index) => {
                  const rawTime = slot.slot_start_time || "00:00";
                  const startTime = rawTime.slice(0, 5);
                  
                  // Calculate end time display
                  let endTime = "";
                  try {
                    const [h, m] = rawTime.split(':').map(Number);
                    const d = new Date(); 
                    d.setHours(h, m + (slot.duration_minutes || 60));
                    endTime = format(d, 'HH:mm');
                  } catch(e) {
                    endTime = "--:--";
                  }

                  return (
                    <button
                      key={`${slot.id || index}`}
                      onClick={() => onSlotClick(slot, therapist)}
                      className={cn(
  "w-full text-center px-2 py-2 rounded-xl text-[11px] md:text-sm font-semibold",

                        // 🔥 BASE PREMIUM
                        "bg-emerald-500/90 text-white backdrop-blur",

                        // 🔥 SOFT GLOW
                        "shadow-[0_4px_14px_rgba(16,185,129,0.35)]",

                        // 🔥 HOVER EFFECT (HALUS, BUKAN NORAK)
                        "hover:bg-emerald-500",
                        "hover:shadow-[0_6px_20px_rgba(16,185,129,0.45)]",

                        // 🔥 MICRO INTERACTION
                        "hover:-translate-y-[1px] active:scale-95",

                        // 🔥 TRANSITION SMOOTH
                        "transition-all duration-200"
                      )}
                    >
                      {startTime} - {endTime}
                    </button>
                  );
                })
              ) : (
                <div className="w-full py-4 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                   <span className="text-xs text-slate-400 italic">
                      {isLeave && !isFullBooked && `Therapist sedang ${leaveStatus.replace(/_/g, ' ')}`}
                      {isFullBooked && 'Semua slot hari ini sudah terbooking'}
                      {!isLeave && !isFullBooked && 'Tidak ada slot kosong'}
                   </span>
                {isFullBooked && (
       <p className="text-xs text-slate-400 mt-1">
         Slot penuh (manual booking tetap tersedia)
       </p>
     )}
  </div>
)}
            </div>
          </div>

          {/* Booked Slots Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
               <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                 <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                 Slot Terisi
               </h4>
               <span className="hidden md:block text-[10px] text-slate-400 font-medium">{sortedAppointments.length} booked</span>
            </div>

            <div className="space-y-1.5">
              {sortedAppointments.length > 0 ? (
                sortedAppointments.map((app) => {
                  const timeString = formatTimeIndonesia(app.appointment_date) || "--:--";
                  
                  return (
                    <div 
  key={app.id}
  className={cn(
  "group flex items-center gap-2 md:gap-4 p-2 md:p-3 rounded-xl cursor-pointer border",

  app.status?.toLowerCase() === 'cancelled'
  ? "bg-red-100 border-red-400 grayscale-0 opacity-100"

    : app.is_homecare
    ? "bg-blue-100 border-blue-400"

    : "bg-white/70 backdrop-blur border-white/40",

  "shadow-sm hover:shadow-md",
  "hover:-translate-y-[1px]",
  "hover:bg-white",
  "transition-all duration-200"
)}

    
                      onClick={() => onAppointmentClick(app)}
                    >
                      <div className="shrink-0 font-mono text-[11px] md:text-sm font-semibold text-slate-800 bg-white/80 px-3 py-1.5 rounded-lg border border-white/40 shadow-sm">
                          {timeString}
                       </div>
                       <div className="flex-1 min-w-0">
                        <button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    onPatientClick?.(app.patient?.id || app.patient_id);
  }}
  className="text-sm font-semibold text-slate-800 truncate hover:text-blue-600 transition-colors text-left"
>
                            {app.patient?.full_name || app.guest_name || 'Tanpa Nama'}
                          </button>
                        <p className="text-[11px] text-slate-400 truncate">
                            {app.duration_minutes} min • {app.status}
                          </p>
                       </div>
                    </div>
                  );
                })
              ) : (
                <span className="text-xs text-slate-400 italic pl-1">Belum ada booking</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default TherapistCard;