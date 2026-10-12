import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  Target,
  AlertCircle,
  RefreshCw,
  Ban,
  CalendarDays,
  Lightbulb,
  Umbrella,
  Briefcase,
  Stethoscope,
  FileText,
  GraduationCap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getTherapistRecaps, getTherapistTargetProgress, getActiveTherapistTarget, getAppointments, getTherapistAnnualLeaveBalance, getTherapistTimeOff, getTherapistExtraShifts } from '@/lib/api';
import { getUnfilledSOAPVisits } from '@/lib/therapistDataUtils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { cn, getTherapistPeriodRange } from '@/lib/utils';


// Kartu statistik seragam: tinggi sama per baris, bar progres selalu menempel di bawah.
const StatCard = ({
  label, value, sub, Icon, iconBox, iconColor, onClick, className,
  tone, surface, labelColor, valueColor,
  progress, barTrack, barColor
}) => {
  const danger = tone === 'danger';
  const interactive = typeof onClick === 'function';
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={cn(
        "rounded-app-lg border shadow-sm p-4 flex flex-col h-full min-w-0 transition-shadow [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-md",
        interactive && "cursor-pointer",
        surface || (danger ? "bg-rose-50 border-rose-200" : "bg-white border-slate-100"),
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn(
          "text-[11px] font-semibold uppercase tracking-wider truncate",
          labelColor || (danger ? "text-rose-400" : "text-slate-500")
        )}>
          {label}
        </span>
        <div className={cn("w-8 h-8 shrink-0 rounded-app flex items-center justify-center", iconBox)}>
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
      </div>
      <div className="mt-3 flex-1">
        <p className={cn("text-3xl font-bold leading-none tabular-nums", valueColor || (danger ? "text-rose-700" : "text-slate-900"))}>
          {value}
        </p>
        <p className={cn("text-xs mt-1.5 leading-snug", danger ? "text-rose-500" : "text-slate-500")}>{sub}</p>
      </div>
      {progress !== undefined && (
        <div className={cn("mt-3 h-1.5 w-full rounded-full overflow-hidden", barTrack)}>
          <div className={cn("h-full rounded-full transition-[width] duration-300", barColor)} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
};

const TherapistMetrics = ({ therapist, userId }) => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    totalPatients: 0,
    todayAppointments: 0,
    monthlyVisitsCalculated: 0,
    monthlyVisitsTotal: 0,
    targetVisits: 0,
    targetVisitsProgress: 0,
    unfilledSoapCount: 0,
    activeTargetPeriod: null,
    excludedTypes: [],
    targetStatus: null,
    annualLeaveRemaining: 0,
    annualLeaveQuota: 0,
    annualLeaveEntries: [],
    workDays: 0,
    absence: { cuti: 0, izin: 0, sakit: 0, training: 0 }
  });
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePeriod, setActivePeriod] = useState({ start: null, end: null });

  useEffect(() => {
    if (therapist?.id && userId) {
      loadMetrics();
    }
  }, [therapist, userId]);

  const loadMetrics = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const now = new Date();

const todayISO = format(
  now,
  'yyyy-MM-dd'
);

const startMonth = format(
  startOfMonth(now),
  'yyyy-MM-dd'
);

const endMonth = format(
  endOfMonth(now),
  'yyyy-MM-dd'
);


const { startDate: startPeriod, endDate: endPeriod } = getTherapistPeriodRange(therapist, now);

const startCustom = format(startPeriod, 'yyyy-MM-dd');
const endCustom = format(endPeriod, 'yyyy-MM-dd');
setActivePeriod({ start: startPeriod, end: endPeriod });

const [
  recapsRes,
  activeTargetRes,
  unfilledRes,
  patientTypeRes,
  todayAppointmentsRes,
  leaveBalanceRes,
  timeOffRes,
  extraShiftRes
] = await Promise.all([
  getTherapistRecaps(therapist.id, { startDate: startMonth, endDate: endMonth }),
  getActiveTherapistTarget(therapist.id),  // ← pakai therapist.id bukan userId
  getUnfilledSOAPVisits(null, therapist.id, startCustom, endCustom),
  getTherapistRecaps(therapist.id, { startDate: startCustom, endDate: endCustom }),
  getAppointments({ date: todayISO, therapistId: therapist.id }),
  getTherapistAnnualLeaveBalance(therapist.id),
  getTherapistTimeOff(therapist.id),
  getTherapistExtraShifts(therapist.id)
]);

// Fetch target progress setelah dapat activeTarget (perlu start_date & end_date dulu)
const activeTarget = activeTargetRes?.data;
const targetProgressRes = activeTarget
  ? await getTherapistTargetProgress(therapist.id, activeTarget.start_date, activeTarget.end_date)
  : { data: null };

const rawMonthlyRecaps = recapsRes.data || [];
      const periodRecaps = patientTypeRes.data || [];

      const unfilledCount = Number(unfilledRes?.count ?? 0);
      const allPatientsCount = periodRecaps.length;
      const todayAppointmentsCount = (todayAppointmentsRes?.data || [])
        .filter(a => a.status !== 'cancelled').length;

      // Gunakan hasil targetProgressRes yang sudah di-fetch sebelumnya (tidak fetch ulang)
      let targetInfo = {
        targetVisits: 0,
        monthlyVisitsCalculated: 0,
        progress: 0,
        period: null,
        excluded: [],
        status: null
      };

      const progressData = targetProgressRes?.data;
      if (progressData) {
        targetInfo = {
          targetVisits: progressData.target_visits || 0,
          monthlyVisitsCalculated: progressData.actual_visits || 0,
          progress: progressData.achievement_percentage || 0,
          period: { start: progressData.start_date, end: progressData.end_date },
          excluded: progressData.excluded_patient_types || [],
          status: progressData.status || null
        };
      }
      // Hari kerja & ketidakhadiran pada periode (libur mingguan tidak dihitung hari kerja)
      const periodDays = eachDayOfInterval({ start: startPeriod, end: endPeriod }).map(d => format(d, 'yyyy-MM-dd'));
      const periodSet = new Set(periodDays);
      const liburDates = new Set();
      const absentByCategory = { cuti: new Set(), izin: new Set(), sakit: new Set(), training: new Set() };
      const categoryOf = { annual: 'cuti', sick: 'sakit', training: 'training', personal: 'izin', other: 'izin' };
      (timeOffRes?.data || []).forEach(t => {
        if (t.start_time) return; // izin parsial (jam tertentu) tidak menghilangkan satu hari penuh
        const isLibur = t.leave_type === 'weekly_off' || (t.reason || '').trim().startsWith('Libur');
        const cat = categoryOf[t.leave_type] || 'izin';
        eachDayOfInterval({ start: parseISO(t.start_date), end: parseISO(t.end_date) }).forEach(d => {
          const key = format(d, 'yyyy-MM-dd');
          if (!periodSet.has(key)) return;
          if (isLibur) liburDates.add(key);
          else absentByCategory[cat].add(key);
        });
      });
      Object.values(absentByCategory).forEach(set => set.forEach(k => liburDates.delete(k)));
      // Hari libur yang diganti kerja (pengganti izin seharian) dihitung hari kerja.
      // Pengganti izin parsial tidak: hari izin parsialnya sudah dihitung hari kerja.
      (extraShiftRes?.data || []).forEach(e => {
        if (!e.replaces_partial_leave && periodSet.has(e.shift_date)) liburDates.delete(e.shift_date);
      });
      const workDays = periodDays.length - liburDates.size;

      setMetrics({
        workDays,
        absence: {
          cuti: absentByCategory.cuti.size,
          izin: absentByCategory.izin.size,
          sakit: absentByCategory.sakit.size,
          training: absentByCategory.training.size
        },
        totalPatients: allPatientsCount,
        todayAppointments: todayAppointmentsCount,
        monthlyVisitsTotal: rawMonthlyRecaps.length, 
        monthlyVisitsCalculated: targetInfo.monthlyVisitsCalculated,
        targetVisits: targetInfo.targetVisits,
        targetVisitsProgress: targetInfo.progress,
        unfilledSoapCount: unfilledCount,
        activeTargetPeriod: targetInfo.period,
        excludedTypes: targetInfo.excluded,
        targetStatus: targetInfo.status,
        annualLeaveRemaining: leaveBalanceRes?.data?.remaining ?? 0,
        annualLeaveQuota: leaveBalanceRes?.data?.quota ?? 0,
        annualLeaveEntries: leaveBalanceRes?.data?.entries ?? []
      });

    } catch (error) {
  console.error(error);
}
  };

  const handleRefresh = () => {
    loadMetrics(true);
  };

  // Helper: progress color
  const getProgressColor = (pct) => {
    if (pct >= 100) return { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    if (pct >= 60) return { bar: 'bg-app-accent-bright', text: 'text-app-accent', bg: 'bg-app-soft', border: 'border-app-accent/25' };
    return { bar: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
  };
  const progressColors = getProgressColor(metrics.targetVisitsProgress);
  const progressCapped = Math.min(metrics.targetVisitsProgress, 100);

  const absenceCards = [
    { key: 'workDays', label: 'Hari Kerja', value: metrics.workDays, sub: 'hari kerja periode ini', Icon: Briefcase, box: 'bg-app-soft', icon: 'text-app-accent', always: true },
    { key: 'cuti', label: 'Cuti', value: metrics.absence.cuti, sub: 'hari cuti periode ini', Icon: Umbrella, box: 'bg-teal-50', icon: 'text-teal-600' },
    { key: 'izin', label: 'Izin', value: metrics.absence.izin, sub: 'hari izin periode ini', Icon: FileText, box: 'bg-amber-50', icon: 'text-amber-600' },
    { key: 'sakit', label: 'Sakit', value: metrics.absence.sakit, sub: 'hari sakit periode ini', Icon: Stethoscope, box: 'bg-rose-50', icon: 'text-rose-600' },
    { key: 'training', label: 'Training', value: metrics.absence.training, sub: 'hari training periode ini', Icon: GraduationCap, box: 'bg-violet-50', icon: 'text-violet-600' }
  ].filter(c => c.always || c.value > 0);

  return (
    <div className="space-y-5 mb-8">

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Ringkasan Aktivitas</h2>
            <span className="inline-flex items-center gap-1 bg-app-soft text-app-accent border border-app-accent/15 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              <CalendarDays className="w-3 h-3" />
              {activePeriod.start ? format(activePeriod.start, 'dd MMM yyyy', { locale: idLocale }) : '...'} – {activePeriod.end ? format(activePeriod.end, 'dd MMM yyyy', { locale: idLocale }) : '...'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Data diperbarui otomatis dari rekap harian 💙</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="bg-white hover:bg-slate-50 border-slate-200 text-slate-500 h-8 px-3 text-xs shadow-none"
        >
          <RefreshCw className={cn("w-3 h-3 mr-1.5", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* ── Row 1: stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          label="Hari Ini"
          value={metrics.todayAppointments}
          sub="Sesi terapi hari ini"
          Icon={Calendar}
          iconBox="bg-emerald-50"
          iconColor="text-emerald-600"
          barTrack="bg-slate-100"
          barColor="bg-emerald-400"
          progress={Math.min(metrics.todayAppointments * 10, 100)}
        />

        <StatCard
          label="Pasien"
          value={metrics.totalPatients}
          sub="Kunjungan periode ini"
          Icon={Users}
          iconBox="bg-app-soft"
          iconColor="text-app-accent"
          barTrack="bg-slate-100"
          barColor="bg-app-accent-bright"
          progress={Math.min(metrics.totalPatients * 2, 100)}
        />

        <StatCard
          onClick={() => navigate('/therapist/records')}
          label="SOAP"
          value={metrics.unfilledSoapCount}
          sub={metrics.unfilledSoapCount > 0 ? "Kunjungan belum tercatat →" : "Semua sudah tercatat ✓"}
          Icon={AlertCircle}
          tone={metrics.unfilledSoapCount > 0 ? 'danger' : undefined}
          iconBox={metrics.unfilledSoapCount > 0 ? "bg-rose-100" : "bg-slate-50"}
          iconColor={metrics.unfilledSoapCount > 0 ? "text-rose-600" : "text-slate-500"}
          barTrack="bg-rose-100"
          barColor={metrics.unfilledSoapCount > 0 ? "bg-rose-400" : "bg-emerald-400"}
          progress={metrics.unfilledSoapCount > 0 ? 100 : 0}
        />

        <StatCard
          label="Target"
          value={`${progressCapped}%`}
          sub={`${metrics.monthlyVisitsCalculated} / ${metrics.targetVisits} kunjungan`}
          Icon={Target}
          surface={cn(progressColors.bg, progressColors.border)}
          labelColor={progressColors.text}
          valueColor={progressColors.text}
          iconBox="bg-white/60"
          iconColor={progressColors.text}
          barTrack="bg-white/60"
          barColor={progressColors.bar}
          progress={progressCapped}
        />

        <StatCard
          onClick={() => setLeaveDialogOpen(true)}
          label="Cuti Tahunan"
          value={metrics.annualLeaveRemaining}
          sub={`dari ${metrics.annualLeaveQuota} hari tersisa`}
          Icon={Umbrella}
          iconBox="bg-teal-50"
          iconColor="text-teal-600"
          barTrack="bg-slate-100"
          barColor="bg-teal-400"
          progress={metrics.annualLeaveQuota ? Math.min((metrics.annualLeaveRemaining / metrics.annualLeaveQuota) * 100, 100) : 0}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* ── Row 2: hari kerja & ketidakhadiran periode (kartu absensi hanya muncul bila ada) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {absenceCards.map(({ key, label, value, sub, Icon, box, icon }, i) => (
          <StatCard
            key={key}
            label={label}
            value={value}
            sub={sub}
            Icon={Icon}
            iconBox={box}
            iconColor={icon}
            className={absenceCards.length % 2 === 1 && i === absenceCards.length - 1 ? "col-span-2 lg:col-span-1" : undefined}
          />
        ))}
      </div>

      {/* Dialog: daftar tanggal cuti tahunan */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Riwayat Cuti Tahunan</DialogTitle>
            <DialogDescription>
              Terpakai {metrics.annualLeaveQuota - metrics.annualLeaveRemaining} dari {metrics.annualLeaveQuota} hari · sisa {metrics.annualLeaveRemaining} hari
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {metrics.annualLeaveEntries.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">Belum ada cuti tahunan yang diambil.</p>
            ) : (
              metrics.annualLeaveEntries.map((entry) => {
                const sameDay = entry.start_date === entry.end_date;
                const fmt = (d) => format(new Date(`${d}T00:00:00`), 'dd MMM yyyy', { locale: idLocale });
                return (
                  <div key={entry.id} className="rounded-app border border-slate-100 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-teal-600" />
                      {sameDay ? fmt(entry.start_date) : `${fmt(entry.start_date)} – ${fmt(entry.end_date)}`}
                    </p>
                    {entry.start_time && entry.end_time && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Pukul {entry.start_time.slice(0, 5)} – {entry.end_time.slice(0, 5)}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      Keterangan: {entry.reason || '-'}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default TherapistMetrics;