import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import MedicalRecordsManagement from '@/components/admin/MedicalRecordsManagement';
import DailyEvaluationReadOnly from '@/components/admin/DailyEvaluationReadOnly';
import { FileText, Stethoscope } from 'lucide-react';

const MedicalRecordsPage = () => {
  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl p-5 md:p-6"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)', boxShadow: '0 8px 32px rgba(15,23,42,0.18)' }}>
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full blur-3xl pointer-events-none" style={{ background: '#3b82f620', transform: 'translate(30%, -40%)' }} />
        <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full blur-2xl pointer-events-none" style={{ background: '#6366f115', transform: 'translate(-30%, 40%)' }} />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}>
            <FileText className="w-5 h-5" style={{ color: '#818cf8' }} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#818cf8' }}>Kaffah Physiotherapy</p>
            <h1 className="text-white text-lg font-bold leading-tight">Medical Records & Evaluation</h1>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>Pusat data rekam medis pasien dan evaluasi SOAP</p>
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