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
    // Gunakan timezone Asia/Makassar (WITA) agar sesuai dengan server
    const now = new Date();
    const offset = 8; // WITA = UTC+8
    const wita = new Date(now.getTime() + (offset * 60 * 60 * 1000));
    const today = wita.toISOString().split('T')[0];

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

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

  // SVG donut manual agar lebih besar dan premium
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const isFull = metrics.utilization >= 100;
  const strokeDash = (metrics.utilization / 100) * circumference;

  return (
    <Card className="rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
      {/* Header */}
      <div className="px-5 md:px-6 pt-5 md:pt-6 pb-4 flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800">Utilisasi Slot Hari Ini</h3>
          <p className="text-xs text-slate-400 mt-0.5">Real-time slot capacity</p>
        </div>
        {!loading && !error && (
          <button onClick={fetchUtilizationData} className="w-7 h-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-slate-100 transition-colors">
            <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
          </button>
        )}
      </div>

      <CardContent className="pt-0 pb-6 px-5 md:px-6">
        {loading ? (
          <div className="h-56 flex items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-slate-200" />
          </div>
        ) : error ? (
          <div className="h-56 flex flex-col items-center justify-center gap-2 text-rose-500 text-sm">
            <AlertCircle className="h-5 w-5" /><p>{error}</p>
          </div>
        ) : total === 0 ? (
          <div className="h-56 flex items-center justify-center text-slate-400 text-sm">
            Tidak ada data jadwal hari ini.
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5">
            {/* SVG Donut — lebih besar & premium */}
            <div className="relative flex items-center justify-center" style={{ width: 180, height: 180 }}>
              <svg width="180" height="180" viewBox="0 0 180 180">
                {/* Track */}
                <circle cx="90" cy="90" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="16" />
                {/* Progress */}
                <circle
                  cx="90" cy="90" r={radius}
                  fill="none"
                  stroke={utilizationColor}
                  strokeWidth="16"
                  strokeLinecap={isFull ? 'butt' : 'round'}
                  strokeDasharray={`${strokeDash} ${circumference}`}
                  strokeDashoffset={circumference / 4}
                  style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.8s ease' }}
                />
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl md:text-5xl font-black leading-none" style={{ color: utilizationColor }}>
                  {metrics.utilization}%
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">Utilisasi</span>
              </div>
            </div>

            {/* Stats 3 kolom */}
            <div className="w-full grid grid-cols-3 gap-3">
              {[
                { label: 'Terisi', value: metrics.filled, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
                { label: 'Kosong', value: metrics.empty, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-100' },
                { label: 'Total', value: total, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-100' },
              ].map(s => (
                <div key={s.label} className={`text-center ${s.bg} border ${s.border} rounded-2xl py-3.5`}>
                  <p className={`text-2xl md:text-3xl font-black leading-none ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1.5 uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="w-full">
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${metrics.utilization}%`, backgroundColor: utilizationColor }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
                <span>{metrics.filled} slot terisi</span>
                <span>{metrics.empty} slot kosong</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SlotUtilizationChart;