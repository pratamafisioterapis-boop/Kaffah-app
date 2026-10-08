import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import {
  CalendarOff, Send, Loader2, Plus, X, AlertTriangle, CheckCircle2, Sun, Clock3, Trash2, Info, Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import {
  getLeaveRequests, submitLeaveRequest, cancelLeaveRequest, getTherapistSchedules, getTherapistTimeOff,
} from '@/lib/api';
import {
  LEAVE_TYPES, leaveTypeLabel, hhmm, timeToMinutes, formatDuration, formatLongDate, totalShiftMinutes, shiftMinutes,
} from '@/lib/leaveRequestUtils';
import LeaveRequestCard from '@/components/shared/LeaveRequestCard';
import LeaveRequestReview from '@/components/shared/LeaveRequestReview';
import { usePendingLeaveRequestCount } from '@/hooks/useTherapistLeaveRequests';

const DAY_KEY = 'yyyy-MM-dd';
const CANDIDATE_DAYS = 28;

const minutesToTime = (min) => {
  const m = Math.min(Math.max(0, min), 23 * 60 + 59);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const emptyForm = () => ({
  leaveDate: '', partial: false, startTime: '09:00', endTime: '12:00', leaveType: 'personal', notes: '', shifts: [],
});

const LeaveForm = ({ therapist, schedules, blockedDates, offDates, onSubmitted }) => {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const todayStr = format(new Date(), DAY_KEY);

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
  const scheduleLabel = (list) => (list.length
    ? list.map((s) => `${hhmm(s.start_time)}–${hhmm(s.end_time)}`).join(', ')
    : '');

  const normalMinutes = form.leaveDate
    ? scheduleOn(form.leaveDate).reduce((sum, s) => sum + (timeToMinutes(s.end_time) - timeToMinutes(s.start_time)), 0)
    : 0;
  const missedMinutes = form.partial
    ? Math.max(0, timeToMinutes(form.endTime) - timeToMinutes(form.startTime))
    : normalMinutes;
  const replacedMinutes = totalShiftMinutes(form.shifts);

  const candidates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: CANDIDATE_DAYS }, (_, i) => addDays(today, i)).map((d) => {
      const key = format(d, DAY_KEY);
      return { date: d, key, sched: scheduleOn(key) };
    });
  }, [scheduleOn]);

  const toggleShift = (day) => {
    setForm((f) => {
      if (f.shifts.some((s) => s.date === day.key)) {
        return { ...f, shifts: f.shifts.filter((s) => s.date !== day.key) };
      }
      // Hari kerja: default setelah jam kerja normal. Hari libur: default mulai 09:00.
      const lastEnd = day.sched.reduce((mx, s) => Math.max(mx, timeToMinutes(s.end_time)), 0);
      const start = day.sched.length ? lastEnd : 9 * 60;
      const wanted = missedMinutes > 0 ? Math.min(missedMinutes, 8 * 60) : 3 * 60;
      return {
        ...f,
        shifts: [...f.shifts, { date: day.key, start_time: minutesToTime(start), end_time: minutesToTime(start + wanted) }],
      };
    });
  };

  const updateShift = (date, patch) =>
    setForm((f) => ({ ...f, shifts: f.shifts.map((s) => (s.date === date ? { ...s, ...patch } : s)) }));

  const shiftError = (shift) => {
    if (timeToMinutes(shift.end_time) <= timeToMinutes(shift.start_time)) return 'Jam selesai harus setelah jam mulai.';
    const overlap = scheduleOn(shift.date).find((s) =>
      timeToMinutes(shift.start_time) < timeToMinutes(s.end_time) && timeToMinutes(shift.end_time) > timeToMinutes(s.start_time));
    if (overlap) return `Bentrok dengan jam kerja normal (${hhmm(overlap.start_time)}–${hhmm(overlap.end_time)}). Pilih jam di luar itu.`;
    return null;
  };

  const sortedShifts = [...form.shifts].sort((a, b) => a.date.localeCompare(b.date));
  const hasShiftError = sortedShifts.some((s) => shiftError(s));

  // Alasan tombol kirim belum aktif — ditampilkan agar terapis tahu apa yang kurang.
  const blocker = (() => {
    if (!form.leaveDate) return 'Pilih tanggal izin dulu.';
    if (form.leaveDate < todayStr) return 'Tanggal izin tidak boleh sudah lewat.';
    if (offDates.has(form.leaveDate)) return 'Tanggal itu hari libur mingguan Anda, jadi tidak perlu mengajukan izin.';
    if (blockedDates.has(form.leaveDate)) return 'Anda sudah punya cuti / izin / pengajuan di tanggal ini.';
    if (form.partial && timeToMinutes(form.endTime) <= timeToMinutes(form.startTime)) return 'Jam selesai izin harus setelah jam mulai.';
    if (form.shifts.length === 0) return 'Pilih minimal 1 hari untuk mengganti jam kerja.';
    if (hasShiftError) return 'Perbaiki jam kerja pengganti yang bermasalah.';
    if (sortedShifts.some((s) => shiftMinutes(s) < slotMinutes)) return `Jam pengganti minimal ${slotMinutes} menit (1 slot booking).`;
    return null;
  })();

  const handleSubmit = async () => {
    if (blocker) return;
    setSubmitting(true);
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
    });
    setSubmitting(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal mengirim pengajuan', description: error.message });
      return;
    }
    toast({
      title: 'Pengajuan terkirim',
      description: 'Owner / terapis kepala sudah diberi tahu dan akan menyetujui atau menolak.',
      className: 'bg-green-50 text-green-800 border-green-200',
    });
    setForm(emptyForm());
    onSubmitted();
  };

  const normalLabel = form.leaveDate ? scheduleLabel(scheduleOn(form.leaveDate)) : '';

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
            min={todayStr}
            value={form.leaveDate}
            onChange={(e) => setForm((f) => ({ ...f, leaveDate: e.target.value, shifts: f.shifts.filter((s) => s.date !== e.target.value) }))}
          />
          {form.leaveDate && (
            <p className="text-xs text-slate-500">
              {formatLongDate(form.leaveDate)}
              {normalLabel ? ` · jadwal normal ${normalLabel}` : ' · bukan hari kerja Anda'}
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
            {LEAVE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, leaveType: t.value }))}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                  form.leaveType === t.value ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

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
            Ganti jam kerjanya kapan?
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Wajib diisi. Setelah disetujui, jam ini otomatis terbuka untuk booking pasien. Ketuk tanggal di bawah — hari <b className="text-emerald-700">Libur</b> adalah libur mingguan Anda. Tanggal abu-abu sudah terisi cuti, sakit, atau izin lain.
          </p>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold uppercase text-slate-400">{d}</div>
          ))}
          {Array.from({ length: candidates[0].date.getDay() }).map((_, i) => <div key={`pad-${i}`} />)}
          {candidates.map((day) => {
            const selected = form.shifts.some((s) => s.date === day.key);
            const isLeaveDay = day.key === form.leaveDate;
            const disabled = isLeaveDay || blockedDates.has(day.key);
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
                  {isLeaveDay ? 'Izin' : blockedDates.has(day.key) ? blockedDates.get(day.key) : off ? 'Libur' : 'Kerja'}
                </span>
              </button>
            );
          })}
        </div>

        {sortedShifts.length > 0 && (
          <div className="space-y-2">
            {sortedShifts.map((shift) => {
              const err = shiftError(shift);
              const normal = scheduleLabel(scheduleOn(shift.date));
              return (
                <div key={shift.date} className={cn('rounded-lg border p-3', err ? 'border-red-200 bg-red-50/50' : 'border-blue-100 bg-blue-50/40')}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{formatLongDate(shift.date)}</p>
                      <p className="text-[11px] text-slate-500">{normal ? `Jadwal normal ${normal}` : 'Hari libur Anda'}</p>
                    </div>
                    <button type="button" aria-label="Hapus hari pengganti" onClick={() => toggleShift({ key: shift.date, sched: [] })} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input type="time" aria-label="Jam mulai pengganti" value={shift.start_time} onChange={(e) => updateShift(shift.date, { start_time: e.target.value })} />
                    <Input type="time" aria-label="Jam selesai pengganti" value={shift.end_time} onChange={(e) => updateShift(shift.date, { end_time: e.target.value })} />
                  </div>
                  {err && <p className="text-xs text-red-600 mt-2 flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{err}</p>}
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

        {form.leaveDate && (
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
        <LeaveForm therapist={therapist} schedules={schedules} blockedDates={blockedDates} offDates={offDates} onSubmitted={load} />
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

      {isHead ? (
        <Tabs defaultValue={pendingForReview > 0 ? 'review' : 'mine'} className="space-y-5">
          <TabsList className="grid grid-cols-2 w-full sm:w-[420px] bg-slate-100 p-1 rounded-lg">
            <TabsTrigger value="mine">Ajukan Izin</TabsTrigger>
            <TabsTrigger value="review" className="gap-1.5">
              <Crown className="w-3.5 h-3.5" /> Izin Tim
              {pendingForReview > 0 && (
                <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5">{pendingForReview}</span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="mine">{mine}</TabsContent>
          <TabsContent value="review"><LeaveRequestReview onChanged={() => { refreshPending(); load(); }} /></TabsContent>
        </Tabs>
      ) : mine}
    </div>
  );
};

export default TherapistLeaveRequests;
