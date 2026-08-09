import React, { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns';
import { id } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const toDateRange = (from, to) => ({
  startDate: format(from, 'yyyy-MM-dd'),
  endDate: format(to, 'yyyy-MM-dd'),
});

const buildPresets = () => {
  const today = new Date();
  const lastMonth = subMonths(today, 1);
  return [
    { label: 'Hari Ini', getRange: () => toDateRange(today, today) },
    { label: '7 Hari Terakhir', getRange: () => toDateRange(subDays(today, 6), today) },
    { label: 'Bulan Ini', getRange: () => toDateRange(startOfMonth(today), endOfMonth(today)) },
    { label: 'Bulan Lalu', getRange: () => toDateRange(startOfMonth(lastMonth), endOfMonth(lastMonth)) },
  ];
};

// Date-range picker dengan preset cepat, dipakai di halaman Presentasi Direksi.
// value/onChange memakai bentuk { startDate, endDate } (yyyy-MM-dd) mengikuti
// konvensi `dateRange` yang sudah dipakai OwnerDashboardHome/RevenueOverview.
const DateRangePicker = ({ value, onChange, className }) => {
  const [open, setOpen] = useState(false);
  const presets = buildPresets();

  const selectedRange = {
    from: value?.startDate ? new Date(`${value.startDate}T00:00:00`) : undefined,
    to: value?.endDate ? new Date(`${value.endDate}T00:00:00`) : undefined,
  };

  const handlePresetClick = (preset) => {
    onChange(preset.getRange());
    setOpen(false);
  };

  const handleCalendarSelect = (range) => {
    if (!range?.from) return;
    onChange(toDateRange(range.from, range.to || range.from));
    if (range.from && range.to) setOpen(false);
  };

  const label = value?.startDate && value?.endDate
    ? `${format(new Date(`${value.startDate}T00:00:00`), 'dd MMM yyyy', { locale: id })} – ${format(new Date(`${value.endDate}T00:00:00`), 'dd MMM yyyy', { locale: id })}`
    : 'Pilih periode';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('justify-start text-left font-medium gap-2', className)}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <div className="flex sm:flex-col gap-1 p-3 border-b sm:border-b-0 sm:border-r border-slate-100 overflow-x-auto">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="justify-start whitespace-nowrap font-normal"
                onClick={() => handlePresetClick(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            defaultMonth={selectedRange.from}
            selected={selectedRange}
            onSelect={handleCalendarSelect}
            numberOfMonths={1}
            locale={id}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DateRangePicker;
