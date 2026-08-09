import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { MonitorPlay, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DateRangePicker from '@/components/ui/date-range-picker';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { usePresentationData } from '@/hooks/usePresentationData';
import PresentationFullscreen from '@/components/owner/presentation/PresentationFullscreen';
import CoverSlide from '@/components/owner/presentation/slides/CoverSlide';
import OperationalSlide from '@/components/owner/presentation/slides/OperationalSlide';
import FinanceSlide from '@/components/owner/presentation/slides/FinanceSlide';
import RevenueBreakdownSlide from '@/components/owner/presentation/slides/RevenueBreakdownSlide';
import AppointmentSlide from '@/components/owner/presentation/slides/AppointmentSlide';
import GrowthRetentionSlide from '@/components/owner/presentation/slides/GrowthRetentionSlide';
import StaffFinanceHealthSlide from '@/components/owner/presentation/slides/StaffFinanceHealthSlide';

const SLIDE_PREVIEWS = [
  { title: 'Cover', desc: 'Ringkasan headline: total sesi, pendapatan, dan pertumbuhan.' },
  { title: 'Operational', desc: 'Sesi, pasien, paket, terapis aktif, rata-rata sesi/hari, dan tingkat pembatalan.' },
  { title: 'Finance', desc: 'Pendapatan, pengeluaran, laba bersih, margin, dan Break Even Point.' },
  { title: 'Revenue Detail', desc: 'Pemasukan per metode pembayaran, pengeluaran per kategori, dan revenue per terapis.' },
  { title: 'Appointment', desc: 'Kepadatan per hari & jam, status appointment, dan tingkat no-show.' },
  { title: 'Growth & Retention', desc: 'Pertumbuhan vs periode sebelumnya, pasien baru/lama, dan perpanjangan paket.' },
  { title: 'Staff & Financial Health', desc: 'Kedisiplinan kehadiran, kelengkapan SOAP, piutang outstanding, dan ranking terapis.' },
];

const OwnerPresentationPage = () => {
  const { clinicName } = useAuth();
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return {
      startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
    };
  });
  const [isPresenting, setIsPresenting] = useState(false);
  const { data, loading, error, refetch } = usePresentationData(dateRange);

  const slides = useMemo(() => {
    if (!data) return [];
    return [
      <CoverSlide key="cover" clinicName={clinicName} data={data} dateRange={dateRange} />,
      <OperationalSlide key="operational" data={data} dateRange={dateRange} />,
      <FinanceSlide key="finance" data={data} dateRange={dateRange} />,
      <RevenueBreakdownSlide key="revenue-breakdown" data={data} dateRange={dateRange} />,
      <AppointmentSlide key="appointment" data={data} dateRange={dateRange} />,
      <GrowthRetentionSlide key="growth" data={data} dateRange={dateRange} />,
      <StaffFinanceHealthSlide key="staff" data={data} dateRange={dateRange} />,
    ];
  }, [data, clinicName, dateRange]);

  return (
    <>
      <Helmet>
        <title>Presentasi Direksi - Kaffah System Care</title>
        <meta name="description" content="Slideshow presentasi kinerja klinik untuk jajaran direksi" />
      </Helmet>

      <div className="space-y-5 animate-in fade-in duration-500 pb-24 md:pb-12">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 md:p-7 shadow-xl border border-slate-700/50">
          <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #d4af6a 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <p className="text-amber-300/80 text-xs font-semibold uppercase tracking-widest mb-1">{clinicName || ''}</p>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
                <MonitorPlay className="h-5 w-5 md:h-6 md:w-6 text-amber-300" />
                Presentasi Direksi
              </h1>
              <p className="text-slate-400 text-xs mt-1">Ringkasan kinerja klinik untuk dipresentasikan ke jajaran direksi.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <DateRangePicker value={dateRange} onChange={setDateRange} className="bg-white/10 border-white/10 text-white hover:bg-white/20 hover:text-white" />
              <Button variant="outline" size="icon" className="bg-white/10 border-white/10 text-white hover:bg-white/20 shrink-0" onClick={refetch} title="Muat ulang data">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold shrink-0"
                disabled={loading || !!error || !data}
                onClick={() => setIsPresenting(true)}
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MonitorPlay className="h-4 w-4 mr-2" />}
                Mulai Presentasi
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-600 p-4 text-sm">
            Gagal memuat data presentasi. Silakan coba muat ulang.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SLIDE_PREVIEWS.map((slide, idx) => (
            <div key={slide.title} className="rounded-2xl border border-slate-100 shadow-sm p-5 bg-white">
              <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-1">Slide {idx + 1}</p>
              <p className="text-base font-bold text-slate-800 mb-1">{slide.title}</p>
              <p className="text-sm text-slate-500">{slide.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {isPresenting && slides.length > 0 && (
        <PresentationFullscreen slides={slides} onClose={() => setIsPresenting(false)} />
      )}
    </>
  );
};

export default OwnerPresentationPage;
