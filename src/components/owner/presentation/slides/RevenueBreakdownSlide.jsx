import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import SlideShell from '@/components/owner/presentation/SlideShell';
import { formatShortCurrency } from '@/components/owner/presentation/presentationFormat';

const COLORS = ['#38bdf8', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#fb7185', '#2dd4bf', '#facc15'];

const ChartCard = ({ title, children }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6 flex flex-col h-full">
    <p className="text-white font-bold text-sm md:text-base mb-3 md:mb-4">{title}</p>
    <div className="flex-1 min-h-[200px]">{children}</div>
  </div>
);

const EmptyState = () => (
  <div className="h-full flex items-center justify-center text-slate-500 text-sm">Belum ada data pada periode ini.</div>
);

// Slide detail sumber pendapatan, pengeluaran & layanan — belum ada widget
// serupa di dashboard biasa yang menggabungkan semuanya dalam satu tempat:
// pemasukan per metode pembayaran, pengeluaran per kategori, revenue per
// terapis, dan distribusi diagnosa pasien.
const RevenueBreakdownSlide = ({ data, dateRange }) => {
  const fin = data?.finance || {};
  const therapistPerf = data?.therapistPerformance || {};
  const paymentMethodBreakdown = fin.paymentMethodBreakdown || [];
  const expenseBreakdown = fin.expenseBreakdown || [];
  const revenueByTherapist = therapistPerf.revenueByTherapist || [];
  const diagnosisBreakdown = fin.diagnosisBreakdown || [];

  return (
    <SlideShell eyebrow="Revenue Detail" title="Pendapatan, Pengeluaran & Diagnosa Pasien" dateRange={dateRange}>
      <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        <ChartCard title="Pemasukan per Metode Pembayaran">
          {paymentMethodBreakdown.length === 0 ? <EmptyState /> : (
            <div className="h-full flex flex-col">
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentMethodBreakdown} dataKey="amount" nameKey="method" innerRadius="45%" outerRadius="80%" paddingAngle={2} animationDuration={800}>
                      {paymentMethodBreakdown.map((entry, i) => (
                        <Cell key={entry.method} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: 'none', background: '#1e293b', color: '#fff' }}
                      formatter={(value) => [formatShortCurrency(value), 'Pemasukan']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {paymentMethodBreakdown.slice(0, 6).map((entry, i) => (
                  <div key={entry.method} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    {entry.method} ({formatShortCurrency(entry.amount)})
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Pengeluaran per Kategori">
          {expenseBreakdown.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expenseBreakdown} layout="vertical" margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => formatShortCurrency(v)} />
                <YAxis type="category" dataKey="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#cbd5e1' }} width={90} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: 'none', background: '#1e293b', color: '#fff' }}
                  formatter={(value) => [formatShortCurrency(value), 'Pengeluaran']}
                />
                <Bar dataKey="amount" fill="#fb7185" radius={[0, 6, 6, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Revenue per Terapis (Top 8)">
          {revenueByTherapist.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByTherapist} layout="vertical" margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => formatShortCurrency(v)} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#cbd5e1' }} width={90} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: 'none', background: '#1e293b', color: '#fff' }}
                  formatter={(value) => [formatShortCurrency(value), 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#34d399" radius={[0, 6, 6, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Distribusi Diagnosa Pasien (Top 8)">
          {diagnosisBreakdown.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={diagnosisBreakdown} layout="vertical" margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                <YAxis type="category" dataKey="diagnosis" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#cbd5e1' }} width={110} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: 'none', background: '#1e293b', color: '#fff' }}
                  formatter={(value) => [value, 'Kasus']}
                />
                <Bar dataKey="count" fill="#a78bfa" radius={[0, 6, 6, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </SlideShell>
  );
};

export default RevenueBreakdownSlide;
