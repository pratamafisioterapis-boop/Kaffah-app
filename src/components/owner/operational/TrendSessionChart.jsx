import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2 } from 'lucide-react';

const TrendSessionChart = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSessionTrend = async () => {
      try {
        setLoading(true);
        const today = new Date();
        // Calculate start (Monday) and end (Sunday) of the current week
        const startDate = startOfWeek(today, { weekStartsOn: 1 }); // 1 = Monday
        const endDate = endOfWeek(today, { weekStartsOn: 1 });

        const startDateStr = format(startDate, 'yyyy-MM-dd');
        const endDateStr = format(endDate, 'yyyy-MM-dd');

        // Fetch daily recaps for this range
        const { data: recaps, error: fetchError } = await supabase
          .from('daily_recaps')
          .select('recap_date')
          .gte('recap_date', startDateStr)
          .lte('recap_date', endDateStr);

        if (fetchError) throw fetchError;

        // Generate all days in the interval to ensure 0s are represented
        const daysInterval = eachDayOfInterval({ start: startDate, end: endDate });

        // Process data
        const chartData = daysInterval.map(day => {
          // Count sessions for this specific day
          // Ensure we compare dates correctly (ignoring time)
          const count = recaps.filter(recap => 
            isSameDay(new Date(recap.recap_date), day)
          ).length;

          return {
            date: format(day, 'eee', { locale: id }), // Sen, Sel, Rab, etc.
            fullDate: format(day, 'dd MMM yyyy', { locale: id }),
            sessions: count
          };
        });

        setData(chartData);
      } catch (err) {
        console.error("Error fetching session trend:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSessionTrend();

    // Subscribe to realtime changes for live updates
    const channel = supabase
      .channel('trend-chart-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_recaps' },
        () => {
          fetchSessionTrend();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (error) {
    return (
      <Card className="rounded-xl border-red-200 shadow-sm bg-red-50">
        <CardContent className="pt-6 flex items-center justify-center text-red-600">
          <p>Gagal memuat data grafik.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border-slate-200 shadow-lg hover:shadow-2xl transition-all duration-300">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-slate-800 flex justify-between items-center">
          <span>Tren Sesi Minggu Ini</span>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          {loading && data.length === 0 ? (
             <div className="h-full w-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
             </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }} 
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  labelStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                  labelFormatter={(label, payload) => {
                    if (payload && payload.length > 0) {
                      return payload[0].payload.fullDate;
                    }
                    return label;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="sessions" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorSessions)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TrendSessionChart;