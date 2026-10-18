import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Target, Wallet, Info, Receipt, Bus, Coins, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { autoPostFixedCosts, getBepFinancials } from '@/lib/api';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import FinanceTile, { TileLoading } from '@/components/owner/finance/FinanceTile';
import { fmtShort, fmtPct } from '@/components/owner/finance/financeTheme';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import BepItemDetailModal from '@/components/owner/BepItemDetailModal';

const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

// Perhitungan biaya & pemasukan bulan berjalan (fixed cost, pengeluaran,
// transport & insentif terapis) dipusatkan di getBepFinancials() (src/lib/api.js)
// supaya widget ini dan ringkasan Financial Health selalu konsisten.
const BreakEvenPointWidget = ({ className }) => {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  // Label periode yang benar-benar dipakai getBepFinancials(): pengeluaran
  // dihitung tgl 1 bulan ini s/d hari ini, pemasukan tgl 1 s/d akhir bulan.
  const expensePeriodLabel = `${format(monthStart, 'd MMM', { locale: idLocale })} – ${format(today, 'd MMM yyyy', { locale: idLocale })}`;
  const revenuePeriodLabel = `${format(monthStart, 'd MMM', { locale: idLocale })} – ${format(monthEnd, 'd MMM yyyy', { locale: idLocale })}`;
  const { userDetails } = useAuth();
  const clinicId = userDetails?.clinic_id;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  const [ownerExpense, setOwnerExpense] = useState(0);
  const [adminExpense, setAdminExpense] = useState(0);
  const [transportTotal, setTransportTotal] = useState(0);
  const [incentiveTotal, setIncentiveTotal] = useState(0);
  const [revenueThisMonth, setRevenueThisMonth] = useState(0);
  const [breakEvenDate, setBreakEvenDate] = useState(null);
  const [salarySource, setSalarySource] = useState({
    transportFromPayroll: 0, transportLive: 0,
    incentiveFromPayroll: 0, incentiveLive: 0,
    payrollTherapistCount: 0,
  });
  const [expenseItems, setExpenseItems] = useState([]);
  const [transportBreakdown, setTransportBreakdown] = useState([]);
  const [incentiveBreakdown, setIncentiveBreakdown] = useState([]);
  // Baris mana yang lagi dibuka detailnya: 'fixedCost' | 'expense' | 'transport' | 'incentive' | null
  const [activeDetail, setActiveDetail] = useState(null);
  // Bagian biaya yang disorot di bar; null = tampilkan total biaya.
  const [selected, setSelected] = useState(null);
  const [showNote, setShowNote] = useState(false);

  const fetchFixedCostItems = useCallback(async () => {
    if (!clinicId) return;
    await autoPostFixedCosts();
    const { data, error } = await supabase
      .from('clinic_fixed_costs')
      .select('id, item_name, amount')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: true });
    if (!error) setItems(data || []);
  }, [clinicId]);

  const fetchBepData = useCallback(async () => {
    if (!clinicId) { setLoading(false); return; }
    setLoading(true);

    await fetchFixedCostItems();

    const { data } = await getBepFinancials();
    if (data) {
      setOwnerExpense(data.ownerExpense);
      setAdminExpense(data.adminExpense);
      setRevenueThisMonth(data.revenueThisMonth);
      setTransportTotal(data.transportTotal);
      setIncentiveTotal(data.incentiveTotal);
      setBreakEvenDate(data.breakEvenDate || null);
      setSalarySource({
        transportFromPayroll: data.transportFromPayroll || 0,
        transportLive: data.transportLive || 0,
        incentiveFromPayroll: data.incentiveFromPayroll || 0,
        incentiveLive: data.incentiveLive || 0,
        payrollTherapistCount: data.payrollTherapistCount || 0,
      });
      setExpenseItems(data.expenseItems || []);
      setTransportBreakdown(data.transportBreakdown || []);
      setIncentiveBreakdown(data.incentiveBreakdown || []);
    }
    setLoading(false);
  }, [clinicId, fetchFixedCostItems]);

  useEffect(() => { fetchBepData(); }, [fetchBepData]);

  const totalFixedCost = useMemo(() => items.reduce((s, i) => s + (Number(i.amount) || 0), 0), [items]);
  const totalCost = totalFixedCost + ownerExpense + adminExpense + transportTotal + incentiveTotal;
  const progressPct = totalCost > 0 ? Math.min(Math.round((revenueThisMonth / totalCost) * 100), 100) : 0;
  const isConfigured = totalFixedCost > 0;
  const isBreakEven = revenueThisMonth >= totalCost;
  // Transport & insentif bisa berasal dari dua fase sekaligus dalam satu bulan:
  // slip gaji yang sudah dibuat (angkanya terkunci) dan akrual harian terapis
  // yang periodenya belum dibayar. Dijelaskan supaya owner tahu angka itu masih
  // bergerak tiap hari atau sudah final.
  const describeSource = useCallback((fromPayroll, live) => {
    const { payrollTherapistCount } = salarySource;
    if (fromPayroll > 0 && live > 0) return `payroll ${payrollTherapistCount} terapis + akrual harian`;
    if (fromPayroll > 0) return `mengikuti payroll ${payrollTherapistCount} terapis bulan ini`;
    if (live > 0) return 'akrual harian, belum ada payroll bulan ini';
    return null;
  }, [salarySource]);
  const transportSource = describeSource(salarySource.transportFromPayroll, salarySource.transportLive);
  const incentiveSource = describeSource(salarySource.incentiveFromPayroll, salarySource.incentiveLive);

  // Setiap sumber data (fixed cost, pengeluaran, transport, insentif) punya
  // bentuk baris yang beda-beda; diseragamkan di sini jadi { key, label,
  // sublabel, date, amount } supaya BepItemDetailModal cukup satu komponen.
  const detailConfigs = useMemo(() => ({
    fixedCost: {
      title: 'Rincian Fixed Cost',
      icon: <Wallet />, iconClassName: 'text-amber-400',
      totalAmount: totalFixedCost,
      emptyText: 'Belum ada fixed cost.',
      rows: [...items]
        .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
        .map(i => ({ key: i.id, label: i.item_name, amount: Number(i.amount) || 0 })),
    },
    expense: {
      title: 'Rincian Pengeluaran',
      icon: <Receipt />, iconClassName: 'text-rose-400',
      periodLabel: expensePeriodLabel,
      totalAmount: ownerExpense + adminExpense,
      emptyText: 'Belum ada pengeluaran di periode ini.',
      rows: expenseItems.map(e => ({
        key: e.id, label: e.description, date: e.date,
        sublabel: [e.category, e.source === 'admin' ? 'Kasir/Admin' : 'Owner'].filter(Boolean).join(' · '),
        amount: e.amount,
      })),
    },
    transport: {
      title: 'Rincian Transport Terapis',
      icon: <Bus />, iconClassName: 'text-cyan-400',
      periodLabel: expensePeriodLabel,
      totalAmount: transportTotal,
      emptyText: 'Belum ada transport terapis di periode ini.',
      rows: transportBreakdown.map((t, idx) => ({
        key: `${t.therapistId}-${t.source}-${idx}`, label: t.name, sublabel: t.detail, amount: t.amount,
      })),
    },
    incentive: {
      title: 'Rincian Insentif Terapis',
      icon: <Coins />, iconClassName: 'text-emerald-400',
      periodLabel: expensePeriodLabel,
      totalAmount: incentiveTotal,
      emptyText: 'Belum ada insentif terapis di periode ini.',
      rows: incentiveBreakdown.map((t, idx) => ({
        key: `${t.therapistId}-${t.source}-${idx}`, label: t.name, sublabel: t.detail, amount: t.amount,
      })),
    },
  }), [items, totalFixedCost, expenseItems, ownerExpense, adminExpense, expensePeriodLabel, transportBreakdown, transportTotal, incentiveBreakdown, incentiveTotal]);
  const activeModal = activeDetail ? detailConfigs[activeDetail] : null;

  const segments = [
    { key: 'fixedCost', label: 'Fixed', value: totalFixedCost, color: '#0d9488', source: null },
    { key: 'expense', label: 'Belanja', value: ownerExpense + adminExpense, color: '#2563eb', source: null },
    { key: 'transport', label: 'Transport', value: transportTotal, color: '#d97706', source: transportSource },
    { key: 'incentive', label: 'Insentif', value: incentiveTotal, color: '#7c3aed', source: incentiveSource },
  ];
  const picked = segments.find(sg => sg.key === selected);
  const scaleMax = Math.max(revenueThisMonth, totalCost, 1) * 1.04;
  const costPct = (totalCost / scaleMax) * 100;
  const revPct = (revenueThisMonth / scaleMax) * 100;

  const statusChip = !loading && isConfigured && (
    <span className={cn(
      'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap',
      isBreakEven ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
    )}>
      {isBreakEven
        ? `Impas${breakEvenDate ? ` ${format(parseISO(breakEvenDate), 'd MMM', { locale: idLocale })}` : ''}`
        : `Kurang ${fmtShort(totalCost - revenueThisMonth)}`}
    </span>
  );

  return (
    <FinanceTile tone="acc" icon={Target} title="Break Even Point" action={statusChip} className={className}>
      {loading ? (
        <TileLoading />
      ) : !isConfigured ? (
        <div className="rounded-app border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
          <Info className="w-5 h-5 text-teal-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Belum ada fixed cost. Atur di menu Accounting System untuk melihat titik impas.</p>
        </div>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Biaya</p>
              <p className="text-2xl font-black tabular-nums leading-tight text-app-ink" title={formatCurrency(totalCost)}>{fmtShort(totalCost)}</p>
            </div>
            <span className="text-xs font-bold text-slate-500 tabular-nums pb-1">{progressPct}%</span>
            <div className="min-w-0 text-right">
              <p className="text-xs text-slate-500">Pemasukan</p>
              <p className="text-2xl font-black tabular-nums leading-tight text-emerald-600" title={formatCurrency(revenueThisMonth)}>{fmtShort(revenueThisMonth)}</p>
            </div>
          </div>

          <div className="relative grid gap-2">
            <div className="absolute -top-1 -bottom-1 w-[3px] -ml-px rounded bg-app-ink z-10 pointer-events-none" style={{ left: `${costPct}%` }} aria-hidden="true" />
            <div className="flex h-8 gap-0.5 rounded-xl overflow-hidden bg-slate-100" style={{ width: `${costPct}%` }}>
              {segments.filter(sg => sg.value > 0).map(sg => (
                <motion.button
                  key={sg.key}
                  type="button"
                  aria-label={sg.label}
                  onClick={() => setSelected(selected === sg.key ? null : sg.key)}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1, opacity: selected && selected !== sg.key ? 0.3 : 1 }}
                  transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                  style={{ flexGrow: sg.value, flexBasis: 0, minWidth: 3, backgroundColor: sg.color, transformOrigin: 'left' }}
                  className="h-full"
                />
              ))}
            </div>
            <div className="h-5 rounded-full bg-slate-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${revPct}%` }}
                transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                className="h-full rounded-full bg-emerald-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {segments.map(sg => (
              <button
                key={sg.key}
                type="button"
                onClick={() => setSelected(selected === sg.key ? null : sg.key)}
                aria-pressed={selected === sg.key}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors',
                  selected === sg.key ? 'bg-slate-100 border-slate-300' : 'border-slate-200 hover:bg-slate-50'
                )}
              >
                <span className="w-2 h-2 rounded-[3px]" style={{ backgroundColor: sg.color }} />
                {sg.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowNote(v => !v)}
              aria-label="Catatan perhitungan"
              aria-pressed={showNote}
              className="ml-auto w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-3 min-h-[40px]">
            <p className="text-xl font-black tabular-nums text-app-ink" title={formatCurrency(picked ? picked.value : totalCost)}>
              {fmtShort(picked ? picked.value : totalCost)}
            </p>
            <p className="text-xs text-slate-500 min-w-0 break-words">
              {picked
                ? `${picked.label} · ${fmtPct((picked.value / (totalCost || 1)) * 100)}${picked.source ? ` · ${picked.source}` : ''}`
                : 'Total biaya'}
            </p>
            {picked && (
              <button
                type="button"
                onClick={() => setActiveDetail(picked.key)}
                className="ml-auto shrink-0 inline-flex items-center gap-0.5 text-xs font-semibold text-teal-700 rounded-lg px-2 py-1.5 hover:bg-teal-50"
              >
                Rincian <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {showNote && (
            <p className="text-xs text-slate-500 italic mt-2">
              *Biaya {expensePeriodLabel}; pemasukan {revenuePeriodLabel}. Pengeluaran di luar pos yang sudah masuk Fixed Cost &amp; slip gaji supaya tidak dobel. Transport &amp; insentif terapis diakrual harian sampai payroll periode itu dibuat, lalu mengikuti slip gaji.
            </p>
          )}
        </>
      )}

      {activeModal && (
        <BepItemDetailModal
          isOpen={!!activeDetail}
          onClose={() => setActiveDetail(null)}
          title={activeModal.title}
          icon={activeModal.icon}
          iconClassName={activeModal.iconClassName}
          periodLabel={activeModal.periodLabel}
          totalAmount={activeModal.totalAmount}
          rows={activeModal.rows}
          emptyText={activeModal.emptyText}
        />
      )}
    </FinanceTile>
  );
};

export default BreakEvenPointWidget;
