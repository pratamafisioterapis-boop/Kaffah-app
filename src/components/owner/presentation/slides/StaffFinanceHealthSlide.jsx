import React from 'react';
import { ShieldCheck, ClipboardCheck, Receipt, Users, Trophy } from 'lucide-react';
import SlideShell from '@/components/owner/presentation/SlideShell';
import StatTile from '@/components/owner/presentation/StatTile';
import { formatShortCurrency } from '@/components/owner/presentation/presentationFormat';

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

// Slide khusus metrik yang belum punya widget di dashboard biasa: kedisiplinan
// kehadiran & kelengkapan SOAP di level klinik (selama ini cuma dihitung
// per-terapis untuk remunerasi), total piutang outstanding, dan ranking
// terapis berdasarkan jumlah sesi pada periode ini.
const StaffFinanceHealthSlide = ({ data, dateRange }) => {
  const staff = data?.staffQuality;
  const receivables = data?.receivables;
  const sessionsByTherapist = data?.therapistPerformance?.sessionsByTherapist || [];

  return (
    <SlideShell eyebrow="Staff & Financial Health" title="Kualitas Layanan & Kesehatan Finansial" dateRange={dateRange}>
      <div className="h-full flex flex-col gap-5 md:gap-7">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-7 flex flex-col items-center text-center gap-2">
            <ShieldCheck className="h-7 w-7 text-emerald-300" />
            <p className="text-4xl md:text-6xl font-black text-white">{staff?.attendanceRate ?? 100}%</p>
            <p className="text-slate-300 text-sm font-semibold">Kedisiplinan Kehadiran Terapis</p>
            <p className="text-slate-400 text-xs">Rata-rata seluruh terapis aktif klinik</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-7 flex flex-col items-center text-center gap-2">
            <ClipboardCheck className="h-7 w-7 text-sky-300" />
            <p className="text-4xl md:text-6xl font-black text-white">{staff?.soapCompletenessRate ?? 100}%</p>
            <p className="text-slate-300 text-sm font-semibold">Kelengkapan Dokumentasi SOAP</p>
            <p className="text-slate-400 text-xs">Rata-rata seluruh terapis aktif klinik</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          <StatTile icon={Users} label="Jumlah Terapis Aktif" value={staff?.therapistCount ?? 0} accent="violet" />
          <StatTile
            icon={Receipt}
            label="Total Piutang Outstanding"
            value={formatShortCurrency(receivables?.total)}
            sublabel={receivables ? `${receivables.count} tagihan belum lunas` : ''}
            accent="rose"
            className="col-span-2 md:col-span-1"
          />
        </div>

        <div className="flex-1 min-h-[160px] rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6 flex flex-col">
          <div className="flex items-center gap-2 text-amber-300 mb-3">
            <Trophy className="h-4 w-4" />
            <p className="font-bold text-sm md:text-base text-white">Ranking Terapis (Jumlah Sesi)</p>
          </div>
          {sessionsByTherapist.length === 0 ? (
            <p className="text-slate-400 text-sm">Belum ada data pada periode ini.</p>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {sessionsByTherapist.map((t, idx) => (
                <div key={t.name} className="flex items-center justify-between gap-3 bg-white/5 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm w-6 text-center shrink-0">{RANK_MEDALS[idx] || `#${idx + 1}`}</span>
                    <span className="text-slate-200 text-sm truncate">{t.name}</span>
                  </div>
                  <span className="text-white font-bold text-sm shrink-0">{t.sessions} sesi</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SlideShell>
  );
};

export default StaffFinanceHealthSlide;
