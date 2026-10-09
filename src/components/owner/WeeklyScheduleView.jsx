import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown, Loader2, Plus, Home, Clock, CalendarOff, Sparkles, Check, Users,
} from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { getAvailableSlots, getAppointments } from '@/lib/api';
import { formatTimeIndonesia, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const toKey = (d) => format(d, 'yyyy-MM-dd');
const hhmm = (t) => (t || '00:00').replace('.', ':').slice(0, 5);
const toMin = (t) => {
  const [h, m] = hhmm(t).split(':').map(Number);
  return h * 60 + (m || 0);
};
const fmtMin = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const ROW_H = 76; // tinggi satu baris jam (px) pada tampilan desktop
const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const shortName = (name = '') => name.split(',')[0].trim();

// Warna pembeda tiap terapis (kelas statis agar ikut ter-generate Tailwind).
// Hijau (slot kosong) & amber (homecare) sengaja tidak dipakai.
const PALETTE = [
  { dot: 'bg-indigo-500', border: 'border-l-indigo-500', card: 'from-indigo-50 border-indigo-200/70', text: 'text-indigo-600', tag: 'bg-indigo-100 text-indigo-700', ring: 'ring-indigo-400' },
  { dot: 'bg-sky-500', border: 'border-l-sky-500', card: 'from-sky-50 border-sky-200/70', text: 'text-sky-600', tag: 'bg-sky-100 text-sky-700', ring: 'ring-sky-400' },
  { dot: 'bg-rose-500', border: 'border-l-rose-500', card: 'from-rose-50 border-rose-200/70', text: 'text-rose-600', tag: 'bg-rose-100 text-rose-700', ring: 'ring-rose-400' },
  { dot: 'bg-violet-500', border: 'border-l-violet-500', card: 'from-violet-50 border-violet-200/70', text: 'text-violet-600', tag: 'bg-violet-100 text-violet-700', ring: 'ring-violet-400' },
  { dot: 'bg-cyan-500', border: 'border-l-cyan-500', card: 'from-cyan-50 border-cyan-200/70', text: 'text-cyan-700', tag: 'bg-cyan-100 text-cyan-700', ring: 'ring-cyan-400' },
  { dot: 'bg-fuchsia-500', border: 'border-l-fuchsia-500', card: 'from-fuchsia-50 border-fuchsia-200/70', text: 'text-fuchsia-600', tag: 'bg-fuchsia-100 text-fuchsia-700', ring: 'ring-fuchsia-400' },
  { dot: 'bg-app-accent', border: 'border-l-app-accent', card: 'from-app-soft border-blue-200/70', text: 'text-app-accent-hover', tag: 'bg-app-accent/15 text-app-accent-hover', ring: 'ring-app-accent-bright' },
  { dot: 'bg-pink-500', border: 'border-l-pink-500', card: 'from-pink-50 border-pink-200/70', text: 'text-pink-600', tag: 'bg-pink-100 text-pink-700', ring: 'ring-pink-400' },
];

const Avatar = ({ t, size = 'h-7 w-7', className }) => {
  const src = t?.photo_url || t?.avatar_url;
  return src ? (
    <img src={src} alt="" className={cn(size, 'rounded-full object-cover shrink-0', className)} loading="lazy" decoding="async" />
  ) : (
    <span className={cn(size, 'rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0', className)}>
      {initials(t?.name)}
    </span>
  );
};

/**
 * Jadwal seminggu untuk satu atau beberapa terapis. Baris = jam mulai yang benar-benar
 * ada (tanpa baris kosong), tiap kartu berupa rentang slot. Klik slot kosong untuk booking.
 */
const WeeklyScheduleView = ({
  therapists,
  date,
  onDateChange,
  onOpenDay,
  onSlotClick,
  onAppointmentClick,
  refreshKey = 0,
}) => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rawSlots, setRawSlots] = useState({}); // day -> rows RPC
  const [rawApps, setRawApps] = useState([]);
  const [rawOff, setRawOff] = useState([]);
  const [selectedDay, setSelectedDay] = useState(toKey(date));

  const weekStart = useMemo(() => startOfWeek(date, { weekStartsOn: 1 }), [date]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = new Date();

  const meta = useMemo(() => {
    const m = {};
    therapists.forEach((t, i) => { m[t.id] = { t, color: PALETTE[i % PALETTE.length] }; });
    return m;
  }, [therapists]);

  // Default: terapis pertama. Buang id yang sudah tidak ada.
  useEffect(() => {
    if (therapists.length === 0) return;
    setSelectedIds((prev) => {
      const valid = prev.filter((id) => meta[id]);
      return valid.length ? valid : [therapists[0].id];
    });
  }, [therapists, meta]);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const multi = selectedIds.length > 1;

  useEffect(() => {
    if (!days.some((d) => toKey(d) === selectedDay)) {
      setSelectedDay(days.some((d) => isSameDay(d, today)) ? toKey(today) : toKey(days[0]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const fetchWeek = useCallback(async () => {
    const startStr = toKey(days[0]);
    const endStr = toKey(days[6]);
    try {
      const [slotResults, appsRes, offRes] = await Promise.all([
        Promise.all(days.map((d) => getAvailableSlots(toKey(d)))),
        getAppointments({ startDate: `${startStr}T00:00:00`, endDate: `${endStr}T23:59:59` }),
        supabase
          .from('therapist_time_off')
          .select('therapist_id, start_date, end_date, reason, leave_type')
          .lte('start_date', endStr)
          .gte('end_date', startStr),
      ]);
      const slotMap = {};
      days.forEach((d, i) => { slotMap[toKey(d)] = slotResults[i]?.data || []; });
      setRawSlots(slotMap);
      setRawApps(appsRes?.data || []);
      setRawOff(offRes?.data || []);
    } catch (e) {
      console.error('[WeeklyScheduleView] fetchWeek error:', e);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    setLoading(true);
    fetchWeek();
  }, [fetchWeek, refreshKey]);

  useEffect(() => {
    const channel = supabase
      .channel(`weekly-appointments-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, fetchWeek)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchWeek]);

  // Item per hari (slot kosong + pasien) untuk terapis terpilih.
  const itemsByDay = useMemo(() => {
    const out = {};
    days.forEach((d) => { out[toKey(d)] = []; });
    days.forEach((d) => {
      const k = toKey(d);
      (rawSlots[k] || []).forEach((s) => {
        if (s.status !== 'aktif' || !selected.has(s.therapist_id) || !meta[s.therapist_id]) return;
        out[k].push({
          kind: 'slot',
          time: hhmm(s.slot_start),
          end: hhmm(s.slot_end) !== '00:00' ? hhmm(s.slot_end) : fmtMin(toMin(s.slot_start) + (s.duration_minutes || 60)),
          therapistId: s.therapist_id,
          data: {
            id: s.id,
            therapist_id: s.therapist_id,
            slot_start_time: s.slot_start,
            slot_end_time: s.slot_end,
            duration_minutes: s.duration_minutes || 60,
            status: s.status,
          },
        });
      });
    });
    rawApps.forEach((a) => {
      if (!a.appointment_date || a.status?.toLowerCase() === 'cancelled') return;
      if (!selected.has(a.therapist_id) || !meta[a.therapist_id]) return;
      const k = new Date(a.appointment_date).toLocaleDateString('sv-SE');
      if (!out[k]) return;
      out[k].push({
        kind: 'app',
        time: hhmm(formatTimeIndonesia(a.appointment_date).replace('.', ':')),
        end: fmtMin(toMin(formatTimeIndonesia(a.appointment_date).replace('.', ':')) + (a.duration_minutes || 60)),
        therapistId: a.therapist_id,
        data: { ...a, is_new_patient: !a.patient_id },
      });
    });
    Object.values(out).forEach((list) =>
      list.sort((x, y) => x.time.localeCompare(y.time) || (x.kind === 'app' ? -1 : 1))
    );
    return out;
  }, [days, rawSlots, rawApps, selected, meta]);

  // Hari cuti hanya ditandai bila satu terapis dipilih.
  const offDays = useMemo(() => {
    const off = {};
    if (selectedIds.length !== 1) return off;
    rawOff.filter((r) => r.therapist_id === selectedIds[0]).forEach((row) => {
      days.forEach((d) => {
        const k = toKey(d);
        if (k >= row.start_date && k <= row.end_date) {
          // Libur mingguan yang diganti jadwal pengganti (ada slot aktif) bukan hari cuti.
          if (row.leave_type === 'weekly_off'
            && (rawSlots[k] || []).some((sl) => sl.therapist_id === row.therapist_id && (sl.status === 'aktif' || sl.status === 'terisi'))) return;
          off[k] = (row.reason || 'Cuti').split(' - ')[0].trim() || 'Cuti';
        }
      });
    });
    return off;
  }, [rawOff, rawSlots, selectedIds, days]);

  // Hari libur mingguan yang diganti jadwal pengganti izin (ditandai di header hari).
  const replacedDays = useMemo(() => {
    const out = {};
    if (selectedIds.length !== 1) return out;
    rawOff.filter((r) => r.therapist_id === selectedIds[0] && r.leave_type === 'weekly_off').forEach((row) => {
      days.forEach((d) => {
        const k = toKey(d);
        if (k >= row.start_date && k <= row.end_date
          && (rawSlots[k] || []).some((sl) => sl.therapist_id === row.therapist_id && (sl.status === 'aktif' || sl.status === 'terisi'))) out[k] = true;
      });
    });
    return out;
  }, [rawOff, rawSlots, selectedIds, days]);

  // Baris = jam mulai yang benar-benar ada (tanpa duplikat, tanpa jam yang tidak punya slot).
  // Tiap kartu membentang dari baris jam mulainya sampai sebelum jam selesainya.
  const timeRows = useMemo(() => {
    const set = new Set();
    Object.values(itemsByDay).forEach((list) => list.forEach((i) => set.add(i.time)));
    return [...set].sort();
  }, [itemsByDay]);

  const layoutByDay = useMemo(() => {
    const out = {};
    Object.entries(itemsByDay).forEach(([k, list]) => {
      const laneEnds = [];
      const placed = list.map((it) => {
        const start = toMin(it.time);
        const end = Math.max(toMin(it.end), start + 1);
        const startIdx = timeRows.indexOf(it.time);
        let span = timeRows.filter((t) => toMin(t) >= start && toMin(t) < end).length;
        span = Math.max(span, 1);
        let lane = laneEnds.findIndex((e) => e <= start);
        if (lane === -1) { lane = laneEnds.length; laneEnds.push(end); } else { laneEnds[lane] = end; }
        return { it, startIdx, span, lane };
      });
      out[k] = { placed, lanes: Math.max(laneEnds.length, 1) };
    });
    return out;
  }, [itemsByDay, timeRows]);

  const cellItems = (dayKey, time) => (itemsByDay[dayKey] || []).filter((i) => i.time === time);
  const freeCount = (k) => (itemsByDay[k] || []).filter((i) => i.kind === 'slot').length;
  const bookedCount = (k) => (itemsByDay[k] || []).filter((i) => i.kind === 'app').length;
  const totalFree = days.reduce((n, d) => n + freeCount(toKey(d)), 0);
  const totalBooked = days.reduce((n, d) => n + bookedCount(toKey(d)), 0);

  const toggleTherapist = (id) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((x) => x !== id) : prev) : [...prev, id]
    );

  const renderItem = (item, dayDate, compact = false, fill = false) => {
    const { color, t } = meta[item.therapistId];
    const tag = multi && (
      <span className={cn('inline-flex items-center gap-1 max-w-full text-[9px] font-bold px-1.5 py-0.5 rounded-full truncate', color.tag)}>
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', color.dot)} />
        <span className="truncate">{shortName(t.name)}</span>
      </span>
    );

    if (item.kind === 'app') {
      const a = item.data;
      const name = a.patient?.full_name || a.guest_name || 'Tanpa Nama';
      return (
        <button
          key={`a-${a.id}`}
          type="button"
          onClick={() => onAppointmentClick(a)}
          className={cn(
            'w-full text-left rounded-app border border-l-4 px-2.5 py-1.5 shadow-sm [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-md transition-[color,background-color,border-color,box-shadow,transform,opacity] bg-gradient-to-br to-white',
            fill && 'h-full overflow-hidden',
            color.card, color.border
          )}
        >
          <div className="flex items-center justify-between gap-1">
            <span className={cn('text-[10px] font-mono font-bold', color.text)}>{item.time}<span className="font-normal opacity-70"> – {item.end}</span></span>
            <span className="flex items-center gap-1">
              {a.is_homecare && (
                <span className="inline-flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 rounded-full">
                  <Home className="h-2.5 w-2.5" /> Homecare
                </span>
              )}
              {a.is_new_patient && (
                <span className="text-[8px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 px-1.5 rounded-full">Baru</span>
              )}
            </span>
          </div>
          <p className={cn('font-semibold text-slate-800 leading-tight truncate', compact ? 'text-sm' : 'text-xs')}>{name}</p>
          {tag && <div className="mt-1">{tag}</div>}
        </button>
      );
    }

    const s = item.data;
    return (
      <button
        key={`s-${s.id || `${item.therapistId}-${item.time}`}`}
        type="button"
        onClick={() => onSlotClick(s, t, dayDate)}
        className={cn(
          'group w-full rounded-app px-2.5 py-1.5 text-left',
          fill && 'h-full overflow-hidden',
          'border border-dashed border-emerald-300 bg-emerald-50/60 text-emerald-700',
          'hover:bg-emerald-500 hover:text-white hover:border-emerald-500 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-lg hover:shadow-emerald-500/25',
          'active:scale-[0.98] transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200'
        )}
        title="Klik untuk tambah pasien di slot ini"
      >
        <div className="flex items-center justify-between gap-1">
          <span className={cn('font-mono font-bold', compact ? 'text-sm' : 'text-[11px]')}>
            {item.time}
            <span className="font-normal opacity-70"> – {hhmm(s.slot_end_time)}</span>
          </span>
          <span className="h-5 w-5 rounded-full bg-emerald-500 text-white group-hover:bg-white group-hover:text-emerald-600 flex items-center justify-center shrink-0 transition-colors">
            <Plus className="h-3 w-3" />
          </span>
        </div>
        {tag && <div className="mt-1">{tag}</div>}
      </button>
    );
  };

  const rangeLabel = `${format(days[0], 'd MMM', { locale: idLocale })} – ${format(days[6], 'd MMM yyyy', { locale: idLocale })}`;
  const selectedTherapists = selectedIds.map((id) => meta[id]).filter(Boolean);

  const picker = (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex items-center gap-3 w-full md:w-auto md:min-w-[280px] pl-2 pr-3 py-1.5 rounded-app-lg border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-sm [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-md hover:border-clinara-sky transition-[color,background-color,border-color,box-shadow,transform,opacity]"
        >
          <div className="flex -space-x-2">
            {selectedTherapists.slice(0, 3).map(({ t, color }) => (
              <Avatar key={t.id} t={t} size="h-8 w-8" className={cn('ring-2 ring-white border-2', color.ring.replace('ring-', 'border-'))} />
            ))}
            {selectedTherapists.length > 3 && (
              <span className="h-8 w-8 rounded-full bg-clinara-navy text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                +{selectedTherapists.length - 3}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 leading-none">Terapis</p>
            <p className="text-sm font-bold text-slate-800 truncate leading-tight mt-0.5">
              {selectedTherapists.length === therapists.length && therapists.length > 1
                ? 'Semua terapis'
                : multi
                  ? `${selectedTherapists.length} terapis dipilih`
                  : shortName(selectedTherapists[0]?.t.name)}
            </p>
          </div>
          <ChevronDown className={cn('h-4 w-4 text-slate-500 transition-transform', pickerOpen && 'rotate-180')} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,340px)] p-0 rounded-app-lg border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-clinara-navy to-clinara-blue text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-clinara-mint" />
            <p className="text-sm font-bold">Pilih terapis</p>
          </div>
          <div className="flex gap-1.5 text-[11px] font-semibold">
            <button type="button" className="px-2 py-1 rounded-md bg-white/15 hover:bg-white/25" onClick={() => setSelectedIds(therapists.map((t) => t.id))}>Semua</button>
            <button type="button" className="px-2 py-1 rounded-md bg-white/15 hover:bg-white/25" onClick={() => setSelectedIds(selectedIds.slice(0, 1))}>Reset</button>
          </div>
        </div>
        <div className="max-h-[320px] overflow-y-auto p-2 space-y-1">
          {therapists.map((t) => {
            const on = selected.has(t.id);
            const { color } = meta[t.id];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTherapist(t.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-2.5 py-2 rounded-app border text-left transition-[color,background-color,border-color,box-shadow,transform,opacity]',
                  on ? 'bg-slate-50 border-slate-200' : 'border-transparent hover:bg-slate-50'
                )}
              >
                <Avatar t={t} size="h-9 w-9" className={cn(on && 'ring-2 ring-offset-1', on && color.ring)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{t.name}</p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', color.dot)} /> Warna penanda
                  </p>
                </div>
                <span className={cn('h-5 w-5 rounded-full flex items-center justify-center border transition-[color,background-color,border-color,box-shadow,transform,opacity]', on ? 'bg-app-accent border-app-accent text-white' : 'border-slate-300')}>
                  {on && <Check className="h-3 w-3" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/70">
          <span className="text-[11px] text-slate-500">{selectedIds.length} dari {therapists.length} dipilih</span>
          <Button size="sm" className="h-7 text-xs bg-clinara-navy hover:bg-clinara-blue" onClick={() => setPickerOpen(false)}>Selesai</Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-app-lg border border-slate-100 shadow-sm p-3 sm:p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => onDateChange(addDays(date, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 md:flex-none min-w-[170px] text-center px-3 py-1.5 rounded-app-sm bg-slate-50 border border-slate-200">
              <p className="text-sm font-bold text-slate-800 leading-tight">{rangeLabel}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Jadwal mingguan</p>
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => onDateChange(addDays(date, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="h-9 text-xs hidden sm:inline-flex" onClick={() => onDateChange(new Date())}>
              Minggu ini
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {totalFree} slot kosong
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> {totalBooked} terjadwal
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {picker}
          {multi && (
            <div className="flex flex-wrap gap-1.5">
              {selectedTherapists.map(({ t, color }) => (
                <span key={t.id} className={cn('inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full', color.tag)}>
                  <span className={cn('h-2 w-2 rounded-full', color.dot)} /> {shortName(t.name)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col justify-center items-center h-64 gap-3">
          <Loader2 className="w-9 h-9 animate-spin text-app-accent" />
          <p className="text-slate-500 text-sm">Memuat jadwal mingguan...</p>
        </div>
      ) : selectedIds.length === 0 ? (
        <div className="text-center text-slate-500 py-16">Belum ada terapis aktif</div>
      ) : (
        <>
          {/* Desktop / tablet landscape */}
          <div className="hidden lg:block bg-white rounded-app-lg border border-slate-100 shadow-sm overflow-hidden">
            <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] bg-gradient-to-b from-clinara-navy to-[#173f6b] text-white">
              <div className="flex items-center justify-center text-sky-200/70"><Clock className="h-4 w-4" /></div>
              {days.map((d) => {
                const k = toKey(d);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => onOpenDay(d)}
                    className="py-3 px-2 text-center border-l first:border-l-0 border-white/10 hover:bg-white/5 transition-colors"
                    title="Buka tampilan harian"
                  >
                    <p className="text-[10px] uppercase tracking-widest text-sky-200/70">{format(d, 'EEE', { locale: idLocale })}</p>
                    <p className={cn('mx-auto mt-0.5 h-8 w-8 rounded-full flex items-center justify-center text-base font-bold', isSameDay(d, today) && 'bg-clinara-teal text-clinara-navy')}>
                      {format(d, 'd')}
                    </p>
                    <p className="text-[10px] mt-0.5 text-sky-200/70">
                      {offDays[k] ? offDays[k] : `${replacedDays[k] ? 'pengganti izin · ' : ''}${freeCount(k)} kosong · ${bookedCount(k)} isi`}
                    </p>
                  </button>
                );
              })}
            </div>

            {totalFree + totalBooked === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">Tidak ada jadwal minggu ini</div>
            ) : (
              <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] max-h-[70vh] overflow-y-auto">
                <div className="bg-slate-50/60">
                  {timeRows.map((t) => (
                    <div
                      key={t}
                      style={{ height: ROW_H }}
                      className="pt-2 text-center text-xs font-mono font-semibold text-slate-500 border-b border-slate-100"
                    >
                      {t}
                    </div>
                  ))}
                </div>
                {days.map((d) => {
                  const k = toKey(d);
                  const { placed = [], lanes = 1 } = layoutByDay[k] || {};
                  return (
                    <div
                      key={k}
                      style={{
                        display: 'grid',
                        gridTemplateRows: `repeat(${timeRows.length}, ${ROW_H}px)`,
                        gridTemplateColumns: `repeat(${lanes}, minmax(0, 1fr))`,
                        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW_H - 1}px, #f1f5f9 ${ROW_H - 1}px, #f1f5f9 ${ROW_H}px)`,
                      }}
                      className={cn(
                        'p-0 border-l border-slate-100 gap-x-1 px-1',
                        isSameDay(d, today) && 'bg-emerald-50/30',
                        offDays[k] && 'bg-slate-50 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(148,163,184,0.12)_6px,rgba(148,163,184,0.12)_12px)]'
                      )}
                    >
                      {placed.map(({ it, startIdx, span, lane }) => (
                        <div
                          key={`${it.kind}-${it.data.id || it.time}-${it.therapistId}`}
                          style={{ gridRow: `${startIdx + 1} / span ${span}`, gridColumn: lane + 1 }}
                          className="py-1 min-w-0"
                        >
                          {renderItem(it, d, false, true)}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mobile / tablet portrait */}
          <div className="lg:hidden space-y-3">
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((d) => {
                const k = toKey(d);
                const active = k === selectedDay;
                const free = freeCount(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSelectedDay(k)}
                    className={cn(
                      'flex flex-col items-center py-2 rounded-app-lg border transition-[color,background-color,border-color,box-shadow,transform,opacity]',
                      active ? 'bg-clinara-navy text-white border-clinara-navy shadow-lg scale-[1.03]' : 'bg-white border-slate-200 text-slate-600'
                    )}
                  >
                    <span className="text-[10px] uppercase tracking-wider opacity-70">{format(d, 'EEE', { locale: idLocale })}</span>
                    <span className={cn('text-base font-bold leading-tight', isSameDay(d, today) && !active && 'text-emerald-600')}>{format(d, 'd')}</span>
                    <span className={cn(
                      'mt-0.5 text-[9px] font-bold px-1.5 rounded-full',
                      offDays[k] ? 'bg-slate-200 text-slate-500'
                        : free > 0 ? (active ? 'bg-clinara-teal text-clinara-navy' : 'bg-emerald-100 text-emerald-700')
                        : 'opacity-40'
                    )}>
                      {offDays[k] ? 'off' : free}
                    </span>
                  </button>
                );
              })}
            </div>

            {(() => {
              const dayDate = days.find((d) => toKey(d) === selectedDay) || days[0];
              const k = toKey(dayDate);
              const times = [...new Set((itemsByDay[k] || []).map((i) => i.time))].sort();
              return (
                <div className="bg-white rounded-app-lg border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gradient-to-r from-clinara-navy to-clinara-blue text-white flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">{format(dayDate, 'EEEE, d MMMM yyyy', { locale: idLocale })}</p>
                      <p className="text-[11px] text-sky-200/80">{freeCount(k)} slot kosong · {bookedCount(k)} terjadwal</p>
                    </div>
                    <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => onOpenDay(dayDate)}>Harian</Button>
                  </div>
                  {offDays[k] ? (
                    <div className="py-12 flex flex-col items-center gap-2 text-slate-500">
                      <CalendarOff className="h-8 w-8" />
                      <p className="text-sm font-medium">{shortName(selectedTherapists[0]?.t.name)} — {offDays[k]}</p>
                    </div>
                  ) : times.length === 0 ? (
                    <div className="py-12 flex flex-col items-center gap-2 text-slate-500">
                      <Sparkles className="h-8 w-8" />
                      <p className="text-sm">Tidak ada jadwal di hari ini</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {times.map((time) => (
                        <div key={time} className="flex gap-3 p-3">
                          <span className="w-11 shrink-0 pt-2 text-xs font-mono font-semibold text-slate-500">{time}</span>
                          <div className="flex-1 space-y-2">
                            {cellItems(k, time).map((it) => renderItem(it, dayDate, true))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
};

export default WeeklyScheduleView;
