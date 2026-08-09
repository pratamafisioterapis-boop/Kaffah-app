import React from 'react';
import { Wallet, Receipt, Trophy, Stethoscope } from 'lucide-react';
import SlideShell from '@/components/owner/presentation/SlideShell';
import { ChartCard, RankedBarChart, DonutWithLegend } from '@/components/owner/presentation/PresentationCharts';
import { CATEGORICAL_COLORS } from '@/components/owner/presentation/chartTheme';
import { formatShortCurrency } from '@/components/owner/presentation/presentationFormat';

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
        <ChartCard title="Pemasukan per Metode Pembayaran" icon={Wallet}>
          <DonutWithLegend
            data={paymentMethodBreakdown}
            dataKey="amount"
            nameKey="method"
            valueFormatter={formatShortCurrency}
            totalLabel="Total Masuk"
          />
        </ChartCard>

        <ChartCard title="Pengeluaran per Kategori" icon={Receipt}>
          <RankedBarChart
            data={expenseBreakdown}
            dataKey="amount"
            nameKey="category"
            valueFormatter={formatShortCurrency}
            tooltipLabel="Pengeluaran"
            baseColor={CATEGORICAL_COLORS[7]}
          />
        </ChartCard>

        <ChartCard title="Revenue per Terapis (Top 8)" icon={Trophy}>
          <RankedBarChart
            data={revenueByTherapist}
            dataKey="revenue"
            nameKey="name"
            valueFormatter={formatShortCurrency}
            tooltipLabel="Revenue"
            baseColor={CATEGORICAL_COLORS[2]}
          />
        </ChartCard>

        <ChartCard title="Distribusi Diagnosa Pasien (Top 8)" icon={Stethoscope}>
          <RankedBarChart
            data={diagnosisBreakdown}
            dataKey="count"
            nameKey="diagnosis"
            valueFormatter={(v) => `${v}`}
            tooltipLabel="Kasus"
            baseColor={CATEGORICAL_COLORS[6]}
          />
        </ChartCard>
      </div>
    </SlideShell>
  );
};

export default RevenueBreakdownSlide;
