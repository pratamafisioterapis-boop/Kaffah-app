import React, { useState, useEffect } from 'react';
import { CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2 } from 'lucide-react';

const SERVICE_CONFIG = [
  { key: 'Musculoskeletal Treatment',         short: 'Musculo',   color: '#6366f1', bg: 'bg-indigo-50',  text: 'text-indigo-600'  },
  { key: 'Neurological Rehabilitation',       short: 'Neuro',     color: '#8b5cf6', bg: 'bg-violet-50',  text: 'text-violet-600'  },
  { key: 'Pre-Post Operative Rehabilitation', short: 'Pre-Post',  color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { key: 'Sport Injury Treatment',            short: 'Sport',     color: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-600'   },
  { key: 'Recovery Treatment',                short: 'Recovery',  color: '#06b6d4', bg: 'bg-cyan-50',    text: 'text-cyan-600'    },
  { key: 'Cardiorespiratory Physiotherapy',   short: 'Cardio',    color: '#f43f5e', bg: 'bg-rose-50',    text: 'text-rose-600'    },
];

const ServiceDistributionChart = ({ dateRange }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

        let query = supabase
          .from('daily_recaps')
          .select('service_type')
          .eq('clinic_id', userRow?.clinic_id);

        if (dateRange?.startDate) query = query.gte('recap_date', dateRange.startDate);
        if (dateRange?.endDate) query = query.lte('recap_date', dateRange.endDate);

        const { data: recaps, error } = await query;

        if (error) throw error;

        const totalCount = (recaps || []).length;
        setTotal(totalCount);

        const countMap = {};
        (recaps || []).forEach(r => {
          if (r.service_type) {
            countMap[r.service_type] = (countMap[r.service_type] || 0) + 1;
          }
        });

        const result = SERVICE_CONFIG.map(s => ({
          ...s,
          count: countMap[s.key] || 0,
          pct: totalCount > 0 ? Math.round(((countMap[s.key] || 0) / totalCount) * 100) : 0
        })).filter(s => s.count > 0).sort((a, b) => b.count - a.count);

        // Hitung yang tidak punya service_type
        const classified = result.reduce((sum, s) => sum + s.count, 0);
        const unclassified = totalCount - classified;

        if (unclassified > 0) {
          result.push({
            key: 'Tidak Terklasifikasi',
            short: 'Lainnya',
            color: '#94a3b8',
            bg: 'bg-slate-100',
            text: 'text-slate-500',
            count: unclassified,
            pct: totalCount > 0 ? Math.round((unclassified / totalCount) * 100) : 0
          });
        }

        setData(result);
      } catch (err) {
        console.error('ServiceDistributionChart error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden h-full">
      {/* Header */}
      <div className="px-5 md:px-6 pt-5 md:pt-6 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">Distribusi Layanan</h3>
            <p className="text-xs text-slate-400 mt-0.5">Breakdown tipe layanan keseluruhan</p>
          </div>
          {!loading && (
            <div className="text-right">
              <p className="text-xl font-black text-slate-900 leading-none">{total.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Total Sesi</p>
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-slate-50 mx-5" />

      <CardContent className="px-5 md:px-6 py-4">
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-slate-200" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
            Belum ada data layanan.
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((s, i) => (
              <div key={s.key} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-xs font-semibold text-slate-700 truncate">{s.key}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                      {s.count.toLocaleString('id-ID')}
                    </span>
                    <span className="text-[10px] text-slate-400 w-8 text-right">{s.pct}%</span>
                  </div>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </div>
  );
};

export default ServiceDistributionChart;