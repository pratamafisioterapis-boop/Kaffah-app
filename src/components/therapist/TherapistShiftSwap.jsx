import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { Repeat, Send, Loader2, Info, Trash2, Check, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import {
  getShiftSwapRequests, submitShiftSwapRequest, cancelShiftSwapRequest, getClinicWorkShifts,
  getTherapistSchedules, getTherapistTimeOff, getShiftSwapBookingConflicts,
} from '@/lib/api';
import { buildShiftOptions, hhmm, timeToMinutes, formatDuration, formatLongDate } from '@/lib/leaveRequestUtils';
import ShiftSwapCard from '@/components/shared/ShiftSwapCard';
import { confirmAction } from '@/lib/confirmAction';

const DAY_KEY = 'yyyy-MM-dd';

// Ubah shift di tanggal yang sama: pilih tanggal, pilih shift tujuan, jam kerja shift ditampilkan.
const TherapistShiftSwap = ({ therapist }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const todayStr = format(new Date(), DAY_KEY);

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [timeOff, setTimeOff] = useState([]);
  const [requests, setRequests] = useState([]);
  const [shiftOptions, setShiftOptions] = useState(() => buildShiftOptions());
  const [date, setDate] = useState('');
  const [target, setTarget] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [conflicts, setConflicts] = useState(null);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  const current = therapist.work_start_time && therapist.work_end_time
    ? { name: therapist.work_shift_name || '', start: hhmm(therapist.work_start_time), end: hhmm(therapist.work_end_time) }
    : null;

  const load = useCallback(async () => {
    const [schedRes, offRes, reqRes, shiftRes] = await Promise.all([
      getTherapistSchedules(therapist.id),
      getTherapistTimeOff(therapist.id),
      getShiftSwapRequests(),
      getClinicWorkShifts(therapist.clinic_id),
    ]);
    setSchedules((schedRes.data || []).filter((s) => s.is_active !== false));
    setTimeOff(offRes.data || []);
    setRequests((reqRes.data || []).filter((r) => r.requested_by === user?.id));
    setShiftOptions(buildShiftOptions(shiftRes.data || []));
    setLoading(false);
  }, [therapist.id, therapist.clinic_id, user?.id]);

  useEffect(() => { load(); }, [load]);

  // Tanggal tidak bisa dipilih: libur mingguan, izin/cuti, atau sudah ada pengajuan tukar shift aktif.
  const blockedReason = useMemo(() => {
    if (!date) return null;
    if (date < todayStr) return 'Tanggal tidak boleh sudah lewat.';
    const dow = parseISO(date).getDay();
    const inRange = (t) => t.start_date <= date && date <= t.end_date;
    if (timeOff.some((t) => t.leave_type === 'weekly_off' && !t.start_time && inRange(t))) {
      return 'Tanggal itu hari libur mingguan Anda.';
    }
    if (timeOff.some((t) => t.leave_type !== 'weekly_off' && inRange(t))) {
      return 'Anda sudah punya cuti / izin di tanggal ini.';
    }
    if (!schedules.some((s) => s.day_of_week === dow)) return 'Tanggal itu bukan hari kerja Anda.';
    if (requests.some((r) => r.swap_date === date && r.status !== 'rejected')) {
      return 'Sudah ada pengajuan tukar shift di tanggal ini.';
    }
    return null;
  }, [date, timeOff, schedules, requests, todayStr]);

  // Cek booking pasien di tanggal itu yang tidak muat di jam shift tujuan.
  useEffect(() => {
    setConflicts(null);
    if (!date || !target || blockedReason) return undefined;
    let active = true;
    setCheckingConflicts(true);
    getShiftSwapBookingConflicts(therapist.id, date, target.start, target.end).then(({ count, error }) => {
      if (!active) return;
      setConflicts(error ? null : count);
      setCheckingConflicts(false);
    });
    return () => { active = false; };
  }, [date, target, blockedReason, therapist.id]);

  const sameAsCurrent = (opt) => !!current && opt.start === current.start && opt.end === current.end;

  const blocker = (() => {
    if (!date) return 'Pilih tanggal dulu.';
    if (blockedReason) return blockedReason;
    if (!target) return 'Pilih shift tujuan.';
    if (sameAsCurrent(target)) return 'Shift tujuan sama dengan shift Anda saat ini.';
    if (checkingConflicts) return 'Memeriksa booking pasien…';
    if (conflicts > 0) return `Sudah ada ${conflicts} pasien yang booking di jam yang terdampak, tukar shift tidak bisa diajukan.`;
    return null;
  })();

  const handleSubmit = async () => {
    if (blocker) return;
    setSubmitting(true);
    const { error } = await submitShiftSwapRequest({
      therapistId: therapist.id,
      therapistName: therapist.name,
      swapDate: date,
      from: current,
      to: target,
      notes,
    });
    setSubmitting(false);
    if (error) {
      const duplicate = error.code === '23505';
      toast({
        variant: 'destructive',
        title: 'Gagal mengirim pengajuan',
        description: duplicate ? 'Sudah ada pengajuan tukar shift di tanggal ini.' : error.message,
      });
      return;
    }
    toast({
      title: 'Pengajuan terkirim',
      description: 'Owner / terapis kepala sudah diberi tahu dan akan menyetujui atau menolak.',
      className: 'bg-green-50 text-green-800 border-green-200',
    });
    setDate(''); setTarget(null); setNotes('');
    load();
  };

  const handleCancel = async (request) => {
    if (!await confirmAction('Batalkan pengajuan tukar shift ini?')) return;
    setCancellingId(request.id);
    const { error } = await cancelShiftSwapRequest(request.id);
    setCancellingId(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal membatalkan', description: error.message });
      return;
    }
    toast({ title: 'Pengajuan dibatalkan' });
    load();
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-app-accent" /></div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3 space-y-5">
        <section className="rounded-app border border-slate-200 bg-white shadow-sm p-4 sm:p-5 space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-app-accent text-white text-xs flex items-center justify-center"><Repeat className="w-3.5 h-3.5" /></span>
            Ubah shift di tanggal yang sama
          </h3>
          <p className="text-xs text-slate-500 -mt-2">Hanya untuk jadwal Anda sendiri (untuk tukar jadwal Minggu dengan terapis lain, pakai tab Tukar Jadwal) dan hanya bisa jika belum ada pasien yang booking di jam yang berubah.</p>

          <div className="space-y-1.5">
            <Label htmlFor="swap-date">Tanggal</Label>
            <Input id="swap-date" type="date" min={todayStr} value={date} onChange={(e) => setDate(e.target.value)} />
            {date && (
              <p className="text-xs text-slate-500">
                {formatLongDate(date)}
                {current ? ` · shift Anda ${current.name ? `${current.name} ` : ''}${current.start}–${current.end}` : ''}
              </p>
            )}
            {blockedReason && <p className="text-xs text-red-600 flex items-center gap-1"><Info className="w-3.5 h-3.5" />{blockedReason}</p>}
            {!blockedReason && conflicts > 0 && (
              <p className="text-xs text-red-600 flex items-center gap-1"><Info className="w-3.5 h-3.5" />Sudah ada {conflicts} pasien yang booking di jam yang terdampak, tukar shift tidak bisa diajukan.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Pilih shift tujuan</Label>
            <div className="grid sm:grid-cols-2 gap-2">
              {shiftOptions.map((opt) => {
                const selected = target?.start === opt.start && target?.end === opt.end;
                const same = sameAsCurrent(opt);
                return (
                  <button
                    key={`${opt.start}-${opt.end}`}
                    type="button"
                    disabled={same}
                    onClick={() => setTarget(opt)}
                    className={cn(
                      'text-left rounded-app border-2 p-3 transition-[color,background-color,border-color,box-shadow,transform,opacity]',
                      selected ? 'border-app-accent bg-app-soft' : 'border-slate-200 bg-white hover:border-app-accent/40',
                      same && 'opacity-50 cursor-not-allowed hover:border-slate-200',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-800">{opt.name}</p>
                      {selected && <Check className="w-4 h-4 text-app-accent" />}
                    </div>
                    <p className="text-sm text-slate-700 flex items-center gap-1.5 mt-0.5">
                      <Clock3 className="w-3.5 h-3.5 text-slate-500" />
                      Jam kerja {opt.start}–{opt.end}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDuration(timeToMinutes(opt.end) - timeToMinutes(opt.start))}{same ? ' · shift Anda saat ini' : ''}
                    </p>
                  </button>
                );
              })}
            </div>
            {target && date && !blockedReason && !sameAsCurrent(target) && (
              <p className="text-xs rounded-app-sm bg-blue-50 text-blue-800 px-3 py-2">
                Pada {formatLongDate(date)} Anda bekerja di <b>{target.name} {target.start}–{target.end}</b>. Slot booking tanggal itu menyesuaikan setelah disetujui.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="swap-notes">Catatan (opsional)</Label>
            <Textarea
              id="swap-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: ada keperluan pagi hari."
              className="resize-none h-16"
            />
          </div>
        </section>

        <div className="space-y-2">
          {blocker && <p className="text-xs text-slate-500 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />{blocker}</p>}
          <Button
            onClick={handleSubmit}
            disabled={!!blocker || submitting}
            className="w-full h-11 bg-app-accent hover:bg-app-accent-hover text-white font-semibold"
          >
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Kirim Pengajuan Ubah Shift
          </Button>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-3">
        <h3 className="font-bold text-slate-800">Pengajuan Saya</h3>
        {requests.length === 0 ? (
          <div className="text-center py-8 text-slate-500 bg-slate-50/60 border-2 border-dashed border-slate-200 rounded-app">
            <Repeat className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">Belum ada pengajuan tukar shift</p>
          </div>
        ) : requests.map((r) => (
          <ShiftSwapCard
            key={r.id}
            request={r}
            footer={r.status === 'pending' ? (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
                disabled={cancellingId === r.id}
                onClick={() => handleCancel(r)}
              >
                {cancellingId === r.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                Batalkan pengajuan
              </Button>
            ) : null}
          />
        ))}
      </div>
    </div>
  );
};

export default TherapistShiftSwap;
