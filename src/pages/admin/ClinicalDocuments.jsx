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
  const { clinicName } = useAuth();
  const [activeTab, setActiveTab] = useState("resume-medis");
  const [clinic, setClinic] = useState(null);
  const [resumeRefreshKey, setResumeRefreshKey] = useState(0);
  const [suratRefreshKey, setSuratRefreshKey] = useState(0);

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
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-[18px] sm:rounded-[22px] border border-[#DCE8F2] shadow-sm h-44 sm:h-52 md:h-60 lg:h-72">
          <img
            src="/hero/clinara-clinicaldoc-hero.webp"
            alt="Kaffah Physiotherapy"
            className="absolute inset-0 w-full h-full object-cover object-[38%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 via-50% to-transparent to-80% pointer-events-none" aria-hidden="true" />
          <div className="absolute inset-0 flex flex-col justify-center px-4 sm:px-6 md:px-10 lg:px-14">
            <div className="max-w-[74%] sm:max-w-[62%] md:max-w-sm">
              <p className="text-[#5B6B7D] text-xs sm:text-sm font-medium mb-1">{clinicName || ''}</p>
              <h1
                style={{ fontFamily: "'Caveat', cursive" }}
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#102F52] leading-[0.85]"
              >
                Dokumen<br />
                <span className="text-[#2F8CFF] underline decoration-wavy decoration-2 md:decoration-[3px] underline-offset-4 md:underline-offset-8">
                  Klinis
                </span>
              </h1>
              <p className="text-[#5B6B7D] text-[10px] sm:text-xs md:text-sm mt-1.5 md:mt-3 leading-snug md:leading-relaxed">
                Generate resume medis dan surat keterangan fisioterapi.
              </p>
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