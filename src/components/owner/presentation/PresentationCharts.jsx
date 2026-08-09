import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts';
import { CATEGORICAL_COLORS, RANK_COLOR, chartTooltipStyle, chartAxisTick } from '@/components/owner/presentation/chartTheme';

export const ChartCard = ({ title, icon: Icon, children }) => (
  <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-4 md:p-6 flex flex-col h-full shadow-lg shadow-black/20">
    <div className="flex items-center gap-2 mb-3 md:mb-4">
      {Icon && <Icon className="h-4 w-4 text-amber-300 shrink-0" />}
      <p className="text-white font-bold text-sm md:text-base">{title}</p>
    </div>
    <div className="flex-1 min-h-[200px]">{children}</div>
  </div>
);

export const ChartEmptyState = () => (
  <div className="h-full flex items-center justify-center text-slate-500 text-sm">Belum ada data pada periode ini.</div>
);

// Horizontal bar ranking — peringkat #1 disorot warna emas, sisanya memakai
// satu hue dasar yang konsisten, dengan label nilai langsung di ujung bar
// (data-end) supaya tidak perlu bolak-balik lihat sumbu untuk presentasi lisan.
export const RankedBarChart = ({ data, dataKey, nameKey, valueFormatter = (v) => v, tooltipLabel, baseColor = CATEGORICAL_COLORS[2] }) => {
  if (!data || data.length === 0) return <ChartEmptyState />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 56, left: 0, bottom: 5 }} barCategoryGap={10}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey={nameKey} axisLine={false} tickLine={false} tick={{ ...chartAxisTick, fill: '#e2e8f0', fontWeight: 600 }} width={110} />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          contentStyle={chartTooltipStyle}
          formatter={(value) => [valueFormatter(value), tooltipLabel]}
        />
        <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} maxBarSize={20} animationDuration={800}>
          {data.map((entry, i) => (
            <Cell key={entry[nameKey]} fill={i === 0 ? RANK_COLOR : baseColor} fillOpacity={i === 0 ? 1 : 0.75} />
          ))}
          <LabelList
            dataKey={dataKey}
            position="right"
            formatter={valueFormatter}
            style={{ fill: '#fff', fontSize: 12, fontWeight: 700 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// Donut dengan total di tengah + legenda "track list" (dot + label + nilai +
// persen + mini progress bar) — mudah dijelaskan lisan karena angka & persen
// sudah tertulis, tidak perlu menaksir dari besar-kecil irisan pie.
export const DonutWithLegend = ({ data, dataKey, nameKey, valueFormatter = (v) => v, totalLabel = 'Total' }) => {
  if (!data || data.length === 0) return <ChartEmptyState />;
  const total = data.reduce((s, d) => s + (Number(d[dataKey]) || 0), 0);

  return (
    <div className="h-full flex flex-col md:flex-row gap-4 items-center">
      <div className="relative w-full md:w-1/2 h-[160px] md:h-full shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey={dataKey} nameKey={nameKey} innerRadius="62%" outerRadius="92%" paddingAngle={3} strokeWidth={0} animationDuration={800}>
              {data.map((entry, i) => (
                <Cell key={entry[nameKey]} fill={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [valueFormatter(value), totalLabel]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-white text-lg md:text-2xl font-black leading-none">{valueFormatter(total)}</p>
          <p className="text-slate-400 text-[10px] md:text-xs font-semibold uppercase tracking-wide mt-1">{totalLabel}</p>
        </div>
      </div>
      <div className="w-full md:w-1/2 space-y-2.5 overflow-y-auto">
        {data.map((entry, i) => {
          const pct = total > 0 ? Math.round((Number(entry[dataKey]) / total) * 100) : 0;
          const color = CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length];
          return (
            <div key={entry[nameKey]} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs md:text-sm">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-slate-200 font-medium truncate">{entry[nameKey]}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-white font-bold">{valueFormatter(entry[dataKey])}</span>
                  <span className="text-slate-400 text-[10px] w-8 text-right">{pct}%</span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
