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

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

const formatCurrency = (amount) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

const formatShortCurrency = (amount) => {
  const num = Number(amount) || 0;
  if (num >= 1_000_000_000) return `Rp ${(num / 1_000_000_000).toFixed(1)} M`;
  if (num >= 1_000_000) return `Rp ${(num / 1_000_000).toFixed(0)} Jt`;
  if (num >= 1_000) return `Rp ${(num / 1_000).toFixed(0)} Rb`;
  return `Rp ${num}`;
};

const RevenueOverview = ({ dateRange }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({
    ownerIncome: [],
    adminIncome: [],
    patientIncome: [],
    ownerExpenses: [],
    adminExpenses: [],
    receivables: [],
    bankAccounts: []
  });

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const [ownerInc, adminInc, patientInc, ownerExp, adminExp] = await Promise.all([
        getOwnerIncome(dateRange),
        getAdminIncome(dateRange),
        getPatientIncomeFromPackages(dateRange),
        getOwnerExpenditures(dateRange),
        getAdminExpenses(dateRange),
      ]);

      setData({
        ownerIncome: ownerInc?.data || [],
        adminIncome: adminInc?.data || [],
        patientIncome: patientInc?.data || [],
        ownerExpenses: ownerExp?.data || [],
        adminExpenses: adminExp?.data || [],
        receivables: [],
        bankAccounts: []
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
      {/* ── Alerts + Revenue Breakdown ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card className="rounded-3xl border-0 shadow-xl bg-white">
          <CardHeader><CardTitle className="text-lg">Executive Alerts</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert, idx) => (
              <div key={idx} className={`p-4 rounded-2xl border ${alert.type === 'success' ? 'bg-emerald-50 border-emerald-100' : alert.type === 'warning' ? 'bg-amber-50 border-amber-100' : 'bg-rose-50 border-rose-100'}`}>
                <div className="flex items-center gap-3">
                  {alert.type === 'success' ? <TrendingUp className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className={`w-5 h-5 ${alert.type === 'warning' ? 'text-amber-600' : 'text-rose-600'}`} />}
                  <div>
                    <div className={`font-semibold text-sm ${alert.type === 'success' ? 'text-emerald-700' : alert.type === 'warning' ? 'text-amber-700' : 'text-rose-700'}`}>{alert.title}</div>
                    <div className="text-sm text-slate-600">{alert.message}</div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white">
          <CardContent className="p-6 h-full flex flex-col justify-center">
            <p className="opacity-80 text-sm">Revenue Breakdown</p>
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div><div className="text-xs opacity-70">Owner Income</div><div className="text-lg font-bold">{formatShortCurrency(metrics.ownerIncome)}</div></div>
              <div><div className="text-xs opacity-70">Admin Income</div><div className="text-lg font-bold">{formatShortCurrency(metrics.adminIncome)}</div></div>
              <div><div className="text-xs opacity-70">Patient Income</div><div className="text-lg font-bold">{formatShortCurrency(metrics.patientIncome)}</div></div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/20 flex justify-between items-center">
              <span className="opacity-80 text-sm">Expense Ratio</span>
              <span className="text-xl font-bold">{metrics.totalRevenue > 0 ? ((metrics.totalExpenses / metrics.totalRevenue) * 100).toFixed(1) : 0}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card className="rounded-3xl border-0 shadow-xl">
          <CardHeader><CardTitle className="text-lg">Revenue Trend</CardTitle></CardHeader>
          <CardContent>
            {revenueTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueTrendData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `Rp${(v / 1000000).toFixed(0)}M`} />
                  <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center text-slate-400">No revenue data for this period</div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-0 shadow-xl">
          <CardHeader><CardTitle className="text-lg">Expense Breakdown</CardTitle></CardHeader>
          <CardContent>
            {expenseBreakdown.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                      {expenseBreakdown.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 mt-2 justify-center">
                  {expenseBreakdown.map((entry, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-xs text-slate-600">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[300px] rounded-2xl bg-gradient-to-br from-rose-50 to-orange-50 flex items-center justify-center text-slate-400">No expense data for this period</div>
            )}
          </CardContent>
        </Card>
      </div>

      
    </div>
  );
};

export default RevenueOverview;
