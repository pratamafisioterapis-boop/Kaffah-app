import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Calendar, TrendingUp, Clock, Activity,  DollarSign,
  Briefcase, UserCheck, BarChart2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { 
  getDailyRecaps, 
  getAppointmentSettings, 
  getActivePhysiotherapists,
  getAppointments,
  getAllPackageTrackings 
} from '@/lib/api';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import UnfilledMedicalRecords from '@/components/shared/UnfilledMedicalRecords';
import MissingRecapsCard from '@/components/shared/MissingRecapsCard';

// --- Components ---
const MetricCard = ({ title, value, subtitle, icon: Icon, color, loading, additionalInfo }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden"
  >
    <div className="flex items-start justify-between relative z-10">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        {loading ? (
          <div className="h-8 w-24 bg-slate-100 animate-pulse rounded my-1"></div>
        ) : (
          <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
            {/* Ensure value is a primitive (string/number) before rendering */}
            {typeof value === 'object' ? JSON.stringify(value) : value}
          </h3>
        )}
        <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>
        {additionalInfo && (
          <div className="mt-2 text-xs text-slate-400">{additionalInfo}</div>
        )}
      </div>
      <div className={`p-3 rounded-xl ${color} bg-opacity-10 backdrop-blur-sm`}>
        <Icon className={`w-6 h-6 text-white`} />
      </div>
    </div>
    <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-10 ${color.replace('bg-', 'bg-')}`} />
  </motion.div>
);

const OwnerOperationalMetrics = () => {
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  
  const [loading, setLoading] = useState(true);
  
  // Stats
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalRevenue: 0,
    uniquePatients: 0,
    newPatients: 0,
    oldPatients: 0,
    occupancyRate: 0,
    attendanceRate: 0,
    attended: 0,
    cancelled: 0
  });

  const [packageStats, setPackageStats] = useState([]);
  const [patientStats, setPatientStats] = useState([]);
  const [trendData, setTrendData] = useState([]);

  useEffect(() => {
  fetchData();
}, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Parallel fetches
      const [recapsRes, settingsRes, therapistsRes, appointmentsRes, trackingsRes] = await Promise.all([
        getDailyRecaps({ startDate: dateRange.startDate, endDate: dateRange.endDate }),
        getAppointmentSettings(),
        getActivePhysiotherapists(),
        getAppointments({ startDate: dateRange.startDate, endDate: dateRange.endDate }),
        getAllPackageTrackings()
      ]);

      // Safely extract data arrays
      const recaps = recapsRes?.data || [];
      const totalRecapsCount = recapsRes?.count || recaps.length;
      const appointments = appointmentsRes?.data || [];
      const settings = settingsRes?.data || {};
      const therapists = therapistsRes?.data || [];
      const trackings = trackingsRes?.data || [];

      // Basic Metrics
      const totalRevenue = recaps.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const uniquePatientIds = new Set(recaps.map(r => r.patient_id).filter(Boolean));
      const newPatientsCount = recaps.filter(r => r.patient_type?.toLowerCase().includes('baru')).length;
      const oldPatientsCount = totalRecapsCount - newPatientsCount;

      // Occupancy
      let totalCapacity = 0;
      if (settings && settings.opening_time && settings.closing_time) {
         const open = parseInt(settings.opening_time.split(':')[0]);
         const close = parseInt(settings.closing_time.split(':')[0]);
         const hoursPerDay = Math.max(0, close - open);
         const slotDuration = settings.slot_duration || 60;
         const slotsPerDayPerTherapist = Math.floor((hoursPerDay * 60) / slotDuration);
         const daysInRange = eachDayOfInterval({ start: new Date(dateRange.startDate), end: new Date(dateRange.endDate) }).length;
         totalCapacity = slotsPerDayPerTherapist * therapists.length * daysInRange;
      } else {
         // Fallback if settings are missing or incomplete
         totalCapacity = 8 * (therapists.length || 1) * eachDayOfInterval({ start: new Date(dateRange.startDate), end: new Date(dateRange.endDate) }).length;
      }
      
      const filledSlots = recaps.length;
      const occupancyRate = totalCapacity > 0 ? Math.round((filledSlots / totalCapacity) * 100) : 0;

      // Attendance
      let attendedAppts = appointments.filter(a => ['completed', 'confirmed'].includes(a.status)).length;
      let cancelledAppts = appointments.filter(a => ['cancelled', 'no-show'].includes(a.status)).length;
      if (appointments.length === 0) attendedAppts = recaps.length; // Fallback
      const totalAppts = attendedAppts + cancelledAppts;
      const attendanceRate = totalAppts > 0 ? Math.round((attendedAppts / totalAppts) * 100) : 100;

      // Package Stats
      const pkgStatsArr = [];
      const distinctPkgNames = [...new Set(recaps.map(v => v.package_type).filter(x => x && x !== '-' && x !== ''))];
      distinctPkgNames.forEach(name => {
          const visitsCount = recaps.filter(v => v.package_type === name).length;
          const relevantTrackings = trackings.filter(t => t.package_name && t.package_name.includes(name) && t.status === 'active');
          const totalRemaining = relevantTrackings.reduce((sum, t) => sum + (t.sessions_remaining || 0), 0);
          pkgStatsArr.push({ name: name, visits: visitsCount, remaining: totalRemaining });
      });
      setPackageStats(pkgStatsArr);

      // Patient Distribution
      const patGroups = {};
      recaps.forEach(v => {
         const pid = v.patient_id;
         if (!pid) return;
         if (!patGroups[pid]) patGroups[pid] = { name: v.patient?.full_name || 'Unknown', visits: 0, therapists: new Set() };
         patGroups[pid].visits += 1;
         if (v.therapist_name) patGroups[pid].therapists.add(v.therapist_name);
      });
      const patStatsArr = Object.values(patGroups).map(p => ({
         name: p.name, visits: p.visits, therapist: Array.from(p.therapists).join(', ')
      })).sort((a,b) => b.visits - a.visits).slice(0, 10);
      setPatientStats(patStatsArr);

      // Trend Data
      const groupedByDate = recaps.reduce((acc, curr) => {
        const d = curr.recap_date;
        acc[d] = (acc[d] || 0) + 1;
        return acc;
      }, {});
      const trendChartData = Object.entries(groupedByDate)
        .sort((a, b) => new Date(a[0]) - new Date(b[0]))
        .map(([date, count]) => ({ date, count }));
      setTrendData(trendChartData);

      setStats({
        totalSessions: totalRecapsCount,
        totalRevenue,
        uniquePatients: uniquePatientIds.size,
        newPatients: newPatientsCount,
        oldPatients: oldPatientsCount,
        occupancyRate,
        attendanceRate,
        attended: attendedAppts,
        cancelled: cancelledAppts
      });

    } catch (err) {
      console.error("Error fetching operational metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Operational Dashboard
          </h1>
          <p className="text-slate-500 mt-1">
            Analisis performa klinik, okupansi, dan efisiensi operasional.
          </p>
        </div>
        
        <div className="w-full md:w-auto">
  <div className="grid grid-cols-2 gap-2">
    <Input
      type="date"
      value={dateRange.startDate}
      onChange={(e) =>
        setDateRange(prev => ({
          ...prev,
          startDate: e.target.value
        }))
      }
      className="w-full"
    />

    <Input
      type="date"
      value={dateRange.endDate}
      onChange={(e) =>
        setDateRange(prev => ({
          ...prev,
          endDate: e.target.value
        }))
      }
      className="w-full"
    />
  </div>
</div>
</div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Pendapatan" value={formatCurrency(stats.totalRevenue)} subtitle="Gross Revenue" icon={DollarSign} color="bg-emerald-600" loading={loading} />
        <MetricCard title="Total Sesi Terapi" value={stats.totalSessions} subtitle="Volume Kunjungan" icon={Briefcase} color="bg-blue-600" loading={loading} />
        <MetricCard title="Slot Occupancy" value={`${stats.occupancyRate}%`} subtitle="Tingkat Keterisian" icon={Clock} color="bg-purple-600" loading={loading} />
        <MetricCard title="Attendance Rate" value={`${stats.attendanceRate}%`} subtitle="Kehadiran Pasien" icon={UserCheck} color="bg-orange-600" loading={loading} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <MissingRecapsCard 
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            title="Missing Recaps"
         />
         <UnfilledMedicalRecords />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Trend Chart */}
         <Card className="col-span-1 lg:col-span-2 shadow-sm border-slate-200">
             <CardHeader><CardTitle>Trend Kunjungan Harian</CardTitle></CardHeader>
             <CardContent>
                 <div className="h-48 flex items-end gap-1 overflow-x-auto pb-2 scrollbar-thin">
                     {trendData.length === 0 ? <p className="w-full text-center text-slate-400">No data</p> : 
                        trendData.map((d, i) => (
                           <div key={i} className="flex-1 flex flex-col justify-end items-center group min-w-[20px]">
                               <div className="w-full bg-blue-500 rounded-t-sm hover:bg-blue-600 relative" style={{ height: `${(d.count / Math.max(...trendData.map(x=>x.count))) * 100}%` }}>
                                   <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 z-10 whitespace-nowrap">{d.date}: {d.count}</div>
                               </div>
                           </div>
                        ))
                     }
                 </div>
                 <div className="flex justify-between text-xs text-slate-400 mt-2"><span>{dateRange.startDate}</span><span>{dateRange.endDate}</span></div>
             </CardContent>
         </Card>

         {/* Package Stats */}
         <Card className="shadow-sm border-slate-200">
             <CardHeader><CardTitle>Statistik Paket</CardTitle></CardHeader>
             <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow><TableHead>Nama Paket</TableHead><TableHead>Visits</TableHead><TableHead>Sisa</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                        {packageStats.map((p, i) => (
                           <TableRow key={i}><TableCell>{p.name}</TableCell><TableCell>{p.visits}</TableCell><TableCell>{p.remaining}</TableCell></TableRow>
                        ))}
                    </TableBody>
                 </Table>
             </CardContent>
         </Card>

         {/* Patient Distribution */}
         <Card className="shadow-sm border-slate-200">
             <CardHeader><CardTitle>Distribusi Pasien</CardTitle></CardHeader>
             <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow><TableHead>Pasien</TableHead><TableHead>Total</TableHead><TableHead>Terapis</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                        {patientStats.map((p, i) => (
                           <TableRow key={i}><TableCell>{p.name}</TableCell><TableCell>{p.visits}</TableCell><TableCell className="text-xs">{p.therapist}</TableCell></TableRow>
                        ))}
                    </TableBody>
                 </Table>
             </CardContent>
         </Card>
      </div>
    </div>
  );
};

export default OwnerOperationalMetrics;