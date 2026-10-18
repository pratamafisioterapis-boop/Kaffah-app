import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { AlertCircle, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import FinanceTile, { TileEmpty, TileLoading } from '@/components/owner/finance/FinanceTile';
import { Ring } from '@/components/owner/finance/charts';
import { getCachedClinicId } from '@/lib/api';

const SessionTimelinessChart = ({ dateRange, className }) => {
  const [chartData, setChartData] = useState([]);
  const [complianceRate, setComplianceRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Kategori yang disorot di grafik (on | late | over).
  const [focus, setFocus] = useState(null);
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
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData?.session?.user?.id;
      const currentUserRow = { clinic_id: await getCachedClinicId(currentUserId) };

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
        .eq('clinic_id', currentUserRow?.clinic_id)
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

  const bars = [
    { key: 'on', label: 'On-Time', value: stats.onTime, color: '#10b981', cls: 'bg-emerald-50 text-emerald-600', hint: 'Sesi tepat waktu' },
    { key: 'late', label: 'Late Start', value: stats.lateStart, color: '#f59e0b', cls: 'bg-amber-50 text-amber-600', hint: 'Mulai terlambat lebih dari 5 menit' },
    { key: 'over', label: 'Over Dur.', value: stats.overDuration, color: '#ef4444', cls: 'bg-rose-50 text-rose-600', hint: 'Durasi lebih dari 5 menit dari jadwal' },
  ];
  const maxValue = Math.max(...bars.map(b => b.value), 1) * 1.12;
  const picked = bars.find(b => b.key === focus);

  return (
    <FinanceTile tone="pos" icon={Timer} title="Ketepatan Waktu Sesi" className={className}>
      {loading ? (
        <TileLoading className="py-16" />
      ) : error ? (
        <div className="h-48 flex flex-col items-center justify-center gap-2 text-rose-500 text-sm">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
          <button type="button" onClick={fetchTimelinessData} className="px-3 h-8 rounded-[10px] border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">Coba Lagi</button>
        </div>
      ) : stats.total === 0 ? (
        <TileEmpty>Tidak ada data sesi pada periode ini.</TileEmpty>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <Ring pct={complianceRate} color={complianceColor} className="w-[92px] shrink-0">
              <b className="text-lg font-black leading-none tabular-nums" style={{ color: complianceColor }}>{complianceRate}%</b>
            </Ring>
            <div className="flex-1 min-w-[210px] grid grid-cols-3 gap-2">
              {bars.map(b => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setFocus(focus === b.key ? null : b.key)}
                  aria-pressed={focus === b.key}
                  className={cn('py-3 rounded-2xl text-center border transition-colors', b.cls, focus === b.key ? 'border-current' : 'border-transparent')}
                >
                  <b className="block text-xl md:text-2xl font-black leading-none tabular-nums">{b.value}</b>
                  <small className="block text-xs font-semibold mt-1 opacity-85">{b.label}</small>
                </button>
              ))}
            </div>
          </div>

          <svg viewBox="0 0 320 130" className="w-full h-auto block mt-4 overflow-visible" role="img" aria-label="Ketepatan waktu sesi">
            {[0, 1, 2].map(g => <line key={g} x1="8" x2="312" y1={10 + g * 45} y2={10 + g * 45} stroke="#e2e8f0" strokeDasharray="3 4" />)}
            {bars.map((b, i) => {
              const h = (b.value / maxValue) * 100;
              const x = 40 + i * 95;
              return (
                <g key={b.key} opacity={focus && focus !== b.key ? 0.3 : 1}>
                  <rect x={x} y={110 - h} width="56" height={h} rx="8" fill={b.color} />
                  <text x={x + 28} y={104 - h} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f172a">{b.value}</text>
                  <text x={x + 28} y="124" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#64748b">{b.label}</text>
                  <rect x={x - 10} y="0" width="76" height="130" fill="transparent" className="cursor-pointer" onClick={() => setFocus(focus === b.key ? null : b.key)} />
                </g>
              );
            })}
          </svg>

          <div>
            <div className="flex justify-between gap-3 text-xs font-medium text-slate-500 mb-1.5">
              <span>{picked ? picked.hint : `Compliance Rate · ${stats.total} sesi`}</span>
              <span className="font-bold" style={{ color: complianceColor }}>{complianceRate}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none" style={{ width: `${complianceRate}%`, backgroundColor: complianceColor }} />
            </div>
          </div>
        </>
      )}
    </FinanceTile>
  );
};

export default SessionTimelinessChart;
