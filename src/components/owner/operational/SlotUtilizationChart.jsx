import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';

const SlotUtilizationChart = () => {
  const [data, setData] = useState([]);
  const [metrics, setMetrics] = useState({ filled: 0, empty: 0, utilization: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUtilizationData = async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date();
      // Adjust to Jakarta/Local timezone concepts if needed, but simplistic "today" based on client browser is usually acceptable for dashboards unless strict server time is required.
      // Ideally we use the server date or consistent ISO string.
      const dateStr = format(today, 'yyyy-MM-dd');
      const dayOfWeek = today.getDay(); // 0 = Sunday

      // 1. Fetch Global Settings for default slot duration
      const { data: settings } = await supabase
        .from('appointment_settings')
        .select('slot_duration')
        .single();
      const slotDuration = settings?.slot_duration || 60;

      // 2. Fetch Active Schedules for today's day of week
      const { data: schedules, error: schedError } = await supabase
        .from('therapist_schedules')
        .select(`
            id, 
            therapist_id, 
            start_time, 
            end_time,
            therapist_slots(id, is_available)
        `)
        .eq('is_active', true)
        .eq('day_of_week', dayOfWeek);

      if (schedError) throw schedError;

      // 3. Fetch Time Offs for today
      const { data: timeOffs, error: toError } = await supabase
        .from('therapist_time_off')
        .select('therapist_id')
        .lte('start_date', dateStr)
        .gte('end_date', dateStr);

      if (toError) throw toError;

      // Set of therapist IDs on leave
      const therapistsOnLeave = new Set(timeOffs?.map(t => t.therapist_id) || []);

      // 4. Calculate Total Capacity
      let totalCapacity = 0;
      
      schedules.forEach(schedule => {
        // Skip if therapist is on leave
        if (therapistsOnLeave.has(schedule.therapist_id)) return;

        let slotsCount = 0;
        
        // Priority: Manual Slots from DB > Calculated from Time Range
        if (schedule.therapist_slots && schedule.therapist_slots.length > 0) {
            // Count available + booked slots (total capacity is the sum of all slots defined)
            // Assuming 'is_available' toggles availability, but existence implies capacity.
            // If is_available=false means "blocked by admin", we might exclude it. 
            // Usually capacity = potential slots. Let's count all defined slots.
            slotsCount = schedule.therapist_slots.length;
        } else if (schedule.start_time && schedule.end_time) {
            // Calculate
            const startParts = schedule.start_time.split(':');
            const endParts = schedule.end_time.split(':');
            const startMins = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
            const endMins = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
            
            if (endMins > startMins) {
                slotsCount = Math.floor((endMins - startMins) / slotDuration);
            }
        }
        
        totalCapacity += slotsCount;
      });

      // 5. Fetch Filled Slots (Appointments Today)
      // Status: confirmed, ongoing, completed
      const { count: filledCount, error: appError } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .gte('appointment_date', `${dateStr}T00:00:00`)
        .lte('appointment_date', `${dateStr}T23:59:59`)
        .in('status', ['confirmed', 'ongoing', 'completed']);

      if (appError) throw appError;

      const safeFilled = filledCount || 0;
      const safeCapacity = totalCapacity || 0;
      // Empty slots cannot be negative if overbooked (force 0)
      const safeEmpty = Math.max(0, safeCapacity - safeFilled);
      
      const utilizationRate = safeCapacity > 0 
        ? Math.round((safeFilled / safeCapacity) * 100) 
        : 0;

      setMetrics({
        filled: safeFilled,
        empty: safeEmpty,
        utilization: utilizationRate
      });

      setData([
        { name: 'Terisi', value: safeFilled, color: '#3b82f6' },
        { name: 'Kosong', value: safeEmpty, color: '#e2e8f0' }
      ]);

    } catch (err) {
      console.error("Error fetching slot utilization:", err);
      setError("Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUtilizationData();

    // Setup realtime listener for updates
    const channel = supabase
      .channel('utilization_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchUtilizationData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'therapist_schedules' }, () => fetchUtilizationData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Card className="rounded-xl border-slate-200 shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-bold text-slate-800">Utilisasi Slot Hari Ini</CardTitle>
        {!loading && !error && (
            <Button variant="ghost" size="sm" onClick={fetchUtilizationData} className="h-8 w-8 p-0">
                <RefreshCw className="h-4 w-4 text-slate-500" />
            </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
        {loading ? (
           <div className="flex flex-col items-center gap-2">
             <Loader2 className="h-8 w-8 animate-spin text-primary" />
             <p className="text-xs text-slate-500">Memuat data...</p>
           </div>
        ) : error ? (
           <div className="flex flex-col items-center gap-2 text-red-500">
             <AlertCircle className="h-6 w-6" />
             <p className="text-sm">{error}</p>
             <Button variant="outline" size="sm" onClick={fetchUtilizationData}>Coba Lagi</Button>
           </div>
        ) : metrics.filled === 0 && metrics.empty === 0 ? (
           <div className="flex flex-col items-center gap-2 text-slate-400">
             <p>Tidak ada data jadwal hari ini.</p>
           </div>
        ) : (
          <div className="h-[300px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={100}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke="none"
                  paddingAngle={2}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name) => [value, name === 'Terisi' ? 'Slot Terisi' : 'Slot Kosong']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] flex flex-col items-center pointer-events-none">
               <span className="text-4xl font-bold text-blue-600">{metrics.utilization}%</span>
               <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Utilization</span>
            </div>
            <div className="absolute bottom-10 w-full text-center text-xs text-slate-400">
               Total Kapasitas: {metrics.filled + metrics.empty} Slot
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SlotUtilizationChart;