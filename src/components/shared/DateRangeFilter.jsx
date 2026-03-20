import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, parse } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const DateRangeFilter = ({ startDate, endDate, onDateChange, className }) => {
  
  const handleStartDateSelect = (date) => {
    if (!date) return;
    const newStart = format(date, 'yyyy-MM-dd');
    
    // If new start is after end, reset end or set end to start
    if (endDate && new Date(newStart) > new Date(endDate)) {
        onDateChange({ startDate: newStart, endDate: newStart });
    } else {
        onDateChange({ startDate: newStart, endDate });
    }
  };

  const handleEndDateSelect = (date) => {
    if (!date) return;
    const newEnd = format(date, 'yyyy-MM-dd');
    onDateChange({ startDate, endDate: newEnd });
  };
  
  // Safe parsing helper to ensure local time is used and proper date is highlighted
  const getDate = (dateStr) => {
    if (!dateStr) return undefined;
    return parse(dateStr, 'yyyy-MM-dd', new Date());
  };

  return (
    <div className={cn("flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm", className)}>
      <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Filter by Date Range:</span>
      
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        {/* Start Date Picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-500 ml-1">Start Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full sm:w-[160px] justify-start text-left font-normal bg-slate-50 border-slate-200 hover:bg-slate-100",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                {startDate ? format(getDate(startDate), 'dd MMM yyyy', { locale: localeId }) : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={getDate(startDate)}
                onSelect={handleStartDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="hidden sm:flex items-end pb-2.5 text-slate-300 mx-1">
          <span className="h-0.5 w-4 bg-slate-200 rounded-full"></span>
        </div>

        {/* End Date Picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-500 ml-1">End Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full sm:w-[160px] justify-start text-left font-normal bg-slate-50 border-slate-200 hover:bg-slate-100",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                {endDate ? format(getDate(endDate), 'dd MMM yyyy', { locale: localeId }) : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={getDate(endDate)}
                onSelect={handleEndDateSelect}
                disabled={(date) => startDate ? date < getDate(startDate) : false}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
};

export default DateRangeFilter;
export { DateRangeFilter };