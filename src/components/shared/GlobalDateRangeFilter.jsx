import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CalendarPlus as CalendarIcon, X } from 'lucide-react';
import { format, parse } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const GlobalDateRangeFilter = ({ dateRange, onDateRangeChange, className }) => {
  const { startDate, endDate } = dateRange;

  // Handlers for single date selection updates
  const handleStartDateSelect = (date) => {
    if (!date) return;
    const newStart = format(date, 'yyyy-MM-dd');
    
    // If new start is after end, reset end or set end to start
    if (endDate && new Date(newStart) > new Date(endDate)) {
        onDateRangeChange({ startDate: newStart, endDate: newStart });
    } else {
        onDateRangeChange({ ...dateRange, startDate: newStart });
    }
  };

  const handleEndDateSelect = (date) => {
    if (!date) return;
    const newEnd = format(date, 'yyyy-MM-dd');
    
    // If new end is before start, generally shouldn't happen due to disabled days, but safe guard
    if (startDate && new Date(newEnd) < new Date(startDate)) {
         // Do nothing or swap? Let's just update
         onDateRangeChange({ ...dateRange, endDate: newEnd });
    } else {
         onDateRangeChange({ ...dateRange, endDate: newEnd });
    }
  };

  const handleReset = (e) => {
      e.stopPropagation();
      // Default to current month or let parent decide, passing nulls
      const now = new Date();
      onDateRangeChange({
          startDate: format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd'),
          endDate: format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd')
      });
  };

  // Safe parsing helper
  const getDate = (dateStr) => {
    if (!dateStr) return undefined;
    return parse(dateStr, 'yyyy-MM-dd', new Date());
  };

  return (
    <div className={cn("flex flex-col sm:flex-row items-start sm:items-center gap-2", className)}>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        {/* Start Date Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[150px] justify-start text-left font-normal bg-white border-slate-200 shadow-sm hover:bg-slate-50",
                !startDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
              {startDate ? format(getDate(startDate), 'dd/MM/yyyy', { locale: localeId }) : <span>Start Date</span>}
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

        <span className="text-slate-400 font-medium hidden sm:inline">-</span>

        {/* End Date Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[150px] justify-start text-left font-normal bg-white border-slate-200 shadow-sm hover:bg-slate-50",
                !endDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
              {endDate ? format(getDate(endDate), 'dd/MM/yyyy', { locale: localeId }) : <span>End Date</span>}
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
      
      {/* Quick Actions (Optional) */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={handleReset}
        className="text-xs text-slate-500 hover:text-slate-700 h-8"
      >
        Reset This Month
      </Button>
    </div>
  );
};

export default GlobalDateRangeFilter;