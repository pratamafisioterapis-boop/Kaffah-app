import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import OwnerFinanceForm from '@/components/owner/OwnerFinanceForm';
import { useToast } from '@/components/ui/use-toast';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import {
  DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, RefreshCw, Loader2, Plus,
  QrCode, Wallet, Landmark, Package, HelpCircle
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import {
  getOwnerIncome, getOwnerExpenditures, getAdminIncome,
  getAdminExpenses, getPatientIncomeFromPackages, getServiceRates,
  getBepFinancials
} from '@/lib/api';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import BreakEvenPointWidget from '@/components/owner/BreakEvenPointWidget';
import ProfitMarginTrendWidget from '@/components/owner/ProfitMarginTrendWidget';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

const getPaymentMethodStyle = (method = '') => {
  const key = method.toLowerCase();
  if (key.includes('qris')) {
    return { icon: QrCode, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', accent: 'border-l-emerald-500' };
  }
  if (key.includes('cash') || key.includes('tunai')) {
    return { icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', accent: 'border-l-amber-500' };
  }
  if (key.includes('transfer') || key.includes('bank')) {
    return { icon: Landmark, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', accent: 'border-l-indigo-500' };
  }
  if (key.includes('paket') || key.includes('package')) {
    return { icon: Package, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', accent: 'border-l-violet-500' };
  }
  return { icon: HelpCircle, color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-100', accent: 'border-l-slate-300' };
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

const formatShortCurrency = (amount) => {
  const num = Number(amount) || 0;
  if (num >= 1_000_000_000) return `Rp ${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, '')} M`;
  if (num >= 1_000_000) return `Rp ${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')} Jt`;
  if (num >= 1_000) return `Rp ${(num / 1_000).toFixed(0)} Rb`;
  return `Rp ${Math.round(num).toLocaleString('id-ID')}`;
};

const formatFull = (amount) => {
  const num = Math.round(Number(amount) || 0);
  return `Rp ${num.toLocaleString('id-ID')}`;
};

const RevenueOverview = ({ dateRange }) => {
  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeFormType, setActiveFormType] = useState('expenditure');
  const [refreshing, setRefreshing] = useState(false);
  const [danaPacket, setDanaPacket] = useState({ total: 0, sisaSesi: 0, jumlahPaket: 0 });
  const [paymentMethodMap, setPaymentMethodMap] = useState({});
  const [data, setData] = useState({
    ownerIncome: [],
    adminIncome: [],
    patientIncome: [],
    ownerExpenses: [],
    adminExpenses: [],
    receivables: [],
    bankAccounts: [],
    nonPkgRecaps: [],
    pkgRecaps: [],
  });
  const [serviceRates, setServiceRates] = useState([]);
  // Financial Health Overview & KPI di atas memakai angka yang sama dengan
  // widget Break Even Point (bulan berjalan) — bukan angka dateRange yang
  // bisa dipilih bebas — supaya kedua ringkasan selalu konsisten satu sama lain.
  const [bepFinancials, setBepFinancials] = useState(null);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData?.session?.user?.id;
      const { data: currentUserRow } = await supabase.from('users').select('clinic_id').eq('id', currentUserId).single();
      const clinicId = currentUserRow?.clinic_id;

      const [ownerInc, adminInc, patientInc, ownerExp, adminExp, nonPkgRecaps, pkgRecaps, serviceRatesRes, bepRes] = await Promise.all([
        getOwnerIncome(dateRange),
        getAdminIncome(dateRange),
        getPatientIncomeFromPackages(dateRange),
        getOwnerExpenditures(dateRange),
        getAdminExpenses(dateRange),
        supabase.from('daily_recaps')
          .select('therapist_name, amount, patient_type, payment_method')
          .eq('clinic_id', clinicId)
          .gte('recap_date', dateRange.startDate)
          .lte('recap_date', dateRange.endDate)
          .is('package_tracking_id', null),
        supabase.from('daily_recaps')
          .select('therapist_name, patient_type, payment_method, package_tracking_id, amount, package_tracking!inner(nominal, total_sessions)')
          .eq('clinic_id', clinicId)
          .gte('recap_date', dateRange.startDate)
          .lte('recap_date', dateRange.endDate)
          .not('package_tracking_id', 'is', null),
        getServiceRates(),
        getBepFinancials(),
      ]);
      setBepFinancials(bepRes?.data || null);
// Fetch dana paket aktif
      const { data: activePkgs } = await supabase
        .from('package_tracking')
        .select('nominal, total_sessions, sessions_remaining')
        .eq('status', 'aktif')
        .gt('sessions_remaining', 0);

      const danaTotal = (activePkgs || []).reduce((s, p) =>
        s + (Number(p.nominal) / Number(p.total_sessions) * Number(p.sessions_remaining)), 0);
      const sisaSesi = (activePkgs || []).reduce((s, p) => s + Number(p.sessions_remaining), 0);

      setDanaPacket({
        total: Math.round(danaTotal),
        sisaSesi,
        jumlahPaket: (activePkgs || []).length
      });

      // Fetch label metode pembayaran
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
        receivables: [],
        bankAccounts: [],
        nonPkgRecaps: nonPkgRecaps?.data || [],
        pkgRecaps: pkgRecaps?.data || [],
      });
      setServiceRates(serviceRatesRes?.data || []);
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

  // ── Computed Metrics ──
  // Financial Health Overview & KPI (Total Revenue/Net Profit/Total
  // Pengeluaran/alerts) memakai totalCost & revenueThisMonth dari
  // getBepFinancials() — sama seperti widget Break Even Point — supaya
  // "biaya" di sini selalu mencakup fixed cost, transport & insentif
  // terapis, bukan cuma transaksi pengeluaran owner/admin yang tercatat.
  const metrics = useMemo(() => {
    const sum = (arr, key = 'amount') => arr.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);

    const ownerIncome = sum(data.ownerIncome);
    const adminIncome = sum(data.adminIncome);
    const patientIncome = sum(data.patientIncome);

    const totalRevenue = bepFinancials?.revenueThisMonth ?? (ownerIncome + adminIncome + patientIncome);
    const totalExpenses = bepFinancials?.totalCost ?? (sum(data.ownerExpenses) + sum(data.adminExpenses));
    const netProfit = totalRevenue - totalExpenses;

    const totalReceivable = data.receivables
      .filter(r => r.status !== 'Paid')
      .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

    const totalCash = data.bankAccounts.reduce((acc, b) => acc + (Number(b.balance) || 0), 0);

    return { totalRevenue, totalExpenses, netProfit, totalReceivable, totalCash, ownerIncome, adminIncome, patientIncome };
  }, [data, bepFinancials]);

  // ── Revenue Trend Data (group by date) ──
  const revenueTrendData = useMemo(() => {
    const allIncome = [
      ...data.ownerIncome.map(i => ({ date: i.date, amount: Number(i.amount) || 0 })),
      ...data.adminIncome.map(i => ({ date: i.transaction_date || i.date, amount: Number(i.amount) || 0 })),
      ...data.patientIncome.map(i => ({ date: i.date, amount: Number(i.amount) || 0 }))
    ];

    const grouped = {};
    allIncome.forEach(item => {
      if (!item.date) return;
      const d = typeof item.date === 'string' ? item.date.split('T')[0] : format(new Date(item.date), 'yyyy-MM-dd');
      grouped[d] = (grouped[d] || 0) + item.amount;
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({
        date: format(parseISO(date), 'dd MMM'),
        fullDate: date,
        revenue: amount
      }));
  }, [data]);

  // ── Expense Breakdown by Category ──
  const expenseBreakdown = useMemo(() => {
    const allExpenses = [
      ...data.ownerExpenses.map(e => ({ category: e.category || 'Lainnya', amount: Number(e.amount) || 0 })),
      ...data.adminExpenses.map(e => ({ category: e.category || 'Lainnya', amount: Number(e.amount) || 0 }))
    ];

    const grouped = {};
    allExpenses.forEach(item => {
      grouped[item.category] = (grouped[item.category] || 0) + item.amount;
    });

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [data]);

  // ── Top Patients by Revenue ──
  const topPatients = useMemo(() => {
    const grouped = {};
    data.patientIncome.forEach(item => {
      const name = item.patient_name || 'Unknown';
      grouped[name] = (grouped[name] || 0) + (Number(item.amount) || 0);
    });
    return Object.entries(grouped)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [data]);
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

  // ── Pemasukan per Metode Pembayaran ──
  const paymentMethodBreakdown = useMemo(() => {
    // Murni ambil dari kolom amount apa adanya (tidak dibagi rata sesi paket).
    // Sesi paket yang amount-nya 0 (karena sudah lunas di sesi pertama) otomatis tidak dihitung.
    const allRecaps = [...(data.nonPkgRecaps || []), ...(data.pkgRecaps || [])];

    const map = {};
    allRecaps.forEach(r => {
      const amount = Number(r.amount) || 0;
      if (amount <= 0) return;
      const raw = r.payment_method;
      const label = paymentMethodMap[raw] || raw || 'Tidak Diketahui';
      map[label] = (map[label] || 0) + amount;
    });

    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .map(([method, amount], i) => ({
        method,
        amount: Math.round(amount),
        pct: total > 0 ? Math.round((amount / total) * 100) : 0,
        color: COLORS[i % COLORS.length],
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [data.nonPkgRecaps, data.pkgRecaps, paymentMethodMap]);

  // ── Alerts ──
  const alerts = useMemo(() => {
    const items = [];
    if (metrics.netProfit < 0) {
      items.push({ type: 'danger', title: 'Loss Alert', message: 'Pengeluaran melebihi pemasukan periode ini' });
    }
    if (metrics.totalExpenses > metrics.totalRevenue * 0.5) {
      items.push({ type: 'warning', title: 'Expense Ratio Tinggi', message: `Pengeluaran mencapai ${metrics.totalRevenue > 0 ? ((metrics.totalExpenses / metrics.totalRevenue) * 100).toFixed(1) : 0}% dari revenue` });
    }
    if (items.length === 0) {
      items.push({ type: 'success', title: 'Financial Health Stable', message: 'Revenue positif, profit terjaga dengan baik' });
    }
    return items;
  }, [metrics]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-slate-500 text-sm">Memuat data finance...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Quick Action Widget */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
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
              fetchData(true);
            }}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl"
        style={{ background: 'linear-gradient(to right, #f0fdfa, #f0fdf4)', border: '1px solid #99f6e4' }}>
        <div className={cn("flex items-center gap-2 mr-1", isPWA && "w-full")}>
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#0d9488' }}>
            <Plus className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-bold text-teal-700">Quick Input Owner</span>
        </div>
        <button
          onClick={() => { setActiveFormType('expenditure'); setIsFormOpen(true); }}
          className={cn(
            "flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95 shadow-sm",
            isPWA && "flex-1"
          )}
          style={{ background: '#e11d48' }}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          + Pengeluaran
        </button>
        <button
          onClick={() => { setActiveFormType('income'); setIsFormOpen(true); }}
          className={cn(
            "flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95 shadow-sm",
            isPWA && "flex-1"
          )}
          style={{ background: '#059669' }}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          + Pemasukan
        </button>
        <span className="text-[11px] text-teal-500 hidden sm:inline ml-1">Catat transaksi tanpa berpindah halaman</span>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button onClick={() => fetchData(true)} variant="outline" size="sm" disabled={refreshing} className="rounded-xl">
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* ── Executive Hero ── */}
      <Card className="overflow-hidden border-0 rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white shadow-2xl relative">
        {/* Decorative */}
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

        <CardContent className="p-6 md:p-8 relative z-10">
          <div className="flex flex-col">
            <div>
              <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest mb-2">Financial Health Overview</p>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black">
                  {metrics.netProfit >= 0 ? 'Healthy' : 'Warning'}
                </h2>
                <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  metrics.netProfit >= 0
                    ? 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-300'
                    : 'bg-rose-500/20 border border-rose-400/30 text-rose-300'
                }`}>
                  {metrics.netProfit >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {metrics.netProfit >= 0 ? 'Net Profit Positive' : 'Net Profit Negative'}
                </div>
              </div>
              <p className="text-slate-400 text-xs mb-4">
                {format(startOfMonth(new Date()), 'dd MMM yyyy')} — {format(endOfMonth(new Date()), 'dd MMM yyyy')} (bulan berjalan, sama seperti Break Even Point)
              </p>
              <div className="mt-2">
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-slate-400">Profit Margin</span>
                  <span className={`font-bold ${metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {metrics.totalRevenue > 0 ? ((metrics.netProfit / metrics.totalRevenue) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${metrics.netProfit >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                    style={{ width: `${Math.min(Math.abs(metrics.totalRevenue > 0 ? (metrics.netProfit / metrics.totalRevenue) * 100 : 0), 100)}%` }} />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-slate-400">Expense Ratio</span>
                  <span className={`font-bold ${metrics.totalRevenue > 0 && (metrics.totalExpenses / metrics.totalRevenue) < 0.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {metrics.totalRevenue > 0 ? ((metrics.totalExpenses / metrics.totalRevenue) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${metrics.totalRevenue > 0 && (metrics.totalExpenses / metrics.totalRevenue) < 0.5 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                    style={{ width: `${Math.min(metrics.totalRevenue > 0 ? (metrics.totalExpenses / metrics.totalRevenue) * 100 : 0, 100)}%` }} />
                </div>
              </div>
            </div>
           
          </div>
        </CardContent>
      </Card>

      {/* ── Break Even Point ── */}
      <BreakEvenPointWidget />

      {/* ── Tren Margin Profit Bulanan ── */}
      <ProfitMarginTrendWidget />

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white rounded-2xl border border-emerald-100 border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-all p-5 md:p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <p className="text-3xl sm:text-4xl md:text-5xl font-black leading-none text-emerald-600 break-words">{formatShortCurrency(metrics.totalRevenue)}</p>
          <p className="text-sm text-slate-500 font-semibold mt-2">Total Revenue</p>
          <p className="text-xs text-slate-400 mt-0.5 break-words">{formatCurrency(metrics.totalRevenue)}</p>
        </div>

        <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all p-5 md:p-6 ${
          metrics.netProfit >= 0 ? 'border-indigo-100 border-l-4 border-l-indigo-500' : 'border-rose-100 border-l-4 border-l-rose-500'
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${metrics.netProfit >= 0 ? 'bg-indigo-50' : 'bg-rose-50'}`}>
              {metrics.netProfit >= 0 ? <TrendingUp className="w-6 h-6 text-indigo-600" /> : <TrendingDown className="w-6 h-6 text-rose-600" />}
            </div>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${metrics.netProfit >= 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-rose-50 text-rose-600'}`}>
              Margin {metrics.totalRevenue > 0 ? ((metrics.netProfit / metrics.totalRevenue) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <p className={`text-3xl sm:text-4xl md:text-5xl font-black leading-none break-words ${metrics.netProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{formatShortCurrency(metrics.netProfit)}</p>
          <p className="text-sm text-slate-500 font-semibold mt-2">Net Profit</p>
          <p className="text-xs text-slate-400 mt-0.5 break-words">{formatCurrency(metrics.netProfit)}</p>
        </div>

        <div className="bg-white rounded-2xl border border-rose-100 border-l-4 border-l-rose-500 shadow-sm hover:shadow-md transition-all p-5 md:p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-rose-600" />
            </div>
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-rose-50 text-rose-600">
              Ratio {metrics.totalRevenue > 0 ? ((metrics.totalExpenses / metrics.totalRevenue) * 100).toFixed(1) : 0}%
            </span>
          </div>
          <p className="text-3xl sm:text-4xl md:text-5xl font-black leading-none text-rose-600 break-words">{formatShortCurrency(metrics.totalExpenses)}</p>
          <p className="text-sm text-slate-500 font-semibold mt-2">Total Pengeluaran</p>
          <p className="text-xs text-slate-400 mt-0.5 break-words">{formatCurrency(metrics.totalExpenses)}</p>
        </div>
      </div>
      {/* ── Dana Paket ── */}
      <div className="bg-white rounded-2xl border border-amber-100 border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-all p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <DollarSign className="w-6 h-6 text-amber-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-800 leading-snug">Dana Paket Belum Terealisasi</h3>
              <p className="text-xs text-slate-400 mt-0.5">Sisa sesi paket aktif yang belum dilakukan</p>
            </div>
          </div>
          <span className="self-start sm:self-auto shrink-0 text-xs font-bold px-3 py-1.5 rounded-full bg-amber-50 text-amber-600 whitespace-nowrap">
            {danaPacket.jumlahPaket} paket aktif
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
          <div className="bg-amber-50 rounded-xl p-4 min-w-0">
            <p className="text-2xl md:text-3xl font-black text-amber-600 leading-none whitespace-nowrap">{formatShortCurrency(danaPacket.total)}</p>
            <p className="text-xs text-slate-500 font-semibold mt-2">Total Dana Tertahan</p>
            <p className="text-[11px] text-slate-400 mt-0.5 break-words">{formatFull(danaPacket.total)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-2xl md:text-3xl font-black text-slate-700 leading-none">{danaPacket.sisaSesi}</p>
            <p className="text-xs text-slate-500 font-semibold mt-2">Sisa Sesi</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-2xl md:text-3xl font-black text-slate-700 leading-none">{danaPacket.jumlahPaket}</p>
            <p className="text-xs text-slate-500 font-semibold mt-2">Paket Aktif</p>
          </div>
        </div>
      </div>

      {/* ── Revenue per Terapis ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-800">Revenue per Terapis</h3>
            <p className="text-xs text-slate-400 mt-0.5">Kontribusi revenue per terapis periode ini</p>
          </div>
          <span className="text-xs text-slate-400">{therapistRevenue.length} terapis</span>
        </div>
        {therapistRevenue.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">Belum ada data</p>
        ) : (
          <div className="space-y-4">
            {therapistRevenue.map((t, i) => {
              const pct = Math.round((t.revenue / (therapistRevenue[0]?.revenue || 1)) * 100);
              const colors = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#8b5cf6'];
              const color = colors[i % colors.length];
              return (
                <div key={t.fullName} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-black text-slate-300 w-5 shrink-0">#{i + 1}</span>
                      <span className="text-sm font-semibold text-slate-700 truncate">{t.name}</span>
                    </div>
                    <div className="shrink-0">
                      <span className="text-sm font-black text-slate-800">{formatFull(t.revenue)}</span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pemasukan per Metode Pembayaran ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Pemasukan per Metode Pembayaran</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {format(parseISO(dateRange.startDate), 'dd MMM yyyy')} — {format(parseISO(dateRange.endDate), 'dd MMM yyyy')}
            </p>
          </div>
        </div>

        {paymentMethodBreakdown.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Belum ada data pemasukan pada periode ini.</p>
        ) : (
          <div className="flex flex-wrap gap-3 md:gap-4">
            {paymentMethodBreakdown.map((pm, i) => {
              const style = getPaymentMethodStyle(pm.method);
              return (
                <div
                  key={i}
                  className={`flex-1 basis-[160px] rounded-2xl border ${style.border} border-l-4 ${style.accent} bg-white p-4 shadow-sm hover:shadow-md transition-all`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-9 h-9 rounded-xl ${style.bg} flex items-center justify-center`}>
                      <style.icon className={`w-4 h-4 ${style.color}`} />
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.bg} ${style.color}`}>
                      {pm.pct}%
                    </span>
                  </div>
                  <p className={`text-lg font-black leading-none ${style.color}`}>{formatFull(pm.amount)}</p>
                  <p className="text-xs text-slate-400 font-medium mt-1.5 truncate">{pm.method}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      
    </div>
  );
};

export default RevenueOverview;
