import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart as LineChartIcon, TrendingUp, TrendingDown, Minus,
  Loader2, Trophy, TrendingDown as TrendingDownIcon, Info
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  getOwnerIncome, getAdminIncome, getPatientIncomeFromPackages,
  getOwnerExpenditures, getAdminExpenses, getBepFinancials
} from '@/lib/api';
import { cn } from '@/lib/utils';

const MONTH_OPTIONS = [3, 6, 12];

const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

const formatShort = (value) => {
  const num = Number(value) || 0;
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '')} M`;
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')} Jt`;
  if (abs >= 1_000) return `${sign}Rp ${(abs / 1_000).toFixed(0)} Rb`;
  return `${sign}Rp ${Math.round(abs).toLocaleString('id-ID')}`;
};

// Widget ini menghitung revenue & pengeluaran per bulan (owner/admin income,
// pemasukan pasien dari daily_recaps, owner/admin expenditures) lalu
// mengelompokkannya per bulan untuk melihat tren margin profit bulan ke bulan.
// Bulan berjalan (bucket terakhir) dikecualikan dari perhitungan mentah itu dan
// ditimpa dengan angka dari getBepFinancials() — sama seperti widget Break Even
// Point & Financial Health Overview — supaya "margin bulan ini" di sini selalu
// konsisten dengan kedua widget tersebut (fixed cost + pengeluaran tgl 1 s/d
// hari ini + transport & insentif terapis, bukan cuma transaksi mentah).
const ProfitMarginTrendWidget = () => {
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const [monthsToShow, setMonthsToShow] = useState(6);
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState({ income: [], expense: [] });
  const [bepFinancials, setBepFinancials] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const today = new Date();
    const startDate = format(startOfMonth(subMonths(today, monthsToShow - 1)), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(today), 'yyyy-MM-dd');

    try {
      const [ownerInc, adminInc, patientInc, ownerExp, adminExp, bepRes] = await Promise.all([
        getOwnerIncome({ startDate, endDate }),
        getAdminIncome({ startDate, endDate }),
        getPatientIncomeFromPackages({ startDate, endDate }),
        getOwnerExpenditures({ startDate, endDate }),
        getAdminExpenses({ startDate, endDate }),
        getBepFinancials(),
      ]);

      const income = [
        ...(ownerInc?.data || []).map(i => ({ date: i.date, amount: Number(i.amount) || 0 })),
        ...(adminInc?.data || []).map(i => ({ date: i.date, amount: Number(i.amount) || 0 })),
        ...(patientInc?.data || []).map(i => ({ date: i.date, amount: Number(i.amount) || 0 })),
      ];

      const expense = [
        ...(ownerExp?.data || []).map(e => ({ date: e.date, amount: Number(e.amount) || 0 })),
        ...(adminExp?.data || []).map(e => ({ date: e.transaction_date || e.date, amount: Number(e.amount) || 0 })),
      ];

      setRaw({ income, expense });
      setBepFinancials(bepRes?.data || null);
    } finally {
      setLoading(false);
    }
  }, [monthsToShow]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const monthlyData = useMemo(() => {
    const today = new Date();
    const months = eachMonthOfInterval({
      start: startOfMonth(subMonths(today, monthsToShow - 1)),
      end: startOfMonth(today),
    });

    const buckets = {};
    months.forEach(m => {
      const key = format(m, 'yyyy-MM');
      buckets[key] = {
        monthKey: key,
        monthLabel: format(m, 'MMM yyyy', { locale: idLocale }),
        revenue: 0,
        expense: 0,
      };
    });

    raw.income.forEach(item => {
      if (!item.date) return;
      const key = String(item.date).slice(0, 7);
      if (buckets[key]) buckets[key].revenue += item.amount;
    });
    raw.expense.forEach(item => {
      if (!item.date) return;
      const key = String(item.date).slice(0, 7);
      if (buckets[key]) buckets[key].expense += item.amount;
    });

    // Bulan berjalan memakai angka getBepFinancials() (fixed cost + transport +
    // insentif terapis, pengeluaran tgl 1 s/d hari ini) supaya sama dengan
    // widget Break Even Point & Financial Health Overview.
    const currentMonthKey = format(today, 'yyyy-MM');
    if (bepFinancials && buckets[currentMonthKey]) {
      buckets[currentMonthKey].revenue = bepFinancials.revenueThisMonth || 0;
      buckets[currentMonthKey].expense = bepFinancials.totalCost || 0;
    }

    return Object.values(buckets).map(b => {
      const profit = b.revenue - b.expense;
      const margin = b.revenue > 0 ? (profit / b.revenue) * 100 : 0;
      return { ...b, profit, margin: Math.round(margin * 10) / 10 };
    });
  }, [raw, monthsToShow, bepFinancials]);

  const hasAnyData = monthlyData.some(m => m.revenue > 0 || m.expense > 0);

  const summary = useMemo(() => {
    const withRevenue = monthlyData.filter(m => m.revenue > 0);
    const current = monthlyData[monthlyData.length - 1];
    const previous = monthlyData[monthlyData.length - 2];
    const marginDelta = current && previous ? Math.round((current.margin - previous.margin) * 10) / 10 : null;

    const avgMargin = withRevenue.length > 0
      ? Math.round((withRevenue.reduce((s, m) => s + m.margin, 0) / withRevenue.length) * 10) / 10
      : 0;

    const best = withRevenue.length > 0
      ? withRevenue.reduce((a, b) => (b.margin > a.margin ? b : a))
      : null;
    const worst = withRevenue.length > 0
      ? withRevenue.reduce((a, b) => (b.margin < a.margin ? b : a))
      : null;

    return { current, previous, marginDelta, avgMargin, best, worst };
  }, [monthlyData]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    const point = payload[0]?.payload;
    return (
      <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-lg text-xs">
        <p className="font-bold text-slate-700 mb-1.5">{label}</p>
        <p className="text-emerald-600">Revenue: <span className="font-semibold">{formatCurrency(point?.revenue)}</span></p>
        <p className="text-rose-600">Pengeluaran: <span className="font-semibold">{formatCurrency(point?.expense)}</span></p>
        <p className="text-indigo-600">Profit: <span className="font-semibold">{formatCurrency(point?.profit)}</span></p>
        <p className="text-slate-500 mt-1 pt-1 border-t border-slate-100">Margin: <span className="font-bold text-slate-700">{point?.margin}%</span></p>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
      <div className={cn("flex gap-3 mb-5", isPWA ? "flex-col" : "items-start justify-between")}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shrink-0">
            <LineChartIcon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-800 tracking-tight">Tren Margin Profit Bulanan</h3>
            <p className="text-xs text-slate-400 mt-0.5">Analisa margin keuntungan bulan ke bulan</p>
          </div>
        </div>
        <div className={cn("flex items-center gap-1.5 rounded-xl bg-slate-50 p-1 shrink-0", isPWA && "w-full")}>
          {MONTH_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => setMonthsToShow(opt)}
              className={cn(
                "flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                monthsToShow === opt
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-100"
              )}
            >
              {opt} Bulan
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-14">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : !hasAnyData ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <Info className="w-5 h-5 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Belum ada data pemasukan/pengeluaran pada periode ini.</p>
        </div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div className={cn("grid gap-3 mb-5", isPWA ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4")}>
            <div className={cn(
              "rounded-xl border p-3.5",
              (summary.current?.margin ?? 0) >= 0 ? "bg-indigo-50/60 border-indigo-100" : "bg-rose-50/60 border-rose-100"
            )}>
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">Margin Bulan Ini</p>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <p className={cn(
                  "text-xl font-black leading-none",
                  (summary.current?.margin ?? 0) >= 0 ? "text-indigo-600" : "text-rose-600"
                )}>
                  {summary.current?.margin ?? 0}%
                </p>
                {summary.marginDelta !== null && (
                  <span className={cn(
                    "inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                    summary.marginDelta > 0 ? "bg-emerald-100 text-emerald-700" :
                    summary.marginDelta < 0 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"
                  )}>
                    {summary.marginDelta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> :
                     summary.marginDelta < 0 ? <TrendingDown className="w-2.5 h-2.5" /> :
                     <Minus className="w-2.5 h-2.5" />}
                    {summary.marginDelta > 0 ? '+' : ''}{summary.marginDelta}pp
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">vs bulan lalu</p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">Rata-rata Margin</p>
              <p className="text-xl font-black leading-none text-slate-700">{summary.avgMargin}%</p>
              <p className="text-[11px] text-slate-400 mt-1">{monthsToShow} bulan terakhir</p>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5">
              <p className="text-[10px] font-bold tracking-widest text-emerald-600/70 uppercase mb-1 flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Bulan Terbaik
              </p>
              <p className="text-xl font-black leading-none text-emerald-600">{summary.best?.margin ?? 0}%</p>
              <p className="text-[11px] text-slate-400 mt-1 truncate">{summary.best?.monthLabel ?? '-'}</p>
            </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3.5">
              <p className="text-[10px] font-bold tracking-widest text-amber-600/70 uppercase mb-1 flex items-center gap-1">
                <TrendingDownIcon className="w-3 h-3" /> Bulan Terlemah
              </p>
              <p className="text-xl font-black leading-none text-amber-600">{summary.worst?.margin ?? 0}%</p>
              <p className="text-[11px] text-slate-400 mt-1 truncate">{summary.worst?.monthLabel ?? '-'}</p>
            </div>
          </div>

          {/* ── Chart ── */}
          <div className="h-[260px] md:h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  tickFormatter={formatShort}
                  width={54}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  tickFormatter={(v) => `${v}%`}
                  width={38}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#10b981" radius={[6, 6, 0, 0]} barSize={22} />
                <Bar yAxisId="left" dataKey="expense" name="Pengeluaran" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={22} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="margin"
                  name="Margin %"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#6366f1' }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* ── Monthly Breakdown List ── */}
          <div className="mt-5 space-y-1.5">
            {monthlyData.map((m, i) => {
              const prev = monthlyData[i - 1];
              const delta = prev ? Math.round((m.margin - prev.margin) * 10) / 10 : null;
              return (
                <div
                  key={m.monthKey}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-bold text-slate-600 w-16 shrink-0">{m.monthLabel}</span>
                    {delta !== null && (
                      <span className={cn(
                        "inline-flex items-center gap-0.5 text-[10px] font-semibold shrink-0",
                        delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-slate-400"
                      )}>
                        {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        {delta > 0 ? '+' : ''}{delta}pp
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs shrink-0">
                    <span className="text-emerald-600 font-semibold hidden sm:inline">{formatShort(m.revenue)}</span>
                    <span className="text-rose-500 font-semibold hidden sm:inline">{formatShort(m.expense)}</span>
                    <span className={cn(
                      "font-black w-14 text-right",
                      m.margin >= 0 ? "text-indigo-600" : "text-rose-600"
                    )}>
                      {m.margin}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default ProfitMarginTrendWidget;
