import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Check } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, subMonths, subDays, startOfYear, differenceInCalendarDays,
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
    { label: 'Tgl 1 – Hari Ini', getRange: () => toDateRange(startOfMonth(today), today) },
    { label: 'Hari Ini', getRange: () => toDateRange(today, today) },
    { label: '7 Hari Terakhir', getRange: () => toDateRange(subDays(today, 6), today) },
    { label: '30 Hari Terakhir', getRange: () => toDateRange(subDays(today, 29), today) },
    { label: 'Bulan Ini (penuh)', getRange: () => toDateRange(startOfMonth(today), endOfMonth(today)) },
    { label: 'Bulan Lalu', getRange: () => toDateRange(startOfMonth(lastMonth), endOfMonth(lastMonth)) },
    { label: 'Tahun Ini', getRange: () => toDateRange(startOfYear(today), today) },
  ];
};

// Gaya tombol pemicu. `toolbar` = bar "PERIODE" di dashboard, `field` = pengganti
// <Input type="date"> di form/filter, `dark` = untuk latar gelap.
const TRIGGER_VARIANTS = {
  toolbar: 'rounded-app-sm border border-app-border bg-white px-3 py-1.5 text-xs shadow-sm text-app-ink hover:border-app-accent/50',
  field: 'h-10 rounded-md border border-input bg-white px-3 text-sm text-slate-800 hover:border-app-accent/50',
  dark: 'h-10 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-white hover:bg-white/10',
};

const fmtShort = (s) => (s ? format(parseDay(s), 'dd/MM/yyyy') : '--/--/----');

// Pemilih rentang tanggal dengan pilihan cepat di kiri dan satu bulan di kanan.
// value/onChange memakai bentuk { startDate, endDate } (yyyy-MM-dd).
const DateRangePicker = ({
  value,
  onChange,
  className,
  align = 'end',
  variant = 'toolbar',
  label = 'Periode',
  maxDate,
  minDate,
  disabled = false,
  clearable = false,
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(undefined);
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

  const dayCount = from && to ? differenceInCalendarDays(to, from) + 1 : null;
  const isToolbar = variant === 'toolbar';

  const disabledDays = [];
  if (minDate) disabledDays.push({ before: parseDay(minDate) });
  if (maxDate) disabledDays.push({ after: parseDay(maxDate) });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Pilih rentang tanggal"
          className={cn(
            'group inline-flex items-center gap-2 text-left font-medium transition-[border-color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/40 data-[state=open]:border-app-accent data-[state=open]:ring-2 data-[state=open]:ring-app-accent/20 disabled:cursor-not-allowed disabled:opacity-50',
            TRIGGER_VARIANTS[variant] || TRIGGER_VARIANTS.toolbar,
            className,
          )}
        >
          {isToolbar && label ? (
            <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-app-accent">{label}</span>
          ) : (
            <CalendarRange className="h-4 w-4 shrink-0 text-app-accent" />
          )}
          <span className="min-w-0 flex-1 truncate tabular-nums">
            {from || to ? `${fmtShort(value?.startDate)} – ${fmtShort(value?.endDate)}` : 'Pilih periode'}
          </span>
          {isToolbar && <CalendarRange className="h-4 w-4 shrink-0 text-app-accent" />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={8}
        className="w-auto max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border-app-border bg-white p-0 text-app-ink shadow-xl"
      >
        <div className="flex flex-col md:flex-row">
          <div className="flex gap-1.5 overflow-x-auto border-b border-app-border bg-slate-50/70 p-2.5 [scrollbar-width:none] md:w-44 md:flex-col md:gap-1 md:overflow-visible md:border-b-0 md:border-r md:bg-transparent md:p-3 [&::-webkit-scrollbar]:hidden">
            <p className="mb-1 hidden px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 md:block">Cepat</p>
            {presets.map((preset) => {
              const isActive = activePreset?.label === preset.label;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  className={cn(
                    'flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-[10px] px-3 py-2 text-left text-[13px] font-semibold transition-colors',
                    isActive ? 'bg-app-soft text-app-accent' : 'text-app-ink hover:bg-slate-100',
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
              numberOfMonths={1}
              locale={id}
              weekStartsOn={1}
              disabled={disabledDays.length ? disabledDays : undefined}
              classNames={{
                caption_label: 'text-[14.5px] font-bold',
                head_cell: 'text-slate-400 w-9 h-9 font-bold uppercase text-[0.68rem] tracking-wide',
                nav_button: 'h-8 w-8 rounded-[10px] border border-app-border bg-white p-0 opacity-100 hover:bg-app-soft inline-flex items-center justify-center',
                cell: 'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-app-soft [&:has(.day-range-start)]:rounded-l-full [&:has(.day-range-end)]:rounded-r-full [&:has([aria-selected].day-outside)]:bg-app-soft/50 focus-within:relative focus-within:z-20',
                day: 'h-9 w-9 p-0 font-medium rounded-full text-[13px] hover:bg-app-soft hover:text-app-accent aria-selected:opacity-100 inline-flex items-center justify-center',
                day_range_start: 'day-range-start',
                day_range_end: 'day-range-end',
                day_selected: 'bg-app-accent text-white shadow-sm hover:bg-app-accent hover:text-white focus:bg-app-accent focus:text-white',
                day_range_middle: 'rounded-none aria-selected:bg-app-soft aria-selected:text-app-accent',
                day_today: 'font-bold text-app-accent ring-1 ring-inset ring-amber-400',
              }}
            />
            <div className="flex items-center justify-between gap-3 border-t border-app-border px-4 py-2.5 text-xs text-slate-500">
              <span>{draft?.from && !draft.to ? 'Pilih tanggal akhir…' : 'Klik tanggal awal, lalu tanggal akhir'}</span>
              {clearable && (from || to) && !draft ? (
                <button
                  type="button"
                  onClick={() => { onChange({ startDate: '', endDate: '' }); setOpen(false); }}
                  className="font-semibold text-app-accent hover:underline"
                >
                  Hapus filter
                </button>
              ) : dayCount && !draft ? <span className="font-bold text-app-ink">{dayCount} hari</span> : null}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DateRangePicker;
