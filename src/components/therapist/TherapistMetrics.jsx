import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  Target,
  AlertCircle,
  RefreshCw,
  Ban,
  CalendarDays,
  Lightbulb
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getTherapistRecaps, getTherapistTargetProgress, getActiveTherapistTarget, getAppointments } from '@/lib/api';
import { getUnfilledSOAPVisits } from '@/lib/therapistDataUtils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';


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
    patientTypeStats: {}
  });
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


let startPeriod;
let endPeriod;

if (now.getDate() >= 28) {
  startPeriod = new Date(now.getFullYear(), now.getMonth(), 28);
  endPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 27);
} else {
  startPeriod = new Date(now.getFullYear(), now.getMonth() - 1, 28);
  endPeriod = new Date(now.getFullYear(), now.getMonth(), 27);
}

const startCustom = format(startPeriod, 'yyyy-MM-dd');
const endCustom = format(endPeriod, 'yyyy-MM-dd');
setActivePeriod({ start: startPeriod, end: endPeriod });

const [
  recapsRes,
  activeTargetRes,
  unfilledRes,
  patientTypeRes,
  todayAppointmentsRes
] = await Promise.all([
  getTherapistRecaps(therapist.id, { startDate: startMonth, endDate: endMonth }),
  getActiveTherapistTarget(therapist.id),  // ← pakai therapist.id bukan userId
  getUnfilledSOAPVisits(null, therapist.id, startCustom, endCustom),
  getTherapistRecaps(therapist.id, { startDate: startCustom, endDate: endCustom }),
  getAppointments({ date: todayISO, therapistId: therapist.id })
]);

// Fetch target progress setelah dapat activeTarget (perlu start_date & end_date dulu)
const activeTarget = activeTargetRes?.data;
const targetProgressRes = activeTarget
  ? await getTherapistTargetProgress(therapist.id, activeTarget.start_date, activeTarget.end_date)
  : { data: null };

const rawMonthlyRecaps = recapsRes.data || [];
      const periodRecaps = patientTypeRes.data || [];

      const patientTypeStats = periodRecaps.reduce((acc, item) => {
        const type = item.patient_type || 'LAINNYA';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

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
      setMetrics({
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
        patientTypeStats
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
    if (pct >= 60) return { bar: 'bg-blue-500', text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
    return { bar: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
  };
  const progressColors = getProgressColor(metrics.targetVisitsProgress);
  const progressCapped = Math.min(metrics.targetVisitsProgress, 100);

  return (
    <div className="space-y-5 mb-8">

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Ringkasan Aktivitas</h2>
            <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 border border-indigo-100 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              <CalendarDays className="w-3 h-3" />
              {activePeriod.start ? format(activePeriod.start, 'dd MMM yyyy', { locale: idLocale }) : '...'} – {activePeriod.end ? format(activePeriod.end, 'dd MMM yyyy', { locale: idLocale }) : '...'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Data diperbarui otomatis dari rekap harian 💙</p>
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

      {/* ── Row 1: 4 stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Card: Jadwal Hari Ini */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hari Ini</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900 leading-none">{metrics.todayAppointments}</p>
            <p className="text-xs text-slate-400 mt-1">Sesi terapi hari ini</p>
          </div>
          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(metrics.todayAppointments * 10, 100)}%` }} />
          </div>
        </div>

        {/* Card: Total Pasien */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pasien</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900 leading-none">{metrics.totalPatients}</p>
            <p className="text-xs text-slate-400 mt-1">Kunjungan periode ini</p>
          </div>
          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(metrics.totalPatients * 2, 100)}%` }} />
          </div>
        </div>

        {/* Card: SOAP Belum Diisi */}
        <div
          onClick={() => navigate('/therapist/records')}
          className={cn(
            "rounded-2xl border shadow-sm p-4 flex flex-col gap-3 cursor-pointer hover:shadow-md transition-shadow",
            metrics.unfilledSoapCount > 0
              ? "bg-rose-50 border-rose-200"
              : "bg-white border-slate-100"
          )}
        >
          <div className="flex items-center justify-between">
            <span className={cn("text-xs font-semibold uppercase tracking-wider", metrics.unfilledSoapCount > 0 ? "text-rose-400" : "text-slate-400")}>
              SOAP
            </span>
            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", metrics.unfilledSoapCount > 0 ? "bg-rose-100" : "bg-slate-50")}>
              <AlertCircle className={cn("w-4 h-4", metrics.unfilledSoapCount > 0 ? "text-rose-600" : "text-slate-400")} />
            </div>
          </div>
          <div>
            <p className={cn("text-3xl font-bold leading-none", metrics.unfilledSoapCount > 0 ? "text-rose-700" : "text-slate-900")}>
              {metrics.unfilledSoapCount}
            </p>
            <p className={cn("text-xs mt-1", metrics.unfilledSoapCount > 0 ? "text-rose-500" : "text-slate-400")}>
              {metrics.unfilledSoapCount > 0 ? "Kunjungan belum tercatat →" : "Semua sudah tercatat ✓"}
            </p>
          </div>
          <div className="h-1 w-full bg-rose-100 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full", metrics.unfilledSoapCount > 0 ? "bg-rose-400" : "bg-emerald-400")}
              style={{ width: metrics.unfilledSoapCount > 0 ? '100%' : '0%' }}
            />
          </div>
        </div>

        {/* Card: Target Progress */}
        <div className={cn("rounded-2xl border shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow", progressColors.bg, progressColors.border)}>
          <div className="flex items-center justify-between">
            <span className={cn("text-xs font-semibold uppercase tracking-wider", progressColors.text)}>Target</span>
            <div className={cn("w-8 h-8 rounded-xl bg-white/60 flex items-center justify-center")}>
              <Target className={cn("w-4 h-4", progressColors.text)} />
            </div>
          </div>
          <div>
            <p className={cn("text-3xl font-bold leading-none", progressColors.text)}>{progressCapped}%</p>
            <p className="text-xs text-slate-500 mt-1">
              {metrics.monthlyVisitsCalculated} / {metrics.targetVisits} kunjungan
            </p>
          </div>
          <div className="h-1.5 w-full bg-white/60 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", progressColors.bar)}
              style={{ width: `${progressCapped}%` }}
            />
          </div>
        </div>

      </div>

      {/* ── Row 2: Tipe Pasien ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Distribusi Tipe Pasien</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {Object.values(metrics.patientTypeStats).reduce((s, v) => s + v, 0)} total
          </span>
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-50 mx-5" />

        {/* Content */}
        {Object.keys(metrics.patientTypeStats).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-xs font-medium text-slate-400">Belum ada data periode ini</p>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-3">
            {(() => {
              const total = Object.values(metrics.patientTypeStats).reduce((s, v) => s + v, 0);
              const colors = [
                { bar: 'bg-indigo-500', light: 'bg-indigo-50', text: 'text-indigo-600' },
                { bar: 'bg-violet-500', light: 'bg-violet-50', text: 'text-violet-600' },
                { bar: 'bg-blue-500',   light: 'bg-blue-50',   text: 'text-blue-600'   },
                { bar: 'bg-cyan-500',   light: 'bg-cyan-50',   text: 'text-cyan-600'   },
                { bar: 'bg-teal-500',   light: 'bg-teal-50',   text: 'text-teal-600'   },
                { bar: 'bg-emerald-500',light: 'bg-emerald-50',text: 'text-emerald-600' },
              ];
              return Object.entries(metrics.patientTypeStats)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count], i) => {
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const color = colors[i % colors.length];
                  return (
                    <div key={type} className="flex items-center gap-3 group">
                      {/* Color dot */}
                      <div className={`w-2 h-2 rounded-full shrink-0 ${color.bar}`} />
                      {/* Label */}
                      <span className="text-xs font-medium text-slate-600 w-24 truncate capitalize">
                        {type.toLowerCase()}
                      </span>
                      {/* Bar */}
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${color.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {/* Count badge */}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color.light} ${color.text} min-w-[2rem] text-center`}>
                        {count}
                      </span>
                    </div>
                  );
                });
            })()}
          </div>
        )}
      </div>

    </div>
  );
};

export default TherapistMetrics;