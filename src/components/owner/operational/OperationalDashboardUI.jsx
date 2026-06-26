import React from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Activity, Calendar, Clock, 
  CheckCircle, XCircle, PlayCircle, UserCheck
} from 'lucide-react';

const isPWA = (() => {
  try {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  } catch { return false; }
})();

// Skeleton
const KPISkeleton = ({ large }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm animate-pulse ${large ? 'p-6' : 'p-4'}`}>
    <div className="flex items-center justify-between mb-4">
      <div className="w-11 h-11 rounded-xl bg-slate-100" />
      <div className="w-14 h-5 rounded-full bg-slate-100" />
    </div>
    <div className={`${large ? 'h-10' : 'h-8'} w-20 bg-slate-200 rounded mb-2`} />
    <div className="h-3 w-28 bg-slate-100 rounded" />
  </div>
);

const OperationalDashboardUI = ({ 
  totalSessions = 0, 
  totalPatients = 0, 
  totalPackages = 0, 
  todaySessions = 0,
  ongoingSessions = 0,
  completedSessions = 0,
  cancelledAppointments = 0,
  activeTherapists = 0,
  emptySlots = 0,
  isLoading = false 
}) => {

  const periodKPIs = [
    { label: 'Total Sesi', value: totalSessions, change: 'Periode', icon: Activity, iconColor: 'text-blue-600', iconBg: 'bg-blue-50', accent: 'border-l-blue-500' },
    { label: 'Total Pasien', value: totalPatients, change: 'Unik', icon: Users, iconColor: 'text-indigo-600', iconBg: 'bg-indigo-50', accent: 'border-l-indigo-500' },
    { label: 'Total Paket', value: totalPackages, change: 'Aktif', icon: Users, iconColor: 'text-violet-600', iconBg: 'bg-violet-50', accent: 'border-l-violet-500' },
  ];

  const todayKPIs = [
    { label: 'Sesi Hari Ini', value: todaySessions, icon: Calendar, iconColor: 'text-emerald-600', iconBg: 'bg-emerald-50', variant: 'normal' },
    { label: 'Sedang Berjalan', value: ongoingSessions, icon: PlayCircle, iconColor: 'text-amber-600', iconBg: 'bg-amber-50', variant: 'normal' },
    { label: 'Selesai', value: completedSessions, icon: CheckCircle, iconColor: 'text-green-600', iconBg: 'bg-green-50', variant: 'normal' },
    { label: 'Dibatalkan', value: cancelledAppointments, icon: XCircle, iconColor: 'text-rose-600', iconBg: 'bg-rose-50', variant: 'danger' },
    { label: 'Terapis Aktif', value: activeTherapists, icon: UserCheck, iconColor: 'text-cyan-600', iconBg: 'bg-cyan-50', variant: 'normal' },
    { label: 'Slot Kosong', value: emptySlots, icon: Clock, iconColor: 'text-orange-600', iconBg: 'bg-orange-50', variant: 'warning' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          {[...Array(3)].map((_, i) => <KPISkeleton key={i} large />)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {[...Array(6)].map((_, i) => <KPISkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Row 1: 3 Period KPIs — lebih besar & premium ── */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {periodKPIs.map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, ease: 'easeOut' }}
            className={`bg-white rounded-2xl border border-slate-100 border-l-4 ${kpi.accent} shadow-sm hover:shadow-lg transition-all duration-300 p-4 md:p-6 flex flex-col gap-3 md:gap-4`}
          >
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${kpi.iconBg} flex items-center justify-center shrink-0`}>
                <kpi.icon className={`w-5 h-5 md:w-6 md:h-6 ${kpi.iconColor}`} />
              </div>
              <span className={`text-[9px] md:text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${kpi.iconBg} ${kpi.iconColor}`}>
                {kpi.change}
              </span>
            </div>
            <div>
              <p className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight leading-none">
                {kpi.value.toLocaleString('id-ID')}
              </p>
              <p className="text-xs md:text-sm font-medium text-slate-400 mt-1.5 leading-tight">{kpi.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Row 2: 6 Today KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {todayKPIs.map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (i + 3) * 0.07, ease: 'easeOut' }}
            className={`rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 p-4 md:p-5 flex items-center gap-3 md:gap-4 ${
              kpi.variant === 'danger'  ? 'bg-rose-50 border-rose-100' :
              kpi.variant === 'warning' ? 'bg-orange-50 border-orange-100' :
              'bg-white border-slate-100'
            }`}
          >
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${kpi.iconBg} flex items-center justify-center shrink-0`}>
              <kpi.icon className={`w-5 h-5 md:w-6 md:h-6 ${kpi.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className={`text-xl md:text-3xl font-black leading-none tracking-tight ${
                kpi.variant === 'danger'  ? 'text-rose-700' :
                kpi.variant === 'warning' ? 'text-orange-700' :
                'text-slate-900'
              }`}>
                {kpi.value.toLocaleString('id-ID')}
              </p>
              <p className={`text-xs md:text-sm font-medium mt-1 truncate ${
                kpi.variant === 'danger'  ? 'text-rose-400' :
                kpi.variant === 'warning' ? 'text-orange-400' :
                'text-slate-400'
              }`}>
                {kpi.label}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

    </div>
  );
};

export default OperationalDashboardUI;