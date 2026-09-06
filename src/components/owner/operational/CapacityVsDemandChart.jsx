import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, eachDayOfInterval, getISOWeek } from 'date-fns';
import { id } from 'date-fns/locale';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";

const CapacityVsDemandChart = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('weekly'); // 'weekly' | 'monthly'

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date();
      // Weekly: Monday-Sunday of the current week. Monthly: 1st-last day of the current month.
      const startDate = view === 'monthly' ? startOfMonth(today) : startOfWeek(today, { weekStartsOn: 1 });
      const endDate = view === 'monthly' ? endOfMonth(today) : endOfWeek(today, { weekStartsOn: 1 });

      const days = eachDayOfInterval({ start: startDate, end: endDate });

      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData?.session?.user?.id;
      const { data: currentUserRow } = await supabase.from('users').select('clinic_id').eq('id', currentUserId).single();
      const currentClinicId = currentUserRow?.clinic_id;

      // Fetch all days in parallel (monthly view can span ~30 days)
      const slotResults = await Promise.all(
        days.map((day) =>
          supabase.rpc('get_available_slots_with_status_by_date', {
            p_date: format(day, 'yyyy-MM-dd'),
            p_clinic_id: currentClinicId,
          })
        )
      );

      const dailyData = days.map((day, idx) => {
        const { data: slotData, error: rpcError } = slotResults[idx] || {};
        if (rpcError) console.error(rpcError);

        // 🔥 kapasitas = slot yang benar-benar tersedia (exclude yang cuti)
        const capacity = (slotData || []).filter(s => s.status !== 'cuti').length;
        // 🔥 permintaan = slot terisi
        const demand = (slotData || []).filter(s => s.status === 'terisi').length;

        return {
          day: format(day, 'EEEE', { locale: id }),
          shortDay: format(day, 'EEE', { locale: id }),
          fullDate: format(day, 'dd MMM yyyy', { locale: id }),
          isoWeek: getISOWeek(day),
          capacity,
          demand,
          utilization: capacity > 0 ? Math.round((demand / capacity) * 100) : 0,
        };
      });

      if (view === 'weekly') {
        setData(dailyData);
      } else {
        // Group days into weeks so the monthly view compares week-over-week within the month
        const weekOrder = [];
        const weekMap = {};
        dailyData.forEach((d) => {
          if (!weekMap[d.isoWeek]) {
            weekMap[d.isoWeek] = { days: [] };
            weekOrder.push(d.isoWeek);
          }
          weekMap[d.isoWeek].days.push(d);
        });

        const monthlyData = weekOrder.map((isoWeek, idx) => {
          const weekDays = weekMap[isoWeek].days;
          const capacity = weekDays.reduce((s, d) => s + d.capacity, 0);
          const demand = weekDays.reduce((s, d) => s + d.demand, 0);
          const activeDays = weekDays.filter((d) => d.capacity > 0);
          const utilization = activeDays.length > 0
            ? Math.round(activeDays.reduce((s, d) => s + d.utilization, 0) / activeDays.length)
            : 0;
          return {
            day: `Minggu ${idx + 1}`,
            shortDay: `Mgg ${idx + 1}`,
            fullDate: `${weekDays[0].fullDate} - ${weekDays[weekDays.length - 1].fullDate}`,
            capacity,
            demand,
            utilization,
          };
        });
        setData(monthlyData);
      }
    } catch (err) {
      console.error("Error fetching capacity vs demand:", err);
      setError("Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to changes
    const channel = supabase
      .channel(`capacity-demand-updates-${view}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'therapist_schedules' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'therapist_time_off' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [view]);

 const todayData = data.find(d => d.fullDate === format(new Date(), 'dd MMM yyyy', { locale: id }));
  // Hari tanpa jadwal aktif (kapasitas 0) tidak dihitung ke avg utilisasi
  // supaya rata-rata tidak turun akibat hari libur/tanpa slot, bukan sepi pasien.
  const activeDays = data.filter(d => d.capacity > 0);
  const avgUtilization = activeDays.length > 0
    ? Math.round(activeDays.reduce((s, d) => s + d.utilization, 0) / activeDays.length)
    : 0;

  return (
    <Card className="rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-5 md:p-6 pb-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-800">Kapasitas vs Permintaan</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {view === 'monthly' ? 'Overview per minggu, bulan ini' : 'Overview minggu ini'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className={`text-xl font-black leading-none ${avgUtilization >= 75 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {avgUtilization}%
              </p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Avg Utilisasi</p>
            </div>
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin text-slate-300 shrink-0" />
              : <button onClick={fetchData} className="w-7 h-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-slate-100 transition-colors">
                  <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                </button>
            }
          </div>
        </div>

        {/* Weekly / Monthly toggle */}
        <div className="flex items-center gap-1 mt-3 bg-slate-50 rounded-full p-1 w-fit border border-slate-100">
          <button
            onClick={() => setView('weekly')}
            className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-colors ${
              view === 'weekly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Mingguan
          </button>
          <button
            onClick={() => setView('monthly')}
            className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-colors ${
              view === 'monthly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Bulanan
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-slate-300" />
            <span className="text-[11px] text-slate-400 font-medium">Kapasitas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-indigo-400" />
            <span className="text-[11px] text-slate-400 font-medium">Terisi</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-slate-400 font-medium">Utilisasi %</span>
          </div>
        </div>
      </div>

      <CardContent className="flex-1 p-0 pt-4 min-h-[200px] md:min-h-[280px]">
        {error ? (
          <div className="h-full flex flex-col items-center justify-center text-rose-500 text-sm gap-2 p-6">
            <AlertCircle className="h-6 w-6" />
            <p>{error}</p>
            <button onClick={fetchData} className="text-xs text-slate-500 underline">Coba Lagi</button>
          </div>
        ) : loading && data.length === 0 ? (
          <div className="h-full flex items-center justify-center py-10">
            <Loader2 className="h-7 w-7 animate-spin text-slate-200" />
          </div>
        ) : (
          <div className="h-[200px] md:h-[270px] w-full px-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 10, right: 28, left: -20, bottom: 0 }} barGap={2}>
                <defs>
                  <linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#cbd5e1" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#cbd5e1" stopOpacity={0.5}/>
                  </linearGradient>
                  <linearGradient id="demGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="shortDay"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                  dy={8}
                />
                <YAxis
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  allowDecimals={false}
                  width={24}
                  domain={[0, 'dataMax + 2']}
                  tickCount={6}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#10b981' }}
                  tickFormatter={(v) => `${v}%`}
                  width={32}
                  tickCount={6}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc', radius: 8 }}
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    padding: '10px 14px',
                    fontSize: '13px'
                  }}
                  labelStyle={{ color: '#1e293b', fontWeight: 700, marginBottom: '4px' }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ''}
                  formatter={(value, name) => {
                    if (name === 'capacity') return [value, 'Kapasitas'];
                    if (name === 'demand') return [value, 'Terisi'];
                    if (name === 'utilization') return [`${value}%`, 'Utilisasi'];
                    return [value, name];
                  }}
                />
                <Bar yAxisId="left" dataKey="capacity" name="capacity" fill="url(#capGrad)" radius={[6, 6, 0, 0]} barSize={20} animationDuration={1200} />
                <Bar yAxisId="left" dataKey="demand" name="demand" fill="url(#demGrad)" radius={[6, 6, 0, 0]} barSize={20} animationDuration={1200} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="utilization"
                  name="utilization"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    return (
                      <circle
                        key={`dot-${cx}-${cy}`}
                        cx={cx} cy={cy} r={4}
                        fill={payload.utilization < 50 ? '#ef4444' : '#10b981'}
                        stroke="white" strokeWidth={2}
                      />
                    );
                  }}
                  activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CapacityVsDemandChart;