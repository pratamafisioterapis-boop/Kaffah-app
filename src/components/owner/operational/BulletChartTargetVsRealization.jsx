import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { getAllTherapistTargets, getDailyRecaps } from '@/lib/api';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isValid } from 'date-fns';

const BulletChartTargetVsRealization = ({ dateRange }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("=== Starting BulletChart Data Fetch ===");
      
      // 1. Fetch All Targets
      const { data: targets, error: targetError } = await getAllTherapistTargets();
      if (targetError) throw new Error("Gagal memuat data target: " + targetError.message);

      console.log("Raw Targets Data from DB:", targets);

      // Filter: Must have therapist info
      const validTargets = targets.filter(t => t.therapist?.name || t.therapist?.full_name);

      if (validTargets.length === 0) {
        console.warn("No valid targets found (targets with therapist info).");
        setData([]);
        setLoading(false);
        return;
      }

      // 2. Determine Date Bounds for Bulk Recap Fetch
      let minDate = new Date(); // Start with today
      let maxDate = new Date(0); // Start with epoch

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
         // Fallback: Current Month
         else {
            const now = new Date();
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
         }

         if (isValid(start) && start < minDate) minDate = start;
         if (isValid(end) && end > maxDate) maxDate = end;

         return {
            ...t,
            parsedStart: start,
            parsedEnd: end,
            therapistName: t.therapist.name || t.therapist.full_name
         };
      });

      // 3. Fetch Recaps for the entire covering period
      const fetchStart = format(minDate, 'yyyy-MM-dd');
      const fetchEnd = format(maxDate, 'yyyy-MM-dd');

      console.log(`Fetching recaps for range: ${fetchStart} to ${fetchEnd}`);

      const { data: recaps, error: recapError } = await getDailyRecaps({
        startDate: fetchStart,
        endDate: fetchEnd,
        limit: 'all'
      });

      if (recapError) throw new Error("Gagal memuat data realisasi: " + recapError.message);
      console.log(`Fetched ${recaps?.length || 0} recaps.`);

      // 4. Calculate Realization Per Target
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

      const chartData = Object.values(activeTargetsByTherapist).map(target => {
         const targetNameNorm = target.therapistName.trim().toLowerCase();
         // Ensure we compare start of day to end of day to include full dates
         const targetStart = startOfDay(target.parsedStart);
         const targetEnd = endOfDay(target.parsedEnd);

         // Count matching recaps
         const actualCount = recaps.filter(r => {
            if (!r.therapist_name) return false;
            
            // Name Check (Case insensitive, partial match)
            const rName = r.therapist_name.trim().toLowerCase();
            const isNameMatch = rName === targetNameNorm || rName.includes(targetNameNorm) || targetNameNorm.includes(rName);
            
            if (!isNameMatch) return false;

            // Date Check
            const rDate = parseISO(r.recap_date);
            return isWithinInterval(rDate, { start: targetStart, end: targetEnd });
         }).length;

         // CRITICAL FIX: Sum up all possible target fields to ensure we catch the value
         // And check for string vs number issues by casting
         const targetValue = Math.max(
             Number(target.target_sessions || 0),
             Number(target.target_visits || 0),
             Number(target.target_patients || 0)
         );

         console.log(`Therapist: ${target.therapistName} | Target Val: ${targetValue} (Sess: ${target.target_sessions}, Visits: ${target.target_visits}) | Actual: ${actualCount}`);

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

      console.log("Final Processed Chart Data:", chartData);
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
        <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-lg text-xs z-50">
          <p className="font-bold text-slate-800 mb-1">{label}</p>
          <p className="text-slate-400 mb-2 text-[10px]">{dataPoint.periodLabel}</p>
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
      <Card className="rounded-xl border-slate-200 shadow-sm h-full flex flex-col">
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
    <Card className="rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 col-span-1 lg:col-span-2 overflow-hidden">
      <div className="p-5 md:p-6 pb-0 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-800">Target vs Realisasi</h3>
          <p className="text-xs text-slate-400 mt-0.5">Perbandingan target kunjungan dengan realisasi aktual</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastUpdated && (
            <span className="text-[10px] text-slate-300 hidden sm:inline">
              {format(lastUpdated, 'HH:mm')}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="w-7 h-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 md:px-6 pt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-200" />
          <span className="text-[11px] text-slate-400 font-medium">Target</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-600" />
          <span className="text-[11px] text-slate-400 font-medium">Realisasi</span>
        </div>
      </div>

      <CardContent className="pt-4 pb-5 px-5 md:px-6">
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-slate-200" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
            <p>Belum ada target yang diset.</p>
            <button
              onClick={() => window.location.href='/owner/physiotherapist-management'}
              className="text-xs text-indigo-500 font-semibold hover:underline"
            >
              + Tambah Target
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {data.map((item, i) => {
              const pct = item.target > 0 ? Math.min(Math.round((item.realization / item.target) * 100), 100) : 0;
              const barColor = pct >= 100 ? '#10b981' : pct >= 60 ? '#6366f1' : '#f59e0b';
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{item.displayName}</p>
                      <p className="text-[10px] text-slate-400">{item.periodLabel}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black leading-none" style={{ color: barColor }}>{pct}%</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{item.realization}/{item.target}</p>
                    </div>
                  </div>
                  {/* Double bar: target (light) + realization (solid) */}
                  <div className="relative h-3 w-full bg-blue-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
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