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
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase.rpc(
      'get_available_slots_with_status_by_date',
      { p_date: today }
    );

    if (error) throw error;

    const totalSlots = (data || []).length;

    const filled = (data || []).filter(
      s => s.status === 'terisi'
    ).length;

    const empty = (data || []).filter(
      s => s.status === 'aktif'
    ).length;

    const utilization = totalSlots > 0
      ? Math.round((filled / totalSlots) * 100)
      : 0;

    setMetrics({
      filled,
      empty,
      utilization
    });

    setData([
      { name: 'Terisi', value: filled, color: '#3b82f6' },
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