import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";

const SessionTimelinessChart = ({ dateRange }) => {
  const [chartData, setChartData] = useState([]);
  const [complianceRate, setComplianceRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ onTime: 0, lateStart: 0, overDuration: 0, total: 0 });

  const fetchTimelinessData = async () => {
    if (!dateRange?.startDate || !dateRange?.endDate) return;

    setLoading(true);
    setError(null);
    try {
      // Fetch daily recaps (actual execution) joined with appointments (scheduled info)
      // Note: We need appointment data to know scheduled time and duration
      // Some recaps might not have appointment_id if created manually without appointment, 
      // but usually for timeliness we care about scheduled ones.
      // FIX: Use explicit foreign key to avoid ambiguity (PGRST201)
      const { data: recaps, error: fetchError } = await supabase
        .from('daily_recaps')
        .select(`
          id, 
          start_time, 
          end_time, 
          appointment_id,
          appointments!daily_recaps_appointment_id_fkey!inner (
            appointment_date,
            duration_minutes
          )
        `)
        .gte('recap_date', dateRange.startDate)
        .lte('recap_date', dateRange.endDate)
        .not('start_time', 'is', null)
        .not('end_time', 'is', null);

      if (fetchError) throw fetchError;

      let onTimeCount = 0;
      let lateStartCount = 0;
      let overDurationCount = 0;

      recaps.forEach(recap => {
        const appointment = recap.appointments;
        if (!appointment) return;

        const scheduledStart = new Date(appointment.appointment_date);
        const actualStart = new Date(recap.start_time);
        const actualEnd = new Date(recap.end_time);

        // Calculate differences in minutes
        const startDiffMinutes = (actualStart - scheduledStart) / (1000 * 60);
        const actualDurationMinutes = (actualEnd - actualStart) / (1000 * 60);
        const scheduledDuration = appointment.duration_minutes || 60;
        
        // Logic Definitions:
        // Late Start: started > 5 mins after scheduled time
        const isLateStart = startDiffMinutes > 5;

        // Over Duration: exceeded scheduled duration by > 5 mins
        const isOverDuration = actualDurationMinutes > (scheduledDuration + 5);

        // On Time: Not late start AND not over duration 
        // (This implies started within 5 mins window or early, AND finished within limit)
        // If strict "On Time" means adherence to both start and duration:
        const isOnTime = !isLateStart && !isOverDuration;

        if (isOnTime) onTimeCount++;
        
        // Note: A session can be both Late Start and Over Duration.
        // For the bar chart, we usually want to show the 'issues'.
        // If we want them exclusive for a 100% total, we need priority.
        // Here we will just count flags for the bar chart categories.
        if (isLateStart) lateStartCount++;
        if (isOverDuration) overDurationCount++;
      });

      const totalSessions = recaps.length;
      const rate = totalSessions > 0 ? Math.round((onTimeCount / totalSessions) * 100) : 0;

      setComplianceRate(rate);
      setStats({
        onTime: onTimeCount,
        lateStart: lateStartCount,
        overDuration: overDurationCount,
        total: totalSessions
      });

      setChartData([
        { category: 'On-Time', value: onTimeCount, color: '#10b981' }, // Green
        { category: 'Late Start', value: lateStartCount, color: '#f59e0b' }, // Amber
        { category: 'Over Duration', value: overDurationCount, color: '#ef4444' }, // Red
      ]);

    } catch (err) {
      console.error("Error fetching timeliness data:", err);
      setError("Gagal memuat data ketepatan waktu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimelinessData();
  }, [dateRange]);

  const complianceColor = complianceRate >= 80 ? '#10b981' : complianceRate >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <Card className="rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
      <div className="p-5 md:p-6 pb-0">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">Ketepatan Waktu Sesi</h3>
            <p className="text-xs text-slate-400 mt-0.5">Analisis kepatuhan waktu terapis</p>
          </div>
          {!loading && stats.total > 0 && (
            <div className="text-right">
              <p className="text-xl font-black leading-none" style={{ color: complianceColor }}>{complianceRate}%</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Compliance</p>
            </div>
          )}
        </div>
      </div>

      <CardContent className="pt-4 pb-5 px-5 md:px-6">
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-slate-200" />
          </div>
        ) : error ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2 text-rose-500 text-sm">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={fetchTimelinessData}>Coba Lagi</Button>
          </div>
        ) : stats.total === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
            Tidak ada data sesi pada periode ini.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Compliance ring + stats */}
            <div className="flex items-center gap-4">
              {/* SVG Ring kecil */}
              <div className="relative shrink-0" style={{ width: 88, height: 88 }}>
                <svg width="88" height="88" viewBox="0 0 88 88">
                  <circle cx="44" cy="44" r="36" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                  <circle
                    cx="44" cy="44" r="36"
                    fill="none"
                    stroke={complianceColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(complianceRate / 100) * 2 * Math.PI * 36} ${2 * Math.PI * 36}`}
                    strokeDashoffset={2 * Math.PI * 36 / 4}
                    style={{ transition: 'stroke-dasharray 0.7s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-black leading-none" style={{ color: complianceColor }}>{complianceRate}%</span>
                  <span className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">Compliance</span>
                </div>
              </div>

              {/* 3 stats vertikal */}
              <div className="flex-1 grid grid-cols-3 gap-2">
                {[
                  { label: 'On-Time', value: stats.onTime, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Late Start', value: stats.lateStart, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Over Dur.', value: stats.overDuration, color: 'text-rose-600', bg: 'bg-rose-50' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl py-3 text-center`}>
                    <p className={`text-xl md:text-2xl font-black leading-none ${s.color}`}>{s.value}</p>
                    <p className="text-[9px] text-slate-400 font-semibold mt-1 leading-tight">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bar chart */}
            <div className="h-[150px] md:h-[170px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} width={24} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc', radius: 8 }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: '12px' }}
                    formatter={(value) => [`${value} Sesi`, 'Jumlah']}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-[10px] font-medium text-slate-400 mb-1.5">
                <span>Compliance Rate</span>
                <span className="font-bold" style={{ color: complianceColor }}>{complianceRate}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${complianceRate}%`, backgroundColor: complianceColor }} />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SessionTimelinessChart;