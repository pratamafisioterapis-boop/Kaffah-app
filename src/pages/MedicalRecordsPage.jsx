import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import MedicalRecordsManagement from '@/components/admin/MedicalRecordsManagement';
import DailyEvaluationReadOnly from '@/components/admin/DailyEvaluationReadOnly';
import { FileText, Stethoscope } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const MedicalRecordsPage = () => {
  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Hero Banner — desktop & PWA */}
      <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className={`relative flex items-center gap-4 ${isPWA ? 'px-4 py-4' : 'px-5 py-5 sm:px-7 sm:py-6'}`}>
          <div className={`flex-shrink-0 ${isPWA ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl bg-indigo-600/80 flex items-center justify-center shadow-lg`}>
            <FileText className={`${isPWA ? 'w-5 h-5' : 'w-6 h-6'} text-white`} />
          </div>
          <div>
            <p className={`${isPWA ? 'text-[10px]' : 'text-xs'} font-bold tracking-widest text-indigo-300 uppercase mb-1`}>{useAuth().clinicName || ''}</p>
            <h2 className={`${isPWA ? 'text-base' : 'text-lg sm:text-xl'} font-bold text-white leading-tight`}>Medical Records & Evaluation</h2>
            <p className={`${isPWA ? 'text-xs' : 'text-sm'} text-slate-400 mt-0.5`}>Pusat data rekam medis pasien dan evaluasi SOAP</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs defaultValue="records" className="w-full space-y-5">
        <TabsList className="flex gap-1.5 p-1 w-fit rounded-xl h-auto" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
          <TabsTrigger value="records"
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-400">
            <FileText className="w-3.5 h-3.5" />
            Rekam Medis
          </TabsTrigger>
          <TabsTrigger value="evaluasi-harian"
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-400">
            <Stethoscope className="w-3.5 h-3.5" />
            Evaluasi Harian
          </TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-0 outline-none">
          <MedicalRecordsManagement />
        </TabsContent>

        <TabsContent value="evaluasi-harian" className="mt-0 outline-none">
          <DailyEvaluationReadOnly />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MedicalRecordsPage;