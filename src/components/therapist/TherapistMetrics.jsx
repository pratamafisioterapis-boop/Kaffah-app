import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  Target,
  AlertCircle,
  RefreshCw,
  Ban,
  CalendarDays,
  Lightbulb
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getTherapistRecaps, getTherapistTargetProgress, getActiveTherapistTarget } from '@/lib/api';
import { getUnfilledSOAPVisits } from '@/lib/therapistDataUtils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import MissingRecapsCard from '@/components/shared/MissingRecapsCard';

const TherapistMetrics = ({ therapist, userId }) => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    totalPatients: 0,
    todayAppointments: 0,
    monthlyVisitsCalculated: 0,
    monthlyVisitsTotal: 0,
    targetVisits: 0,
    targetVisitsProgress: 0,
    unfilledSoapCount: 0,
    activeTargetPeriod: null,
    excludedTypes: [],
    targetStatus: null
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (therapist?.id && userId) {
      loadMetrics();
    }
  }, [therapist, userId]);

  const loadMetrics = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const now = new Date();
      const startMonth = startOfMonth(now).toISOString().split('T')[0];
      const endMonth = endOfMonth(now).toISOString().split('T')[0];
      const todayISO = now.toISOString().split('T')[0];
console.log('THERAPIST ID:', therapist.id);
console.log('USER ID:', userId);
console.log('START MONTH:', startMonth);
console.log('END MONTH:', endMonth);
      const [
        recapsRes,
        activeTargetRes,
        unfilledRes
      ] = await Promise.all([
        getTherapistRecaps(therapist.id, { startDate: startMonth, endDate: endMonth }),
        getActiveTherapistTarget(userId),
        getUnfilledSOAPVisits(therapist.name, therapist.user_id)
      ]);

      const rawMonthlyRecaps = recapsRes.data || [];
      const unfilledCount = unfilledRes.count || 0;
      
      const allPatientsCount = new Set(rawMonthlyRecaps.map(r => r.patient_id).filter(Boolean)).size;
      const todayRecaps = rawMonthlyRecaps.filter(r => r.recap_date === todayISO);

      let targetInfo = {
         targetVisits: 0,
         monthlyVisitsCalculated: 0,
         progress: 0,
         period: null,
         excluded: [],
         status: null
      };

      if (activeTargetRes.data) {
          const target = activeTargetRes.data;
          const { data: progress } = await getTherapistTargetProgress(userId, target.start_date, target.end_date);
          
          if (progress) {
             targetInfo = {
                 targetVisits: progress.target_visits,
                 monthlyVisitsCalculated: progress.actual_visits,
                 progress: progress.achievement_percentage,
                 period: { start: progress.start_date, end: progress.end_date },
                 excluded: progress.excluded_patient_types || [],
                 status: progress.status
             };
          }
      }

      setMetrics({
        totalPatients: allPatientsCount,
        todayAppointments: todayRecaps.length,
        monthlyVisitsTotal: rawMonthlyRecaps.length, 
        monthlyVisitsCalculated: targetInfo.monthlyVisitsCalculated,
        targetVisits: targetInfo.targetVisits,
        targetVisitsProgress: targetInfo.progress,
        unfilledSoapCount: unfilledCount,
        activeTargetPeriod: targetInfo.period,
        excludedTypes: targetInfo.excluded,
        targetStatus: targetInfo.status
      });

    } catch (error) {
      console.error("Error loading metrics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadMetrics(true);
  };

  return (
    <div className="space-y-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
           <h2 className="text-xl font-bold text-slate-900 tracking-tight">Ringkasan Aktivitas Kamu</h2>
           <p className="text-sm text-slate-500">Semua data otomatis. Fokus kamu tetap ke pasien 💙</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh} 
          disabled={loading || refreshing}
          className="bg-white hover:bg-slate-50 border-slate-200 text-slate-600 shadow-sm"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
          Refresh Data
        </Button>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-3">
         <Lightbulb className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
         <p className="text-sm text-slate-600">
            <strong>Info:</strong> Data di bawah ini diperbarui otomatis dari rekap harian yang Anda isi. Pastikan rekap selalu terisi agar performa tercatat akurat!
         </p>
      </div>

      {/* Top Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Unfilled SOAP Metric */}
        <Card 
          className={cn(
            "border shadow-sm transition-all cursor-pointer hover:shadow-md",
            metrics.unfilledSoapCount > 0 
              ? "bg-red-50/50 border-red-200" 
              : "bg-white border-slate-200"
          )}
          onClick={() => navigate('/therapist/records')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn(
              "text-sm font-medium",
              metrics.unfilledSoapCount > 0 ? "text-red-700" : "text-slate-600"
            )}>
              Belum Diisi SOAP
            </CardTitle>
            <AlertCircle className={cn(
              "h-4 w-4",
              metrics.unfilledSoapCount > 0 ? "text-red-600" : "text-slate-400"
            )} />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1">
              <div className={cn(
                "text-2xl font-bold",
                metrics.unfilledSoapCount > 0 ? "text-red-700" : "text-slate-900"
              )}>
                {metrics.unfilledSoapCount}
              </div>
              <p className={cn(
                "text-xs",
                metrics.unfilledSoapCount > 0 ? "text-red-600/80" : "text-slate-500"
              )}>
                Kunjungan tanpa rekam medis
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Patients Card */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Total Pasien (Bulan Ini)
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{metrics.totalPatients}</div>
            <p className="text-xs text-slate-500">Pasien pernah ditangani</p>
          </CardContent>
        </Card>

        {/* Today's Schedule Card */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Jadwal Hari Ini
            </CardTitle>
            <Calendar className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{metrics.todayAppointments}</div>
            <p className="text-xs text-slate-500">Sesi terapi hari ini</p>
          </CardContent>
        </Card>

        {/* Simplified Target Card (Quick View) */}
        <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-blue-600 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-100">
              Pencapaian Kunjungan
            </CardTitle>
            <Target className="h-4 w-4 text-blue-100" />
          </CardHeader>
          <CardContent>
             <div className="flex items-end justify-between">
                <div>
                   <div className="text-2xl font-bold">
                     {metrics.targetVisitsProgress}%
                   </div>
                   <p className="text-xs text-blue-200 mt-0.5">Progress Kunjungan</p>
                </div>
                <div className="text-right">
                   <div className="text-2xl font-bold">
                     {metrics.monthlyVisitsCalculated}
                   </div>
                   <p className="text-xs text-blue-200 mt-0.5">
                     Terhitung Target
                   </p>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

      <MissingRecapsCard 
         title="My Missing Recaps" 
         therapistId={therapist?.id} 
         role="therapist" 
         className="border-l-blue-500"
      />
    </div>
  );
};

export default TherapistMetrics;