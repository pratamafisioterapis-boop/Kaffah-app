import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, RefreshCw, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import FinanceTile, { TileLoading } from '@/components/owner/finance/FinanceTile';
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

const BulletChartTargetVsRealization = ({ dateRange, className }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  // Terapis yang barisnya dibuka untuk melihat sisa target.
  const [picked, setPicked] = useState(null);

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

  const refreshBtn = (
    <div className="flex items-center gap-2">
      {lastUpdated && <span className="hidden sm:inline text-xs text-slate-400">{format(lastUpdated, 'HH:mm')}</span>}
      <button
        type="button"
        onClick={fetchData}
        disabled={loading}
        aria-label="Muat ulang target dan realisasi"
        className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-700 flex items-center justify-center active:scale-[0.95] transition-transform"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
      </button>
    </div>
  );

  return (
    <FinanceTile tone="ind" icon={Target} title="Target vs Realisasi" action={refreshBtn} className={className}>
      {error ? (
        <div className="py-10 flex flex-col items-center justify-center text-rose-500 text-sm text-center gap-2">
          <AlertCircle className="w-7 h-7 opacity-60" />
          <p>{error}</p>
          <button type="button" onClick={fetchData} className="px-3 h-8 rounded-[10px] border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">Coba Lagi</button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 mb-3 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-1.5 rounded-full bg-indigo-100" />Target</span>
            <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-1.5 rounded-full bg-indigo-500" />Realisasi</span>
            <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-1.5 rounded-full bg-emerald-500" />Tercapai</span>
          </div>

          {loading ? (
            <TileLoading className="py-14" />
          ) : data.length === 0 ? (
            <div className="py-10 flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
              <p>Belum ada target yang diset.</p>
              <button
                type="button"
                onClick={() => { window.location.href = '/owner/physiotherapist-management'; }}
                className="text-xs text-indigo-500 font-semibold hover:underline"
              >
                + Tambah Target
              </button>
            </div>
          ) : (
            <div className="grid gap-1">
              {data.map((item, i) => {
                const pct = item.target > 0 ? Math.min(Math.round((item.realization / item.target) * 100), 100) : 0;
                const barColor = pct >= 100 ? '#10b981' : pct >= 60 ? '#6366f1' : '#f59e0b';
                const barBg = pct >= 100 ? '#d1fae5' : pct >= 60 ? '#e0e7ff' : '#fef3c7';
                const open = picked === i;
                return (
                  <button
                    key={`${item.name}-${i}`}
                    type="button"
                    onClick={() => setPicked(open ? null : i)}
                    aria-pressed={open}
                    className={cn('w-full text-left px-2 py-2.5 rounded-2xl transition-colors', open ? 'bg-slate-100' : 'hover:bg-slate-50')}
                  >
                    <span className="flex items-start justify-between gap-3 mb-1.5">
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-800 break-words">{item.name}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{item.periodLabel}</span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block text-xl font-black leading-none tabular-nums" style={{ color: barColor }}>{pct}%</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{item.realization} / {item.target} kunjungan</span>
                      </span>
                    </span>
                    <span className="block h-4 w-full rounded-full overflow-hidden" style={{ backgroundColor: barBg }}>
                      <span
                        className="block h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
                        style={{ width: `${pct}%`, backgroundColor: barColor }}
                      />
                    </span>
                    {open && (
                      <span className="block text-xs text-slate-700 mt-2">
                        {item.realization >= item.target
                          ? `Target tercapai, lebih ${item.realization - item.target} kunjungan`
                          : `Kurang ${item.target - item.realization} kunjungan lagi`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </FinanceTile>
  );
};

export default BulletChartTargetVsRealization;
