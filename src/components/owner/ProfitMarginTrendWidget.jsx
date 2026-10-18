import React, { useState, useMemo } from 'react';
import { LineChart as LineChartIcon, Trophy, TrendingDown } from 'lucide-react';
import FinanceTile, { TileEmpty, TileLoading } from '@/components/owner/finance/FinanceTile';
import { fmtShort, fmtPct } from '@/components/owner/finance/financeTheme';
import { cn } from '@/lib/utils';

const MONTH_OPTIONS = [3, 6, 12];
const VIOLET = '#7c3aed';

// Data bulanan (`monthly`, 12 bulan) dihitung di useMonthlyFinance dan dipakai
// bersama KPI di RevenueOverview; widget ini hanya mengiris 3/6/12 bulan.
const ProfitMarginTrendWidget = ({ monthly = [], loading = false, className }) => {
  const [months, setMonths] = useState(12);
  const [picked, setPicked] = useState(null);

  const data = useMemo(() => monthly.slice(-months), [monthly, months]);
  const hasAnyData = data.some(m => m.revenue > 0 || m.expense > 0);
  const n = data.length;
  const sel = n === 0 ? 0 : picked == null || picked >= n ? n - 1 : picked;
  const cur = data[sel];
  const prev = sel > 0 ? data[sel - 1] : null;
  const delta = cur && prev ? Math.round((cur.margin - prev.margin) * 10) / 10 : null;

  const summary = useMemo(() => {
    const withRevenue = data.filter(m => m.revenue > 0);
    if (withRevenue.length === 0) return null;
    return {
      avg: Math.round((withRevenue.reduce((s, m) => s + m.margin, 0) / withRevenue.length) * 10) / 10,
      best: withRevenue.reduce((a, b) => (b.margin > a.margin ? b : a)),
      worst: withRevenue.reduce((a, b) => (b.margin < a.margin ? b : a)),
    };
  }, [data]);

  const W = 320, H = 140, L = 10, R = 10, T = 14, B = 22;
  const chart = useMemo(() => {
    if (n < 2) return null;
    const mn = Math.floor(Math.min(...data.map(d => d.margin)) - 3);
    const mx = Math.ceil(Math.max(...data.map(d => d.margin)) + 3);
    const X = (i) => L + (i * (W - L - R)) / (n - 1);
    const Y = (v) => T + (1 - (v - mn) / (mx - mn)) * (H - T - B);
    const line = data.map((d, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(d.margin).toFixed(1)}`).join('');
    return { X, Y, line, area: `${line}L${X(n - 1)} ${H - B}L${X(0)} ${H - B}Z`, colW: (W - L - R) / (n - 1) };
  }, [data, n]);

  const rangeChips = (
    <div className="flex gap-1">
      {MONTH_OPTIONS.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => { setMonths(opt); setPicked(null); }}
          aria-pressed={months === opt}
          className={cn(
            'min-w-[36px] px-2.5 py-1 rounded-full border text-xs font-bold transition-colors',
            months === opt ? 'bg-app-ink text-white border-app-ink' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          )}
        >
          {opt}b
        </button>
      ))}
    </div>
  );

  return (
    <FinanceTile tone="vio" icon={LineChartIcon} title="Tren Margin" action={rangeChips} className={className}>
      {loading && monthly.length === 0 ? (
        <TileLoading />
      ) : !hasAnyData || !cur ? (
        <TileEmpty>Belum ada data pada periode ini.</TileEmpty>
      ) : (
        <>
          <div className="flex items-baseline gap-2 flex-wrap mb-1">
            <p className={cn('text-3xl font-black tabular-nums leading-none', cur.margin >= 0 ? 'text-app-ink' : 'text-rose-600')}>{fmtPct(cur.margin)}</p>
            <span className="text-sm text-slate-500 font-medium">{cur.monthLabel}</span>
            {delta !== null && (
              <span className={cn(
                'text-xs font-bold px-2 py-0.5 rounded-full',
                delta > 0 ? 'bg-emerald-50 text-emerald-700' : delta < 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'
              )}>
                {delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : ''}{String(delta).replace('.', ',')} pt
              </span>
            )}
          </div>
          <div className="flex gap-4 text-xs text-slate-500 mb-2 flex-wrap">
            <span>Pemasukan <b className="text-emerald-600 tabular-nums">{fmtShort(cur.revenue)}</b></span>
            <span>Biaya <b className="text-rose-600 tabular-nums">{fmtShort(cur.expense)}</b></span>
            <span>Profit <b className={cn('tabular-nums', cur.profit >= 0 ? 'text-app-ink' : 'text-rose-600')}>{fmtShort(cur.profit)}</b></span>
          </div>

          {chart && (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block overflow-visible" role="img" aria-label={`Tren margin ${months} bulan`}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={VIOLET} stopOpacity="0.32" />
                  <stop offset="1" stopColor={VIOLET} stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 1, 2].map(g => {
                const y = T + (g * (H - T - B)) / 2;
                return <line key={g} x1={L} x2={W - R} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 4" />;
              })}
              <path d={chart.area} fill="url(#trendFill)" />
              <path d={chart.line} fill="none" stroke={VIOLET} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
              <line x1={chart.X(sel)} x2={chart.X(sel)} y1={T - 6} y2={H - B} stroke={VIOLET} strokeOpacity="0.4" />
              {data.map((d, i) => (
                <circle key={d.monthKey} cx={chart.X(i)} cy={chart.Y(d.margin)} r={i === sel ? 5.5 : 2.6} fill={i === sel ? VIOLET : '#fff'} stroke={VIOLET} strokeWidth="2" />
              ))}
              {data.map((d, i) => (n <= 6 || i % 2 === (n - 1) % 2) && (
                <text key={`l${d.monthKey}`} x={chart.X(i)} y={H - 5} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#64748b">{d.shortLabel}</text>
              ))}
              {data.map((d, i) => (
                <rect
                  key={`h${d.monthKey}`} x={chart.X(i) - chart.colW / 2} y="0" width={chart.colW} height={H}
                  fill="transparent" className="cursor-pointer" onClick={() => setPicked(i)}
                />
              ))}
            </svg>
          )}

          {summary && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                Rata-rata <b className="tabular-nums">{fmtPct(summary.avg)}</b>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">
                <Trophy className="w-3 h-3" /> {summary.best.shortLabel} <b className="tabular-nums">{fmtPct(summary.best.margin)}</b>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-xs font-semibold text-amber-700">
                <TrendingDown className="w-3 h-3" /> {summary.worst.shortLabel} <b className="tabular-nums">{fmtPct(summary.worst.margin)}</b>
              </span>
            </div>
          )}
        </>
      )}
    </FinanceTile>
  );
};

export default ProfitMarginTrendWidget;
