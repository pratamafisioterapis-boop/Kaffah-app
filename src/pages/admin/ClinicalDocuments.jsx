import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { FileText, ClipboardList } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ClinicalDocuments = () => {
  const [activeTab, setActiveTab] = useState("resume-medis");

  return (
    <>
      <Helmet>
        <title>Clinical Documents - Kaffah Admin</title>
        <meta name="description" content="Generate and manage clinical documents like medical resumes and certificates." />
      </Helmet>

      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Clinical Documents</h1>
          <p className="text-slate-500">Generate medical resumes and physiotherapy certificates.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-slate-100 p-1">
            <TabsTrigger 
              value="resume-medis"
              className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all flex items-center gap-2"
            >
              <ClipboardList className="w-4 h-4" />
              Resume Medis
            </TabsTrigger>
            <TabsTrigger 
              value="surat-keterangan"
              className="data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm transition-all flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Surat Keterangan
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="resume-medis" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
            <div className="min-h-[400px] flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-8">
              <div className="p-4 rounded-full bg-blue-50 mb-4">
                <ClipboardList className="w-8 h-8 text-blue-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700">Resume Medis Module</h3>
              <p className="text-slate-500 mt-2 max-w-sm text-center">
                This module will allow you to generate comprehensive medical resumes for patients.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="surat-keterangan" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
            <div className="min-h-[400px] flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-8">
              <div className="p-4 rounded-full bg-emerald-50 mb-4">
                <FileText className="w-8 h-8 text-emerald-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700">Surat Keterangan Fisioterapi</h3>
              <p className="text-slate-500 mt-2 max-w-sm text-center">
                This module will allow you to create official physiotherapy certificates and letters.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default ClinicalDocuments;