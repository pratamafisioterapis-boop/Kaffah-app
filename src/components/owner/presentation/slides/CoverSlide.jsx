import React from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Activity, Wallet, CalendarRange } from 'lucide-react';
import { formatShortCurrency, formatPercent } from '@/components/owner/presentation/presentationFormat';

const CoverSlide = ({ clinicName, data, dateRange }) => {
  const periodLabel = dateRange?.startDate && dateRange?.endDate
    ? `${format(new Date(`${dateRange.startDate}T00:00:00`), 'dd MMMM yyyy', { locale: idLocale })} — ${format(new Date(`${dateRange.endDate}T00:00:00`), 'dd MMMM yyyy', { locale: idLocale })}`
    : '';

  const revenueGrowth = data?.growth?.revenue?.growth ?? 0;
  const GrowthIcon = revenueGrowth >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center p-8 md:p-14 gap-8 md:gap-12">
      <div>
        <p className="text-amber-300/80 text-sm md:text-base font-bold uppercase tracking-[0.3em] mb-3">Laporan Kinerja Klinik</p>
        <h1 className="text-3xl md:text-6xl font-black text-white tracking-tight">{clinicName || 'Klinik'}</h1>
        <div className="mt-4 inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-4 py-2 text-slate-200 text-xs md:text-base font-medium">
          <CalendarRange className="h-4 w-4 text-amber-300" />
          {periodLabel}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 w-full max-w-4xl">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-7">
          <Activity className="h-5 w-5 md:h-6 md:w-6 text-sky-300 mx-auto mb-2" />
          <p className="text-2xl md:text-4xl font-black text-white">{data?.operational?.totalSessions ?? 0}</p>
          <p className="text-slate-400 text-xs md:text-sm mt-1">Total Sesi</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-7">
          <Wallet className="h-5 w-5 md:h-6 md:w-6 text-emerald-300 mx-auto mb-2" />
          <p className="text-2xl md:text-4xl font-black text-white">{formatShortCurrency(data?.finance?.totalRevenue)}</p>
          <p className="text-slate-400 text-xs md:text-sm mt-1">Total Pendapatan</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-7">
          <GrowthIcon className={`h-5 w-5 md:h-6 md:w-6 mx-auto mb-2 ${revenueGrowth >= 0 ? 'text-emerald-300' : 'text-rose-300'}`} />
          <p className={`text-2xl md:text-4xl font-black ${revenueGrowth >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatPercent(revenueGrowth)}</p>
          <p className="text-slate-400 text-xs md:text-sm mt-1">Pertumbuhan Revenue vs Periode Sebelumnya</p>
        </div>
      </div>
    </div>
  );
};

export default CoverSlide;
