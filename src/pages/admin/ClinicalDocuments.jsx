import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { FileText, ClipboardList } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getClinicDetails } from '@/lib/api';
import ResumeMedisForm from '@/components/admin/clinical-documents/ResumeMedisForm';
import ResumeMedisTemplate from '@/components/admin/clinical-documents/ResumeMedisTemplate';
import SuratKeteranganForm from '@/components/admin/clinical-documents/SuratKeteranganForm';
import SuratKeteranganTemplate from '@/components/admin/clinical-documents/SuratKeteranganTemplate';
import ClinicalDocumentHistory from '@/components/admin/clinical-documents/ClinicalDocumentHistory';

const ClinicalDocuments = () => {
  const [activeTab, setActiveTab] = useState("resume-medis");
  const [clinic, setClinic] = useState(null);
  const [resumeRefreshKey, setResumeRefreshKey] = useState(0);
  const [suratRefreshKey, setSuratRefreshKey] = useState(0);
  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');

  useEffect(() => {
    (async () => {
      const { data } = await getClinicDetails();
      setClinic(data || null);
    })();
  }, []);

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
              <p className={`${isPWA ? 'text-[10px]' : 'text-xs'} font-bold tracking-widest text-indigo-300 uppercase mb-1`}>{useAuth().clinicName || ''}</p>
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
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              <div className="xl:col-span-2">
                <div className="xl:sticky xl:top-4">
                  <ResumeMedisForm onSaved={() => setResumeRefreshKey((k) => k + 1)} />
                </div>
              </div>
              <div className="xl:col-span-3">
                <h3 className="font-bold text-slate-800 text-lg mb-3">Riwayat Resume Medis</h3>
                <ClinicalDocumentHistory
                  documentType="resume_medis"
                  TemplateComponent={ResumeMedisTemplate}
                  previewTitle="Resume Medis"
                  clinic={clinic}
                  refreshKey={resumeRefreshKey}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="surat-keterangan" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              <div className="xl:col-span-2">
                <div className="xl:sticky xl:top-4">
                  <SuratKeteranganForm onSaved={() => setSuratRefreshKey((k) => k + 1)} />
                </div>
              </div>
              <div className="xl:col-span-3">
                <h3 className="font-bold text-slate-800 text-lg mb-3">Riwayat Surat Keterangan</h3>
                <ClinicalDocumentHistory
                  documentType="surat_keterangan"
                  TemplateComponent={SuratKeteranganTemplate}
                  previewTitle="Surat Keterangan Fisioterapi"
                  clinic={clinic}
                  refreshKey={suratRefreshKey}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default ClinicalDocuments;