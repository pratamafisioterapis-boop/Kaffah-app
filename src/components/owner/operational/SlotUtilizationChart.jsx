import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { AlertCircle, RefreshCw, LayoutGrid } from 'lucide-react';
import FinanceTile, { TileLoading } from '@/components/owner/finance/FinanceTile';
import { Ring } from '@/components/owner/finance/charts';
import { getCachedClinicId } from '@/lib/api';

const SlotUtilizationChart = ({ className }) => {
  const [data, setData] = useState([]);
  const [metrics, setMetrics] = useState({ filled: 0, empty: 0, utilization: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchUtilizationData = async () => {
  setLoading(true);
  setError(null);

  try {
    // Gunakan timezone Asia/Makassar (WITA) agar sesuai dengan server
    const now = new Date();
    const offset = 8; // WITA = UTC+8
    const wita = new Date(now.getTime() + (offset * 60 * 60 * 1000));
    const today = wita.toISOString().split('T')[0];

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const userRow = { clinic_id: await getCachedClinicId(userId) };

    const { data, error } = await supabase.rpc(
      'get_available_slots_with_status_by_date',
      { p_date: today, p_clinic_id: userRow?.clinic_id }
    );

    if (error) throw error;

    const filled = (data || []).filter(
      s => s.status === 'terisi'
    ).length;

    const empty = (data || []).filter(
      s => s.status === 'aktif'
    ).length;

    // 🔥 total kapasitas = terisi + kosong (exclude yang cuti)
    const totalSlots = filled + empty;

    const utilization = totalSlots > 0
      ? Math.round((filled / totalSlots) * 100)
      : 0;

    setMetrics({
      filled,
      empty,
      utilization
    });

   

    setData([
      { name: 'Terisi', value: filled, color: '#6366f1' },
      { name: 'Kosong', value: empty, color: '#e2e8f0' }
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

  

 const total = metrics.filled + metrics.empty;

  // Interpolasi warna kontinu sesuai persentase: merah (rendah) → kuning →
  // hijau → indigo (penuh), bukan lompatan 3 tingkat.
  const UTILIZATION_COLOR_STOPS = [
    { p: 0, rgb: [239, 68, 68] },   // red-500
    { p: 50, rgb: [245, 158, 11] }, // amber-500
    { p: 80, rgb: [16, 185, 129] }, // emerald-500
    { p: 100, rgb: [99, 102, 241] } // indigo-500
  ];
  const getUtilizationColor = (pct) => {
    const clamped = Math.min(100, Math.max(0, pct));
    let lower = UTILIZATION_COLOR_STOPS[0];
    let upper = UTILIZATION_COLOR_STOPS[UTILIZATION_COLOR_STOPS.length - 1];
    for (let i = 0; i < UTILIZATION_COLOR_STOPS.length - 1; i++) {
      if (clamped >= UTILIZATION_COLOR_STOPS[i].p && clamped <= UTILIZATION_COLOR_STOPS[i + 1].p) {
        lower = UTILIZATION_COLOR_STOPS[i];
        upper = UTILIZATION_COLOR_STOPS[i + 1];
        break;
      }
    }
    const range = upper.p - lower.p || 1;
    const t = (clamped - lower.p) / range;
    const rgb = lower.rgb.map((c, i) => Math.round(c + (upper.rgb[i] - c) * t));
    return `rgb(${rgb.join(',')})`;
  };
  const utilizationColor = getUtilizationColor(metrics.utilization);

  return (
    <FinanceTile
      tone="ind"
      icon={LayoutGrid}
      title="Utilisasi Slot Hari Ini"
      className={className}
      action={
        !loading && !error && (
          <button
            type="button"
            onClick={fetchUtilizationData}
            aria-label="Muat ulang utilisasi slot"
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-700 flex items-center justify-center active:scale-[0.95] transition-transform"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )
      }
    >
      {loading ? (
        <TileLoading className="py-6" />
      ) : error ? (
        <div className="h-24 flex flex-col items-center justify-center gap-1.5 text-rose-500 text-xs">
          <AlertCircle className="h-4 w-4" /><p>{error}</p>
        </div>
      ) : total === 0 ? (
        <div className="h-24 flex items-center justify-center text-slate-500 text-xs text-center">
          Tidak ada data jadwal hari ini.
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <Ring pct={metrics.utilization} color={utilizationColor} className="w-[104px] shrink-0">
            <b className="text-2xl font-black leading-none tabular-nums" style={{ color: utilizationColor }}>{metrics.utilization}%</b>
          </Ring>
          <div className="flex-1 min-w-[130px]">
            <p className="text-4xl font-black leading-none text-slate-900 tabular-nums">{metrics.filled}</p>
            <p className="text-xs text-slate-500 font-medium mt-1">slot terisi dari {total} total</p>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-2.5">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
                style={{ width: `${metrics.utilization}%`, backgroundColor: utilizationColor }}
              />
            </div>
          </div>
        </div>
      )}
    </FinanceTile>
  );
};

export default SlotUtilizationChart;
