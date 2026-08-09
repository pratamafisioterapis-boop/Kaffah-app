import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Wallet, TrendingDown, TrendingUp, Percent, Target } from 'lucide-react';
import SlideShell from '@/components/owner/presentation/SlideShell';
import StatTile from '@/components/owner/presentation/StatTile';
import { formatShortCurrency } from '@/components/owner/presentation/presentationFormat';

const FinanceSlide = ({ data, dateRange }) => {
  const fin = data?.finance || {};
  const bep = fin.bep;

  return (
    <SlideShell eyebrow="Finance" title="Kinerja Keuangan" dateRange={dateRange}>
      <div className="h-full flex flex-col gap-5 md:gap-7">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatTile icon={Wallet} label="Total Pendapatan" value={formatShortCurrency(fin.totalRevenue)} accent="emerald" />
          <StatTile icon={TrendingDown} label="Total Pengeluaran" value={formatShortCurrency(fin.totalExpenses)} accent="rose" />
          <StatTile
            icon={fin.netProfit >= 0 ? TrendingUp : TrendingDown}
            label="Laba Bersih"
            value={formatShortCurrency(fin.netProfit)}
            accent={fin.netProfit >= 0 ? 'emerald' : 'rose'}
          />
          <StatTile icon={Percent} label="Margin Laba" value={`${fin.profitMargin ?? 0}%`} accent="amber" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 flex-1 min-h-0">
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6 flex flex-col">
            <p className="text-white font-bold text-sm md:text-base mb-4">Tren Pendapatan</p>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={fin.revenueTrend || []} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="finTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis
                    axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }}
                    width={44} tickFormatter={(v) => formatShortCurrency(v)}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: 'none', background: '#1e293b', color: '#fff' }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ''}
                    formatter={(value) => [formatShortCurrency(value), 'Pendapatan']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#34d399" strokeWidth={2.5} fill="url(#finTrendGrad)" animationDuration={800} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6 flex flex-col justify-center gap-3">
            <div className="flex items-center gap-2 text-amber-300">
              <Target className="h-4 w-4" />
              <p className="font-bold text-sm md:text-base">Break Even Point</p>
            </div>
            <p className="text-slate-400 text-[11px] md:text-xs -mt-2">Posisi bulan berjalan</p>
            {bep ? (
              <>
                <div>
                  <p className="text-slate-400 text-xs">Total Biaya Bulan Ini</p>
                  <p className="text-white text-lg md:text-2xl font-black">{formatShortCurrency(bep.totalCost)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Pendapatan Bulan Ini</p>
                  <p className="text-white text-lg md:text-2xl font-black">{formatShortCurrency(bep.revenueThisMonth)}</p>
                </div>
                <div className={`mt-1 inline-flex w-fit items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${bep.isBreakEven ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}`}>
                  {bep.isBreakEven ? 'Sudah Balik Modal' : 'Belum Balik Modal'}
                </div>
              </>
            ) : (
              <p className="text-slate-400 text-sm">Data belum tersedia.</p>
            )}
          </div>
        </div>
      </div>
    </SlideShell>
  );
};

export default FinanceSlide;
