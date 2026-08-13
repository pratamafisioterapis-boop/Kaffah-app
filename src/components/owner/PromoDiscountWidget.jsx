import React, { useState, useEffect } from 'react';
import { CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Wallet, ChevronRight, HelpCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const UNCATEGORIZED_LABEL = 'Tanpa Kategori';

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
  const [uncategorizedRecaps, setUncategorizedRecaps] = useState([]);
  const [showUncategorizedModal, setShowUncategorizedModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

        let query = supabase
          .from('daily_recaps')
          .select(`
            id,
            discount_label,
            discount_type,
            discount_value,
            amount,
            recap_date,
            guest_name,
            therapist_name,
            patients!patient_id(id, full_name, medical_record_number)
          `)
          .eq('clinic_id', userRow?.clinic_id)
          .not('discount_type', 'is', null);

        if (dateRange?.startDate) query = query.gte('recap_date', dateRange.startDate);
        if (dateRange?.endDate) query = query.lte('recap_date', dateRange.endDate);

        const { data: recaps, error } = await query;
        if (error) throw error;

        const groupMap = {};
        let grandTotal = 0;
        const uncategorizedList = [];

        (recaps || []).forEach(r => {
          const money = estimateDiscountRupiah(r.discount_type, r.discount_value, r.amount);
          grandTotal += money;
          // Sesi bisa punya diskon (tipe + nilai) tanpa admin memilih kategori
          // "Jenis Diskon"-nya — kelompokkan sebagai "Tanpa Kategori" alih-alih
          // baris kosong tak terbaca.
          const label = r.discount_label && r.discount_label.trim() ? r.discount_label.trim() : UNCATEGORIZED_LABEL;
          if (!groupMap[label]) {
            groupMap[label] = { count: 0, amount: 0 };
          }
          groupMap[label].count += 1;
          groupMap[label].amount += money;

          if (label === UNCATEGORIZED_LABEL) {
            uncategorizedList.push({
              id: r.id,
              patientName: r.patients?.full_name || r.guest_name || 'Tanpa Nama',
              medicalRecordNumber: r.patients?.medical_record_number || null,
              therapistName: r.therapist_name || '-',
              recapDate: r.recap_date || null,
              discountType: r.discount_type,
              discountValue: r.discount_value,
              amount: money,
            });
          }
        });

        setUncategorizedRecaps(
          uncategorizedList.sort((a, b) => (b.recapDate || '').localeCompare(a.recapDate || ''))
        );

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
            {data.map((s) => {
              const isUncategorized = s.key === UNCATEGORIZED_LABEL;
              const isClickable = isUncategorized && uncategorizedRecaps.length > 0;
              return (
                <div
                  key={s.key}
                  className={`space-y-1 ${isClickable ? 'cursor-pointer group -mx-2 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors' : ''}`}
                  onClick={isClickable ? () => setShowUncategorizedModal(true) : undefined}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') setShowUncategorizedModal(true); } : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-xs font-semibold text-slate-700 truncate">{s.key}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">({s.count} sesi)</span>
                      {isClickable && (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
                      )}
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
              );
            })}
            <p className="text-[10px] text-slate-400 pt-1">
              *Diskon persentase dihitung otomatis dari nominal transaksi (estimasi).
            </p>
          </div>
        )}
      </CardContent>

      {/* Full-viewport transparent shell — see ServiceDistributionChart.jsx for why
          this avoids horizontal clipping on mobile widths instead of the shared
          component's default vw-based centering. */}
      <Dialog open={showUncategorizedModal} onOpenChange={setShowUncategorizedModal}>
        <DialogContent className="left-0 top-0 h-full w-full max-w-none translate-x-0 translate-y-0 flex items-center justify-center gap-0 border-0 bg-transparent p-4 shadow-none rounded-none">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-xl bg-white shadow-lg">
            <DialogHeader className="sticky top-0 z-10 px-5 py-4 border-b border-slate-100 bg-slate-50/95 backdrop-blur">
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                Sesi Tanpa Kategori Diskon
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {uncategorizedRecaps.length} sesi punya diskon tapi belum diisi "Jenis Diskon"-nya. Buka rekap harian pasien ini untuk melengkapi kategorinya.
              </DialogDescription>
            </DialogHeader>
            <div className="divide-y divide-slate-100">
              {uncategorizedRecaps.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{r.patientName}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {r.medicalRecordNumber ? `RM ${r.medicalRecordNumber} • ` : ''}{r.therapistName}
                      {' • '}{r.discountType === 'percentage' ? `${r.discountValue}%` : formatCurrency(r.discountValue)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {r.recapDate && (
                      <p className="text-[10px] text-slate-400">
                        {format(new Date(r.recapDate), 'd MMM yyyy', { locale: idLocale })}
                      </p>
                    )}
                    <p className="text-[10px] font-semibold text-slate-600 mt-0.5">{formatCurrency(r.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PromoDiscountWidget;
