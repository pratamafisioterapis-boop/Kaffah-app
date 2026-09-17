import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';
import { getCachedClinicId } from '@/lib/api';

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

  // SVG donut manual — versi ringkas, ukurannya sengaja dijaga tetap kecil
  // supaya kartu ini tidak melebihi luas gabungan 4 kartu KPI hari ini
  // (Terapis Aktif, Slot Kosong, Pasien Baru, Pasien Lama) di atasnya.
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const isFull = metrics.utilization >= 100;
  const strokeDash = (metrics.utilization / 100) * circumference;

  return (
    <Card className="rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-5 pt-4 md:pt-5 pb-2 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Utilisasi Slot Hari Ini</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Real-time slot capacity</p>
        </div>
        {!loading && !error && (
          <button onClick={fetchUtilizationData} className="w-6 h-6 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-slate-100 transition-colors shrink-0">
            <RefreshCw className="h-3 w-3 text-slate-400" />
          </button>
        )}
      </div>

      <CardContent className="pt-1 pb-4 px-4 md:px-5">
        {loading ? (
          <div className="h-20 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-200" />
          </div>
        ) : error ? (
          <div className="h-20 flex flex-col items-center justify-center gap-1.5 text-rose-500 text-xs">
            <AlertCircle className="h-4 w-4" /><p>{error}</p>
          </div>
        ) : total === 0 ? (
          <div className="h-20 flex items-center justify-center text-slate-400 text-xs">
            Tidak ada data jadwal hari ini.
          </div>
        ) : (
          <div className="flex items-center gap-4">
            {/* SVG Donut — ringkas */}
            <div className="relative flex items-center justify-center shrink-0" style={{ width: 100, height: 100 }}>
              <svg width="100" height="100" viewBox="0 0 100 100">
                {/* Track */}
                <circle cx="50" cy="50" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="10" />
                {/* Progress — saat 100% gambar lingkaran solid tanpa dasharray sama
                    sekali, supaya tidak bergantung pada perhitungan panjang lingkaran
                    (circumference) milik browser yang bisa sedikit meleset di sebagian
                    WebView/mobile dan menyisakan celah walau nilainya sudah penuh. */}
                {isFull ? (
                  <circle
                    cx="50" cy="50" r={radius}
                    fill="none"
                    stroke={utilizationColor}
                    strokeWidth="10"
                    style={{ transition: 'stroke 0.8s ease' }}
                  />
                ) : (
                  <circle
                    cx="50" cy="50" r={radius}
                    fill="none"
                    stroke={utilizationColor}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${strokeDash} ${circumference}`}
                    strokeDashoffset={circumference / 4}
                    style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.8s ease' }}
                  />
                )}
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black leading-none" style={{ color: utilizationColor }}>
                  {metrics.utilization}%
                </span>
              </div>
            </div>

            {/* Info terisi — Slot Kosong sudah tampil di kartu KPI hari ini,
                jadi di sini cukup tampilkan jumlah yang terisi & progress bar. */}
            <div className="flex-1 min-w-0">
              <p className="text-2xl md:text-3xl font-black leading-none text-indigo-600">{metrics.filled}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">slot terisi dari {total} total</p>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-2.5">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${metrics.utilization}%`, backgroundColor: utilizationColor }}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SlotUtilizationChart;