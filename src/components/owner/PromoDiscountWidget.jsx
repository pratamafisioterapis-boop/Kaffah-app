import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Tag, ChevronRight, HelpCircle, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { getCachedClinicId } from '@/lib/api';
import FinanceTile, { TileEmpty, TileLoading } from '@/components/owner/finance/FinanceTile';
import { fmtShort } from '@/components/owner/finance/financeTheme';

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

const PromoDiscountWidget = ({ dateRange, className }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [uncategorizedRecaps, setUncategorizedRecaps] = useState([]);
  const [showUncategorizedModal, setShowUncategorizedModal] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        const userRow = { clinic_id: await getCachedClinicId(userId) };

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
        // Sesi dengan `discount_type` terisi tapi nilainya 0/kosong bukan promo
        // sungguhan — jangan dihitung sebagai "Tanpa Kategori".
        const discountedRecaps = (recaps || []).filter(r => Number(r.discount_value) > 0);

        discountedRecaps.forEach(r => {
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
        setTotalSessions(discountedRecaps.length);

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

  const maxAmount = data[0]?.amount || 1;

  return (
    <FinanceTile tone="neg" icon={Tag} title="Promo & Reward" className={className}>
      {loading ? (
        <TileLoading />
      ) : data.length === 0 ? (
        <TileEmpty>Belum ada sesi dengan diskon/reward pada periode ini.</TileEmpty>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-3 flex-wrap">
            <p className="text-3xl font-black tabular-nums leading-none text-app-ink" title={formatCurrency(totalAmount)}>{fmtShort(totalAmount)}</p>
            <span className="text-xs text-slate-500">{totalSessions.toLocaleString('id-ID')} sesi</span>
          </div>
          <div className="grid gap-0.5">
            {data.map((s) => {
              const isUncategorized = s.key === UNCATEGORIZED_LABEL;
              const hasList = isUncategorized && uncategorizedRecaps.length > 0;
              const active = selected === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => (hasList ? setShowUncategorizedModal(true) : setSelected(active ? null : s.key))}
                  className={cn('grid gap-1 w-full px-2 py-2 rounded-xl text-left transition-colors', active ? 'bg-slate-100' : 'hover:bg-slate-50')}
                >
                  <span className="flex items-center gap-2 text-[13px] font-semibold">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="flex-1 min-w-0 break-words text-slate-700">{s.key}</span>
                    <span className="tabular-nums" title={formatCurrency(s.amount)}>{active ? `${s.count} sesi · ${s.pct}%` : fmtShort(s.amount)}</span>
                    {hasList && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                  </span>
                  <span className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <span
                      className="block h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
                      style={{ width: `${(s.amount / maxAmount) * 100}%`, backgroundColor: s.color }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">*Diskon persentase dihitung otomatis (estimasi).</p>
        </>
      )}

      {/* Full-viewport transparent shell — see ServiceDistributionChart.jsx for why
          this avoids horizontal clipping on mobile widths instead of the shared
          component's default vw-based centering. */}
      <Dialog open={showUncategorizedModal} onOpenChange={setShowUncategorizedModal}>
        <DialogContent hideClose className="left-0 top-0 h-full w-full max-w-none translate-x-0 translate-y-0 flex items-center justify-center gap-0 border-0 bg-transparent p-4 shadow-none rounded-none">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-app bg-white shadow-lg">
            <DialogHeader className="sticky top-0 z-10 px-5 py-4 pr-12 border-b border-slate-100 bg-slate-50/95 backdrop-blur relative">
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-4.5 h-4.5 text-slate-500 shrink-0" />
                Sesi Tanpa Kategori Diskon
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {uncategorizedRecaps.length} sesi punya diskon tapi belum diisi "Jenis Diskon"-nya. Buka rekap harian pasien ini untuk melengkapi kategorinya.
              </DialogDescription>
              <DialogClose className="absolute right-4 top-4 before:absolute before:-inset-2 before:content-[''] rounded-full p-1 text-slate-500 hover:bg-slate-200/70 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300">
                <X className="w-4 h-4" />
                <span className="sr-only">Tutup</span>
              </DialogClose>
            </DialogHeader>
            <div className="divide-y divide-slate-100">
              {uncategorizedRecaps.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 break-words sm:truncate">{r.patientName}</p>
                    <p className="text-xs text-slate-500 mt-0.5 break-words sm:truncate">
                      {r.medicalRecordNumber ? `RM ${r.medicalRecordNumber} • ` : ''}{r.therapistName}
                      {' • '}{r.discountType === 'percentage' ? `${r.discountValue}%` : formatCurrency(r.discountValue)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {r.recapDate && (
                      <p className="text-xs text-slate-500">
                        {format(new Date(r.recapDate), 'd MMM yyyy', { locale: idLocale })}
                      </p>
                    )}
                    <p className="text-xs font-semibold text-slate-600 mt-0.5">{formatCurrency(r.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </FinanceTile>
  );
};

export default PromoDiscountWidget;
