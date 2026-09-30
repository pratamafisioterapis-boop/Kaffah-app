import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Plus, Clock, CalendarOff, Sparkles } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { getAvailableSlots, getAppointments } from '@/lib/api';
import { formatTimeIndonesia, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const toKey = (d) => format(d, 'yyyy-MM-dd');
const hhmm = (t) => (t || '00:00').slice(0, 5);
const addMinutes = (t, mins) => {
  const [h, m] = hhmm(t).split(':').map(Number);
  const total = h * 60 + m + (mins || 60);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/**
 * Tampilan jadwal seminggu untuk satu terapis: slot kosong & pasien terjadwal
 * per hari/jam. Klik slot kosong langsung membuka form booking.
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
  const [therapistId, setTherapistId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slotsByDay, setSlotsByDay] = useState({});
  const [appsByDay, setAppsByDay] = useState({});
  const [offDays, setOffDays] = useState({});
  const [selectedDay, setSelectedDay] = useState(toKey(date));

  const weekStart = useMemo(() => startOfWeek(date, { weekStartsOn: 1 }), [date]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = new Date();

  const sortedTherapists = useMemo(() => [...therapists], [therapists]);
  const activeId = therapistId || sortedTherapists[0]?.id || null;
  const activeTherapist = sortedTherapists.find((t) => t.id === activeId);

  // Jaga hari terpilih (tampilan mobile) tetap berada dalam minggu yang tampil.
  useEffect(() => {
    if (!days.some((d) => toKey(d) === selectedDay)) {
      setSelectedDay(days.some((d) => isSameDay(d, today)) ? toKey(today) : toKey(days[0]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const fetchWeek = useCallback(async () => {
    if (!activeId) return;
    const startStr = toKey(days[0]);
    const endStr = toKey(days[6]);
    try {
      const [slotResults, appsRes, offRes] = await Promise.all([
        Promise.all(days.map((d) => getAvailableSlots(toKey(d), activeId))),
        getAppointments({
          therapistId: activeId,
          startDate: `${startStr}T00:00:00`,
          endDate: `${endStr}T23:59:59`,
        }),
        supabase
          .from('therapist_time_off')
          .select('start_date, end_date, reason')
          .eq('therapist_id', activeId)
          .lte('start_date', endStr)
          .gte('end_date', startStr),
      ]);

      const slotMap = {};
      days.forEach((d, i) => {
        const rows = slotResults[i]?.data || [];
        slotMap[toKey(d)] = rows
          .filter((s) => s.therapist_id === activeId && s.status === 'aktif')
          .map((s) => ({
            id: s.id,
            therapist_id: activeId,
            slot_start_time: s.slot_start,
            slot_end_time: s.slot_end,
            duration_minutes: s.duration_minutes || 60,
            status: s.status,
          }))
          .sort((a, b) => hhmm(a.slot_start_time).localeCompare(hhmm(b.slot_start_time)));
      });

      const appMap = {};
      (appsRes?.data || []).forEach((a) => {
        if (!a.appointment_date || a.status?.toLowerCase() === 'cancelled') return;
        const key = new Date(a.appointment_date).toLocaleDateString('sv-SE');
        (appMap[key] = appMap[key] || []).push({ ...a, is_new_patient: !a.patient_id });
      });
      Object.values(appMap).forEach((list) =>
        list.sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date))
      );

      const off = {};
      (offRes?.data || []).forEach((row) => {
        days.forEach((d) => {
          const k = toKey(d);
          if (k >= row.start_date && k <= row.end_date) {
            off[k] = (row.reason || 'Cuti').split(' - ')[0].trim() || 'Cuti';
          }
        });
      });

      setSlotsByDay(slotMap);
      setAppsByDay(appMap);
      setOffDays(off);
    } catch (e) {
      console.error('[WeeklyScheduleView] fetchWeek error:', e);
    } finally {
      setLoading(false);
    }
  }, [activeId, days]);

  useEffect(() => {
    setLoading(true);
    fetchWeek();
  }, [fetchWeek, refreshKey]);

  useEffect(() => {
    const channel = supabase
      .channel(`weekly-appointments-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, fetchWeek)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchWeek]);

  // Baris jam: dari jam paling awal sampai paling akhir yang punya isi.
  const hours = useMemo(() => {
    let min = 24;
    let max = -1;
    Object.values(slotsByDay).forEach((list) =>
      list.forEach((s) => {
        const h = parseInt(hhmm(s.slot_start_time).slice(0, 2), 10);
        min = Math.min(min, h);
        max = Math.max(max, h);
      })
    );
    Object.values(appsByDay).forEach((list) =>
      list.forEach((a) => {
        const h = parseInt(formatTimeIndonesia(a.appointment_date).slice(0, 2), 10);
        min = Math.min(min, h);
        max = Math.max(max, h);
      })
    );
    if (max < 0) return [];
    min = Math.min(min, 8);
    max = Math.max(max, 17);
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [slotsByDay, appsByDay]);

  const itemsFor = (dayKey, hour) => {
    const inHour = (t) => parseInt(hhmm(t).slice(0, 2), 10) === hour;
    const apps = (appsByDay[dayKey] || [])
      .filter((a) => inHour(formatTimeIndonesia(a.appointment_date)))
      .map((a) => ({ kind: 'app', time: formatTimeIndonesia(a.appointment_date), data: a }));
    const slots = (slotsByDay[dayKey] || [])
      .filter((s) => inHour(s.slot_start_time))
      .map((s) => ({ kind: 'slot', time: hhmm(s.slot_start_time), data: s }));
    return [...apps, ...slots].sort((a, b) => a.time.localeCompare(b.time));
  };

  const freeCount = (dayKey) => (slotsByDay[dayKey] || []).length;
  const bookedCount = (dayKey) => (appsByDay[dayKey] || []).length;
  const totalFree = days.reduce((n, d) => n + freeCount(toKey(d)), 0);
  const totalBooked = days.reduce((n, d) => n + bookedCount(toKey(d)), 0);

  const renderItem = (item, dayKey, dayDate, compact = false) => {
    if (item.kind === 'app') {
      const a = item.data;
      const name = a.patient?.full_name || a.guest_name || 'Tanpa Nama';
      return (
        <button
          key={`a-${a.id}`}
          type="button"
          onClick={() => onAppointmentClick(a)}
          className={cn(
            'group w-full text-left rounded-xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 to-white',
            'px-2.5 py-1.5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all',
            'border-l-4 border-l-indigo-500'
          )}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-mono font-bold text-indigo-600">{item.time}</span>
            {a.is_new_patient && (
              <span className="text-[8px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 px-1.5 rounded-full">
                Baru
              </span>
            )}
          </div>
          <p className={cn('font-semibold text-slate-800 leading-tight truncate', compact ? 'text-sm' : 'text-xs')}>
            {name}
          </p>
        </button>
      );
    }
    const s = item.data;
    return (
      <button
        key={`s-${s.id || item.time}`}
        type="button"
        onClick={() => onSlotClick(s, activeTherapist, dayDate)}
        className={cn(
          'group w-full flex items-center justify-between gap-1 rounded-xl px-2.5 py-1.5',
          'border border-dashed border-emerald-300 bg-emerald-50/60 text-emerald-700',
          'hover:bg-emerald-500 hover:text-white hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/25',
          'active:scale-[0.98] transition-all duration-200'
        )}
        title="Klik untuk tambah pasien di slot ini"
      >
        <span className={cn('font-mono font-bold', compact ? 'text-sm' : 'text-[11px]')}>
          {item.time}
          <span className="font-normal opacity-70"> – {hhmm(s.slot_end_time) || addMinutes(s.slot_start_time, s.duration_minutes)}</span>
        </span>
        <span className="h-5 w-5 rounded-full bg-emerald-500 text-white group-hover:bg-white group-hover:text-emerald-600 flex items-center justify-center shrink-0 transition-colors">
          <Plus className="h-3 w-3" />
        </span>
      </button>
    );
  };

  const rangeLabel = `${format(days[0], 'd MMM', { locale: idLocale })} – ${format(days[6], 'd MMM yyyy', { locale: idLocale })}`;

  return (
    <div className="space-y-4">
      {/* Kontrol: terapis + navigasi minggu */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 sm:p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => onDateChange(addDays(date, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 md:flex-none min-w-[170px] text-center px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-sm font-bold text-slate-800 leading-tight">{rangeLabel}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Jadwal mingguan</p>
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

        {/* Pemilih terapis */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
          {sortedTherapists.map((t) => {
            const active = t.id === activeId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTherapistId(t.id)}
                className={cn(
                  'snap-start shrink-0 flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full border text-sm font-medium transition-all',
                  active
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                {t.photo_url || t.avatar_url ? (
                  <img src={t.photo_url || t.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className={cn('h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold', active ? 'bg-white/20' : 'bg-slate-100 text-slate-500')}>
                    {initials(t.name)}
                  </span>
                )}
                <span className="whitespace-nowrap max-w-[160px] truncate">{t.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col justify-center items-center h-64 gap-3">
          <Loader2 className="w-9 h-9 animate-spin text-blue-600" />
          <p className="text-slate-400 text-sm">Memuat jadwal mingguan...</p>
        </div>
      ) : !activeTherapist ? (
        <div className="text-center text-slate-400 py-16">Belum ada terapis aktif</div>
      ) : (
        <>
          {/* ===== Desktop / tablet landscape: grid 7 hari ===== */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] bg-gradient-to-b from-slate-900 to-slate-800 text-white">
              <div className="flex items-center justify-center text-slate-400">
                <Clock className="h-4 w-4" />
              </div>
              {days.map((d) => {
                const k = toKey(d);
                const isToday = isSameDay(d, today);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => onOpenDay(d)}
                    className="py-3 px-2 text-center border-l border-white/10 hover:bg-white/5 transition-colors"
                    title="Buka tampilan harian"
                  >
                    <p className="text-[10px] uppercase tracking-widest text-slate-400">
                      {format(d, 'EEE', { locale: idLocale })}
                    </p>
                    <p className={cn(
                      'mx-auto mt-0.5 h-8 w-8 rounded-full flex items-center justify-center text-base font-bold',
                      isToday ? 'bg-emerald-400 text-slate-900' : ''
                    )}>
                      {format(d, 'd')}
                    </p>
                    <p className="text-[10px] mt-0.5 text-slate-400">
                      {offDays[k] ? offDays[k] : `${freeCount(k)} kosong · ${bookedCount(k)} isi`}
                    </p>
                  </button>
                );
              })}
            </div>

            {hours.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">Tidak ada jadwal minggu ini</div>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto">
                {hours.map((h) => (
                  <div key={h} className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-t border-slate-100">
                    <div className="py-2 text-center text-xs font-mono font-semibold text-slate-400 bg-slate-50/60">
                      {String(h).padStart(2, '0')}:00
                    </div>
                    {days.map((d) => {
                      const k = toKey(d);
                      const items = itemsFor(k, h);
                      return (
                        <div
                          key={k}
                          className={cn(
                            'min-h-[56px] p-1.5 border-l border-slate-100 space-y-1.5',
                            isSameDay(d, today) && 'bg-emerald-50/30',
                            offDays[k] && 'bg-slate-50 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(148,163,184,0.12)_6px,rgba(148,163,184,0.12)_12px)]'
                          )}
                        >
                          {items.map((it) => renderItem(it, k, d))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ===== Mobile / tablet portrait: pilih hari + daftar jam ===== */}
          <div className="lg:hidden space-y-3">
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((d) => {
                const k = toKey(d);
                const active = k === selectedDay;
                const isToday = isSameDay(d, today);
                const free = freeCount(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSelectedDay(k)}
                    className={cn(
                      'flex flex-col items-center py-2 rounded-2xl border transition-all',
                      active
                        ? 'bg-slate-900 text-white border-slate-900 shadow-lg scale-[1.03]'
                        : 'bg-white border-slate-200 text-slate-600'
                    )}
                  >
                    <span className="text-[10px] uppercase tracking-wider opacity-70">
                      {format(d, 'EEE', { locale: idLocale })}
                    </span>
                    <span className={cn('text-base font-bold leading-tight', isToday && !active && 'text-emerald-600')}>
                      {format(d, 'd')}
                    </span>
                    <span className={cn(
                      'mt-0.5 text-[9px] font-bold px-1.5 rounded-full',
                      offDays[k] ? 'bg-slate-200 text-slate-500'
                        : free > 0 ? (active ? 'bg-emerald-400 text-slate-900' : 'bg-emerald-100 text-emerald-700')
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
              const rows = hours
                .map((h) => ({ h, items: itemsFor(k, h) }))
                .filter((r) => r.items.length > 0);
              return (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">{format(dayDate, 'EEEE, d MMMM yyyy', { locale: idLocale })}</p>
                      <p className="text-[11px] text-slate-400">{freeCount(k)} slot kosong · {bookedCount(k)} terjadwal</p>
                    </div>
                    <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => onOpenDay(dayDate)}>
                      Harian
                    </Button>
                  </div>
                  {offDays[k] ? (
                    <div className="py-12 flex flex-col items-center gap-2 text-slate-400">
                      <CalendarOff className="h-8 w-8" />
                      <p className="text-sm font-medium">{activeTherapist.name} — {offDays[k]}</p>
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="py-12 flex flex-col items-center gap-2 text-slate-400">
                      <Sparkles className="h-8 w-8" />
                      <p className="text-sm">Tidak ada jadwal di hari ini</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {rows.map(({ h, items }) => (
                        <div key={h} className="flex gap-3 p-3">
                          <span className="w-11 shrink-0 pt-2 text-xs font-mono font-semibold text-slate-400">
                            {String(h).padStart(2, '0')}:00
                          </span>
                          <div className="flex-1 space-y-2">
                            {items.map((it) => renderItem(it, k, dayDate, true))}
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
