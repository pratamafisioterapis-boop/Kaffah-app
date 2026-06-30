import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { FileText, ClipboardList } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ClinicalDocuments = () => {
  const [activeTab, setActiveTab] = useState("resume-medis");
  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');

  return (
    <>
      <Helmet>
        <title>Clinical Documents - Kaffah Admin</title>
        <meta name="description" content="Generate and manage clinical documents like medical resumes and certificates." />
      </Helmet>

      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Hero Banner — desktop & PWA */}
        <div className="w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 shadow-xl border border-slate-700/50 relative">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className={`relative flex items-center gap-4 ${isPWA ? 'px-4 py-4' : 'px-5 py-5 sm:px-7 sm:py-6'}`}>
            <div className={`flex-shrink-0 ${isPWA ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl bg-indigo-600/80 flex items-center justify-center shadow-lg`}>
              <FileText className={`${isPWA ? 'w-5 h-5' : 'w-6 h-6'} text-white`} />
            </div>
            <div>
              <p className={`${isPWA ? 'text-[10px]' : 'text-xs'} font-bold tracking-widest text-indigo-300 uppercase mb-1`}>Kaffah Physiotherapy</p>
              <h2 className={`${isPWA ? 'text-base' : 'text-lg sm:text-xl'} font-bold text-white leading-tight`}>Clinical Documents</h2>
              <p className={`${isPWA ? 'text-xs' : 'text-sm'} text-slate-400 mt-0.5`}>Generate resume medis dan surat keterangan fisioterapi</p>
            </div>
          </div>
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