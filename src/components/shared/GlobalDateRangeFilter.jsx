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
const saveToStorage = (range) => {
  localStorage.setItem('global_date_range', JSON.stringify(range));
};
  // Handlers for single date selection updates
  const handleStartDateSelect = (date) => {
  if (!date) return;
  const newStart = format(date, 'yyyy-MM-dd');
  
  const newRange =
    endDate && new Date(newStart) > new Date(endDate)
      ? { startDate: newStart, endDate: newStart }
      : { ...dateRange, startDate: newStart };

  onDateRangeChange(newRange);
  saveToStorage(newRange);
};

 const handleEndDateSelect = (date) => {
  if (!date) return;
  const newEnd = format(date, 'yyyy-MM-dd');
  
  const newRange = { ...dateRange, endDate: newEnd };

  onDateRangeChange(newRange);
  saveToStorage(newRange);
};

  const handleReset = (e) => {
  e.stopPropagation();
  const now = new Date();

  const newRange = {
    startDate: format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd'),
    endDate: format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd')
  };

  onDateRangeChange(newRange);
  saveToStorage(newRange);
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