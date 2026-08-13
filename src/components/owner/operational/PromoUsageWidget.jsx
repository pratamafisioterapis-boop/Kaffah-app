import React, { useState, useEffect } from 'react';
import { CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Gift } from 'lucide-react';

const COLOR_PALETTE = [
  { color: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-600'   },
  { color: '#6366f1', bg: 'bg-indigo-50',  text: 'text-indigo-600'  },
  { color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { color: '#ec4899', bg: 'bg-pink-50',    text: 'text-pink-600'    },
  { color: '#06b6d4', bg: 'bg-cyan-50',    text: 'text-cyan-600'    },
  { color: '#8b5cf6', bg: 'bg-violet-50',  text: 'text-violet-600'  },
  { color: '#f43f5e', bg: 'bg-rose-50',    text: 'text-rose-600'    },
  { color: '#84cc16', bg: 'bg-lime-50',    text: 'text-lime-600'    },
];

const PromoUsageWidget = ({ dateRange }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [freeCount, setFreeCount] = useState(0);
  const [freePatientCount, setFreePatientCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

        let query = supabase
          .from('daily_recaps')
          .select('discount_label, discount_type, patient_id, amount, package_tracking_id')
          .eq('clinic_id', userRow?.clinic_id);

        if (dateRange?.startDate) query = query.gte('recap_date', dateRange.startDate);
        if (dateRange?.endDate) query = query.lte('recap_date', dateRange.endDate);

        const { data: recaps, error } = await query;
        if (error) throw error;

        const totalCount = (recaps || []).length;
        setTotal(totalCount);

        const countMap = {};
        let freeSessions = 0;
        const freePatients = new Set();

        (recaps || []).forEach(r => {
          if (r.discount_type) {
            // Sesi bisa punya diskon tanpa admin memilih kategori "Jenis
            // Diskon"-nya — kelompokkan sebagai "Tanpa Kategori" alih-alih
            // diam-diam tidak dihitung.
            const label = r.discount_label && r.discount_label.trim() ? r.discount_label.trim() : 'Tanpa Kategori';
            countMap[label] = (countMap[label] || 0) + 1;
          }
          if (Number(r.amount) === 0 && !r.package_tracking_id) {
            freeSessions += 1;
            if (r.patient_id) freePatients.add(r.patient_id);
          }
        });

        setFreeCount(freeSessions);
        setFreePatientCount(freePatients.size);

        const result = Object.entries(countMap)
          .map(([label, count], i) => ({
            key: label,
            count,
            pct: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
            ...COLOR_PALETTE[i % COLOR_PALETTE.length]
          }))
          .sort((a, b) => b.count - a.count);

        setData(result);
      } catch (err) {
        console.error('PromoUsageWidget error:', err);
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
            <h3 className="text-base font-bold text-slate-800">Sesi per Promo</h3>
            <p className="text-xs text-slate-400 mt-0.5">Pemakaian jenis diskon/reward pada periode ini</p>
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

      <CardContent className="px-5 md:px-6 py-4 space-y-4">
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-slate-200" />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
              <div className="flex items-start gap-2 min-w-0">
                <Gift className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-xs font-semibold text-emerald-800">Pasien Free (sesi Rp 0 di luar paket)</span>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-emerald-700 leading-none">{freeCount.toLocaleString('id-ID')} sesi</p>
                <p className="text-[10px] text-emerald-600 mt-0.5">{freePatientCount.toLocaleString('id-ID')} pasien</p>
              </div>
            </div>

            {data.length === 0 ? (
              <div className="h-24 flex items-center justify-center text-slate-400 text-sm">
                Belum ada sesi dengan promo pada periode ini.
              </div>
            ) : (
              <div className="space-y-3">
                {data.map((s) => (
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
          </>
        )}
      </CardContent>
    </div>
  );
};

export default PromoUsageWidget;
