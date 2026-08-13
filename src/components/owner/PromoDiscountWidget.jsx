import React, { useState, useEffect } from 'react';
import { CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

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

// Estimasi nilai rupiah dari diskon persentase: `amount` disimpan sebagai
// nominal YANG SUDAH didiskon (staf mengetik harga final), jadi harga asli
// = amount / (1 - persen/100), dan nilai potongannya = harga asli - amount.
const estimateDiscountRupiah = (discountType, discountValue, amount) => {
  const value = Number(discountValue) || 0;
  const amt = Number(amount) || 0;
  if (discountType === 'nominal') return value;
  if (discountType === 'percentage') {
    const pct = Math.min(Math.max(value, 0), 99);
    if (pct <= 0) return 0;
    return Math.round((amt * pct) / (100 - pct));
  }
  return 0;
};

const PromoDiscountWidget = ({ dateRange }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

        let query = supabase
          .from('daily_recaps')
          .select('discount_label, discount_type, discount_value, amount')
          .eq('clinic_id', userRow?.clinic_id)
          .not('discount_label', 'is', null);

        if (dateRange?.startDate) query = query.gte('recap_date', dateRange.startDate);
        if (dateRange?.endDate) query = query.lte('recap_date', dateRange.endDate);

        const { data: recaps, error } = await query;
        if (error) throw error;

        const groupMap = {};
        let grandTotal = 0;

        (recaps || []).forEach(r => {
          const money = estimateDiscountRupiah(r.discount_type, r.discount_value, r.amount);
          grandTotal += money;
          if (!groupMap[r.discount_label]) {
            groupMap[r.discount_label] = { count: 0, amount: 0 };
          }
          groupMap[r.discount_label].count += 1;
          groupMap[r.discount_label].amount += money;
        });

        setTotalAmount(grandTotal);
        setTotalSessions((recaps || []).length);

        const result = Object.entries(groupMap)
          .map(([label, v], i) => ({
            key: label,
            count: v.count,
            amount: v.amount,
            pct: grandTotal > 0 ? Math.round((v.amount / grandTotal) * 100) : 0,
            ...COLOR_PALETTE[i % COLOR_PALETTE.length]
          }))
          .sort((a, b) => b.amount - a.amount);

        setData(result);
      } catch (err) {
        console.error('PromoDiscountWidget error:', err);
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
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-teal-600" />
              Potongan per Kategori Reward
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Total nilai diskon/reward yang diberikan pada periode ini</p>
          </div>
          {!loading && (
            <div className="text-right shrink-0">
              <p className="text-lg font-black text-slate-900 leading-none">{formatCurrency(totalAmount)}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">{totalSessions.toLocaleString('id-ID')} sesi berpromo</p>
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
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm text-center px-4">
            Belum ada sesi dengan diskon/reward pada periode ini.
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((s) => (
              <div key={s.key} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-xs font-semibold text-slate-700 truncate">{s.key}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">({s.count} sesi)</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                      {formatCurrency(s.amount)}
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
            <p className="text-[10px] text-slate-400 pt-1">
              *Diskon persentase dihitung otomatis dari nominal transaksi (estimasi).
            </p>
          </div>
        )}
      </CardContent>
    </div>
  );
};

export default PromoDiscountWidget;
