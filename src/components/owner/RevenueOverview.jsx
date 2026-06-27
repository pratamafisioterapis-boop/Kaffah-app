import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { format, parseISO } from 'date-fns';
import {
  DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, RefreshCw, Loader2
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import {
  getOwnerIncome, getOwnerExpenditures, getAdminIncome,
  getAdminExpenses, getPatientIncomeFromPackages
} from '@/lib/api';
import { supabase } from '@/lib/customSupabaseClient';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

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
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [danaPacket, setDanaPacket] = useState({ total: 0, sisaSesi: 0, jumlahPaket: 0 });
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

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const [ownerInc, adminInc, patientInc, ownerExp, adminExp, nonPkgRecaps, pkgRecaps] = await Promise.all([
        getOwnerIncome(dateRange),
        getAdminIncome(dateRange),
        getPatientIncomeFromPackages(dateRange),
        getOwnerExpenditures(dateRange),
        getAdminExpenses(dateRange),
        supabase.from('daily_recaps')
          .select('therapist_name, amount')
          .gte('recap_date', dateRange.startDate)
          .lte('recap_date', dateRange.endDate)
          .is('package_tracking_id', null),
        supabase.from('daily_recaps')
          .select('therapist_name, package_tracking!inner(nominal, total_sessions)')
          .gte('recap_date', dateRange.startDate)
          .lte('recap_date', dateRange.endDate)
          .not('package_tracking_id', 'is', null),
      ]);
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
  const metrics = useMemo(() => {
    const sum = (arr, key = 'amount') => arr.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);

    const ownerIncome = sum(data.ownerIncome);
    const adminIncome = sum(data.adminIncome);
    const patientIncome = sum(data.patientIncome);
    const totalRevenue = ownerIncome + adminIncome + patientIncome;

    const ownerExpenses = sum(data.ownerExpenses);
    const adminExpenses = sum(data.adminExpenses);
    const totalExpenses = ownerExpenses + adminExpenses;

    const netProfit = totalRevenue - totalExpenses;

    const totalReceivable = data.receivables
      .filter(r => r.status !== 'Paid')
      .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

    const totalCash = data.bankAccounts.reduce((acc, b) => acc + (Number(b.balance) || 0), 0);

    return { totalRevenue, totalExpenses, netProfit, totalReceivable, totalCash, ownerIncome, adminIncome, patientIncome };
  }, [data]);

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
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-4xl md:text-5xl font-black">
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
                {format(parseISO(dateRange.startDate), 'dd MMM yyyy')} — {format(parseISO(dateRange.endDate), 'dd MMM yyyy')}
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

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white rounded-2xl border border-emerald-100 border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-all p-5 md:p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <p className="text-4xl md:text-5xl font-black leading-none text-emerald-600">{formatShortCurrency(metrics.totalRevenue)}</p>
          <p className="text-sm text-slate-500 font-semibold mt-2">Total Revenue</p>
          <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(metrics.totalRevenue)}</p>
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
          <p className={`text-4xl md:text-5xl font-black leading-none ${metrics.netProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{formatShortCurrency(metrics.netProfit)}</p>
          <p className="text-sm text-slate-500 font-semibold mt-2">Net Profit</p>
          <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(metrics.netProfit)}</p>
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
          <p className="text-4xl md:text-5xl font-black leading-none text-rose-600">{formatShortCurrency(metrics.totalExpenses)}</p>
          <p className="text-sm text-slate-500 font-semibold mt-2">Total Pengeluaran</p>
          <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(metrics.totalExpenses)}</p>
        </div>
      </div>
      {/* ── Dana Paket ── */}
      <div className="bg-white rounded-2xl border border-amber-100 border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-all p-5 md:p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <DollarSign className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Dana Paket Belum Terealisasi</h3>
              <p className="text-xs text-slate-400 mt-0.5">Sisa sesi paket aktif yang belum dilakukan</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-50 text-amber-600">
              {danaPacket.jumlahPaket} paket aktif
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
          <div className="bg-amber-50 rounded-xl p-4">
            <p className="text-2xl md:text-3xl font-black text-amber-600 leading-none">{formatFull(danaPacket.total)}</p>
            <p className="text-xs text-slate-500 font-semibold mt-2">Total Dana Tertahan</p>
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

      
    </div>
  );
};

export default RevenueOverview;
