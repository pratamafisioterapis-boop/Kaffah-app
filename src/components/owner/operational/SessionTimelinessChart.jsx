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

  return (
    <Card className="rounded-xl border-slate-200 shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col h-full">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-slate-800">Ketepatan Waktu Sesi</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {loading ? (
           <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-[250px]">
             <Loader2 className="h-8 w-8 animate-spin text-primary" />
             <p className="text-xs text-slate-500">Menganalisis data sesi...</p>
           </div>
        ) : error ? (
           <div className="flex-1 flex flex-col items-center justify-center gap-2 text-red-500 min-h-[250px]">
             <AlertCircle className="h-6 w-6" />
             <p className="text-sm">{error}</p>
             <Button variant="outline" size="sm" onClick={fetchTimelinessData}>Coba Lagi</Button>
           </div>
        ) : stats.total === 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center text-slate-400 min-h-[250px]">
             <p>Tidak ada data sesi selesai pada periode ini.</p>
           </div>
        ) : (
          <div className="flex flex-col gap-6 mt-2">
            {/* Compliance Percentage (Gauge Visualization) */}
            <div className="flex flex-col items-center justify-center relative h-[140px]">
               <div className="relative w-48 h-24 overflow-hidden">
                 <div className="absolute top-0 left-0 w-full h-full bg-slate-100 rounded-t-full"></div>
                 <div 
                   className="absolute top-0 left-0 w-full h-full bg-emerald-500 rounded-t-full origin-bottom transition-all duration-1000 ease-out"
                   style={{ 
                     transform: `rotate(${Math.min(180, (complianceRate / 100) * 180) - 180}deg)` 
                   }} 
                 ></div>
               </div>
               <div className="absolute bottom-4 flex flex-col items-center">
                 <span className="text-3xl font-extrabold text-slate-800">{complianceRate}%</span>
                 <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Compliance</span>
               </div>
            </div>

            {/* Breakdown Bar Chart */}
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="horizontal" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    interval={0}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip 
                     cursor={{ fill: '#f1f5f9' }}
                     contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                     formatter={(value) => [`${value} Sesi`, 'Jumlah']}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            {/* Text Breakdown */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-600 border-t pt-4 border-slate-100">
               <div>
                  <span className="block font-bold text-emerald-600">{stats.onTime}</span>
                  On-Time
               </div>
               <div>
                  <span className="block font-bold text-amber-500">{stats.lateStart}</span>
                  Late Start
               </div>
               <div>
                  <span className="block font-bold text-red-500">{stats.overDuration}</span>
                  Over Duration
               </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SessionTimelinessChart;