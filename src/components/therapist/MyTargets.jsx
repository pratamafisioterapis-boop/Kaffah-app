import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getActiveTherapistTarget, getTherapistTargetProgress } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Target, Calendar, Info } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const MyTargets = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [targetData, setTargetData] = useState(null);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Get active target using Auth User ID
      const { data: activeTarget } = await getActiveTherapistTarget(user.id);
      
      if (activeTarget) {
        // 2. Get progress details
        const { data: progress } = await getTherapistTargetProgress(
          user.id, 
          activeTarget.start_date, 
          activeTarget.end_date
        );
        setTargetData(progress);
      } else {
        setTargetData(null);
      }
    } catch (error) {
      console.error("Failed to load targets:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'TERCAPAI': return <Badge className="bg-emerald-500 hover:bg-emerald-600">TERCAPAI</Badge>;
      case 'BELUM TERCAPAI': return <Badge className="bg-amber-500 hover:bg-amber-600">BELUM TERCAPAI</Badge>;
      case 'PERLU EVALUASI': return <Badge className="bg-rose-500 hover:bg-rose-600">PERLU EVALUASI</Badge>;
      default: return <Badge variant="secondary">BELUM DIHITUNG</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="animate-spin text-blue-600 w-8 h-8" />
      </div>
    );
  }

  if (!targetData) {
    return (
      <Card className="border-dashed border-2 bg-slate-50">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <Target className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700">Tidak Ada Target Aktif</h3>
          <p className="text-slate-500 max-w-sm mt-2">
            Anda belum memiliki target kunjungan untuk periode saat ini. Silakan hubungi manajemen klinik untuk pengaturan target.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Target className="w-6 h-6 text-blue-600" /> Target Saya
        </h2>
        <div className="text-sm text-slate-500 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" />
            Target dikelola oleh manajemen klinik
        </div>
      </div>

      <Card>
        <CardHeader className="border-b bg-slate-50/50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
             <div>
                <CardTitle className="text-lg">Periode Target</CardTitle>
                <div className="flex items-center gap-2 text-slate-500 mt-1">
                   <Calendar className="w-4 h-4" />
                   <span>
                      {format(new Date(targetData.start_date), 'dd MMMM yyyy', { locale: idLocale })} 
                      {' - '} 
                      {format(new Date(targetData.end_date), 'dd MMMM yyyy', { locale: idLocale })}
                   </span>
                </div>
             </div>
             {getStatusBadge(targetData.status)}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
             <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold mb-1">Target Kunjungan</p>
                <p className="text-3xl font-bold text-slate-900">{targetData.target_visits}</p>
             </div>
             <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold mb-1">Capaian Saat Ini</p>
                <p className={`text-3xl font-bold ${targetData.achievement_percentage >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
                  {targetData.actual_visits}
                </p>
             </div>
             <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold mb-1">Persentase</p>
                <p className={`text-3xl font-bold ${targetData.achievement_percentage >= 100 ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {targetData.achievement_percentage}%
                </p>
             </div>
          </div>

          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-sm font-medium">
               <span>Progress Pencapaian</span>
               <span>{Math.min(targetData.achievement_percentage, 100)}%</span>
            </div>
            <Progress value={Math.min(targetData.achievement_percentage, 100)} className="h-3" />
          </div>

          {targetData.excluded_patient_types && targetData.excluded_patient_types.length > 0 && (
             <div className="bg-amber-50 border border-amber-100 rounded-md p-4">
                <h4 className="font-semibold text-amber-800 text-sm mb-2">Pengecualian Perhitungan</h4>
                <p className="text-sm text-amber-700 mb-2">
                   Tipe pasien berikut <strong>tidak dihitung</strong> dalam pencapaian target ini:
                </p>
                <div className="flex flex-wrap gap-2">
                   {targetData.excluded_patient_types.map((type, i) => (
                      <Badge key={i} variant="outline" className="bg-white border-amber-200 text-amber-800">
                         {type}
                      </Badge>
                   ))}
                </div>
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyTargets;