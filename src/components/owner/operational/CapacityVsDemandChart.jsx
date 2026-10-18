import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  addMonths,
  isSameWeek,
  isSameMonth,
  format,
  eachDayOfInterval,
  getISOWeek,
} from 'date-fns';
import { id } from 'date-fns/locale';
import { RefreshCw, AlertCircle, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import FinanceTile, { TileLoading } from '@/components/owner/finance/FinanceTile';
import SegControl from '@/components/owner/finance/SegControl';
import { getCachedClinicId } from '@/lib/api';

const CapacityVsDemandChart = ({ className }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('weekly'); // 'weekly' | 'monthly'
  const [anchorDate, setAnchorDate] = useState(new Date()); // periode (minggu/bulan) yang sedang dilihat
  const [picked, setPicked] = useState(null); // batang yang dipilih untuk detail

  const isCurrentPeriod = view === 'monthly'
    ? isSameMonth(anchorDate, new Date())
    : isSameWeek(anchorDate, new Date(), { weekStartsOn: 1 });

  const goToPrevious = () => {
    setPicked(null);
    setAnchorDate((prev) => (view === 'monthly' ? addMonths(prev, -1) : addWeeks(prev, -1)));
  };
  const goToNext = () => {
    if (isCurrentPeriod) return; // jangan izinkan lihat periode masa depan
    setPicked(null);
    setAnchorDate((prev) => (view === 'monthly' ? addMonths(prev, 1) : addWeeks(prev, 1)));
  };
  const goToToday = () => { setPicked(null); setAnchorDate(new Date()); };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Weekly: Monday-Sunday of the selected week. Monthly: 1st-last day of the selected month.
      const startDate = view === 'monthly' ? startOfMonth(anchorDate) : startOfWeek(anchorDate, { weekStartsOn: 1 });
      const endDate = view === 'monthly' ? endOfMonth(anchorDate) : endOfWeek(anchorDate, { weekStartsOn: 1 });

      const days = eachDayOfInterval({ start: startDate, end: endDate });

      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData?.session?.user?.id;
      const currentUserRow = { clinic_id: await getCachedClinicId(currentUserId) };
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
      .channel(`capacity-demand-updates-${view}-${format(anchorDate, 'yyyy-MM-dd')}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'therapist_schedules' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'therapist_time_off' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [view, anchorDate]);

 const todayData = data.find(d => d.fullDate === format(new Date(), 'dd MMM yyyy', { locale: id }));
  // Hari tanpa jadwal aktif (kapasitas 0) tidak dihitung ke avg utilisasi
  // supaya rata-rata tidak turun akibat hari libur/tanpa slot, bukan sepi pasien.
  const activeDays = data.filter(d => d.capacity > 0);
  const avgUtilization = activeDays.length > 0
    ? Math.round(activeDays.reduce((s, d) => s + d.utilization, 0) / activeDays.length)
    : 0;

  const W = 320, H = 160, L = 10, R = 26, T = 14, B = 22;
  const count = data.length;
  const maxCap = Math.max(...data.map(d => d.capacity), 1) + 4;
  const slotW = (W - L - R) / Math.max(count, 1);
  const X = (i) => L + (i + 0.5) * slotW;
  const Y = (v) => T + (1 - v / maxCap) * (H - T - B);
  const Y2 = (v) => T + (1 - v / 100) * (H - T - B);
  const barW = Math.min(16, slotW / 2.4);
  const sel = picked != null && picked < count ? picked : null;
  const point = sel != null ? data[sel] : null;
  const utilLine = data.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y2(p.utilization).toFixed(1)}`).join('');

  const periodLabel = view === 'monthly'
    ? `Overview per minggu · ${format(anchorDate, 'MMMM yyyy', { locale: id })}`
    : `Overview mingguan · ${format(startOfWeek(anchorDate, { weekStartsOn: 1 }), 'dd MMM', { locale: id })} - ${format(endOfWeek(anchorDate, { weekStartsOn: 1 }), 'dd MMM yyyy', { locale: id })}`;

  const iconBtn = 'w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-700 flex items-center justify-center active:scale-[0.95] transition-transform';

  return (
    <FinanceTile tone="acc" icon={BarChart3} title="Kapasitas vs Permintaan" className={className}>
      <div className="flex items-start justify-between gap-3">
        <small className="text-xs text-slate-500 min-w-0 break-words">{periodLabel}</small>
        <div className="text-right whitespace-nowrap shrink-0">
          <p className={`text-2xl font-black leading-none tabular-nums ${avgUtilization >= 75 ? 'text-amber-600' : 'text-emerald-600'}`}>{avgUtilization}%</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Avg Utilisasi</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-3">
        <SegControl
          items={[{ value: 'weekly', label: 'Mingguan' }, { value: 'monthly', label: 'Bulanan' }]}
          value={view}
          onChange={(v) => { setView(v); setAnchorDate(new Date()); setPicked(null); }}
        />
        <div className="flex items-center gap-1.5 ml-auto">
          <button type="button" onClick={fetchData} aria-label="Muat ulang kapasitas dan permintaan" className={iconBtn}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
          <button type="button" onClick={goToPrevious} aria-label={view === 'monthly' ? 'Bulan sebelumnya' : 'Minggu sebelumnya'} className={iconBtn}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          {!isCurrentPeriod && (
            <button type="button" onClick={goToToday} className="text-xs font-semibold text-indigo-600 px-1.5 hover:underline">
              {view === 'monthly' ? 'Bulan ini' : 'Minggu ini'}
            </button>
          )}
          <button
            type="button"
            onClick={goToNext}
            disabled={isCurrentPeriod}
            aria-label={view === 'monthly' ? 'Bulan berikutnya' : 'Minggu berikutnya'}
            className={cn(iconBtn, 'disabled:opacity-35 disabled:cursor-not-allowed')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap mt-3 text-xs font-semibold text-slate-500">
        <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[3px] bg-slate-300" />Kapasitas</span>
        <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[3px] bg-indigo-500" />Terisi</span>
        <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-1.5 rounded-full bg-emerald-500" />Utilisasi %</span>
      </div>

      <div className="min-h-[26px] flex flex-wrap items-baseline gap-x-2 mt-2 text-xs text-slate-500">
        {point
          ? <><b className="text-xl font-black text-slate-900 tabular-nums">{point.utilization}%</b><span>{point.fullDate} · terisi {point.demand} dari {point.capacity}</span></>
          : <span>Ketuk batang untuk detail</span>}
      </div>

      {error ? (
        <div className="h-[200px] flex flex-col items-center justify-center text-rose-500 text-sm gap-2 p-6">
          <AlertCircle className="h-6 w-6" />
          <p>{error}</p>
          <button onClick={fetchData} className="text-xs text-slate-500 underline">Coba Lagi</button>
        </div>
      ) : loading && data.length === 0 ? (
        <TileLoading className="py-16" />
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block overflow-visible" role="img" aria-label="Kapasitas vs permintaan">
          {[0, 1, 2, 3].map(g => {
            const y = T + (g * (H - T - B)) / 3;
            return <line key={g} x1={L} x2={W - R} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 4" />;
          })}
          {data.map((p, i) => (
            <g key={`b${i}`} opacity={sel != null && sel !== i ? 0.4 : 1}>
              <rect x={X(i) - barW - 1} y={Y(p.capacity)} width={barW} height={Math.max(H - B - Y(p.capacity), 0)} rx="4" fill="#cbd5e1" />
              <rect x={X(i) + 1} y={Y(p.demand)} width={barW} height={Math.max(H - B - Y(p.demand), 0)} rx="4" fill="#6366f1" />
            </g>
          ))}
          <path d={utilLine} fill="none" stroke="#10b981" strokeWidth="2.4" strokeLinejoin="round" />
          {data.map((p, i) => (
            <g key={`d${i}`}>
              <circle cx={X(i)} cy={Y2(p.utilization)} r={sel === i ? 5.5 : 3.6} fill={p.utilization < 50 ? '#ef4444' : '#10b981'} stroke="#fff" strokeWidth="2" />
              <text x={X(i)} y={H - 5} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#64748b">{p.shortDay}</text>
            </g>
          ))}
          <text x={W - R + 4} y={T + 3} fontSize="9" fontWeight="600" fill="#10b981">100%</text>
          <text x={W - R + 4} y={H - B + 3} fontSize="9" fontWeight="600" fill="#10b981">0%</text>
          {data.map((p, i) => (
            <rect key={`h${i}`} x={X(i) - slotW / 2} y="0" width={slotW} height={H} fill="transparent" className="cursor-pointer" onClick={() => setPicked(picked === i ? null : i)} />
          ))}
        </svg>
      )}
    </FinanceTile>
  );
};

export default CapacityVsDemandChart;
