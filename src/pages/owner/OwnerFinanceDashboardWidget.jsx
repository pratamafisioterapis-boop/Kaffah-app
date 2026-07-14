import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { format, startOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Loader2, TrendingUp, TrendingDown, DollarSign, RefreshCw, ArrowDownRight, Users, UserCheck, Zap, Plus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const fmtShort = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}Jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}Rb`;
  return n.toString();
};

const isPWA = (() => {
  try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
  catch { return false; }
})();

const PATIENT_TYPE_COLORS = {
  'NORMAL':       '#6366f1',
  'DUA KELUHAN':  '#8b5cf6',
  'HOMECARE':     '#10b981',
  'RECOVERY':     '#06b6d4',
  'KONSULTASI':   '#f59e0b',
  'TIGA KELUHAN': '#f43f5e',
  'FREE':         '#94a3b8',
  'guest':        '#cbd5e1',
  'registered':   '#e2e8f0',
};

const OwnerFinanceDashboardWidget = ({ dateRange, onAddExpense, onAddIncome }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [dailyChart, setDailyChart] = useState([]);
  const [therapistRevenue, setTherapistRevenue] = useState([]);
  const [patientTypeRevenue, setPatientTypeRevenue] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState([]);

  const startDate = dateRange?.startDate || format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const endDate = dateRange?.endDate || format(new Date(), 'yyyy-MM-dd');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData?.session?.user?.id;
      const { data: currentUserRow } = await supabase.from('users').select('clinic_id').eq('id', currentUserId).single();
      const clinicId = currentUserRow?.clinic_id;

      const [
        recapsRes,
        packageRes,
        adminIncRes,
        ownerIncRes,
        adminExpRes,
        ownerExpRes,
      ] = await Promise.all([
        supabase.from('daily_recaps')
          .select('recap_date, amount, therapist_name, patient_type, package_tracking_id')
          .eq('clinic_id', clinicId)
          .gte('recap_date', startDate)
          .lte('recap_date', endDate)
          .is('package_tracking_id', null),
        supabase.from('daily_recaps')
          .select('recap_date, therapist_name, patient_type, package_tracking_id, package_tracking!inner(nominal, total_sessions)')
          .eq('clinic_id', clinicId)
          .gte('recap_date', startDate)
          .lte('recap_date', endDate)
          .not('package_tracking_id', 'is', null),
        supabase.from('admin_income')
          .select('date, amount, category, description')
          .eq('clinic_id', clinicId)
          .gte('date', startDate)
          .lte('date', endDate),
        supabase.from('owner_income')
          .select('date, amount, category, description')
          .eq('clinic_id', clinicId)
          .gte('date', startDate)
          .lte('date', endDate),
        supabase.from('admin_expenses') // 🔥 FIX: nama tabel benar (admin_expenditures kosong & tidak dipakai)
          .select('date:transaction_date, amount, category, description')
          .eq('clinic_id', clinicId)
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDate),
        supabase.from('owner_expenditures')
          .select('date, amount, category, description')
          .eq('clinic_id', clinicId)
          .gte('date', startDate)
          .lte('date', endDate),
      ]);

      const nonPkgRecaps = recapsRes.data || [];
      const pkgRecaps = packageRes.data || [];
      const adminInc = adminIncRes.data || [];
      const ownerInc = ownerIncRes.data || [];
      const adminExp = adminExpRes.data || [];
      const ownerExp = ownerExpRes.data || [];

      // ── KPI totals ──
      const nonPkgRevenue = nonPkgRecaps.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const pkgRevenue = pkgRecaps.reduce((s, r) => {
        const pt = r.package_tracking;
        return s + (pt ? Number(pt.nominal) / Number(pt.total_sessions) : 0);
      }, 0);
      const otherRevenue = [...adminInc, ...ownerInc].reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const totalExpenses = [...adminExp, ...ownerExp].reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const totalRevenue = nonPkgRevenue + pkgRevenue + otherRevenue;
      const profit = totalRevenue - totalExpenses;

      // ── Daily chart ──
      const days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });
      const dailyMap = {};
      days.forEach(d => { dailyMap[format(d, 'yyyy-MM-dd')] = { revenue: 0, expense: 0 }; });
      nonPkgRecaps.forEach(r => { if (dailyMap[r.recap_date]) dailyMap[r.recap_date].revenue += Number(r.amount) || 0; });
      pkgRecaps.forEach(r => {
        const pt = r.package_tracking;
        if (pt && dailyMap[r.recap_date]) dailyMap[r.recap_date].revenue += Number(pt.nominal) / Number(pt.total_sessions);
      });
      [...adminInc, ...ownerInc].forEach(r => { if (dailyMap[r.date]) dailyMap[r.date].revenue += Number(r.amount) || 0; });
      [...adminExp, ...ownerExp].forEach(r => { if (dailyMap[r.date]) dailyMap[r.date].expense += Number(r.amount) || 0; });
      const chartData = Object.entries(dailyMap).map(([date, v]) => ({
        date: format(parseISO(date), 'd MMM', { locale: idLocale }),
        revenue: Math.round(v.revenue),
        expense: Math.round(v.expense),
      }));

      // ── Revenue per terapis ──
      const therapistMap = {};
      nonPkgRecaps.forEach(r => {
        if (!r.therapist_name) return;
        if (!therapistMap[r.therapist_name]) therapistMap[r.therapist_name] = 0;
        therapistMap[r.therapist_name] += Number(r.amount) || 0;
      });
      pkgRecaps.forEach(r => {
        if (!r.therapist_name) return;
        const pt = r.package_tracking;
        if (!pt) return;
        if (!therapistMap[r.therapist_name]) therapistMap[r.therapist_name] = 0;
        therapistMap[r.therapist_name] += Number(pt.nominal) / Number(pt.total_sessions);
      });
      const therapistList = Object.entries(therapistMap)
        .map(([name, rev]) => ({ name: name.split(',')[0], fullName: name, revenue: Math.round(rev) }))
        .sort((a, b) => b.revenue - a.revenue);
      const maxTherapistRev = therapistList[0]?.revenue || 1;

      // ── Revenue per tipe pasien ──
      const ptMap = {};
      nonPkgRecaps.forEach(r => {
        const pt = r.patient_type || 'Lainnya';
        if (!ptMap[pt]) ptMap[pt] = 0;
        ptMap[pt] += Number(r.amount) || 0;
      });
      pkgRecaps.forEach(r => {
        const pt = r.patient_type || 'Lainnya';
        const pkg = r.package_tracking;
        if (!pkg) return;
        if (!ptMap[pt]) ptMap[pt] = 0;
        ptMap[pt] += Number(pkg.nominal) / Number(pkg.total_sessions);
      });
      const ptList = Object.entries(ptMap)
        .map(([type, rev]) => ({ type, revenue: Math.round(rev), pct: totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 0 }))
        .filter(p => p.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue);

      // ── Recent transactions ──
      const allTx = [
        ...nonPkgRecaps.filter(r => r.amount > 0).map(r => ({ date: r.recap_date, amount: r.amount, label: r.patient_type || 'Pasien', type: 'income' })),
        ...pkgRecaps.map(r => {
          const pt = r.package_tracking;
          return { date: r.recap_date, amount: pt ? Math.round(Number(pt.nominal) / Number(pt.total_sessions)) : 0, label: `Paket - ${r.patient_type || ''}`, type: 'income' };
        }),
        ...adminInc.map(r => ({ date: r.date, amount: r.amount, label: r.description || r.category, type: 'income' })),
        ...ownerInc.map(r => ({ date: r.date, amount: r.amount, label: r.description || r.category, type: 'income' })),
        ...adminExp.map(r => ({ date: r.date, amount: r.amount, label: r.description || r.category, type: 'expense' })),
        ...ownerExp.map(r => ({ date: r.date, amount: r.amount, label: r.description || r.category, type: 'expense' })),
      ].filter(t => t.amount > 0).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

      // ── Expense breakdown per kategori ──
      const expMap = {};
      [...adminExp, ...ownerExp].forEach(r => {
        const cat = r.category || 'Lainnya';
        if (!expMap[cat]) expMap[cat] = 0;
        expMap[cat] += Number(r.amount) || 0;
      });
      const expList = Object.entries(expMap)
        .map(([cat, amt]) => ({ cat, amt, pct: totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0 }))
        .sort((a, b) => b.amt - a.amt);

      setData({ totalRevenue, nonPkgRevenue, pkgRevenue, otherRevenue, totalExpenses, profit, margin: totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0 });
      setDailyChart(chartData);
      setTherapistRevenue(therapistList);
      setPatientTypeRevenue(ptList);
      setRecentTransactions(allTx);
      setExpenseBreakdown(expList);

    } catch (err) {
      console.error('OwnerFinanceDashboardWidget error:', err);
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
    { label: 'Total Revenue', value: data.totalRevenue, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', accent: 'border-l-emerald-500' },
    { label: 'Profit', value: data.profit, icon: data.profit >= 0 ? TrendingUp : TrendingDown, color: data.profit >= 0 ? 'text-indigo-600' : 'text-rose-600', bg: data.profit >= 0 ? 'bg-indigo-50' : 'bg-rose-50', border: data.profit >= 0 ? 'border-indigo-100' : 'border-rose-100', accent: data.profit >= 0 ? 'border-l-indigo-500' : 'border-l-rose-500', sub: `Margin ${data.margin}%` },
    { label: 'Total Pengeluaran', value: data.totalExpenses, icon: ArrowDownRight, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', accent: 'border-l-rose-500' },
  ];

  const revenueBreakdown = [
    { label: 'Sesi Non-Paket', value: data.nonPkgRevenue, color: '#6366f1', pct: data.totalRevenue > 0 ? Math.round((data.nonPkgRevenue / data.totalRevenue) * 100) : 0 },
    { label: 'Sesi Paket', value: data.pkgRevenue, color: '#10b981', pct: data.totalRevenue > 0 ? Math.round((data.pkgRevenue / data.totalRevenue) * 100) : 0 },
    { label: 'Pendapatan Lainnya', value: data.otherRevenue, color: '#f59e0b', pct: data.totalRevenue > 0 ? Math.round((data.otherRevenue / data.totalRevenue) * 100) : 0 },
  ];

  const EXPENSE_COLORS = ['#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6'];

  return (
    <div className="space-y-4">

      {/* ── Quick Action ── */}
      {(onAddExpense || onAddIncome) && (
        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100 rounded-2xl p-3 md:p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 mr-1">
              <Zap className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-semibold text-teal-700">Quick Action Owner</span>
            </div>
            {onAddExpense && (
              <button
                onClick={onAddExpense}
                className="inline-flex items-center gap-2 h-9 px-4 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-100 transition-colors"
              >
                <TrendingDown className="w-4 h-4" />
                + Pengeluaran
              </button>
            )}
            {onAddIncome && (
              <button
                onClick={onAddIncome}
                className="inline-flex items-center gap-2 h-9 px-4 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-100 transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                + Pemasukan
              </button>
            )}
            <span className="text-xs text-teal-400 hidden md:inline">Catat transaksi owner secara cepat</span>
          </div>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {kpis.map((k, i) => (
          <div key={i} className={`bg-white rounded-2xl border ${k.border} border-l-4 ${k.accent} shadow-sm hover:shadow-md transition-all p-4 md:p-5`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center`}>
                <k.icon className={`w-5 h-5 ${k.color}`} />
              </div>
              {k.sub && <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${k.bg} ${k.color}`}>{k.sub}</span>}
            </div>
            <p className={`text-2xl md:text-3xl font-black leading-none ${k.color}`}>{fmtShort(k.value)}</p>
            <p className="text-xs text-slate-400 font-medium mt-1.5">{k.label}</p>
            <p className="text-[10px] text-slate-300 mt-0.5">{fmt(k.value)}</p>
          </div>
        ))}
      </div>

      {/* ── Row 1: Breakdown Revenue + Tren Harian ── */}
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
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-500">Total Revenue</span>
            <span className="text-base font-black text-emerald-600">{fmt(data.totalRevenue)}</span>
          </div>
        </div>

        {/* Tren Harian */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-800">Tren Harian</h3>
            <p className="text-xs text-slate-400 mt-0.5">Revenue & pengeluaran per hari</p>
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-full bg-emerald-500" /><span className="text-[11px] text-slate-400 font-medium">Revenue</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-full bg-rose-400" /><span className="text-[11px] text-slate-400 font-medium">Pengeluaran</span></div>
          </div>
          <div className="h-[180px] md:h-[200px] w-full">
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
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: '12px' }} formatter={(v, n) => [fmt(v), n === 'revenue' ? 'Revenue' : 'Pengeluaran']} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" dot={false} />
                <Area type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={2} fill="url(#expGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Row 2: Revenue per Terapis + Revenue per Tipe Pasien ── */}
      <div className={`grid grid-cols-1 ${isPWA ? '' : 'lg:grid-cols-2'} gap-4`}>

        {/* Revenue per Terapis */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Revenue per Terapis</h3>
              <p className="text-xs text-slate-400">Kontribusi revenue per terapis</p>
            </div>
          </div>
          {therapistRevenue.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Belum ada data</p>
          ) : (
            <div className="space-y-3">
              {therapistRevenue.map((t, i) => {
                const pct = Math.round((t.revenue / (therapistRevenue[0]?.revenue || 1)) * 100);
                const colors = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#8b5cf6'];
                const color = colors[i % colors.length];
                return (
                  <div key={t.fullName} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-black text-slate-400 w-4 shrink-0">#{i + 1}</span>
                        <span className="text-xs font-semibold text-slate-700 truncate">{t.name}</span>
                      </div>
                      <span className="text-xs font-black text-slate-800 shrink-0">{fmtShort(t.revenue)}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Revenue per Tipe Pasien */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
              <Users className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Revenue per Tipe Pasien</h3>
              <p className="text-xs text-slate-400">Breakdown berdasarkan jenis kunjungan</p>
            </div>
          </div>
          {patientTypeRevenue.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Belum ada data</p>
          ) : (
            <div className="space-y-3">
              {patientTypeRevenue.map((p, i) => {
                const color = PATIENT_TYPE_COLORS[p.type] || '#94a3b8';
                return (
                  <div key={p.type} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs font-semibold text-slate-700 truncate">{p.type}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-black text-slate-800">{fmtShort(p.revenue)}</span>
                        <span className="text-[10px] text-slate-400 w-7 text-right">{p.pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p.pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Transaksi Terbaru + Breakdown Pengeluaran ── */}
      <div className={`grid grid-cols-1 ${isPWA ? '' : 'lg:grid-cols-2'} gap-4`}>

        {/* Transaksi Terbaru */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Transaksi Terbaru</h3>
          {recentTransactions.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Belum ada transaksi</p>
          ) : (
            <div className="space-y-2">
              {recentTransactions.map((tx, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${tx.type === 'income' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                    {tx.type === 'income'
                      ? <TrendingUp className="w-4 h-4 text-emerald-600" />
                      : <TrendingDown className="w-4 h-4 text-rose-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{tx.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{format(parseISO(tx.date), 'dd MMM yyyy', { locale: idLocale })}</p>
                  </div>
                  <p className={`text-xs font-black shrink-0 ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {tx.type === 'income' ? '+' : '-'}{fmtShort(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Breakdown Pengeluaran */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Breakdown Pengeluaran</h3>
              <p className="text-xs text-slate-400 mt-0.5">Per kategori</p>
            </div>
            {data.totalExpenses > 0 && (
              <div className="text-right">
                <p className="text-base font-black text-rose-600 leading-none">{fmtShort(data.totalExpenses)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Total</p>
              </div>
            )}
          </div>
          {expenseBreakdown.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-slate-400 text-sm">
              Belum ada pengeluaran di periode ini.
            </div>
          ) : (
            <div className="space-y-3">
              {expenseBreakdown.map((e, i) => (
                <div key={e.cat} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
                      <span className="text-xs font-semibold text-slate-700 truncate">{e.cat}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-black text-slate-800">{fmtShort(e.amt)}</span>
                      <span className="text-[10px] text-slate-400 w-7 text-right">{e.pct}%</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${e.pct}%`, backgroundColor: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default OwnerFinanceDashboardWidget;
