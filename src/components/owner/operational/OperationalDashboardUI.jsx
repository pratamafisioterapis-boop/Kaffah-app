import React from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Activity, Calendar, Clock, 
  CheckCircle, XCircle, AlertCircle, PlayCircle,
  UserCheck
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

// Skeleton Component
const KPISkeleton = () => (
  <Card className="rounded-xl border-slate-200 shadow-sm bg-white h-full">
    <CardContent className="p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 rounded-lg bg-slate-100 animate-pulse"></div>
        <div className="w-16 h-6 rounded-full bg-slate-100 animate-pulse"></div>
      </div>
      <div>
        <div className="w-24 h-10 bg-slate-200 rounded animate-pulse mb-2"></div>
        <div className="w-32 h-4 bg-slate-100 rounded animate-pulse"></div>
      </div>
    </CardContent>
  </Card>
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
  
  const KPI_DATA = [
    { 
      label: 'Total Sesi', 
      value: totalSessions.toLocaleString('id-ID'), 
      change: 'Period', 
      icon: Activity, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50', 
      trend: 'neutral' 
    },
    { 
      label: 'Total Pasien', 
      value: totalPatients.toLocaleString('id-ID'), 
      change: 'Unique', 
      icon: Users, 
      color: 'text-indigo-600', 
      bg: 'bg-indigo-50', 
      trend: 'neutral' 
    },
    { 
      label: 'Total Paket', 
      value: totalPackages.toLocaleString('id-ID'), 
      change: 'Sessions', 
      icon: Users, 
      color: 'text-purple-600', 
      bg: 'bg-purple-50', 
      trend: 'neutral' 
    },
    { 
      label: 'Sesi Hari Ini', 
      value: todaySessions.toLocaleString('id-ID'), 
      change: 'Today', 
      icon: Calendar, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50', 
      trend: 'neutral' 
    },
    { 
      label: 'Sedang Berjalan', 
      value: ongoingSessions.toLocaleString('id-ID'), 
      change: 'Now', 
      icon: PlayCircle, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50', 
      trend: 'neutral' 
    },
    { 
      label: 'Selesai', 
      value: completedSessions.toLocaleString('id-ID'), 
      change: 'Today', 
      icon: CheckCircle, 
      color: 'text-green-600', 
      bg: 'bg-green-50', 
      trend: 'neutral' 
    },
    { 
      label: 'Dibatalkan', 
      value: cancelledAppointments.toLocaleString('id-ID'), 
      change: 'Today', 
      icon: XCircle, 
      color: 'text-red-600', 
      bg: 'bg-red-50', 
      trend: 'neutral' 
    },
    { 
      label: 'Terapis Aktif', 
      value: activeTherapists.toLocaleString('id-ID'), 
      change: 'Today', 
      icon: UserCheck, 
      color: 'text-cyan-600', 
      bg: 'bg-cyan-50', 
      trend: 'neutral' 
    },
    { 
      label: 'Slot Kosong', 
      value: emptySlots.toLocaleString('id-ID'), 
      change: 'Est.', 
      icon: Clock, 
      color: 'text-orange-600', 
      bg: 'bg-orange-50', 
      trend: 'warning' 
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        {[...Array(9)].map((_, i) => (
          <KPISkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
      {KPI_DATA.map((kpi, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <Card className="rounded-xl border-slate-200 shadow-sm md:shadow-lg hover:shadow-xl transition-all duration-300 bg-white group overflow-hidden relative h-full">
            <div className={`absolute top-0 right-0 p-2 md:p-4 opacity-5 md:opacity-10 group-hover:opacity-20 transition-opacity ${kpi.color}`}>
              <kpi.icon className="w-16 h-16 md:w-24 md:h-24 transform translate-x-2 md:translate-x-4 -translate-y-2 md:-translate-y-4" />
            </div>
            <CardContent className="p-3 md:p-6 relative z-10">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2 md:p-3 rounded-lg ${kpi.bg} ${kpi.color}`}>
                  <kpi.icon className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div className={`hidden md:flex text-xs font-bold px-2.5 py-1 rounded-full items-center gap-1 ${
                  kpi.trend === 'up' ? 'text-green-600 bg-green-50' : 
                  kpi.trend === 'down' ? 'text-red-600 bg-red-50' : 
                  kpi.trend === 'warning' ? 'text-orange-600 bg-orange-50' :
                  'text-slate-600 bg-slate-50'
                }`}>
                  {kpi.change}
                </div>
              </div>
              <div>
                <h3 className="text-2xl md:text-4xl font-extrabold text-slate-900 tracking-tight">{kpi.value}</h3>
                <p className="text-[11px] md:text-sm font-medium text-slate-500 mt-1 leading-tight">
  {kpi.label}
</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

export default OperationalDashboardUI;