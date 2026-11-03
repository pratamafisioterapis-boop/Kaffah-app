import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { addDays, format, startOfDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ArrowRight, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getAvailableSlots } from '@/lib/api';

const dayKey = (d) => format(d, 'yyyy-MM-dd');
const parseDayKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addMinutesToTime = (hhmm, minutes) => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + (minutes || 0);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/* ---------- Kartu yang mengikuti kursor ---------- */
export const DragGhost = ({ app, therapistName, setNode }) => {
  if (!app) return null;
  const name = app.patient?.full_name || app.guest_name || 'Tanpa Nama';
  return createPortal(
    <div
      ref={setNode}
      className="fixed left-0 top-0 z-[100] w-[300px] max-w-[calc(100vw-32px)] pointer-events-none will-change-transform"
    >
      <div className="flex items-center gap-3 rounded-app border-2 border-app-accent bg-white p-3 shadow-2xl">
        <div className="shrink-0 rounded-app-sm border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-sm font-semibold text-slate-800">
          {format(new Date(app.appointment_date), 'HH.mm')}
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-800">{name}</p>
          <p className="truncate text-xs text-slate-500">
            {therapistName} · {format(new Date(app.appointment_date), 'EEE, d MMM', { locale: idLocale })}
          </p>
        </div>
      </div>
      <span
        data-ghost-tip
        data-ok="false"
        className="ml-1.5 mt-2 inline-block rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white shadow data-[ok=true]:bg-emerald-600"
      >
        Lepas di slot hijau atau di sebuah hari
      </span>
    </div>,
    document.body
  );
};

/* ---------- Strip 2 minggu (target drop per hari) ---------- */
export const DayDropStrip = ({ originDate, viewDate }) => {
  const today = startOfDay(new Date());
  const origin = startOfDay(new Date(originDate));
  const anchor = origin < today ? today : origin;
  const monday = addDays(anchor, -((anchor.getDay() + 6) % 7));
  const days = Array.from({ length: 14 }, (_, i) => addDays(monday, i));
  const viewKey = dayKey(viewDate);
  const originKey = dayKey(origin);

  return (
    <div className="rounded-app border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-slate-500">
        <span>Lepaskan kartu di sebuah hari untuk memilih jam</span>
        <span className="shrink-0">
          {format(days[0], 'd MMM', { locale: idLocale })} – {format(days[13], 'd MMM', { locale: idLocale })}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const k = dayKey(d);
          const past = d < today;
          const dropProps = past ? {} : { 'data-drop-day': k };
          return (
            <div
              key={k}
              {...dropProps}
              className={cn(
                'flex flex-col items-center rounded-app-sm border px-1 py-1.5 transition-[box-shadow,background-color,border-color,transform]',
                past && 'opacity-40',
                !past && 'bg-slate-50 border-slate-200',
                k === viewKey && !past && 'bg-app-soft border-app-accent',
                'data-[drop-over=true]:border-app-accent data-[drop-over=true]:ring-2 data-[drop-over=true]:ring-app-accent data-[drop-over=true]:bg-app-soft data-[drop-over=true]:scale-105'
              )}
            >
              <span className="text-[11px] font-semibold uppercase text-slate-500">
                {format(d, 'EEE', { locale: idLocale })}
              </span>
              <span className="text-base font-bold leading-tight text-slate-800">
                {d.getDate()}
                {k === originKey && (
                  <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ---------- Dialog konfirmasi ---------- */
export const RescheduleConfirmDialog = ({ pending, therapists, saving, onConfirm, onCancel }) => {
  const app = pending?.app;
  const to = pending?.to;
  const open = !!pending;
  const dur = app?.duration_minutes || 60;

  let body = null;
  if (app && to) {
    const fromDate = new Date(app.appointment_date);
    const toDate = parseDayKey(to.dateKey);
    const fromTime = format(fromDate, 'HH:mm');
    const fromTherapist = app.therapist?.name || therapists.find((t) => t.id === app.therapist_id)?.name || '-';
    const toTherapist = therapists.find((t) => t.id === to.therapistId)?.name || '-';
    const changedDay = dayKey(fromDate) !== to.dateKey;
    const changedTherapist = app.therapist_id !== to.therapistId;
    const changedTime = fromTime !== to.time;
    const chips = [
      changedDay && 'Hari berubah',
      changedTherapist && 'Terapis berubah',
      changedTime && 'Jam berubah',
      'Status menjadi rescheduled'
    ].filter(Boolean);

    body = (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-800">
            {app.patient?.full_name || app.guest_name || 'Tanpa Nama'}
          </span>{' '}
          · {dur} menit
        </p>

        <div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr]">
          <div className="flex flex-col gap-0.5 rounded-app border border-slate-200 bg-slate-50 p-3 text-sm min-w-0">
            <small className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Dari</small>
            <b className="font-semibold">{format(fromDate, 'EEE, d MMM', { locale: idLocale })}</b>
            <span>{fromTime} - {addMinutesToTime(fromTime, dur)}</span>
            <span className="break-words">{fromTherapist}</span>
          </div>
          <ArrowRight className="mx-auto h-5 w-5 shrink-0 self-center rotate-90 text-slate-400 sm:rotate-0" />
          <div className="flex flex-col gap-0.5 rounded-app border border-app-accent bg-app-soft p-3 text-sm min-w-0">
            <small className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ke</small>
            <b className={cn('font-semibold', changedDay && 'text-app-accent')}>
              {format(toDate, 'EEE, d MMM', { locale: idLocale })}
            </b>
            <span className={cn(changedTime && 'font-bold text-app-accent')}>
              {to.time} - {addMinutesToTime(to.time, dur)}
            </span>
            <span className={cn('break-words', changedTherapist && 'font-bold text-app-accent')}>{toTherapist}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c} className="rounded-full bg-app-soft px-2.5 py-0.5 text-xs font-semibold text-app-accent">
              {c}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onCancel()}>
      <DialogContent className="w-[95vw] max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle>Pindahkan appointment?</DialogTitle>
          <DialogDescription>Periksa jadwal baru sebelum disimpan.</DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onCancel} disabled={saving}>Batal</Button>
          <Button onClick={onConfirm} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Pindahkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ---------- Pilih jam setelah kartu dilepas di sebuah hari ---------- */
export const RescheduleSlotPickerDialog = ({ picker, therapists, onPick, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [slotsByTherapist, setSlotsByTherapist] = useState({});
  const dateKey = picker?.dateKey;

  useEffect(() => {
    if (!dateKey) return undefined;
    let cancelled = false;
    setLoading(true);
    setSlotsByTherapist({});
    (async () => {
      const { data } = await getAvailableSlots(dateKey);
      if (cancelled) return;
      const map = {};
      (Array.isArray(data) ? data : []).forEach((s) => {
        if (s.status !== 'aktif' || !s.therapist_id) return;
        (map[s.therapist_id] = map[s.therapist_id] || []).push(String(s.slot_start).slice(0, 5));
      });
      Object.values(map).forEach((arr) => arr.sort());
      setSlotsByTherapist(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dateKey]);

  const app = picker?.app;

  return (
    <Dialog open={!!picker} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-lg bg-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Pilih jam · {dateKey ? format(parseDayKey(dateKey), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : ''}
          </DialogTitle>
          <DialogDescription>
            Memindahkan {app?.patient?.full_name || app?.guest_name || 'appointment'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-app-accent" />
            Memuat slot kosong...
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {therapists.map((t) => {
              const slots = slotsByTherapist[t.id] || [];
              return (
                <div key={t.id} className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[150px_1fr] sm:items-center">
                  <p className="text-sm font-semibold text-slate-800 break-words">{t.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {slots.length ? (
                      slots.map((time) => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => onPick(app, { dateKey, therapistId: t.id, time })}
                          className="rounded-app-sm bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white tabular-nums transition-colors hover:bg-emerald-600"
                        >
                          {time}
                        </button>
                      ))
                    ) : (
                      <span className="text-sm italic text-slate-500">Tidak ada slot kosong</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
