import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const PackageSessionDisplay = ({ sessionData, packageName }) => {
  if (!sessionData) return null;

  const {
      sessionUsed = 0,
      totalSessions = 0,
      status = 'aktif',
      packageStartDate,
      packageEndDate,
      extendedUntil
  } = sessionData;

  const displayEndDate = status === 'diperpanjang' && extendedUntil ? extendedUntil : packageEndDate;

  const getStatusColor = (statusStr) => {
    const s = statusStr?.toLowerCase();
    if (s === 'aktif' || s === 'active') return 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200';
    if (s === 'selesai' || s === 'completed') return 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200';
    if (s === 'belum dimulai') return 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200';
    if (s === 'expired' || s === 'kadaluarsa') return 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200';
    if (s === 'diperpanjang') return 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-indigo-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getProgressColor = (used, total) => {
      if (used === 0) return 'bg-slate-300';
      const percentage = total > 0 ? (used / total) * 100 : 0;
      if (percentage >= 100) return 'bg-blue-500'; // Finished
      return 'bg-green-500'; // Active
  };

  const sessionsRemaining = Math.max(0, totalSessions - sessionUsed);
  const progressPercentage = totalSessions > 0 ? Math.min((sessionUsed / totalSessions) * 100, 100) : 0;

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex justify-between items-start">
        <div>
          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
             {packageName || 'Paket Fisioterapi'}
          </h4>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
             <Clock className="w-3 h-3" />
             Tgl Beli: {packageStartDate ? format(new Date(packageStartDate), 'dd MMM yyyy', { locale: id }) : '-'}
          </div>
        </div>
        <Badge className={getStatusColor(status)}>
           {(status || 'Unknown').toUpperCase()}
        </Badge>
      </div>
      
      <CardContent className="p-4 space-y-4">
         {/* Session Counter */}
         <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
               <span className="text-slate-600">Sesi Terpakai</span>
               <span className="text-slate-900 font-bold">{sessionUsed} <span className="text-slate-400 font-normal">/</span> {totalSessions}</span>
            </div>
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-500 ${getProgressColor(sessionUsed, totalSessions)}`} 
                    style={{ width: `${progressPercentage}%` }}
                />
            </div>
         </div>

         {/* Grid Details */}
         <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
               <div className="text-slate-500 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-blue-400" /> Berlaku Hingga
               </div>
               <div className="font-semibold text-slate-700">
                  {displayEndDate ? format(new Date(displayEndDate), 'dd MMM yyyy', { locale: id }) : '-'}
               </div>
            </div>
             <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
               <div className="text-slate-500 mb-1 flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-green-400" /> Sisa Sesi
               </div>
               <div className="font-semibold text-slate-700">
                  {sessionsRemaining}
               </div>
            </div>
         </div>
      </CardContent>
    </Card>
  );
};

export default PackageSessionDisplay;