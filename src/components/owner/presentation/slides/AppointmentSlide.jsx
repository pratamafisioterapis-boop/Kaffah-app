import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { CalendarCheck2, Flame } from 'lucide-react';
import SlideShell from '@/components/owner/presentation/SlideShell';
import StatTile from '@/components/owner/presentation/StatTile';

const STATUS_LABELS = {
  confirmed: 'Terkonfirmasi',
  rescheduled: 'Dijadwal Ulang',
  ongoing: 'Berlangsung',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};
const STATUS_COLORS = {
  confirmed: '#38bdf8',
  rescheduled: '#f59e0b',
  ongoing: '#8b5cf6',
  completed: '#10b981',
  cancelled: '#ef4444',
};

const AppointmentSlide = ({ data, dateRange }) => {
  const appt = data?.appointment || {};
  const statusBreakdown = appt.statusBreakdown || [];

  return (
    <SlideShell eyebrow="Appointment" title="Pola & Kepadatan Appointment" dateRange={dateRange}>
      <div className="h-full flex flex-col gap-5 md:gap-7">
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <StatTile icon={CalendarCheck2} label="Total Appointment" value={appt.totalAppointments ?? 0} accent="sky" />
          <StatTile
            icon={Flame}
            label="Hari Paling Ramai"
            value={appt.busiestDay?.day || '-'}
            sublabel={appt.busiestDay ? `${appt.busiestDay.count} appointment` : ''}
            accent="rose"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 flex-1 min-h-0">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6 flex flex-col">
            <p className="text-white font-bold text-sm md:text-base mb-4">Kepadatan per Hari</p>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={appt.byWeekday || []} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} width={28} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: 'none', background: '#1e293b', color: '#fff' }}
                    formatter={(value) => [value, 'Appointment']}
                  />
                  <Bar dataKey="count" fill="#38bdf8" radius={[6, 6, 0, 0]} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6 flex flex-col">
            <p className="text-white font-bold text-sm md:text-base mb-4">Status Appointment</p>
            <div className="flex-1 min-h-0 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusBreakdown}
                    dataKey="count"
                    nameKey="status"
                    innerRadius="45%"
                    outerRadius="80%"
                    paddingAngle={2}
                    animationDuration={800}
                  >
                    {statusBreakdown.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#64748b'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: 'none', background: '#1e293b', color: '#fff' }}
                    formatter={(value, name) => [value, STATUS_LABELS[name] || name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {statusBreakdown.map((entry) => (
                <div key={entry.status} className="flex items-center gap-1.5 text-[11px] md:text-xs text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[entry.status] || '#64748b' }} />
                  {STATUS_LABELS[entry.status] || entry.status} ({entry.count})
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SlideShell>
  );
};

export default AppointmentSlide;
