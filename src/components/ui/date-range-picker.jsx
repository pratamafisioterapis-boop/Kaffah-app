import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronDown, Check } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, subMonths, subDays, startOfYear, isSameDay, differenceInCalendarDays,
} from 'date-fns';
import { id } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const toDateRange = (from, to) => ({
  startDate: format(from, 'yyyy-MM-dd'),
  endDate: format(to, 'yyyy-MM-dd'),
});

const parseDay = (s) => (s ? new Date(`${s}T00:00:00`) : undefined);

// Default periode dashboard keuangan: tanggal 1 bulan ini s/d hari ini.
export const getDefaultDateRange = () => {
  const today = new Date();
  return toDateRange(startOfMonth(today), today);
};

const buildPresets = () => {
  const today = new Date();
  const lastMonth = subMonths(today, 1);
  return [
    { label: 'Tgl 1 – Hari Ini', hint: 'Default', getRange: () => toDateRange(startOfMonth(today), today) },
    { label: 'Hari Ini', getRange: () => toDateRange(today, today) },
    { label: '7 Hari Terakhir', getRange: () => toDateRange(subDays(today, 6), today) },
    { label: '30 Hari Terakhir', getRange: () => toDateRange(subDays(today, 29), today) },
    { label: 'Bulan Ini (penuh)', getRange: () => toDateRange(startOfMonth(today), endOfMonth(today)) },
    { label: 'Bulan Lalu', getRange: () => toDateRange(startOfMonth(lastMonth), endOfMonth(lastMonth)) },
    { label: 'Tahun Ini', getRange: () => toDateRange(startOfYear(today), today) },
  ];
};

const useIsWide = () => {
  const query = '(min-width: 768px)';
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : true);
  const [wide, setWide] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
};

// Date-range picker dengan preset cepat. value/onChange memakai bentuk
// { startDate, endDate } (yyyy-MM-dd) mengikuti konvensi `dateRange`.
const DateRangePicker = ({ value, onChange, className, align = 'start' }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(undefined);
  const wide = useIsWide();
  const presets = useMemo(buildPresets, [open]);

  const from = parseDay(value?.startDate);
  const to = parseDay(value?.endDate);
  const selected = draft || { from, to };

  useEffect(() => { if (!open) setDraft(undefined); }, [open]);

  const activePreset = presets.find((p) => {
    const r = p.getRange();
    return r.startDate === value?.startDate && r.endDate === value?.endDate;
  });

  const handlePreset = (preset) => {
    onChange(preset.getRange());
    setOpen(false);
  };

  // Klik pertama = tanggal awal, klik kedua = tanggal akhir (lalu menutup).
  const handleSelect = (range, clicked) => {
    if (!draft || (draft.from && draft.to)) {
      setDraft({ from: clicked, to: undefined });
      return;
    }
    const a = draft.from;
    const [s, e] = clicked < a ? [clicked, a] : [a, clicked];
    onChange(toDateRange(s, e));
    setOpen(false);
  };

  const fmt = (d, withYear = true) => format(d, withYear ? 'd MMM yyyy' : 'd MMM', { locale: id });
  const label = from && to
    ? (isSameDay(from, to) ? fmt(from) : `${fmt(from, from.getFullYear() !== to.getFullYear())} – ${fmt(to)}`)
    : 'Pilih periode';
  const dayCount = from && to ? differenceInCalendarDays(to, from) + 1 : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Pilih rentang tanggal"
          className={cn(
            'group inline-flex items-center gap-3 rounded-[14px] border border-slate-200 bg-white px-3.5 py-2 text-left shadow-sm transition-[border-color,box-shadow] hover:border-emerald-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 data-[state=open]:border-emerald-400 data-[state=open]:ring-2 data-[state=open]:ring-emerald-500/20',
            className,
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-600">
            <CalendarRange className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Periode</span>
            <span className="block truncate text-[13px] font-semibold text-slate-800">{label}</span>
          </span>
          {dayCount ? (
            <span className="hidden shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 sm:inline">
              {dayCount} hari
            </span>
          ) : null}
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={8}
        className="w-auto max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border-slate-200 p-0 shadow-xl"
      >
        <div className="flex flex-col md:flex-row">
          <div className="flex gap-1.5 overflow-x-auto border-b border-slate-100 bg-slate-50/70 p-2.5 [scrollbar-width:none] md:w-48 md:flex-col md:gap-1 md:overflow-visible md:border-b-0 md:border-r md:p-3 [&::-webkit-scrollbar]:hidden">
            <p className="mb-1 hidden px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 md:block">Pilihan cepat</p>
            {presets.map((preset) => {
              const isActive = activePreset?.label === preset.label;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  className={cn(
                    'flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-[13px] font-medium transition-colors',
                    isActive ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900',
                  )}
                >
                  {preset.label}
                  {isActive && <Check className="hidden h-3.5 w-3.5 md:block" />}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col">
            <Calendar
              mode="range"
              defaultMonth={from}
              selected={selected}
              onSelect={handleSelect}
              numberOfMonths={wide ? 2 : 1}
              locale={id}
              weekStartsOn={1}
              classNames={{
                head_cell: 'text-slate-400 rounded-md w-9 h-9 font-medium text-[0.75rem]',
                day_selected: 'bg-emerald-600 text-white hover:bg-emerald-600 hover:text-white focus:bg-emerald-600 focus:text-white',
                day_range_middle: 'aria-selected:bg-emerald-50 aria-selected:text-emerald-800',
                day_today: 'ring-1 ring-inset ring-emerald-400 text-emerald-700 font-semibold',
                cell: 'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-emerald-50 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
              }}
            />
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
              <span>{draft?.from && !draft.to ? 'Pilih tanggal akhir…' : 'Klik tanggal awal, lalu tanggal akhir'}</span>
              {dayCount ? <span className="font-semibold text-slate-700">{dayCount} hari</span> : null}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DateRangePicker;
