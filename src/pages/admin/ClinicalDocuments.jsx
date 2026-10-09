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
import PageHero from '@/components/shared/PageHero';

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

      <div className="space-y-6 animate-in fade-in duration-200 ease-out">
        {/* Hero Banner */}
        <PageHero image="/hero/clinara-clinicaldoc-hero.webp" title="Dokumen" highlight="Klinis" description="Generate resume medis dan surat keterangan fisioterapi." />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-slate-100 p-1">
            <TabsTrigger 
              value="resume-medis"
              className="data-[state=active]:bg-white data-[state=active]:text-app-accent data-[state=active]:shadow-sm transition-[color,background-color,border-color,box-shadow,transform,opacity] flex items-center gap-2"
            >
              <ClipboardList className="w-4 h-4 shrink-0" />
              Resume Medis
            </TabsTrigger>
            <TabsTrigger 
              value="surat-keterangan"
              className="data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm transition-[color,background-color,border-color,box-shadow,transform,opacity] flex items-center gap-2"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
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