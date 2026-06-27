import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { format, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Loader2, TrendingUp, TrendingDown, DollarSign, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const fmtShort = (n) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}Jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}Rb`;
  return n?.toString() || '0';
};

const isPWA = (() => {
  try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
  catch { return false; }
})();

const OwnerFinanceDashboard = ({ dateRange }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [dailyChart, setDailyChart] = useState([]);

  const startDate = dateRange?.startDate || format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const endDate = dateRange?.endDate || format(new Date(), 'yyyy-MM-dd');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        recapsRes,
        packageRes,
        adminIncRes,
        ownerIncRes,
        adminExpRes,
        ownerExpRes,
      ] = await Promise.all([
        // Non-package recaps
        supabase.from('daily_recaps')
          .select('recap_date, amount')
          .gte('recap_date', startDate)
          .lte('recap_date', endDate)
          .is('package_tracking_id', null),

        // Package recaps joined with package_tracking
        supabase.from('daily_recaps')
          .select('recap_date, package_tracking_id, package_tracking!inner(nominal, total_sessions)')
          .gte('recap_date', startDate)
          .lte('recap_date', endDate)
          .not('package_tracking_id', 'is', null),

        // Admin income
        supabase.from('admin_income')
          .select('date, amount, category, description')
          .gte('date', startDate)
          .lte('date', endDate),

        // Owner income
        supabase.from('owner_income')
          .select('date, amount, category, description')
          .gte('date', startDate)
          .lte('date', endDate),

        // Admin expenditures
        supabase.from('admin_expenditures')
          .select('date, amount, category, description')
          .gte('date', startDate)
          .lte('date', endDate),

        // Owner expenditures
        supabase.from('owner_expenditures')
          .select('date, amount, category, description')
          .gte('date', startDate)
          .lte('date', endDate),
      ]);

      // Revenue non-paket
      const nonPkgRevenue = (recapsRes.data || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);

      // Revenue paket (nominal/total_sessions per sesi)
      const pkgRevenue = (packageRes.data || []).reduce((s, r) => {
        const pt = r.package_tracking;
        if (!pt) return s;
        return s + (Number(pt.nominal) / Number(pt.total_sessions));
      }, 0);

      // Revenue lainnya
      const otherRevenue = [
        ...(adminIncRes.data || []),
        ...(ownerIncRes.data || []),
      ].reduce((s, r) => s + (Number(r.amount) || 0), 0);

      // Total expenses
      const totalExpenses = [
        ...(adminExpRes.data || []),
        ...(ownerExpRes.data || []),
      ].reduce((s, r) => s + (Number(r.amount) || 0), 0);

      const totalRevenue = nonPkgRevenue + pkgRevenue + otherRevenue;
      const profit = totalRevenue - totalExpenses;

      // Daily chart data
      const days = eachDayOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate),
      });

      const dailyMap = {};
      days.forEach(d => {
        dailyMap[format(d, 'yyyy-MM-dd')] = { revenue: 0, expense: 0 };
      });

      (recapsRes.data || []).forEach(r => {
        if (dailyMap[r.recap_date]) dailyMap[r.recap_date].revenue += Number(r.amount) || 0;
      });
      (packageRes.data || []).forEach(r => {
        const pt = r.package_tracking;
        if (pt && dailyMap[r.recap_date]) {
          dailyMap[r.recap_date].revenue += Number(pt.nominal) / Number(pt.total_sessions);
        }
      });
      [...(adminIncRes.data || []), ...(ownerIncRes.data || [])].forEach(r => {
        if (dailyMap[r.date]) dailyMap[r.date].revenue += Number(r.amount) || 0;
      });
      [...(adminExpRes.data || []), ...(ownerExpRes.data || [])].forEach(r => {
        if (dailyMap[r.date]) dailyMap[r.date].expense += Number(r.amount) || 0;
      });

      const chartData = Object.entries(dailyMap).map(([date, v]) => ({
        date: format(parseISO(date), 'd MMM', { locale: idLocale }),
        revenue: Math.round(v.revenue),
        expense: Math.round(v.expense),
      }));

      setDailyChart(chartData);
      setData({
        totalRevenue,
        nonPkgRevenue,
        pkgRevenue,
        otherRevenue,
        totalExpenses,
        profit,
        margin: totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0,
      });
    } catch (err) {
      console.error('OwnerFinanceDashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return (
    <div className="h-64 flex items-center justify-center">
      <Loader2 className="w-7 h-7 animate-spin text-slate-200" />
    </div>
  );

  if (!data) return null;

  const kpis = [
    {
      label: 'Total Revenue',
      value: data.totalRevenue,
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      accent: 'border-l-emerald-500',
    },
    {
      label: 'Profit',
      value: data.profit,
      icon: data.profit >= 0 ? TrendingUp : TrendingDown,
      color: data.profit >= 0 ? 'text-indigo-600' : 'text-rose-600',
      bg: data.profit >= 0 ? 'bg-indigo-50' : 'bg-rose-50',
      border: data.profit >= 0 ? 'border-indigo-100' : 'border-rose-100',
      accent: data.profit >= 0 ? 'border-l-indigo-500' : 'border-l-rose-500',
      sub: `Margin ${data.margin}%`,
    },
    {
      label: 'Total Pengeluaran',
      value: data.totalExpenses,
      icon: ArrowDownRight,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-100',
      accent: 'border-l-rose-500',
    },
  ];

  const revenueBreakdown = [
    { label: 'Sesi Non-Paket', value: data.nonPkgRevenue, color: '#6366f1', pct: data.totalRevenue > 0 ? Math.round((data.nonPkgRevenue / data.totalRevenue) * 100) : 0 },
    { label: 'Sesi Paket', value: data.pkgRevenue, color: '#10b981', pct: data.totalRevenue > 0 ? Math.round((data.pkgRevenue / data.totalRevenue) * 100) : 0 },
    { label: 'Pendapatan Lainnya', value: data.otherRevenue, color: '#f59e0b', pct: data.totalRevenue > 0 ? Math.round((data.otherRevenue / data.totalRevenue) * 100) : 0 },
  ];

  return (
    <div className="space-y-4">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {kpis.map((k, i) => (
          <div key={i} className={`bg-white rounded-2xl border ${k.border} border-l-4 ${k.accent} shadow-sm hover:shadow-md transition-all p-4 md:p-5`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center`}>
                <k.icon className={`w-5 h-5 ${k.color}`} />
              </div>
              {k.sub && (
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${k.bg} ${k.color}`}>{k.sub}</span>
              )}
            </div>
            <p className={`text-2xl md:text-3xl font-black leading-none ${k.color}`}>
              {fmtShort(k.value)}
            </p>
            <p className="text-xs text-slate-400 font-medium mt-1.5">{k.label}</p>
            <p className="text-[10px] text-slate-300 mt-0.5">{fmt(k.value)}</p>
          </div>
        ))}
      </div>

      {/* ── Revenue Breakdown + Chart ── */}
      <div className={`grid grid-cols-1 ${isPWA ? '' : 'lg:grid-cols-2'} gap-4`}>

        {/* Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Breakdown Revenue</h3>
              <p className="text-xs text-slate-400 mt-0.5">Sumber pendapatan periode ini</p>
            </div>
            <button onClick={fetchData} className="w-7 h-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-slate-100">
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
          <div className="space-y-3">
            {revenueBreakdown.map((r, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                    <span className="text-xs font-semibold text-slate-700">{r.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800">{fmtShort(r.value)}</span>
                    <span className="text-[10px] text-slate-400 w-8 text-right">{r.pct}%</span>
                  </div>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${r.pct}%`, backgroundColor: r.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-500">Total Revenue</span>
            <span className="text-base font-black text-emerald-600">{fmt(data.totalRevenue)}</span>
          </div>
        </div>

        {/* Daily Revenue Chart */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-800">Tren Harian</h3>
            <p className="text-xs text-slate-400 mt-0.5">Revenue & pengeluaran per hari</p>
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[11px] text-slate-400 font-medium">Revenue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1.5 rounded-full bg-rose-400" />
              <span className="text-[11px] text-slate-400 font-medium">Pengeluaran</span>
            </div>
          </div>
          <div className="h-[180px] md:h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyChart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} interval={isPWA ? 6 : 4} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={fmtShort} width={32} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: '12px' }}
                  formatter={(v, n) => [fmt(v), n === 'revenue' ? 'Revenue' : 'Pengeluaran']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" dot={false} />
                <Area type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={2} fill="url(#expGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
};

export default OwnerFinanceDashboard;
