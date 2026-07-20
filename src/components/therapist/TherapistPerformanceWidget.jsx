import React, { useState, useEffect } from 'react';
import { getTherapistRecaps, getActiveTherapistTarget, getTherapistTargetProgress } from '@/lib/api';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Loader2, TrendingUp, Flame, Target, Award, ChevronUp, ChevronDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const TherapistPerformanceWidget = ({ therapist, userId }) => {
  const [loading, setLoading] = useState(true);
  const [perf, setPerf] = useState(null);

  useEffect(() => {
    if (therapist?.id) loadPerformance();
  }, [therapist]);

  const loadPerformance = async () => {
    setLoading(true);
    try {
      const now = new Date();

      // Periode 28-27
      let startPeriod, endPeriod;
      if (now.getDate() >= 28) {
        startPeriod = new Date(now.getFullYear(), now.getMonth(), 28);
        endPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 27);
      } else {
        startPeriod = new Date(now.getFullYear(), now.getMonth() - 1, 28);
        endPeriod = new Date(now.getFullYear(), now.getMonth(), 27);
      }

      const startCustom = format(startPeriod, 'yyyy-MM-dd');
      const endCustom = format(endPeriod, 'yyyy-MM-dd');

      // 7 hari terakhir
      const last7Start = format(subDays(now, 6), 'yyyy-MM-dd');
      const todayISO = format(now, 'yyyy-MM-dd');

      // Bulan lalu untuk perbandingan
      const lastMonthStart = format(startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1)), 'yyyy-MM-dd');
      const lastMonthEnd = format(endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1)), 'yyyy-MM-dd');

      const [periodRes, last7Res, lastMonthRes, activeTargetRes] = await Promise.all([
        getTherapistRecaps(therapist.id, { startDate: startCustom, endDate: endCustom }),
        getTherapistRecaps(therapist.id, { startDate: last7Start, endDate: todayISO }),
        getTherapistRecaps(therapist.id, { startDate: lastMonthStart, endDate: lastMonthEnd }),
        getActiveTherapistTarget(therapist.id),
      ]);

      const periodRecaps = periodRes.data || [];
      const last7Recaps = last7Res.data || [];
      const lastMonthRecaps = lastMonthRes.data || [];

      // Target progress
      let targetVisits = 0;
      let actualVisits = 0;
      let achievement = 0;
      let excludedTypes = [];

      const activeTarget = activeTargetRes?.data;
      if (activeTarget) {
        const progressRes = await getTherapistTargetProgress(therapist.id, activeTarget.start_date, activeTarget.end_date);
        if (progressRes?.data) {
          targetVisits = progressRes.data.target_visits || 0;
          actualVisits = progressRes.data.actual_visits || 0;
          achievement = progressRes.data.achievement_percentage || 0;
          excludedTypes = progressRes.data.excluded_patient_types || [];
        }
      }

      // Tren 7 hari — hitung per hari
      const dailyMap = {};
      for (let i = 6; i >= 0; i--) {
        const d = format(subDays(now, i), 'yyyy-MM-dd');
        dailyMap[d] = 0;
      }
      last7Recaps.forEach(r => {
        if (dailyMap[r.recap_date] !== undefined) dailyMap[r.recap_date]++;
      });
      const daily7 = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));
      const max7 = Math.max(...daily7.map(d => d.count), 1);

      // Rata-rata per hari (dalam periode)
      const daysInPeriod = Math.max(
        Math.ceil((endPeriod - startPeriod) / (1000 * 60 * 60 * 24)) + 1, 1
      );
      const avgPerDay = (periodRecaps.length / daysInPeriod).toFixed(1);

      // Perbandingan bulan lalu
      const thisMonthCount = periodRecaps.length;
      const lastMonthCount = lastMonthRecaps.length;
      const diffPct = lastMonthCount > 0
        ? Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100)
        : 0;

      // Streak hari aktif berturut-turut
      let streak = 0;
      const checkDate = new Date(now);
      while (true) {
        const ds = format(checkDate, 'yyyy-MM-dd');
        const hasVisit = periodRecaps.some(r => r.recap_date === ds);
        if (!hasVisit) break;
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }

      setPerf({
        targetVisits,
        actualVisits,
        achievement: Math.min(achievement, 100),
        excludedTypes,
        daily7,
        max7,
        avgPerDay,
        thisMonthCount,
        lastMonthCount,
        diffPct,
        streak,
        startPeriod,
        endPeriod,
      });
    } catch (err) {
      console.error('TherapistPerformanceWidget error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!perf) return null;

  const { targetVisits, actualVisits, achievement, daily7, max7, avgPerDay, diffPct, streak, startPeriod, endPeriod } = perf;

  // Warna progress ring
  const ringColor = achievement >= 100 ? '#10b981' : achievement >= 60 ? '#6366f1' : '#f59e0b';
  const circumference = 2 * Math.PI * 36;
  const strokeDash = achievement >= 100 
    ? circumference 
    : (achievement / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <h3 className="text-sm font-bold text-slate-700 truncate">Performa Bulan Ini</h3>
        </div>
        <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap">
          {format(startPeriod, 'dd MMM', { locale: idLocale })} – {format(endPeriod, 'dd MMM yyyy', { locale: idLocale })}
        </span>
      </div>

      <div className="h-px bg-slate-50 mx-5" />

      <div className="p-5 space-y-5">

        {/* ── Baris 1: Progress Ring + Stats ── */}
        <div className="flex items-center gap-5">

          {/* Donut Ring */}
          <div className="relative shrink-0">
            <svg width="88" height="88" viewBox="0 0 88 88">
              {/* Track */}
              <circle cx="44" cy="44" r="36" fill="none" stroke="#f1f5f9" strokeWidth="8" />
              {/* Progress */}
              <circle
                cx="44" cy="44" r="36"
                fill="none"
                stroke={ringColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={achievement >= 100 
                  ? `${circumference} 0` 
                  : `${strokeDash} ${circumference - strokeDash}`}
                strokeDashoffset={circumference / 4}
                style={{ transition: 'stroke-dasharray 0.7s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-slate-800 leading-none">{achievement}%</span>
              <span className="text-[9px] text-slate-400 font-medium mt-0.5">TARGET</span>
            </div>
          </div>

          {/* Stats kanan ring */}
          <div className="flex-1 space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Kunjungan</span>
              <span className="text-sm font-bold text-slate-800">{actualVisits} <span className="text-slate-400 font-normal">/ {targetVisits}</span></span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Rata-rata/hari</span>
              <span className="text-sm font-bold text-slate-800">{avgPerDay}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">vs Bulan Lalu</span>
              <span className={cn("text-xs font-bold flex items-center gap-0.5",
                diffPct > 0 ? 'text-emerald-600' : diffPct < 0 ? 'text-rose-500' : 'text-slate-400'
              )}>
                {diffPct > 0 ? <ChevronUp className="w-3 h-3" /> : diffPct < 0 ? <ChevronDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                {Math.abs(diffPct)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-400" /> Streak aktif
              </span>
              <span className={cn("text-sm font-bold", streak >= 5 ? 'text-orange-500' : streak >= 3 ? 'text-amber-500' : 'text-slate-800')}>
                {streak} hari
              </span>
            </div>
          </div>
        </div>

        {/* ── Baris 2: Tren 7 Hari ── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Tren 7 Hari Terakhir</p>
          <div className="flex items-end gap-1.5 h-16">
            {daily7.map(({ date, count }) => {
              const isToday = date === format(new Date(), 'yyyy-MM-dd');
              const heightPct = max7 > 0 ? (count / max7) * 100 : 0;
              return (
                <div key={date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center" style={{ height: '48px' }}>
                    <div
                      className={cn(
                        "w-full rounded-t-md transition-all duration-500",
                        count === 0 ? 'bg-slate-100' :
                        isToday ? 'bg-indigo-500' : 'bg-indigo-200'
                      )}
                      style={{ height: count === 0 ? '4px' : `${Math.max(heightPct, 10)}%` }}
                    />
                  </div>
                  <span className={cn("text-[9px] font-medium", isToday ? 'text-indigo-600' : 'text-slate-400')}>
                    {format(new Date(date), 'EEE', { locale: idLocale })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Baris 3: Badge status ── */}
        <div className={cn(
          "rounded-xl px-4 py-3 flex items-center gap-3",
          achievement >= 100 ? 'bg-emerald-50 border border-emerald-100' :
          achievement >= 60 ? 'bg-indigo-50 border border-indigo-100' :
          'bg-amber-50 border border-amber-100'
        )}>
          <Award className={cn("w-5 h-5 shrink-0",
            achievement >= 100 ? 'text-emerald-500' :
            achievement >= 60 ? 'text-indigo-500' : 'text-amber-500'
          )} />
          <p className={cn("text-xs font-medium",
            achievement >= 100 ? 'text-emerald-700' :
            achievement >= 60 ? 'text-indigo-700' : 'text-amber-700'
          )}>
            {achievement >= 100 ? 'Target tercapai! Luar biasa! 🎉'
              : achievement >= 80 ? 'Hampir sampai! Sedikit lagi! 🔥'
              : achievement >= 60 ? 'On track! Pertahankan ritmenya! 🚀'
              : achievement >= 30 ? 'Awal yang bagus, teruskan! ✨'
              : 'Perjalanan baru dimulai, semangat! 🌱'}
          </p>
        </div>

      </div>
    </div>
  );
};

export default TherapistPerformanceWidget;
