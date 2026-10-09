import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { getAllTherapistTargets, getDailyRecaps, getCachedClinicId } from '@/lib/api';
import { supabase } from '@/lib/customSupabaseClient';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isValid } from 'date-fns';

// Helper: hitung periode aktif (28 bulan lalu/ini s/d 27 bulan ini/depan)
const getCurrentPeriod = () => {
  const now = new Date();
  let start, end;
  if (now.getDate() >= 28) {
    start = new Date(now.getFullYear(), now.getMonth(), 28);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 27);
  } else {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 28);
    end = new Date(now.getFullYear(), now.getMonth(), 27);
  }
  return { start, end };
};

const BulletChartTargetVsRealization = ({ dateRange }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      
      // 1. Fetch All Targets
      const { data: targets, error: targetError } = await getAllTherapistTargets();
      if (targetError) throw new Error("Gagal memuat data target: " + targetError.message);


      // Filter: Must have therapist info
      const validTargets = targets.filter(t => t.therapist?.name || t.therapist?.full_name);

      if (validTargets.length === 0) {
        console.warn("No valid targets found (targets with therapist info).");
        setData([]);
        setLoading(false);
        return;
      }

      const processedTargets = validTargets.map(t => {
         let start, end;

         // Priority 1: Explicit Date Range in Target
         if (t.start_date && t.end_date) {
            start = new Date(t.start_date);
            end = new Date(t.end_date);
         }
         // Priority 2: Month Field
         else if (t.month) {
            const m = new Date(t.month);
            start = new Date(m.getFullYear(), m.getMonth(), 1);
            end = new Date(m.getFullYear(), m.getMonth() + 1, 0); // Last day of month
         }
         // Fallback: Periode berjalan (28 bulan lalu/ini s/d 27 bulan ini/depan)
         else {
            const period = getCurrentPeriod();
            start = period.start;
            end = period.end;
         }

         return {
            ...t,
            parsedStart: start,
            parsedEnd: end,
            therapistName: t.therapist.name || t.therapist.full_name
         };
      });

      // 2. Calculate Realization Per Target
      // Logic: For each unique therapist, pick the BEST target record.
      // Priority: Has values > 0, then Latest Date.
      const activeTargetsByTherapist = {};

      // Sort targets: First by presence of value (desc), then by End Date (desc)
      processedTargets.sort((a, b) => {
          const valA = Number(a.target_sessions || 0) + Number(a.target_visits || 0);
          const valB = Number(b.target_sessions || 0) + Number(b.target_visits || 0);

          if (valA > 0 && valB === 0) return -1;
          if (valB > 0 && valA === 0) return 1;

          return b.parsedEnd - a.parsedEnd;
      });

      processedTargets.forEach(t => {
         const name = t.therapistName;
         // Since we sorted by priority, the first one we see for a therapist is the "best" one
         if (!activeTargetsByTherapist[name]) {
            activeTargetsByTherapist[name] = t;
         }
      });

      // Filter: hanya tampilkan target yang overlap dengan periode berjalan saat ini
      const { start: currentStart, end: currentEnd } = getCurrentPeriod();
      const filteredTargets = Object.values(activeTargetsByTherapist).filter(target => {
        return target.parsedStart <= currentEnd && target.parsedEnd >= currentStart;
      });

      if (filteredTargets.length === 0) {
        console.warn("No targets overlapping the current period.");
        setData([]);
        setLoading(false);
        return;
      }

      // 3. Determine Date Bounds for Recap Fetch — only the periods actually
      // being displayed (overlapping the current period), not every historical
      // target, so the range stays small and we don't silently truncate at
      // PostgREST's default 1000-row response cap.
      let minDate = filteredTargets[0].parsedStart;
      let maxDate = filteredTargets[0].parsedEnd;
      filteredTargets.forEach(t => {
         if (isValid(t.parsedStart) && t.parsedStart < minDate) minDate = t.parsedStart;
         if (isValid(t.parsedEnd) && t.parsedEnd > maxDate) maxDate = t.parsedEnd;
      });

      const fetchStart = format(minDate, 'yyyy-MM-dd');
      const fetchEnd = format(maxDate, 'yyyy-MM-dd');


      // Fetch langsung dari supabase agar bisa select field spesifik
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData?.session?.user?.id;
      const currentUserRow = { clinic_id: await getCachedClinicId(currentUserId) };

      // Paginate explicitly so we never silently drop rows if a clinic/period
      // ends up with more than one page (PostgREST default cap is 1000 rows).
      let recaps = [];
      const PAGE_SIZE = 1000;
      for (let page = 0; ; page++) {
        const { data: pageData, error: recapError } = await supabase
          .from('daily_recaps')
          .select('therapist_id, recap_date, patient_type')
          .eq('clinic_id', currentUserRow?.clinic_id)
          .gte('recap_date', fetchStart)
          .lte('recap_date', fetchEnd)
          .order('recap_date', { ascending: true })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

        if (recapError) throw new Error("Gagal memuat data realisasi: " + recapError.message);

        recaps = recaps.concat(pageData || []);
        if (!pageData || pageData.length < PAGE_SIZE) break;
      }


      const chartData = filteredTargets.map(target => {
         const targetStart = startOfDay(target.parsedStart);
         const targetEnd = endOfDay(target.parsedEnd);
         const excludedTypes = [...(target.excluded_patient_types || []), 'registered', 'guest'];

         const actualCount = recaps.filter(r => {
            // Match pakai therapist_id (lebih reliable dari nama)
            if (r.therapist_id !== target.therapist_id) return false;

            // Filter excluded patient types
            if (excludedTypes.includes(r.patient_type)) return false;

            // Date check
            const rDate = parseISO(r.recap_date);
            return isWithinInterval(rDate, { start: targetStart, end: targetEnd });
         }).length;

         const targetValue = Math.max(
             Number(target.target_sessions || 0),
             Number(target.target_visits || 0),
             Number(target.target_visits || 0), // target_visits adalah field utama
             Number(target.target_patients || 0)
         );


         return {
            name: target.therapistName,
            // Display: First name + first letter of last name if exists, or just first name
            displayName: target.therapistName.split(' ').slice(0, 2).join(' '), 
            target: targetValue,
            realization: actualCount,
            periodLabel: `${format(target.parsedStart, 'dd MMM')} - ${format(target.parsedEnd, 'dd MMM yyyy')}`
         };
      });

      // Sort: Highest realization first
      chartData.sort((a, b) => b.realization - a.realization);

      setData(chartData);
      setLastUpdated(new Date());

    } catch (err) {
      console.error("Error in BulletChartTargetVsRealization:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload; // Access the full data object
      return (
        <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-app-sm text-xs z-50">
          <p className="font-bold text-slate-800 mb-1">{label}</p>
          <p className="text-slate-500 mb-2 text-xs">{dataPoint.periodLabel}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: entry.fill }}
              />
              <span className="text-slate-500 capitalize">{entry.name}:</span>
              <span className="font-semibold ml-auto">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (error) {
    return (
      <Card className="h-full flex flex-col rounded-app-lg border border-slate-100 shadow-sm overflow-hidden">
         <CardHeader className="flex flex-row items-center justify-between py-4">
            <CardTitle className="text-lg font-bold text-slate-800">Target vs Realisasi</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchData}><RefreshCw className="w-4 h-4" /></Button>
         </CardHeader>
         <CardContent className="flex-1 flex flex-col items-center justify-center text-red-500 text-sm p-6 text-center">
            <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData} className="mt-4">Coba Lagi</Button>
         </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col rounded-app-lg border border-slate-100 shadow-sm [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-lg transition-shadow duration-200 overflow-hidden">
      <div className="p-5 md:p-6 pb-0 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">Target vs Realisasi</h2>
          <p className="text-xs text-slate-500 mt-0.5">Perbandingan target kunjungan dengan realisasi aktual</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastUpdated && (
            <span className="text-xs text-slate-300 hidden sm:inline">
              {format(lastUpdated, 'HH:mm')}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            aria-label="Muat ulang target dan realisasi"
            className="relative before:absolute before:-inset-2 before:content-[''] w-7 h-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-slate-100 transition-[background-color,transform] duration-150 active:scale-95"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 md:px-6 pt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-full bg-app-accent/15" />
          <span className="text-xs text-slate-500 font-medium">Target</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-full bg-indigo-500" />
          <span className="text-xs text-slate-500 font-medium">Realisasi</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-xs text-slate-500 font-medium">Tercapai</span>
        </div>
      </div>

      <CardContent className="pt-4 pb-8 px-5 md:px-6">
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-slate-200" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
            <p>Belum ada target yang diset.</p>
            <button
              onClick={() => window.location.href='/owner/physiotherapist-management'}
              className="text-xs text-indigo-500 font-semibold hover:underline"
            >
              + Tambah Target
            </button>
          </div>
        ) : (
       <div className="space-y-6">
            {data.map((item, i) => {
              const pct = item.target > 0 ? Math.min(Math.round((item.realization / item.target) * 100), 100) : 0;
              const barColor = pct >= 100 ? '#10b981' : pct >= 60 ? '#6366f1' : '#f59e0b';
              const barBg = pct >= 100 ? '#d1fae5' : pct >= 60 ? '#e0e7ff' : '#fef3c7';
              return (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.periodLabel}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-black leading-none" style={{ color: barColor }}>{pct}%</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.realization} / {item.target} kunjungan</p>
                    </div>
                  </div>
                  {/* Track */}
                  <div className="relative h-5 w-full rounded-full overflow-hidden" style={{ backgroundColor: barBg }}>
                    <div
                      className="h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
                      style={{ width: `${pct}%`, backgroundColor: barColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BulletChartTargetVsRealization;