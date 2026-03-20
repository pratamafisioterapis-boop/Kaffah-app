import React from 'react';
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SlotGrid = ({ 
  slots = [], 
  onSlotClick, 
  leaveStatus = 'aktif' 
}) => {
  const isCutiOrSakit = ['cuti', 'sakit', 'non_active'].includes(leaveStatus);

  // Debug log for Task 2 verification
  if (slots.length > 0 && isCutiOrSakit) {
      console.log(`[SlotGrid] Rendering ${slots.length} slots in DISABLED state due to status: ${leaveStatus}`);
  }

  if (!slots || slots.length === 0) {
    return (
      <div className="w-full py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
        <span className="text-sm text-slate-400 italic">
           {isCutiOrSakit ? 'Therapist tidak tersedia.' : 'Tidak ada slot tersedia.'}
        </span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {slots.map((slot) => {
          const startTime = slot.slot_start_time.slice(0, 5);
          // Calculate end time display (Task 2: Time display logic)
          const [h, m] = slot.slot_start_time.split(':').map(Number);
          const d = new Date(); d.setHours(h, m + (slot.duration_minutes || 60));
          const endTime = format(d, 'HH:mm');

          const isDisabled = isCutiOrSakit;

          const ButtonElement = (
            <button
              key={slot.id}
              onClick={() => !isDisabled && onSlotClick(slot)}
              disabled={isDisabled}
              aria-disabled={isDisabled}
              type="button"
              className={cn(
                "relative px-2 py-2 rounded-md text-xs font-semibold transition-all border shadow-sm flex flex-col items-center justify-center gap-0.5 w-full",
                isDisabled 
                  ? "slot-leave-disabled bg-gray-300 text-gray-600 border-gray-400 cursor-not-allowed opacity-70"
                  : "bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border-slate-200 hover:border-emerald-200 active:scale-95 cursor-pointer"
              )}
            >
              {isDisabled ? (
                 <span className="leave-label font-bold text-[10px] uppercase text-gray-700">
                    {leaveStatus === 'non_active' ? 'INACTIVE' : leaveStatus.toUpperCase()}
                 </span>
              ) : (
                 <>
                   <span>{startTime}</span>
                   <span className="text-[9px] text-slate-400 font-normal">s.d {endTime}</span>
                 </>
              )}
            </button>
          );

          if (isDisabled) {
            return (
              <Tooltip key={slot.id}>
                <TooltipTrigger asChild>
                  <div className="w-full cursor-not-allowed">{ButtonElement}</div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Fisioterapis sedang {leaveStatus === 'non_active' ? 'tidak aktif' : leaveStatus}</p>
                </TooltipContent>
              </Tooltip>
            );
          }

          return ButtonElement;
        })}
      </div>
    </TooltipProvider>
  );
};

export default SlotGrid;