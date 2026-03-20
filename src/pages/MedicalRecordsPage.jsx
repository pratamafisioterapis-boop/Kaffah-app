import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import MedicalRecordsManagement from '@/components/admin/MedicalRecordsManagement';
import DailyEvaluationReadOnly from '@/components/admin/DailyEvaluationReadOnly';
import { FileText, Stethoscope } from 'lucide-react';

const MedicalRecordsPage = () => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Medical Records & Evaluation</h1>
        <p className="text-slate-500">Pusat data rekam medis pasien dan evaluasi SOAP.</p>
      </div>

      <Tabs defaultValue="records" className="w-full space-y-6">
        <TabsList className="grid w-full md:w-[500px] grid-cols-2 p-1 bg-slate-100/80 rounded-xl">
          <TabsTrigger 
            value="records" 
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"
          >
            <FileText className="w-4 h-4" /> 
            <span className="truncate">Rekam Medis</span>
          </TabsTrigger>
          <TabsTrigger 
            value="evaluasi-harian" 
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"
          >
            <Stethoscope className="w-4 h-4" /> 
            <span className="truncate">Evaluasi Harian</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Detailed Medical Records Management (Rekam Medis) */}
        <TabsContent value="records" className="mt-0 outline-none">
           <MedicalRecordsManagement />
        </TabsContent>

        {/* Tab 2: Daily Evaluation / SOAP (Evaluasi Harian) */}
        <TabsContent value="evaluasi-harian" className="mt-0 outline-none">
           <DailyEvaluationReadOnly />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MedicalRecordsPage;