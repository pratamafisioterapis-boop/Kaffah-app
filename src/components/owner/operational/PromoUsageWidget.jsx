import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Gift, ChevronRight, HelpCircle, X, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { getCachedClinicId, getDiscountTypeOptions } from '@/lib/api';
import { cn } from '@/lib/utils';
import FinanceTile, { TileLoading } from '@/components/owner/finance/FinanceTile';

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

const PromoUsageWidget = ({ dateRange, className }) => {
  const { toast } = useToast();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [freeCount, setFreeCount] = useState(0);
  const [freePatientCount, setFreePatientCount] = useState(0);
  const [uncategorizedRecaps, setUncategorizedRecaps] = useState([]);
  const [showUncategorizedModal, setShowUncategorizedModal] = useState(false);
  const [discountOptions, setDiscountOptions] = useState([]);
  const [savingRowId, setSavingRowId] = useState(null);
  // Kategori promo yang disorot di daftar.
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: options } = await getDiscountTypeOptions('');
      setDiscountOptions((options || []).map(o => ({ value: o.label, label: o.label })));
    })();
  }, []);

  const handleAssignDiscountLabel = async (recapId, label) => {
    if (!label) return;
    setSavingRowId(recapId);
    try {
      const { error } = await supabase
        .from('daily_recaps')
        .update({ discount_label: label })
        .eq('id', recapId);
      if (error) throw error;

      setUncategorizedRecaps(prev => prev.filter(r => r.id !== recapId));
      setData(prev => {
        const next = prev.map(s => s.key === UNCATEGORIZED_LABEL ? { ...s, count: s.count - 1 } : s);
        const existing = next.find(s => s.key === label);
        if (existing) {
          existing.count += 1;
        } else {
          next.push({
            key: label,
            count: 1,
            ...COLOR_PALETTE[next.length % COLOR_PALETTE.length]
          });
        }
        return next
          .filter(s => s.count > 0)
          .map(s => ({ ...s, pct: total > 0 ? Math.round((s.count / total) * 100) : 0 }))
          .sort((a, b) => b.count - a.count);
      });

      toast({ title: 'Jenis diskon disimpan', description: `Sesi ditandai sebagai "${label}".` });
    } catch (err) {
      console.error('handleAssignDiscountLabel error:', err);
      toast({ title: 'Gagal menyimpan', description: 'Tidak dapat menyimpan jenis diskon. Coba lagi.', variant: 'destructive' });
    } finally {
      setSavingRowId(null);
    }
  };

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
            patient_id,
            amount,
            package_tracking_id,
            recap_date,
            guest_name,
            therapist_name,
            patients!patient_id(id, full_name, medical_record_number)
          `)
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
        const uncategorizedList = [];

        (recaps || []).forEach(r => {
          // Sesi bisa punya `discount_type` terisi tapi nilainya 0/kosong (staf
          // memilih jenis diskon lalu batal mengisi nominalnya) — itu bukan
          // promo sungguhan, jadi jangan dihitung sebagai "Tanpa Kategori".
          if (r.discount_type && Number(r.discount_value) > 0) {
            // Sesi bisa punya diskon tanpa admin memilih kategori "Jenis
            // Diskon"-nya — kelompokkan sebagai "Tanpa Kategori" alih-alih
            // diam-diam tidak dihitung.
            const label = r.discount_label && r.discount_label.trim() ? r.discount_label.trim() : UNCATEGORIZED_LABEL;
            countMap[label] = (countMap[label] || 0) + 1;

            if (label === UNCATEGORIZED_LABEL) {
              uncategorizedList.push({
                id: r.id,
                patientName: r.patients?.full_name || r.guest_name || 'Tanpa Nama',
                medicalRecordNumber: r.patients?.medical_record_number || null,
                therapistName: r.therapist_name || '-',
                recapDate: r.recap_date || null,
                discountType: r.discount_type,
                discountValue: r.discount_value,
              });
            }
          }
          if (Number(r.amount) === 0 && !r.package_tracking_id) {
            freeSessions += 1;
            if (r.patient_id) freePatients.add(r.patient_id);
          }
        });

        setUncategorizedRecaps(
          uncategorizedList.sort((a, b) => (b.recapDate || '').localeCompare(a.recapDate || ''))
        );

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

  // Jumlah sesi yang memakai jenis diskon (bukan seluruh sesi pada periode).
  const promoSessionCount = data.reduce((sum, s) => sum + s.count, 0);

  const maxCount = data[0]?.count || 1;

  return (
    <FinanceTile tone="warn" icon={Tag} title="Sesi Promo" className={className}>
      {loading ? (
        <TileLoading className="py-14" />
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-3">
            <b className="text-3xl font-black tabular-nums leading-none text-slate-900">{promoSessionCount.toLocaleString('id-ID')}</b>
            <span className="text-xs text-slate-500">Sesi Berdiskon</span>
          </div>

          <div className="flex items-start justify-between gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 mb-3">
            <div className="flex items-start gap-2 min-w-0">
              <Gift className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="text-xs font-semibold text-emerald-800">Pasien Free (sesi Rp 0 di luar paket)</span>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-black text-emerald-700 leading-none">{freeCount.toLocaleString('id-ID')} sesi</p>
              <p className="text-xs text-emerald-600 mt-0.5">{freePatientCount.toLocaleString('id-ID')} pasien</p>
            </div>
          </div>

          {data.length === 0 ? (
            <div className="h-20 flex items-center justify-center text-slate-500 text-sm text-center">
              Belum ada sesi dengan promo pada periode ini.
            </div>
          ) : (
            <div className="grid gap-0.5">
              {data.map((s) => {
                const isUncategorized = s.key === UNCATEGORIZED_LABEL;
                const isClickable = isUncategorized && uncategorizedRecaps.length > 0;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => (isClickable ? setShowUncategorizedModal(true) : setSelected(selected === s.key ? null : s.key))}
                    aria-pressed={selected === s.key}
                    className={cn('w-full grid gap-1.5 px-2 py-2 rounded-xl text-left transition-colors', selected === s.key ? 'bg-slate-100' : 'hover:bg-slate-50')}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="flex-1 min-w-0 text-xs font-semibold text-slate-700 break-words">{s.key}</span>
                      {isClickable && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${s.bg} ${s.text}`}>{s.count.toLocaleString('id-ID')}</span>
                      <span className="text-xs text-slate-500 w-8 text-right shrink-0">{s.pct}%</span>
                    </span>
                    <span className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <span
                        className="block h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
                        style={{ width: `${Math.min(100, (s.count / maxCount) * 100)}%`, backgroundColor: s.color }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
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
              {uncategorizedRecaps.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-500">
                  Semua sesi sudah punya jenis diskon. 🎉
                </div>
              ) : uncategorizedRecaps.map((r) => (
                <div key={r.id} className="px-5 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 break-words sm:truncate">{r.patientName}</p>
                      <p className="text-xs text-slate-500 mt-0.5 break-words sm:truncate">
                        {r.medicalRecordNumber ? `RM ${r.medicalRecordNumber} • ` : ''}{r.therapistName}
                        {' • '}{r.discountType === 'percentage' ? `${r.discountValue}%` : `Rp${Number(r.discountValue).toLocaleString('id-ID')}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {r.recapDate && (
                        <p className="text-xs text-slate-500">
                          {format(new Date(r.recapDate), 'd MMM yyyy', { locale: idLocale })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SearchableSelect
                      options={discountOptions}
                      value=""
                      onChange={(val) => handleAssignDiscountLabel(r.id, val)}
                      placeholder="Pilih jenis diskon..."
                      disabled={savingRowId === r.id}
                      allowCreate
                      notFoundText="Belum ada jenis diskon. Ketik untuk membuat baru."
                    />
                    {savingRowId === r.id && <Loader2 className="w-4 h-4 animate-spin text-slate-500 shrink-0" />}
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

export default PromoUsageWidget;
