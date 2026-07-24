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

        const { data: sessionData } = await supabase.auth.getSession();
        const currentUserId = sessionData?.session?.user?.id;
        const { data: currentUserRow } = await supabase.from('users').select('clinic_id').eq('id', currentUserId).single();

        // Fetch daily recaps for this range
        const { data: recaps, error: fetchError } = await supabase
          .from('daily_recaps')
          .select('recap_date')
          .eq('clinic_id', currentUserRow?.clinic_id)
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

  const totalSessions = data.reduce((s, d) => s + d.sessions, 0);
  const peakDay = data.reduce((max, d) => d.sessions > max.sessions ? d : max, data[0] || { sessions: 0, date: '-' });

  return (
    <Card className="rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
      {/* Header */}
      <div className="p-5 md:p-6 pb-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-800">Tren Sesi Minggu Ini</h3>
            <p className="text-xs text-slate-400 mt-0.5">Total kunjungan per hari</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Mini stats */}
            <div className="text-right">
              <p className="text-xl font-black text-slate-900 leading-none">{totalSessions}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Total Minggu</p>
            </div>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-300 shrink-0" />}
          </div>
        </div>

        {/* Peak day badge */}
        {!loading && peakDay.sessions > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-blue-100">
            <span>📈</span> Peak: {peakDay.date} — {peakDay.sessions} sesi
          </div>
        )}
      </div>

      <CardContent className="p-0 pt-4">
        <div className="h-[200px] md:h-[280px] w-full px-2">
          {loading && data.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-slate-200" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25}/>
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                  padding={{ left: 16, right: 16 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    padding: '10px 14px',
                    fontSize: '13px'
                  }}
                  labelStyle={{ color: '#1e293b', fontWeight: 700, marginBottom: '4px' }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ''}
                  formatter={(value) => [value, 'Sesi']}
                />
                <Area
                  type="monotone"
                  dataKey="sessions"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#trendGrad)"
                  dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                  animationDuration={1200}
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