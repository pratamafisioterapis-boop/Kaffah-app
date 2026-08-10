import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Target, Loader2, Users, Wallet, Info, Receipt, Bus, Coins, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { autoPostFixedCosts, getBepFinancials } from '@/lib/api';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import BepItemDetailModal from '@/components/owner/BepItemDetailModal';

const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

// Perhitungan biaya & pemasukan bulan berjalan (fixed cost, pengeluaran,
// transport & insentif terapis) dipusatkan di getBepFinancials() (src/lib/api.js)
// supaya widget ini dan ringkasan Financial Health selalu konsisten.
const BreakEvenPointWidget = () => {
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
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

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-xl border border-slate-800/50" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #1e293b 100%)' }}>
      <div className="absolute -top-16 -right-16 w-56 h-56 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 p-6 space-y-5">
        <div className={cn("flex gap-3", isPWA ? "flex-col" : "items-start justify-between")}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-900/40 shrink-0">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-bold text-base tracking-tight">Break Even Point</h3>
              <p className="text-slate-400 text-xs mt-0.5">Total biaya bulan ini vs total pemasukan bulan ini</p>
              <p className="text-slate-500 text-[11px] mt-0.5">Per {format(today, 'd MMM yyyy', { locale: idLocale })}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          </div>
        ) : !isConfigured ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-5 text-center">
            <Info className="w-5 h-5 text-indigo-300 mx-auto mb-2" />
            <p className="text-sm text-slate-300">Belum ada fixed cost. Atur di menu Accounting System untuk melihat titik impas.</p>
          </div>
        ) : (
          <>
            <div className={cn("grid gap-3", isPWA ? "grid-cols-1" : "grid-cols-2")}>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">Total Biaya Bulan Ini</p>
                <p className="text-lg font-bold text-white tabular-nums break-words">{formatCurrency(totalCost)}</p>
                <p className="text-[11px] text-slate-400 mt-1">fixed cost + pengeluaran + transport + insentif</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{expensePeriodLabel}</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">Total Pemasukan Bulan Ini</p>
                <p className="text-lg font-bold text-white tabular-nums break-words">{formatCurrency(revenueThisMonth)}</p>
                <p className="text-[11px] text-slate-400 mt-1">tgl 1 s/d akhir bulan</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{revenuePeriodLabel}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className={cn("flex text-xs gap-1", isPWA ? "flex-col" : "items-center justify-between")}>
                <span className="text-slate-400 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Progress terhadap biaya bulan ini</span>
                <span className="text-white font-semibold">{progressPct}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: isBreakEven ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #6366f1, #a855f7)' }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                {isBreakEven
                  ? `Sudah melewati titik impas${breakEvenDate ? ` pada ${format(parseISO(breakEvenDate), 'd MMM yyyy', { locale: idLocale })}` : ''} — profit ${formatCurrency(revenueThisMonth - totalCost)} 🎉`
                  : `Kurang ${formatCurrency(totalCost - revenueThisMonth)} lagi untuk mencapai titik impas`}
              </p>
            </div>

            <div className={cn("grid gap-3 pt-1", isPWA ? "grid-cols-1" : "grid-cols-2")}>
              <button type="button" onClick={() => setActiveDetail('fixedCost')} className="flex items-start gap-2 text-xs text-slate-400 text-left rounded-lg -m-1 p-1 hover:bg-white/5 active:bg-white/10 transition-colors">
                <Wallet className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p>Fixed Cost:</p>
                  <p className="text-slate-200 font-semibold tabular-nums break-words">{formatCurrency(totalFixedCost)}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
              </button>
              <button type="button" onClick={() => setActiveDetail('expense')} className="flex items-start gap-2 text-xs text-slate-400 text-left rounded-lg -m-1 p-1 hover:bg-white/5 active:bg-white/10 transition-colors">
                <Receipt className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p>Pengeluaran ({expensePeriodLabel}):</p>
                  <p className="text-slate-200 font-semibold tabular-nums break-words">{formatCurrency(ownerExpense + adminExpense)}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
              </button>
              <button type="button" onClick={() => setActiveDetail('transport')} className="flex items-start gap-2 text-xs text-slate-400 text-left rounded-lg -m-1 p-1 hover:bg-white/5 active:bg-white/10 transition-colors">
                <Bus className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p>Transport Terapis:</p>
                  <p className="text-slate-200 font-semibold tabular-nums break-words">{formatCurrency(transportTotal)}</p>
                  {transportSource && <p className="text-[10px] text-slate-500">{transportSource}</p>}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
              </button>
              <button type="button" onClick={() => setActiveDetail('incentive')} className="flex items-start gap-2 text-xs text-slate-400 text-left rounded-lg -m-1 p-1 hover:bg-white/5 active:bg-white/10 transition-colors">
                <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p>Insentif Terapis:</p>
                  <p className="text-slate-200 font-semibold tabular-nums break-words">{formatCurrency(incentiveTotal)}</p>
                  {incentiveSource && <p className="text-[10px] text-slate-500">{incentiveSource}</p>}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
              </button>
            </div>
            <p className="text-[10px] text-slate-500 italic">
              *Pengeluaran dihitung dari {expensePeriodLabel}, di luar pos yang sudah masuk Fixed Cost &amp; slip gaji supaya tidak dobel. Gaji pokok karyawan tetap sudah termasuk di Fixed Cost. Transport &amp; insentif terapis diakrual harian dari awal periode gaji masing-masing s/d {format(today, 'd MMM yyyy', { locale: idLocale })}; begitu payroll periode itu dibuat, angkanya mengikuti slip gaji dan akrual harian berhenti sampai akhir bulan.
            </p>
          </>
        )}
      </div>

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
    </div>
  );
};

export default BreakEvenPointWidget;
