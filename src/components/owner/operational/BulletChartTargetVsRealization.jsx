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
      const validTargets = targets.filter(t => t.therapist?.full_name);

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
            therapistName: t.therapist.full_name
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
    <Card className="rounded-xl border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 col-span-1 lg:col-span-2 flex flex-col h-[450px]">
      <CardHeader className="pb-2 border-b border-slate-50">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-slate-800">Target vs Realisasi</CardTitle>
            <p className="text-xs text-slate-500 mt-1">
               Membandingkan target kunjungan dengan realisasi aktual.
            </p>
          </div>
          <div className="flex items-center gap-2">
             {lastUpdated && (
                <span className="text-[10px] text-slate-400 hidden sm:inline">
                   Updated: {format(lastUpdated, 'HH:mm')}
                </span>
             )}
             <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-slate-500" 
                onClick={fetchData}
                disabled={loading}
             >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
             </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pt-4">
        {loading ? (
           <div className="h-full w-full flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-blue-500" />
              <span className="text-sm">Menghitung Data...</span>
           </div>
        ) : data.length === 0 ? (
           <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 italic">
              <p>Belum ada target yang diset.</p>
              <Button variant="link" className="text-xs mt-2" onClick={() => window.location.href='/owner/physiotherapist-management'}>
                 + Tambah Target
              </Button>
           </div>
        ) : (
          <div className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={data} 
                layout="vertical" 
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="displayName" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  width={120}
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} 
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', fontWeight: 500 }}
                />
                
                {/* Target Bar (Light Blue) */}
                <Bar 
                  dataKey="target" 
                  name="Target" 
                  fill="#93c5fd" 
                  radius={[0, 4, 4, 0]} 
                  barSize={12} 
                  animationDuration={1500}
                />
                
                {/* Realization Bar (Dark Blue) */}
                <Bar 
                  dataKey="realization" 
                  name="Realisasi" 
                  fill="#2563eb" 
                  radius={[0, 4, 4, 0]} 
                  barSize={12} 
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BulletChartTargetVsRealization;