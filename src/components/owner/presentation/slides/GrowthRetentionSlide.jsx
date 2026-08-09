import React from 'react';
import { TrendingUp, TrendingDown, Users, UserPlus, RefreshCcw, PackageCheck } from 'lucide-react';
import SlideShell from '@/components/owner/presentation/SlideShell';
import StatTile from '@/components/owner/presentation/StatTile';
import { formatPercent } from '@/components/owner/presentation/presentationFormat';

const GrowthCard = ({ label, growthData }) => {
  const growth = growthData?.growth ?? 0;
  const Icon = growth >= 0 ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6 flex flex-col gap-2">
      <p className="text-slate-300 text-xs md:text-sm font-semibold uppercase tracking-wide">{label}</p>
      <div className="flex items-end gap-3">
        <p className={`text-3xl md:text-5xl font-black leading-none ${growth >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
          {formatPercent(growth)}
        </p>
        <Icon className={`h-6 w-6 mb-1 ${growth >= 0 ? 'text-emerald-300' : 'text-rose-300'}`} />
      </div>
      <p className="text-slate-400 text-xs md:text-sm">
        {growthData?.now ?? 0} vs {growthData?.previous ?? 0} periode sebelumnya
      </p>
    </div>
  );
};

// Slide khusus metrik yang belum punya widget di dashboard biasa: growth
// rate periode-ke-periode, komposisi pasien baru/lama, dan tingkat
// perpanjangan paket.
const GrowthRetentionSlide = ({ data, dateRange }) => {
  const growth = data?.growth;
  const mix = data?.patientMix;
  const renewal = data?.packageRenewal;

  return (
    <SlideShell eyebrow="Growth & Retention" title="Pertumbuhan & Loyalitas Pasien" dateRange={dateRange}>
      <div className="h-full flex flex-col gap-5 md:gap-7">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <GrowthCard label="Pertumbuhan Sesi" growthData={growth?.sessions} />
          <GrowthCard label="Pertumbuhan Pasien" growthData={growth?.patients} />
          <GrowthCard label="Pertumbuhan Pendapatan" growthData={growth?.revenue} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 flex-1">
          <StatTile icon={UserPlus} label="Pasien Baru" value={mix?.newPatients ?? 0} accent="sky" />
          <StatTile icon={Users} label="Pasien Kembali" value={mix?.returningPatients ?? 0} accent="violet" />
          <StatTile icon={RefreshCcw} label="Tingkat Pasien Kembali" value={`${mix?.returningRate ?? 0}%`} accent="emerald" />
          <StatTile
            icon={PackageCheck}
            label="Tingkat Perpanjangan Paket"
            value={`${renewal?.rate ?? 0}%`}
            sublabel={renewal ? `${renewal.renewed} dari ${renewal.totalExpired} paket habis` : ''}
            accent="amber"
          />
        </div>

        {growth?.previousPeriod && (
          <p className="text-slate-400 text-xs md:text-sm">
            Dibandingkan dengan periode sebelumnya (panjang sama): {growth.previousPeriod.startDate} – {growth.previousPeriod.endDate}
          </p>
        )}
      </div>
    </SlideShell>
  );
};

export default GrowthRetentionSlide;
