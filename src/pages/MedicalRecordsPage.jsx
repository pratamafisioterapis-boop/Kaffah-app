import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import MedicalRecordsManagement from '@/components/admin/MedicalRecordsManagement';
import DailyEvaluationReadOnly from '@/components/admin/DailyEvaluationReadOnly';
import { FileText, Stethoscope } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const MedicalRecordsPage = () => {
  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-[18px] sm:rounded-[22px] border border-[#DCE8F2] shadow-sm h-44 sm:h-52 md:h-60 lg:h-72">
        <img
          src="/hero/clinara-medrec-hero.webp"
          alt="Kaffah Physiotherapy"
          className="absolute inset-0 w-full h-full object-cover object-[38%_center]"
        />
        <div className="absolute inset-0 flex flex-col justify-center px-4 sm:px-6 md:px-10 lg:px-14">
          <div className="max-w-[74%] sm:max-w-[62%] md:max-w-sm">
            <p className="text-[#5B6B7D] text-xs sm:text-sm font-medium mb-1">{useAuth().clinicName || ''}</p>
            <h1
              style={{ fontFamily: "'Caveat', cursive" }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#102F52] leading-[0.85]"
            >
              Rekam<br />
              <span className="text-[#2F8CFF] underline decoration-wavy decoration-2 md:decoration-[3px] underline-offset-4 md:underline-offset-8">
                Medis
              </span>
            </h1>
            <p className="text-[#5B6B7D] text-[10px] sm:text-xs md:text-sm mt-1.5 md:mt-3 leading-snug md:leading-relaxed">
              Pusat data rekam medis pasien dan evaluasi SOAP.
            </p>
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