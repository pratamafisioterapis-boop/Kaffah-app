import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import OwnerFinanceForm from '@/components/owner/OwnerFinanceForm';
import { useToast } from '@/components/ui/use-toast';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  DollarSign, TrendingUp, TrendingDown, Plus, RefreshCw, QrCode, Wallet, Landmark,
  Package, HelpCircle, HeartPulse, Users,
} from 'lucide-react';
import { getOwnerIncome, getOwnerExpenditures, getAdminIncome, getAdminExpenses, getPatientIncomeFromPackages, getBepFinancials, getCachedClinicId } from '@/lib/api';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import useMonthlyFinance from '@/hooks/useMonthlyFinance';
import BreakEvenPointWidget from '@/components/owner/BreakEvenPointWidget';
import ProfitMarginTrendWidget from '@/components/owner/ProfitMarginTrendWidget';
import ExpenseCategoryWidget from '@/components/owner/ExpenseCategoryWidget';
import PromoDiscountWidget from '@/components/owner/PromoDiscountWidget';
import FinanceTile, { TileEmpty, TileLoading } from '@/components/owner/finance/FinanceTile';
import AnimatedNumber from '@/components/owner/finance/AnimatedNumber';
import { Ring, Spark } from '@/components/owner/finance/charts';
import { TONES, CHART_COLORS, fmtShort, fmtRp, fmtPct } from '@/components/owner/finance/financeTheme';

const getPaymentMethodStyle = (method = '') => {
  const key = method.toLowerCase();
  if (key.includes('qris')) return { icon: QrCode, color: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (key.includes('cash') || key.includes('tunai')) return { icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50' };
  if (key.includes('transfer') || key.includes('bank')) return { icon: Landmark, color: 'text-indigo-600', bg: 'bg-indigo-50' };
  if (key.includes('paket') || key.includes('package')) return { icon: Package, color: 'text-violet-600', bg: 'bg-violet-50' };
  return { icon: HelpCircle, color: 'text-slate-500', bg: 'bg-slate-100' };
};

const THERAPIST_COLORS = ['#0d9488', '#2563eb', '#7c3aed', '#d97706', '#059669', '#e11d48'];

const Delta = ({ value, inverse = false }) => {
  if (value == null || !Number.isFinite(value)) return null;
  const good = inverse ? value <= 0 : value >= 0;
  return (
    <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap', good ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
      {value >= 0 ? '▲' : '▼'} {fmtPct(Math.abs(value))}
    </span>
  );
};

const BulanIni = () => <span className="text-[11px] font-semibold text-slate-400">Bulan ini</span>;

const KpiTile = ({ tone, icon, title, value, series, inverse, className }) => {
  const t = TONES[tone];
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const delta = prev && prev > 0 ? ((value / prev) - 1) * 100 : null;
  return (
    <FinanceTile tone={tone} icon={icon} title={title} tinted className={className}>
      <div className="flex items-center gap-2 flex-wrap">
        <p className={cn('text-[26px] sm:text-3xl font-black tabular-nums leading-none', value < 0 ? 'text-rose-600' : 'text-app-ink')} title={fmtRp(value)}>
          <AnimatedNumber value={value} format={fmtShort} />
        </p>
        <Delta value={delta} inverse={inverse} />
      </div>
      <Spark values={series} color={t.hex} className="mt-3" label={`Tren ${title}`} />
    </FinanceTile>
  );
};

const RevenueOverview = ({ dateRange }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeFormType, setActiveFormType] = useState('expenditure');
  const [refreshing, setRefreshing] = useState(false);
  // Naik tiap kali Refresh/simpan transaksi, supaya widget yang fetch sendiri ikut dimuat ulang.
  const [refreshKey, setRefreshKey] = useState(0);
  const [danaPacket, setDanaPacket] = useState({ total: 0, sisaSesi: 0, jumlahPaket: 0 });
  const [paymentMethodMap, setPaymentMethodMap] = useState({});
  const [data, setData] = useState({
    ownerIncome: [],
    adminIncome: [],
    patientIncome: [],
    ownerExpenses: [],
    adminExpenses: [],
    nonPkgRecaps: [],
    pkgRecaps: [],
  });
  // Financial Health & KPI memakai angka yang sama dengan widget Break Even Point
  // (bulan berjalan), bukan dateRange yang bisa dipilih bebas, supaya keduanya
  // selalu konsisten.
  const [bepFinancials, setBepFinancials] = useState(null);

  // Interaksi tile
  const [healthView, setHealthView] = useState('margin');
  const [selTherapist, setSelTherapist] = useState(null);
  const [selPackage, setSelPackage] = useState(null);
  const [selPayment, setSelPayment] = useState(null);

  const { monthly, loading: monthlyLoading } = useMonthlyFinance(bepFinancials, 12, refreshKey);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData?.session?.user?.id;
      const clinicId = await getCachedClinicId(currentUserId);

      const [ownerInc, adminInc, patientInc, ownerExp, adminExp, nonPkgRecaps, pkgRecaps, bepRes] = await Promise.all([
        getOwnerIncome(dateRange),
        getAdminIncome(dateRange),
        getPatientIncomeFromPackages(dateRange),
        getOwnerExpenditures(dateRange),
        getAdminExpenses(dateRange),
        supabase.from('daily_recaps')
          .select('therapist_name, amount, patient_type, payment_method, payment_splits:daily_recap_payment_splits(payment_method, amount)')
          .eq('clinic_id', clinicId)
          .gte('recap_date', dateRange.startDate)
          .lte('recap_date', dateRange.endDate)
          .is('package_tracking_id', null),
        supabase.from('daily_recaps')
          .select('therapist_name, patient_type, payment_method, package_tracking_id, amount, payment_splits:daily_recap_payment_splits(payment_method, amount), package_tracking!inner(nominal, total_sessions)')
          .eq('clinic_id', clinicId)
          .gte('recap_date', dateRange.startDate)
          .lte('recap_date', dateRange.endDate)
          .not('package_tracking_id', 'is', null),
        getBepFinancials(),
      ]);
      setBepFinancials(bepRes?.data || null);

      // Dana paket aktif
      const { data: activePkgs } = await supabase
        .from('package_tracking')
        .select('nominal, total_sessions, sessions_remaining')
        .eq('status', 'aktif')
        .gt('sessions_remaining', 0);

      const danaTotal = (activePkgs || []).reduce((s, p) =>
        s + (Number(p.nominal) / Number(p.total_sessions) * Number(p.sessions_remaining)), 0);
      setDanaPacket({
        total: Math.round(danaTotal),
        sisaSesi: (activePkgs || []).reduce((s, p) => s + Number(p.sessions_remaining), 0),
        jumlahPaket: (activePkgs || []).length,
      });

      // Label metode pembayaran
      const { data: paymentMethods } = await supabase
        .from('operational_options')
        .select('id, label')
        .eq('category', 'payment_method')
        .eq('clinic_id', clinicId);
      const pmMap = {};
      (paymentMethods || []).forEach(pm => { pmMap[pm.id] = pm.label; });
      setPaymentMethodMap(pmMap);

      setData({
        ownerIncome: ownerInc?.data || [],
        adminIncome: adminInc?.data || [],
        patientIncome: patientInc?.data || [],
        ownerExpenses: ownerExp?.data || [],
        adminExpenses: adminExp?.data || [],
        nonPkgRecaps: nonPkgRecaps?.data || [],
        pkgRecaps: pkgRecaps?.data || [],
      });
    } catch (error) {
      console.error('Error fetching finance overview:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Gagal memuat data finance.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
    fetchData(true);
  };

  // ── Computed Metrics ──
  // Total Revenue/Net Profit/Total Pengeluaran memakai totalCost & revenueThisMonth
  // dari getBepFinancials() — sama seperti widget Break Even Point — supaya
  // "biaya" di sini selalu mencakup fixed cost, transport & insentif terapis.
  const metrics = useMemo(() => {
    const sum = (arr) => arr.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
    const totalRevenue = bepFinancials?.revenueThisMonth ?? (sum(data.ownerIncome) + sum(data.adminIncome) + sum(data.patientIncome));
    const totalExpenses = bepFinancials?.totalCost ?? (sum(data.ownerExpenses) + sum(data.adminExpenses));
    const netProfit = totalRevenue - totalExpenses;
    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      margin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
      ratio: totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0,
    };
  }, [data, bepFinancials]);

  // ── Revenue per Terapis ──
  const therapistRevenue = useMemo(() => {
    const map = {};
    (data.nonPkgRecaps || []).forEach(r => {
      if (!r.therapist_name) return;
      map[r.therapist_name] = (map[r.therapist_name] || 0) + (Number(r.amount) || 0);
    });
    (data.pkgRecaps || []).forEach(r => {
      if (!r.therapist_name) return;
      const pt = r.package_tracking;
      if (!pt) return;
      map[r.therapist_name] = (map[r.therapist_name] || 0) + (Number(pt.nominal) / Number(pt.total_sessions));
    });
    return Object.entries(map)
      .map(([name, revenue]) => ({ name: name.split(',')[0], fullName: name, revenue: Math.round(revenue) }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [data.nonPkgRecaps, data.pkgRecaps]);
  const therapistTotal = therapistRevenue.reduce((s, t) => s + t.revenue, 0);

  // ── Pemasukan Paket vs Non-Paket (sesuai date range) ──
  // Pemasukan paket dihitung dari pembayaran yang benar-benar masuk (amount di
  // daily_recaps), bukan diamortisasi per sesi.
  const packageVsNonPackage = useMemo(() => {
    const nonPaketRecaps = (data.nonPkgRecaps || []).filter(r => (Number(r.amount) || 0) > 0);
    const paketRecaps = (data.pkgRecaps || []).filter(r => (Number(r.amount) || 0) > 0);
    const nonPaket = nonPaketRecaps.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const paket = paketRecaps.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const total = nonPaket + paket;
    return {
      nonPaket: Math.round(nonPaket),
      paket: Math.round(paket),
      total: Math.round(total),
      nonPaketPct: total > 0 ? Math.round((nonPaket / total) * 100) : 0,
      paketPct: total > 0 ? Math.round((paket / total) * 100) : 0,
      nonPaketCount: nonPaketRecaps.length,
      paketCount: paketRecaps.length,
    };
  }, [data.nonPkgRecaps, data.pkgRecaps]);

  // ── Pemasukan per Metode Pembayaran ──
  const paymentMethodBreakdown = useMemo(() => {
    // Murni dari kolom amount apa adanya; sesi paket ber-amount 0 tidak dihitung.
    const allRecaps = [...(data.nonPkgRecaps || []), ...(data.pkgRecaps || [])];
    const map = {};
    allRecaps.forEach(r => {
      // Recap dengan split pembayaran (mis. QRIS + Cash) dipecah per metode.
      if (Array.isArray(r.payment_splits) && r.payment_splits.length > 0) {
        r.payment_splits.forEach(s => {
          const amount = Number(s.amount) || 0;
          if (amount <= 0) return;
          const label = paymentMethodMap[s.payment_method] || s.payment_method || 'Tidak Diketahui';
          map[label] = (map[label] || 0) + amount;
        });
        return;
      }
      const amount = Number(r.amount) || 0;
      if (amount <= 0) return;
      const label = paymentMethodMap[r.payment_method] || r.payment_method || 'Tidak Diketahui';
      map[label] = (map[label] || 0) + amount;
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .map(([method, amount], i) => ({
        method,
        amount: Math.round(amount),
        pct: total > 0 ? Math.round((amount / total) * 100) : 0,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [data.nonPkgRecaps, data.pkgRecaps, paymentMethodMap]);
  const totalPemasukanMetode = paymentMethodBreakdown.reduce((s, pm) => s + pm.amount, 0);

  if (loading) {
    return <TileLoading className="py-16" />;
  }

  const openForm = (type) => { setActiveFormType(type); setIsFormOpen(true); };
  const series = (key) => monthly.map(m => m[key]);
  const isHealthy = metrics.netProfit >= 0;
  const showMargin = healthView === 'margin';
  const ringPct = showMargin ? metrics.margin : metrics.ratio;
  const rangeLabel = `${format(parseISO(dateRange.startDate), 'd MMM', { locale: idLocale })} – ${format(parseISO(dateRange.endDate), 'd MMM yyyy', { locale: idLocale })}`;
  const pickedPayment = paymentMethodBreakdown.find(p => p.method === selPayment);

  const miniBar = (key, label, value, color) => (
    <button
      type="button"
      onClick={() => setHealthView(key)}
      aria-pressed={healthView === key}
      className={cn('grid gap-1 px-2.5 py-2 rounded-xl text-left transition-colors', healthView === key ? 'bg-slate-100' : 'hover:bg-slate-50')}
    >
      <span className="flex justify-between text-xs font-semibold text-slate-600"><span>{label}</span><span className="tabular-nums">{fmtPct(value)}</span></span>
      <span className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <span className="block h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none" style={{ width: `${Math.min(Math.abs(value), 100)}%`, backgroundColor: color }} />
      </span>
    </button>
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-app-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {activeFormType === 'expenditure' ? 'Tambah Pengeluaran' : 'Tambah Pemasukan'} Owner
            </DialogTitle>
          </DialogHeader>
          <OwnerFinanceForm
            type={activeFormType}
            dateRange={dateRange}
            onSuccess={() => {
              setIsFormOpen(false);
              setRefreshKey(k => k + 1);
              fetchData(true);
            }}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Header + input cepat */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="mr-auto min-w-0">
          <h2 className="text-xl md:text-2xl font-black text-app-ink leading-none">Finance</h2>
          <p className="text-xs text-slate-500 mt-1">{rangeLabel}</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => openForm('expenditure')}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-rose-600 text-white text-[13px] font-semibold shadow-sm transition-[transform,opacity] active:scale-[0.96] hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Keluar
          </button>
          <button
            type="button"
            onClick={() => openForm('income')}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold shadow-sm transition-[transform,opacity] active:scale-[0.96] hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Masuk
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Muat ulang"
            className="w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 active:scale-[0.96] transition-[transform,background-color]"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ── Bento grid: 2 kolom HP, 4 kolom tablet, 6 kolom desktop ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
        {/* Kesehatan */}
        <FinanceTile
          tone={isHealthy ? 'pos' : 'neg'} icon={HeartPulse} title="Kesehatan" tinted action={<BulanIni />}
          className="col-span-2 md:col-span-2 md:row-span-2"
        >
          <div className="flex flex-wrap items-center gap-4">
            <Ring pct={ringPct} color={showMargin ? '#059669' : '#d97706'} className="w-[132px] shrink-0 mx-auto sm:mx-0">
              <b className="text-2xl font-black tabular-nums leading-none text-app-ink">
                <AnimatedNumber value={ringPct} format={fmtPct} />
              </b>
              <small className="text-xs text-slate-500 mt-1">{showMargin ? 'Margin' : 'Biaya'}</small>
            </Ring>
            <div className="grid gap-2 flex-1 min-w-[150px]">
              <span className={cn('inline-flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-xs font-bold', isHealthy ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
                <span className="w-2 h-2 rounded-full bg-current" />
                {isHealthy ? 'Sehat' : 'Waspada'}
              </span>
              {miniBar('margin', 'Margin', metrics.margin, '#059669')}
              {miniBar('ratio', 'Biaya / Pendapatan', metrics.ratio, '#d97706')}
            </div>
          </div>
        </FinanceTile>

        <KpiTile tone="pos" icon={DollarSign} title="Pendapatan" value={metrics.totalRevenue} series={series('revenue')} className="col-span-1 md:col-span-2" />
        <KpiTile tone="sky" icon={TrendingUp} title="Laba Bersih" value={metrics.netProfit} series={series('profit')} className="col-span-1 md:col-span-2" />
        <KpiTile tone="neg" icon={TrendingDown} title="Biaya" value={metrics.totalExpenses} series={series('expense')} inverse className="col-span-1 md:col-span-2" />

        {/* Dana paket */}
        <FinanceTile tone="warn" icon={Package} title="Dana Paket" className="col-span-1 md:col-span-2">
          <p className="text-[26px] sm:text-3xl font-black tabular-nums leading-none text-amber-600" title={fmtRp(danaPacket.total)}>
            <AnimatedNumber value={danaPacket.total} format={fmtShort} />
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-baseline gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-[13px] font-bold tabular-nums">{danaPacket.sisaSesi} <small className="text-xs font-medium text-slate-500">sesi</small></span>
            <span className="inline-flex items-baseline gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-[13px] font-bold tabular-nums">{danaPacket.jumlahPaket} <small className="text-xs font-medium text-slate-500">paket</small></span>
          </div>
        </FinanceTile>

        <BreakEvenPointWidget key={`bep-${refreshKey}`} className="col-span-2 md:col-span-4 lg:col-span-3" />
        <ProfitMarginTrendWidget monthly={monthly} loading={monthlyLoading} className="col-span-2 md:col-span-4 lg:col-span-3" />
        <ExpenseCategoryWidget key={`cat-${refreshKey}`} dateRange={dateRange} className="col-span-2 md:col-span-4 lg:col-span-3" />

        {/* Metode pembayaran */}
        <FinanceTile tone="sky" icon={Landmark} title="Metode Bayar" className="col-span-2 md:col-span-4 lg:col-span-3">
          {paymentMethodBreakdown.length === 0 ? (
            <TileEmpty>Belum ada pemasukan pada periode ini.</TileEmpty>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mb-3 flex-wrap">
                <p className="text-3xl font-black tabular-nums leading-none text-app-ink" title={fmtRp(pickedPayment ? pickedPayment.amount : totalPemasukanMetode)}>
                  <AnimatedNumber value={pickedPayment ? pickedPayment.amount : totalPemasukanMetode} format={fmtShort} />
                </p>
                <span className="text-xs text-slate-500">{pickedPayment ? `${pickedPayment.method} · ${pickedPayment.pct}%` : 'Total'}</span>
              </div>
              <div className="flex h-[22px] gap-0.5 rounded-xl overflow-hidden bg-slate-100">
                {paymentMethodBreakdown.map(pm => (
                  <button
                    key={pm.method}
                    type="button"
                    aria-label={pm.method}
                    onClick={() => setSelPayment(selPayment === pm.method ? null : pm.method)}
                    className="h-full transition-opacity duration-200"
                    style={{ flexGrow: pm.amount, flexBasis: 0, minWidth: 3, backgroundColor: pm.color, opacity: selPayment && selPayment !== pm.method ? 0.3 : 1 }}
                  />
                ))}
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5 mt-3">
                {paymentMethodBreakdown.map(pm => {
                  const st = getPaymentMethodStyle(pm.method);
                  const dim = selPayment && selPayment !== pm.method;
                  return (
                    <button
                      key={pm.method}
                      type="button"
                      onClick={() => setSelPayment(selPayment === pm.method ? null : pm.method)}
                      aria-pressed={selPayment === pm.method}
                      className={cn('grid gap-1.5 p-3 rounded-2xl text-left transition-[opacity,transform] duration-200 active:scale-[0.97]', st.bg, st.color, dim && 'opacity-40')}
                    >
                      <span className="flex items-center justify-between gap-2 text-[13px] font-bold">
                        <span className="min-w-0 break-words">{pm.method}</span>
                        <st.icon className="w-4 h-4 shrink-0" />
                      </span>
                      <span className="text-lg font-black tabular-nums leading-none" title={fmtRp(pm.amount)}>{fmtShort(pm.amount)}</span>
                      <span className="text-xs opacity-80">{pm.pct}%</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </FinanceTile>

        {/* Per terapis */}
        <FinanceTile tone="acc" icon={Users} title="Per Terapis" className="col-span-2 md:col-span-4 lg:col-span-2">
          {therapistRevenue.length === 0 ? (
            <TileEmpty>Belum ada data.</TileEmpty>
          ) : (
            <div className="grid gap-0.5">
              {therapistRevenue.map((t, i) => (
                <button
                  key={t.fullName}
                  type="button"
                  onClick={() => setSelTherapist(selTherapist === t.fullName ? null : t.fullName)}
                  aria-pressed={selTherapist === t.fullName}
                  className={cn('grid gap-1 w-full px-2 py-2 rounded-xl text-left transition-colors', selTherapist === t.fullName ? 'bg-slate-100' : 'hover:bg-slate-50')}
                >
                  <span className="flex items-center gap-2 text-[13px] font-semibold">
                    <span className="w-4 text-[11px] text-slate-400">{i + 1}</span>
                    <span className="flex-1 min-w-0 break-words text-slate-700">{t.name}</span>
                    <span className="tabular-nums" title={fmtRp(t.revenue)}>
                      {selTherapist === t.fullName ? fmtPct(therapistTotal > 0 ? (t.revenue / therapistTotal) * 100 : 0) : fmtShort(t.revenue)}
                    </span>
                  </span>
                  <span className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <span
                      className="block h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
                      style={{ width: `${(t.revenue / (therapistRevenue[0]?.revenue || 1)) * 100}%`, backgroundColor: THERAPIST_COLORS[i % THERAPIST_COLORS.length] }}
                    />
                  </span>
                </button>
              ))}
            </div>
          )}
        </FinanceTile>

        {/* Paket vs non-paket */}
        <FinanceTile tone="vio" icon={Package} title="Paket vs Non-Paket" className="col-span-2 md:col-span-2 lg:col-span-2">
          {packageVsNonPackage.total === 0 ? (
            <TileEmpty>Belum ada pemasukan pada periode ini.</TileEmpty>
          ) : (
            <>
              <div className="flex h-8 gap-0.5 rounded-xl overflow-hidden bg-slate-100">
                {[['paket', packageVsNonPackage.paket, '#7c3aed'], ['non', packageVsNonPackage.nonPaket, '#2563eb']].map(([k, v, c]) => (
                  <button
                    key={k}
                    type="button"
                    aria-label={k === 'paket' ? 'Paket' : 'Non-Paket'}
                    onClick={() => setSelPackage(selPackage === k ? null : k)}
                    className="h-full transition-opacity duration-200"
                    style={{ flexGrow: v, flexBasis: 0, backgroundColor: c, opacity: selPackage && selPackage !== k ? 0.3 : 1 }}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2.5 mt-3">
                {[
                  { k: 'paket', label: 'Paket', v: packageVsNonPackage.paket, pct: packageVsNonPackage.paketPct, n: packageVsNonPackage.paketCount, cls: 'bg-violet-50 text-violet-600' },
                  { k: 'non', label: 'Non-Paket', v: packageVsNonPackage.nonPaket, pct: packageVsNonPackage.nonPaketPct, n: packageVsNonPackage.nonPaketCount, cls: 'bg-blue-50 text-blue-600' },
                ].map(c => (
                  <button
                    key={c.k}
                    type="button"
                    onClick={() => setSelPackage(selPackage === c.k ? null : c.k)}
                    aria-pressed={selPackage === c.k}
                    className={cn('grid gap-1 p-3 rounded-2xl text-left transition-[opacity,transform] duration-200 active:scale-[0.97]', c.cls, selPackage && selPackage !== c.k && 'opacity-40')}
                  >
                    <span className="text-xs font-semibold opacity-80">{c.label} · {c.n}x</span>
                    <span className="text-xl font-black tabular-nums leading-none" title={fmtRp(c.v)}>{fmtShort(c.v)}</span>
                    <span className="text-xs opacity-80">{c.pct}%</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </FinanceTile>

        <PromoDiscountWidget key={`promo-${refreshKey}`} dateRange={dateRange} className="col-span-2 md:col-span-2 lg:col-span-2" />
      </div>
    </div>
  );
};

export default RevenueOverview;
