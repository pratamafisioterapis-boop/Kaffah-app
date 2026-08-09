import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Users, Package, CheckCircle2, UserCog, XCircle } from 'lucide-react';
import SlideShell from '@/components/owner/presentation/SlideShell';
import StatTile from '@/components/owner/presentation/StatTile';

const OperationalSlide = ({ data, dateRange }) => {
  const op = data?.operational || {};
  const cancellation = data?.cancellation;

  return (
    <SlideShell eyebrow="Operational" title="Performa Operasional Klinik" dateRange={dateRange}>
      <div className="h-full flex flex-col gap-4 md:gap-6">
        <div className="grid grid-cols-3 gap-2.5 md:gap-4">
          <StatTile icon={Activity} label="Total Sesi" value={op.totalSessions ?? 0} accent="sky" />
          <StatTile icon={Users} label="Total Pasien" value={op.totalPatients ?? 0} accent="violet" />
          <StatTile icon={Package} label="Total Paket" value={op.totalPackages ?? 0} accent="amber" />
          <StatTile icon={CheckCircle2} label="Sesi Selesai (Periode)" value={op.completedSessionsRange ?? 0} accent="emerald" />
          <StatTile icon={UserCog} label="Terapis Aktif" value={op.activeTherapists ?? 0} accent="sky" />
          <StatTile
            icon={XCircle}
            label="Tingkat Pembatalan"
            value={`${cancellation?.rate ?? 0}%`}
            sublabel={cancellation ? `${cancellation.cancelled} dari ${cancellation.totalAppointments} appointment` : ''}
            accent="rose"
          />
        </div>

        <div className="flex-1 min-h-[220px] rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6">
          <p className="text-white font-bold text-sm md:text-base mb-3 md:mb-4">Tren Jumlah Sesi</p>
          <div className="h-[calc(100%-2rem)] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={op.sessionTrend || []} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="opTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} width={28} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: 'none', background: '#1e293b', color: '#fff' }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ''}
                  formatter={(value) => [value, 'Sesi']}
                />
                <Area type="monotone" dataKey="sessions" stroke="#38bdf8" strokeWidth={2.5} fill="url(#opTrendGrad)" animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </SlideShell>
  );
};

export default OperationalSlide;
