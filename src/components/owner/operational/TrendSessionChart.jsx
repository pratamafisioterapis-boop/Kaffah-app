import React, { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { TrendingUp } from 'lucide-react';
import FinanceTile, { TileLoading } from '@/components/owner/finance/FinanceTile';
import { getCachedClinicId } from '@/lib/api';

const TrendSessionChart = ({ className }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Hari yang dipilih di grafik (null = hari terakhir).
  const [picked, setPicked] = useState(null);

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
        const currentUserRow = { clinic_id: await getCachedClinicId(currentUserId) };

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
      <FinanceTile tone="ind" icon={TrendingUp} title="Tren Sesi Minggu Ini" className={className}>
        <p className="py-8 text-center text-sm text-rose-600">Gagal memuat data grafik.</p>
      </FinanceTile>
    );
  }

  const totalSessions = data.reduce((s, d) => s + d.sessions, 0);
  const peakDay = data.reduce((max, d) => d.sessions > max.sessions ? d : max, data[0] || { sessions: 0, date: '-' });

  const W = 320, H = 150, L = 10, R = 10, T = 16, B = 22;
  const n = data.length;
  const sel = n === 0 ? 0 : picked == null || picked >= n ? n - 1 : picked;
  const mx = Math.max(...data.map(d => d.sessions), 1) + 8;
  const X = (i) => L + (i * (W - L - R)) / Math.max(n - 1, 1);
  const Y = (v) => T + (1 - v / mx) * (H - T - B);
  const line = data.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.sessions).toFixed(1)}`).join('');
  const colW = (W - L - R) / Math.max(n - 1, 1);
  const cur = data[sel];

  return (
    <FinanceTile tone="ind" icon={TrendingUp} title="Tren Sesi Minggu Ini" className={className}>
      {loading && data.length === 0 ? (
        <TileLoading />
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-1.5">
            <b className="text-3xl font-black tabular-nums leading-none text-slate-900">{cur?.sessions ?? 0}</b>
            <span className="text-xs text-slate-500">sesi · {cur?.fullDate}</span>
            {peakDay.sessions > 0 && (
              <span className="ml-auto px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold">
                Peak {peakDay.date} · {peakDay.sessions}
              </span>
            )}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block overflow-visible" role="img" aria-label="Tren sesi per hari minggu ini">
            <defs>
              <linearGradient id="opTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#6366f1" stopOpacity="0.3" />
                <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 1, 2].map(g => {
              const y = T + (g * (H - T - B)) / 2;
              return <line key={g} x1={L} x2={W - R} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 4" />;
            })}
            {n > 1 && <path d={`${line}L${X(n - 1)} ${H - B}L${X(0)} ${H - B}Z`} fill="url(#opTrendFill)" />}
            <path d={line} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {n > 0 && <line x1={X(sel)} x2={X(sel)} y1={T - 6} y2={H - B} stroke="#6366f1" strokeOpacity="0.4" />}
            {data.map((p, i) => (
              <g key={p.fullDate}>
                <circle cx={X(i)} cy={Y(p.sessions)} r={i === sel ? 5.5 : 3.2} fill={i === sel ? '#6366f1' : '#fff'} stroke="#6366f1" strokeWidth="2" />
                <text x={X(i)} y={H - 5} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#64748b">{p.date}</text>
              </g>
            ))}
            {data.map((p, i) => (
              <rect key={`h${p.fullDate}`} x={X(i) - colW / 2} y="0" width={colW} height={H} fill="transparent" className="cursor-pointer" onClick={() => setPicked(i)} />
            ))}
          </svg>
          <div className="flex items-baseline justify-between mt-1.5">
            <small className="text-xs text-slate-500">Total kunjungan per hari</small>
            <span><b className="text-xl font-black tabular-nums">{totalSessions}</b> <small className="text-xs text-slate-500">total minggu</small></span>
          </div>
        </>
      )}
    </FinanceTile>
  );
};

export default TrendSessionChart;
