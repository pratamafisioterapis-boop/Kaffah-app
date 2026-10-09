import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, addMonths, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarOff, Send, Loader2, Paperclip, Repeat, Plus, X, AlertTriangle, CheckCircle2, Sun, Clock3, Trash2, Info, Crown, CalendarClock, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import {
  getLeaveRequests, submitLeaveRequest, cancelLeaveRequest, getTherapistSchedules, getTherapistTimeOff,
  getTherapistAnnualLeaveBalance,
} from '@/lib/api';
import {
  LEAVE_TYPES, leaveTypeLabel, hhmm, timeToMinutes, formatDuration, formatLongDate, totalShiftMinutes, shiftMinutes, attendanceImpactNote,
  isWeekendDate, isSundayDate, WEEKEND_REPLACEMENT_NOTE, isReplacementOptionalType, SUNDAY_RULE_NOTE, WORK_SHIFT_PRESETS, clinicHoursOn,
} from '@/lib/leaveRequestUtils';
import LeaveRequestCard from '@/components/shared/LeaveRequestCard';
import LeaveRequestReview from '@/components/shared/LeaveRequestReview';
import ShiftSwapReview from '@/components/shared/ShiftSwapReview';
import TherapistShiftSwap from '@/components/therapist/TherapistShiftSwap';
import TherapistSundaySwap from '@/components/therapist/TherapistSundaySwap';
import SundaySwapReview from '@/components/shared/SundaySwapReview';
import { usePendingLeaveRequestCount } from '@/hooks/useTherapistLeaveRequests';

const DAY_KEY = 'yyyy-MM-dd';
// Izin yang sudah lewat masih boleh dicatat (mundur), jadwal pengganti dipilih per bulan ke depan.
const MAX_BACKDATE_DAYS = 60;
const MAX_MONTHS_AHEAD = 1;
// Batas jam kerja per hari: hari pengganti yang jam kerjanya belum 8 jam bisa diisi sisa utang jam.
const DAY_TARGET_MINUTES = 8 * 60;
// Jadwal pengganti dan jam izin bebas di jam berapa pun selama masih dalam jam buka klinik hari itu
// (lihat clinicHoursOn). Jam shift terapis tidak membatasinya.

const minutesToTime = (min) => {
  const m = Math.min(Math.max(0, min), 23 * 60 + 59);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const emptyForm = () => ({
  leaveDate: '', partial: false, startTime: '09:00', endTime: '12:00', leaveType: 'personal', notes: '', shifts: [], proofFile: null,
});

const PROOF_MAX_BYTES = 5 * 1024 * 1024;
const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const LeaveForm = ({ therapist, schedules, blockedDates, offDates, requests, onSubmitted }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [proofInputKey, setProofInputKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const todayStr = format(new Date(), DAY_KEY);

  // Terapis tahun pertama belum berhak Cuti (annual); opsi dinonaktifkan.
  const [firstYear, setFirstYear] = useState(false);
  useEffect(() => {
    let active = true;
    getTherapistAnnualLeaveBalance(therapist.id).then(({ data }) => {
      if (!active) return;
      const isFirst = !!data?.isFirstYear;
      setFirstYear(isFirst);
      if (isFirst) setForm((f) => (f.leaveType === 'annual' ? { ...f, leaveType: 'personal' } : f));
    });
    return () => { active = false; };
  }, [therapist.id]);

  const schedulesByDow = useMemo(() => {
    const map = {};
    schedules.forEach((s) => {
      (map[s.day_of_week] = map[s.day_of_week] || []).push(s);
    });
    return map;
  }, [schedules]);

  // Sama dengan habitual_slot_minutes di database: durasi baris jadwal mingguan yang paling sering.
  const slotMinutes = useMemo(() => {
    const counts = {};
    schedules.forEach((s) => {
      const m = timeToMinutes(s.end_time) - timeToMinutes(s.start_time);
      if (m >= 5 && m <= 180) counts[m] = (counts[m] || 0) + 1;
    });
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    return best ? Number(best[0]) : 60;
  }, [schedules]);

  // Hari libur mingguan dicatat sebagai cuti bertipe 'weekly_off' (jadwal mingguan tetap
  // aktif di semua hari), jadi tanggal itu dianggap tidak ada jadwal kerja.
  const scheduleOn = useCallback(
    (dateStr) => (offDates.has(dateStr) ? [] : schedulesByDow[parseISO(dateStr).getDay()] || []),
    [schedulesByDow, offDates],
  );
  // Jam kerja shift terapis (mis. Pagi 09:00–17:00). Terpisah dari slot booking; kalau belum
  // diatur, pakai baris jadwal mingguan seperti sebelumnya.
  const workShift = therapist.work_start_time && therapist.work_end_time
    ? { name: therapist.work_shift_name, start_time: hhmm(therapist.work_start_time), end_time: hhmm(therapist.work_end_time) }
    : null;
  const hoursOn = useCallback(
    (dateStr) => {
      const sched = scheduleOn(dateStr);
      if (sched.length === 0 || !workShift) return sched;
      // Terapis bisa punya dua shift (mis. Senin–Jumat Siang, Sabtu/Minggu Pagi). Shift hari itu dibaca dari
      // baris jadwal mingguannya: pakai shift terapis bila baris jadwal masuk di dalamnya, kalau tidak pakai
      // preset shift yang memuatnya, dan terakhir rentang baris jadwal itu sendiri.
      const rowStart = Math.min(...sched.map((s) => timeToMinutes(s.start_time)));
      const rowEnd = Math.max(...sched.map((s) => timeToMinutes(s.end_time)));
      const fits = (sh) => rowStart >= timeToMinutes(sh.start_time) && rowEnd <= timeToMinutes(sh.end_time);
      const match = [workShift, ...WORK_SHIFT_PRESETS.map((p) => ({ start_time: p.start, end_time: p.end }))].find(fits);
      return match ? [{ start_time: match.start_time, end_time: match.end_time }] : [{ start_time: minutesToTime(rowStart), end_time: minutesToTime(rowEnd) }];
    },
    [scheduleOn, workShift?.start_time, workShift?.end_time], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const scheduleLabel = (list) => (list.length
    ? list.map((s) => `${hhmm(s.start_time)}–${hhmm(s.end_time)}`).join(', ')
    : '');

  // Jam pengganti yang sudah diajukan (pending / disetujui) per tanggal. Pengajuan ditolak atau
  // dibatalkan (status 'rejected') tidak dihitung, karena jamnya sudah dikembalikan.
  const takenByDate = useMemo(() => {
    const map = new Map();
    (requests || []).filter((r) => r.status !== 'rejected').forEach((r) => {
      (r.replacement_shifts || []).forEach((sh) => {
        const list = map.get(sh.date) || [];
        list.push({ start: timeToMinutes(sh.start_time), end: timeToMinutes(sh.end_time) });
        map.set(sh.date, list);
      });
    });
    return map;
  }, [requests]);

  // Rentang jam yang masih kosong di satu tanggal: jam buka klinik dikurangi jam kerja normal dan
  // jam pengganti yang sudah terisi. Bentuk: [{ start, end }] dalam menit.
  const openHoursOn = useCallback((dateStr) => clinicHoursOn(therapist.clinic_id, parseISO(dateStr).getDay()), [therapist.clinic_id]);
  const openLabelOn = (dateStr) => { const h = openHoursOn(dateStr); return `${minutesToTime(h.open)}–${minutesToTime(h.close)}`; };

  const freeWindowsOn = useCallback((dateStr) => {
    const { open, close } = openHoursOn(dateStr);
    const busy = [
      ...hoursOn(dateStr).map((s) => ({ start: timeToMinutes(s.start_time), end: timeToMinutes(s.end_time) })),
      ...(takenByDate.get(dateStr) || []),
    ].sort((a, b) => a.start - b.start);
    const windows = [];
    let cursor = open;
    busy.forEach((b) => {
      if (b.start > cursor) windows.push({ start: cursor, end: Math.min(b.start, close) });
      cursor = Math.max(cursor, b.end);
    });
    if (cursor < close) windows.push({ start: cursor, end: close });
    return windows.filter((w) => w.end > w.start);
  }, [hoursOn, takenByDate, openHoursOn]);
  const windowsLabel = (windows) => windows.map((w) => `${minutesToTime(w.start)}–${minutesToTime(w.end)}`).join(', ');

  const normalMinutes = form.leaveDate
    ? hoursOn(form.leaveDate).reduce((sum, s) => sum + (timeToMinutes(s.end_time) - timeToMinutes(s.start_time)), 0)
    : 0;
  const leaveDayHours = form.leaveDate ? hoursOn(form.leaveDate) : [];
  const missedMinutes = form.partial
    ? Math.max(0, timeToMinutes(form.endTime) - timeToMinutes(form.startTime))
    : normalMinutes;
  const replacedMinutes = totalShiftMinutes(form.shifts);

  // Kalender jadwal pengganti per bulan: mulai bulan ini, bisa maju ke bulan berikutnya bila
  // jam di bulan ini belum cukup. Hari yang sudah lewat tidak bisa dipilih.
  const [monthOffset, setMonthOffset] = useState(0);
  const viewMonth = useMemo(() => startOfMonth(addMonths(new Date(), monthOffset)), [monthOffset]);
  const candidates = useMemo(() => {
    const last = endOfMonth(viewMonth).getDate();
    return Array.from({ length: last }, (_, i) => addDays(viewMonth, i)).map((d) => {
      const key = format(d, DAY_KEY);
      return { date: d, key, sched: hoursOn(key), past: key < todayStr, free: freeWindowsOn(key), taken: takenByDate.get(key) || [] };
    });
  }, [hoursOn, freeWindowsOn, takenByDate, viewMonth, todayStr]);

  // Pilih tanggal izin: jam izin sebagian diisi otomatis dari jam kerja shift hari itu
  // (3 jam pertama), supaya terapis tinggal menyesuaikan.
  const handleLeaveDateChange = (value) => {
    setForm((f) => {
      const sundayOnly = isWeekendDate(value);
      const next = {
        ...f,
        leaveDate: value,
        shifts: f.shifts.filter((s) => s.date !== value && (!sundayOnly || isSundayDate(s.date))),
      };
      const hours = value ? hoursOn(value) : [];
      if (hours.length) {
        const start = Math.min(...hours.map((s) => timeToMinutes(s.start_time)));
        const end = Math.max(...hours.map((s) => timeToMinutes(s.end_time)));
        next.startTime = minutesToTime(start);
        next.endTime = minutesToTime(Math.min(start + 3 * 60, end));
      }
      return next;
    });
  };

  const toggleShift = (day) => {
    setForm((f) => {
      if (f.shifts.some((s) => s.date === day.key)) {
        return { ...f, shifts: f.shifts.filter((s) => s.date !== day.key) };
      }
      // Default: mulai dari jam kosong pertama (dalam jam buka klinik) dengan panjang sebesar sisa utang jam,
      // dibatasi ruang kosong dan sisa ruang 8 jam hari itu.
      const normalOnDay = day.sched.reduce((sum, s) => sum + timeToMinutes(s.end_time) - timeToMinutes(s.start_time), 0);
      const dayRoom = Math.max(0, DAY_TARGET_MINUTES - normalOnDay);
      const win = day.free.find((w) => w.end - w.start >= slotMinutes) || day.free[0] || { start: openHoursOn(day.key).open, end: openHoursOn(day.key).close };
      const shiftLength = workShift ? timeToMinutes(workShift.end_time) - timeToMinutes(workShift.start_time) : 3 * 60;
      // Utang yang tersisa (jam izin dikurangi pengganti yang sudah dipilih).
      const debtLeft = missedMinutes - totalShiftMinutes(f.shifts);
      const wanted = missedMinutes > 0
        ? Math.max(Math.min(debtLeft > 0 ? debtLeft : missedMinutes, dayRoom || DAY_TARGET_MINUTES), slotMinutes)
        : shiftLength;
      const length = Math.min(wanted, win.end - win.start);
      return {
        ...f,
        shifts: [...f.shifts, { date: day.key, start_time: minutesToTime(win.start), end_time: minutesToTime(win.start + length) }],
      };
    });
  };

  const updateShift = (date, patch) =>
    setForm((f) => ({ ...f, shifts: f.shifts.map((s) => (s.date === date ? { ...s, ...patch } : s)) }));

  const shiftError = (shift) => {
    if (timeToMinutes(shift.end_time) <= timeToMinutes(shift.start_time)) return 'Jam selesai harus setelah jam mulai.';
    const overlap = hoursOn(shift.date).find((s) =>
      timeToMinutes(shift.start_time) < timeToMinutes(s.end_time) && timeToMinutes(shift.end_time) > timeToMinutes(s.start_time));
    if (overlap) return `Bentrok dengan jam kerja normal (${hhmm(overlap.start_time)}–${hhmm(overlap.end_time)}). Pilih jam di luar itu.`;
    const sStart = timeToMinutes(shift.start_time);
    const sEnd = timeToMinutes(shift.end_time);
    const oh = openHoursOn(shift.date);
    if (sStart < oh.open || sEnd > oh.close) {
      return `Jam pengganti harus di dalam jam buka klinik hari itu (${openLabelOn(shift.date)}).`;
    }
    const taken = (takenByDate.get(shift.date) || []).find((t) => sStart < t.end && sEnd > t.start);
    if (taken) {
      const free = freeWindowsOn(shift.date);
      return `Bentrok dengan jadwal pengganti Anda yang sudah diajukan (${minutesToTime(taken.start)}–${minutesToTime(taken.end)}).${free.length ? ` Jam yang masih kosong: ${windowsLabel(free)}.` : ' Tidak ada jam kosong di tanggal ini.'}`;
    }
    const normalOnDay = hoursOn(shift.date).reduce((sum, s) => sum + timeToMinutes(s.end_time) - timeToMinutes(s.start_time), 0);
    if (normalOnDay + shiftMinutes(shift) > DAY_TARGET_MINUTES) {
      const room = Math.max(0, DAY_TARGET_MINUTES - normalOnDay);
      return room > 0
        ? `Total jam kerja hari itu maksimal 8 jam. Jam normal ${formatDuration(normalOnDay)}, jadi pengganti maksimal ${formatDuration(room)}.`
        : 'Hari itu sudah 8 jam kerja normal. Pilih hari lain.';
    }
    return null;
  };

  const sortedShifts = [...form.shifts].sort((a, b) => a.date.localeCompare(b.date));
  const hasShiftError = sortedShifts.some((s) => shiftError(s));
  // Kegiatan organisasi / Event: jadwal pengganti tidak wajib (ditentukan peninjau); boleh diisi sukarela.
  const isOrg = form.leaveType === 'organization';
  const isEvent = form.leaveType === 'event';
  const replacementOptional = isReplacementOptionalType(form.leaveType);

  // Alasan tombol kirim belum aktif — ditampilkan agar terapis tahu apa yang kurang.
  const sundayOnly = isWeekendDate(form.leaveDate);

  const blocker = (() => {
    if (!form.leaveDate) return 'Pilih tanggal izin dulu.';
    if (offDates.has(form.leaveDate)) return 'Tanggal itu hari libur mingguan Anda, jadi tidak perlu mengajukan izin.';
    if (blockedDates.has(form.leaveDate)) return 'Anda sudah punya cuti / izin / pengajuan di tanggal ini.';
    if (form.partial && timeToMinutes(form.endTime) <= timeToMinutes(form.startTime)) return 'Jam selesai izin harus setelah jam mulai.';
    if (form.leaveType === 'sick' && !form.proofFile) return 'Izin sakit wajib melampirkan foto / PDF surat dokter.';
    if (isOrg && !form.notes.trim()) return 'Cantumkan nama kegiatan, penyelenggara, dan statusnya (penugasan klinik atau pribadi) pada kolom catatan.';
    if (isEvent && !form.notes.trim()) return 'Cantumkan nama event dan penyelenggaranya pada kolom catatan.';
    const leaveOpen = openHoursOn(form.leaveDate);
    if (form.partial && (timeToMinutes(form.startTime) < leaveOpen.open || timeToMinutes(form.endTime) > leaveOpen.close)) {
      return `Jam izin harus di dalam jam buka klinik hari itu (${openLabelOn(form.leaveDate)}).`;
    }
    if (form.shifts.length === 0 && !replacementOptional) return 'Pilih minimal 1 hari untuk mengganti jam kerja.';
    if (sundayOnly && sortedShifts.some((s) => !isSundayDate(s.date))) return WEEKEND_REPLACEMENT_NOTE;
    if (hasShiftError) return 'Perbaiki jam kerja pengganti yang bermasalah.';
    if (sortedShifts.some((s) => shiftMinutes(s) < slotMinutes)) return `Jam pengganti minimal ${slotMinutes} menit (1 slot booking).`;
    if (!replacementOptional && missedMinutes > 0 && replacedMinutes < missedMinutes) {
      return `Jam pengganti kurang ${formatDuration(missedMinutes - replacedMinutes)} dari jam izin (${formatDuration(missedMinutes)}). Tambah jam pengganti sampai cukup.`;
    }
    return null;
  })();

  const handleSubmit = async () => {
    if (blocker) return;
    setSubmitting(true);
    let proofPath = null;
    if (form.leaveType === 'sick' && form.proofFile) {
      const ext = (form.proofFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      proofPath = `${therapist.clinic_id}/${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('leave-proofs').upload(proofPath, form.proofFile, { contentType: form.proofFile.type });
      if (uploadError) {
        setSubmitting(false);
        toast({ variant: 'destructive', title: 'Gagal mengunggah surat dokter', description: uploadError.message });
        return;
      }
    }
    const { error } = await submitLeaveRequest({
      therapistId: therapist.id,
      therapistName: therapist.name,
      leaveDate: form.leaveDate,
      isPartial: form.partial,
      startTime: form.partial ? form.startTime : null,
      endTime: form.partial ? form.endTime : null,
      leaveType: form.leaveType,
      notes: form.notes,
      replacementShifts: sortedShifts.map((s) => ({ date: s.date, start_time: s.start_time, end_time: s.end_time })),
      proofPath,
    });
    setSubmitting(false);
    if (error) {
      if (proofPath) supabase.storage.from('leave-proofs').remove([proofPath]);
      toast({ variant: 'destructive', title: 'Gagal mengirim pengajuan', description: error.message });
      return;
    }
    toast({
      title: 'Pengajuan terkirim',
      description: 'Owner / terapis kepala sudah diberi tahu dan akan menyetujui atau menolak.',
      className: 'bg-green-50 text-green-800 border-green-200',
    });
    setForm(emptyForm());
    setProofInputKey((k) => k + 1);
    onSubmitted();
  };

  const normalLabel = form.leaveDate ? scheduleLabel(hoursOn(form.leaveDate)) : '';

  return (
    <div className="space-y-5">
      {/* LANGKAH 1 */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5 space-y-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center">1</span>
          Kapan Anda izin?
        </h3>

        <div className="space-y-1.5">
          <Label htmlFor="leave-date">Tanggal izin</Label>
          <Input
            id="leave-date"
            type="date"
            min={format(addDays(new Date(), -MAX_BACKDATE_DAYS), DAY_KEY)}
            value={form.leaveDate}
            onChange={(e) => handleLeaveDateChange(e.target.value)}
          />
          {form.leaveDate && (
            <p className="text-xs text-slate-500">
              {formatLongDate(form.leaveDate)}
              {normalLabel ? ` · jadwal normal ${normalLabel}` : ' · bukan hari kerja Anda'}
            </p>
          )}
          {form.leaveDate && form.leaveDate < todayStr && (
            <p className="text-xs rounded-lg bg-amber-50 text-amber-800 px-3 py-2 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Izin ini sudah lewat. Tetap bisa dicatat, dan Anda wajib memilih tanggal pengganti (mulai hari ini) sebanyak jam izinnya.</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { partial: false, icon: Sun, title: 'Seharian', desc: 'Tidak masuk sama sekali' },
            { partial: true, icon: Clock3, title: 'Jam tertentu', desc: 'Hanya sebagian hari' },
          ].map(({ partial, icon: Icon, title, desc }) => (
            <button
              key={title}
              type="button"
              onClick={() => setForm((f) => ({ ...f, partial }))}
              className={cn(
                'text-left rounded-xl border-2 p-3 transition-all',
                form.partial === partial ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white hover:border-orange-200',
              )}
            >
              <Icon className={cn('w-5 h-5 mb-1', form.partial === partial ? 'text-orange-600' : 'text-slate-400')} />
              <p className="text-sm font-bold text-slate-800">{title}</p>
              <p className="text-[11px] text-slate-500 leading-tight">{desc}</p>
            </button>
          ))}
        </div>

        {!form.partial && leaveDayHours.length > 0 && (
          <p className="text-xs rounded-lg bg-orange-50 text-orange-800 px-3 py-2">
            Izin seharian = {workShift?.name ? `${workShift.name} ` : ''}jam kerja <b>{scheduleLabel(leaveDayHours)}</b> ({formatDuration(normalMinutes)}) — terisi otomatis.
          </p>
        )}

        {form.partial && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Dari jam</Label>
              <Input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sampai jam</Label>
              <Input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Alasan</Label>
          <div className="flex flex-wrap gap-1.5">
            {LEAVE_TYPES.map((t) => {
              const locked = t.value === 'annual' && firstYear;
              return (
                <button
                  key={t.value}
                  type="button"
                  disabled={locked}
                  onClick={() => setForm((f) => ({ ...f, leaveType: t.value }))}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                    form.leaveType === t.value ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300',
                    locked && 'opacity-50 cursor-not-allowed hover:border-slate-200',
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          {firstYear && (
            <p className="text-[11px] text-amber-700">Cuti tahunan belum tersedia di tahun pertama bergabung.</p>
          )}
        </div>

        {isEvent && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 space-y-1 text-xs text-violet-900">
            <p className="font-semibold flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Ketentuan izin Event</p>
            <p>
              Cantumkan nama event dan penyelenggaranya pada kolom catatan. Jadwal pengganti tidak wajib; owner / terapis kepala menentukan saat peninjauan. Bila jadwal pengganti diperlukan, pengajuan akan dikembalikan beserta catatan agar Anda mengajukannya kembali dengan jadwal pengganti.
            </p>
          </div>
        )}

        {isSundayDate(form.leaveDate) && !form.partial && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <p>
              <b>Izin hari Minggu.</b> {SUNDAY_RULE_NOTE} Berlaku untuk semua alasan izin.
            </p>
          </div>
        )}

        {isOrg && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2 text-xs text-amber-900">
            <p className="font-semibold flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Ketentuan izin kegiatan organisasi</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                <b>Tanpa jadwal pengganti:</b> berlaku untuk kegiatan organisasi yang ditugaskan atau disetujui secara resmi oleh klinik.
              </li>
              <li>
                <b>Wajib jadwal pengganti:</b> berlaku untuk kegiatan organisasi yang bersifat pribadi atau di luar penugasan klinik. Jam kerja yang ditinggalkan harus diganti pada hari lain.
              </li>
            </ul>
            <p>
              Mohon cantumkan nama kegiatan, penyelenggara, dan statusnya (penugasan klinik atau pribadi) pada kolom catatan. Keputusan akhir ditetapkan oleh owner / terapis kepala saat peninjauan. Apabila jadwal pengganti diperlukan, pengajuan akan dikembalikan beserta catatan dan Anda dapat mengajukannya kembali dengan jadwal pengganti.
            </p>
          </div>
        )}

        {form.leaveType === 'sick' && (
          <div className="space-y-1.5 rounded-lg border border-orange-200 bg-orange-50/50 p-3">
            <Label htmlFor="leave-proof" className="flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5" /> Surat dokter <span className="text-red-500">*</span>
            </Label>
            <Input
              id="leave-proof"
              key={proofInputKey}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                if (file && !PROOF_TYPES.includes(file.type)) {
                  toast({ variant: 'destructive', title: 'Format tidak didukung', description: 'Gunakan foto (JPG/PNG/WebP) atau PDF.' });
                  e.target.value = '';
                  setForm((f) => ({ ...f, proofFile: null }));
                  return;
                }
                if (file && file.size > PROOF_MAX_BYTES) {
                  toast({ variant: 'destructive', title: 'Berkas terlalu besar', description: 'Maksimal 5 MB.' });
                  e.target.value = '';
                  setForm((f) => ({ ...f, proofFile: null }));
                  return;
                }
                setForm((f) => ({ ...f, proofFile: file }));
              }}
            />
            <p className="text-[11px] text-slate-500">
              {form.proofFile ? `Terpilih: ${form.proofFile.name}` : 'Wajib untuk izin sakit. Foto (JPG/PNG/WebP) atau PDF, maksimal 5 MB.'}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="leave-notes">Catatan (opsional)</Label>
          <Textarea
            id="leave-notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Contoh: acara keluarga, kontrol ke dokter…"
            className="resize-none h-16"
          />
        </div>
      </section>

      {/* LANGKAH 2 */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">2</span>
            {replacementOptional ? 'Jadwal pengganti (opsional)' : 'Ganti jam kerjanya kapan?'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {isOrg ? 'Dapat dikosongkan bila kegiatan merupakan penugasan klinik. Isi bila kegiatan bersifat pribadi. ' : isEvent ? 'Dapat dikosongkan; peninjau menentukan apakah event ini perlu jadwal pengganti. ' : 'Wajib diisi. '}Setelah disetujui, jam ini otomatis terbuka untuk booking pasien. Ketuk tanggal di bawah; bila jam bulan ini belum cukup, lanjut ke bulan berikutnya dengan tombol panah. Hari <b className="text-emerald-700">Libur</b> adalah libur mingguan Anda. Tanggal abu-abu sudah terisi cuti, sakit, atau izin lain.
          </p>
        </div>

        <p className="text-xs rounded-lg bg-sky-50 text-sky-800 border border-sky-100 px-3 py-2 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{attendanceImpactNote(form.partial)}</span>
        </p>
        {sundayOnly && (
          <p className="text-xs rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{WEEKEND_REPLACEMENT_NOTE} Hanya tanggal hari Minggu yang bisa dipilih di kalender.</span>
          </p>
        )}

        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Bulan sebelumnya" disabled={monthOffset <= 0} onClick={() => setMonthOffset((m) => m - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <p className="text-sm font-semibold text-slate-800 capitalize">{format(viewMonth, 'MMMM yyyy', { locale: idLocale })}</p>
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Bulan berikutnya" disabled={monthOffset >= MAX_MONTHS_AHEAD} onClick={() => setMonthOffset((m) => m + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold uppercase text-slate-400">{d}</div>
          ))}
          {Array.from({ length: candidates[0].date.getDay() }).map((_, i) => <div key={`pad-${i}`} />)}
          {candidates.map((day) => {
            const selected = form.shifts.some((s) => s.date === day.key);
            const isLeaveDay = day.key === form.leaveDate;
            const full = !day.free.some((w) => w.end - w.start >= slotMinutes);
            const disabled = day.past || isLeaveDay || blockedDates.has(day.key) || (sundayOnly && day.date.getDay() !== 0) || (full && !selected);
            const off = day.sched.length === 0;
            return (
              <button
                key={day.key}
                type="button"
                disabled={disabled}
                onClick={() => toggleShift(day)}
                className={cn(
                  'rounded-lg border py-1.5 flex flex-col items-center leading-tight transition-all',
                  disabled && 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-100',
                  !disabled && selected && 'bg-blue-600 border-blue-600 text-white shadow',
                  !disabled && !selected && off && 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:border-emerald-400',
                  !disabled && !selected && !off && 'bg-white border-slate-200 text-slate-700 hover:border-blue-300',
                )}
              >
                <span className="text-sm font-bold">{format(day.date, 'd')}</span>
                <span className={cn('text-[9px]', selected ? 'text-blue-100' : off ? 'text-emerald-600' : 'text-slate-400')}>
                  {isLeaveDay ? 'Izin' : blockedDates.has(day.key) ? blockedDates.get(day.key) : full ? 'Penuh' : day.taken.length ? 'Terisi' : off ? 'Libur' : 'Kerja'}
                </span>
              </button>
            );
          })}
        </div>

        {sortedShifts.length > 0 && (
          <div className="space-y-2">
            {sortedShifts.map((shift) => {
              const err = shiftError(shift);
              const normal = scheduleLabel(hoursOn(shift.date));
              return (
                <div key={shift.date} className={cn('rounded-lg border p-3', err ? 'border-red-200 bg-red-50/50' : 'border-blue-100 bg-blue-50/40')}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{formatLongDate(shift.date)}</p>
                      <p className="text-[11px] text-slate-500">{normal ? `Jadwal normal ${normal}` : 'Hari libur Anda'}
                        {(() => {
                          const n = hoursOn(shift.date).reduce((sum, s) => sum + timeToMinutes(s.end_time) - timeToMinutes(s.start_time), 0);
                          return n > 0 && n < DAY_TARGET_MINUTES ? ` · baru ${formatDuration(n)}, masih bisa tambah ${formatDuration(DAY_TARGET_MINUTES - n)}` : '';
                        })()}</p>
                    </div>
                    <button type="button" aria-label="Hapus hari pengganti" onClick={() => toggleShift({ key: shift.date, sched: [] })} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {(() => {
                    const taken = takenByDate.get(shift.date) || [];
                    if (!taken.length) return null;
                    const free = freeWindowsOn(shift.date);
                    const others = replacedMinutes - shiftMinutes(shift);
                    const debtLeft = Math.max(0, missedMinutes - others);
                    return (
                      <p className="text-xs rounded-md bg-sky-50 text-sky-800 border border-sky-100 px-2 py-1.5 mb-2 flex items-start gap-1">
                        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>
                          Tanggal ini sudah punya jadwal pengganti ({taken.map((t) => `${minutesToTime(t.start)}–${minutesToTime(t.end)}`).join(', ')}).{' '}
                          {free.length ? <>Jam yang masih bisa diisi: <b>{windowsLabel(free)}</b> (jam buka klinik {openLabelOn(shift.date)}).</> : 'Tidak ada jam kosong lagi.'}
                          {!replacementOptional && debtLeft > 0 ? <> Sisa utang jam izin ini: <b>{formatDuration(debtLeft)}</b>.</> : null}
                        </span>
                      </p>
                    );
                  })()}
                  <div className="grid grid-cols-2 gap-3">
                    <Input type="time" aria-label="Jam mulai pengganti" value={shift.start_time} onChange={(e) => updateShift(shift.date, { start_time: e.target.value })} />
                    <Input type="time" aria-label="Jam selesai pengganti" value={shift.end_time} onChange={(e) => updateShift(shift.date, { end_time: e.target.value })} />
                  </div>
                  {err && <p className="text-xs text-red-600 mt-2 flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{err}</p>}
                  {!err && !replacementOptional && missedMinutes > 0 && replacedMinutes < missedMinutes && (() => {
                    // Jam selesai yang pas agar total jam pengganti = jam yang ditinggalkan
                    // (hari pengganti lain dianggap tetap).
                    const needed = missedMinutes - (replacedMinutes - shiftMinutes(shift));
                    const suggestedEnd = timeToMinutes(shift.start_time) + needed;
                    return (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1.5 mt-2 flex items-start gap-1">
                        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>
                          Jam pengganti kurang {formatDuration(missedMinutes - replacedMinutes)} dari izin ({formatDuration(missedMinutes)}).
                          {suggestedEnd <= 24 * 60
                            ? <> Seharusnya sampai jam <b>{minutesToTime(suggestedEnd)}</b>.</>
                            : ' Tambah hari pengganti lain untuk menutup kekurangannya.'}
                        </span>
                      </p>
                    );
                  })()}
                  {!err && (() => {
                    const total = shiftMinutes(shift);
                    const count = Math.floor(total / slotMinutes);
                    const leftover = total - count * slotMinutes;
                    return (
                      <p className={cn('text-[11px] mt-1.5', count === 0 || leftover ? 'text-amber-700' : 'text-blue-700')}>
                        Durasi {formatDuration(total)} → {count} slot booking @ {slotMinutes} menit
                        {count === 0 && ' — terlalu pendek untuk satu slot'}
                        {count > 0 && leftover > 0 && ` (sisa ${formatDuration(leftover)} tidak jadi slot)`}
                      </p>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}

        {form.leaveDate && !replacementOptional && (
          <div className={cn(
            'rounded-lg px-3 py-2 text-xs flex items-start gap-2',
            replacedMinutes >= missedMinutes && replacedMinutes > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800',
          )}>
            {replacedMinutes >= missedMinutes && replacedMinutes > 0
              ? <CheckCircle2 className="w-4 h-4 shrink-0" />
              : <Info className="w-4 h-4 shrink-0" />}
            <span>
              Jam yang ditinggalkan: <b>{missedMinutes ? formatDuration(missedMinutes) : '–'}</b> · Jam pengganti: <b>{replacedMinutes ? formatDuration(replacedMinutes) : 'belum ada'}</b>
              {replacedMinutes > 0 && replacedMinutes < missedMinutes && ` (kurang ${formatDuration(missedMinutes - replacedMinutes)})`}
            </span>
          </div>
        )}
      </section>

      <div className="space-y-2">
        {blocker && <p className="text-xs text-slate-500 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />{blocker}</p>}
        <Button
          onClick={handleSubmit}
          disabled={!!blocker || submitting}
          className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white font-semibold"
        >
          {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Kirim Pengajuan Izin
        </Button>
      </div>
    </div>
  );
};

const MyRequests = ({ requests, onCancel, cancellingId }) => {
  if (requests.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 bg-slate-50/60 border-2 border-dashed border-slate-200 rounded-xl">
        <CalendarOff className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm font-medium">Belum ada pengajuan izin</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <LeaveRequestCard
          key={r.id}
          request={r}
          footer={r.status === 'pending' ? (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50"
              disabled={cancellingId === r.id}
              onClick={() => onCancel(r)}
            >
              {cancellingId === r.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
              Batalkan pengajuan
            </Button>
          ) : null}
        />
      ))}
    </div>
  );
};

const TherapistLeaveRequests = ({ therapist }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const isHead = therapist?.is_head_therapist === true;
  const [schedules, setSchedules] = useState([]);
  const [timeOff, setTimeOff] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const { count: pendingForReview, refresh: refreshPending } = usePendingLeaveRequestCount(isHead);
  const [searchParams] = useSearchParams();
  const [incomingSunday, setIncomingSunday] = useState(0);
  const refreshIncomingSunday = useCallback(async () => {
    if (!user?.id) return;
    const { count } = await supabase
      .from('therapist_sunday_swap_requests')
      .select('id', { count: 'exact', head: true })
      .eq('substitute_user_id', user.id)
      .eq('status', 'pending_substitute');
    setIncomingSunday(count || 0);
  }, [user?.id]);
  useEffect(() => { refreshIncomingSunday(); }, [refreshIncomingSunday]);
  const [tab, setTab] = useState(() => {
    const fromUrl = searchParams.get('tab');
    return ['mine', 'swap', 'sunday', 'review'].includes(fromUrl) ? fromUrl : (isHead && pendingForReview > 0 ? 'review' : 'mine');
  });

  const load = useCallback(async () => {
    if (!therapist?.id) return;
    const [schedRes, offRes, reqRes] = await Promise.all([
      getTherapistSchedules(therapist.id),
      getTherapistTimeOff(therapist.id),
      getLeaveRequests(),
    ]);
    setSchedules((schedRes.data || []).filter((s) => s.is_active !== false));
    setTimeOff(offRes.data || []);
    setRequests((reqRes.data || []).filter((r) => r.requested_by === user?.id));
    setLoading(false);
  }, [therapist?.id, user?.id]);

  useEffect(() => { load(); }, [load]);

  // Libur mingguan (cuti 'weekly_off' seharian) = hari libur terapis: boleh dipilih untuk mengganti jam.
  const offDates = useMemo(() => {
    const set = new Set();
    timeOff.filter((t) => t.leave_type === 'weekly_off' && !t.start_time).forEach((t) => {
      const end = parseISO(t.end_date);
      for (let d = parseISO(t.start_date); d <= end; d = addDays(d, 1)) set.add(format(d, DAY_KEY));
    });
    return set;
  }, [timeOff]);

  // Tanggal yang tidak bisa dipilih: sudah ada cuti/izin (sakit, cuti tahunan, dll.) atau pengajuan
  // pending/disetujui. Disimpan bersama labelnya agar Cuti, Sakit, dan Izin tidak disamakan dengan Libur.
  const blockedDates = useMemo(() => {
    const map = new Map();
    timeOff.filter((t) => t.leave_type !== 'weekly_off' || t.start_time).forEach((t) => {
      const label = t.leave_type === 'weekly_off' ? 'Libur' : t.leave_type === 'other' ? 'Izin' : leaveTypeLabel(t.leave_type);
      const end = parseISO(t.end_date);
      for (let d = parseISO(t.start_date); d <= end; d = addDays(d, 1)) map.set(format(d, DAY_KEY), label);
    });
    requests.filter((r) => r.status !== 'rejected').forEach((r) => map.set(r.leave_date, 'Diajukan'));
    return map;
  }, [timeOff, requests]);

  const handleCancel = async (request) => {
    if (!window.confirm('Batalkan pengajuan izin ini?')) return;
    setCancellingId(request.id);
    const { error } = await cancelLeaveRequest(request.id);
    setCancellingId(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal membatalkan', description: error.message });
      return;
    }
    toast({ title: 'Pengajuan dibatalkan' });
    load();
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600" /></div>;
  }

  const mine = (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3 space-y-3">
        <LeaveForm therapist={therapist} schedules={schedules} blockedDates={blockedDates} offDates={offDates} requests={requests} onSubmitted={load} />
      </div>
      <div className="lg:col-span-2 space-y-3">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">Pengajuan Saya</h3>
        <MyRequests requests={requests} onCancel={handleCancel} cancellingId={cancellingId} />
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
          <CalendarOff className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Izin</h2>
          <p className="text-sm text-slate-500">Ajukan izin, lalu tentukan kapan Anda mengganti jam kerjanya.</p>
        </div>
      </div>

      {therapist?.work_start_time && therapist?.work_end_time && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 flex items-center gap-3">
          <Clock3 className="w-5 h-5 text-sky-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-sky-700">Jam kerja Anda</p>
            <p className="text-sm font-bold text-sky-900">
              {therapist.work_shift_name ? `${therapist.work_shift_name} · ` : ''}
              {hhmm(therapist.work_start_time)}–{hhmm(therapist.work_end_time)}
              <span className="font-normal text-sky-700">
                {' '}({formatDuration(timeToMinutes(therapist.work_end_time) - timeToMinutes(therapist.work_start_time))})
              </span>
            </p>
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList className={cn('grid w-full bg-slate-100 p-1 rounded-lg', isHead ? 'grid-cols-4 sm:w-[720px]' : 'grid-cols-3 sm:w-[540px]')}>
          <TabsTrigger value="mine">Ajukan Izin</TabsTrigger>
          <TabsTrigger value="swap" className="gap-1.5"><Repeat className="w-3.5 h-3.5" /> Ubah Shift</TabsTrigger>
          <TabsTrigger value="sunday" className="gap-1.5">
            <CalendarClock className="w-3.5 h-3.5" /> Tukar Jadwal
            {incomingSunday > 0 && (
              <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5">{incomingSunday}</span>
            )}
          </TabsTrigger>
          {isHead && (
            <TabsTrigger value="review" className="gap-1.5">
              <Crown className="w-3.5 h-3.5" /> Izin Tim
              {pendingForReview > 0 && (
                <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5">{pendingForReview}</span>
              )}
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="mine">{mine}</TabsContent>
        <TabsContent value="swap"><TherapistShiftSwap therapist={therapist} /></TabsContent>
        <TabsContent value="sunday"><TherapistSundaySwap therapist={therapist} onChanged={refreshIncomingSunday} /></TabsContent>
        {isHead && (
          <TabsContent value="review" className="space-y-8">
            <LeaveRequestReview onChanged={() => { refreshPending(); load(); }} />
            <ShiftSwapReview />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default TherapistLeaveRequests;
