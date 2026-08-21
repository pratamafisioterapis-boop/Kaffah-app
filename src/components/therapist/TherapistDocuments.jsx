import React, { useState } from 'react';
import { UploadCloud, Image as ImageIcon, Receipt, ScrollText, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TherapistDriveUpload from '@/components/therapist/TherapistDriveUpload';
import TherapistSharedMedia from '@/components/therapist/TherapistSharedMedia';
import TherapistPayrollList from '@/components/therapist/TherapistPayrollList';
import PayrollAuthGate from '@/components/therapist/PayrollAuthGate';
import TherapistMouList from '@/components/therapist/TherapistMouList';
import MouAuthGate from '@/components/therapist/MouAuthGate';
import TherapistWarningLetterList from '@/components/therapist/TherapistWarningLetterList';

const ACTIVE_TAB_KEY = 'kaffah_therapist_documents_tab';
const VALID_TABS = ['upload_konten', 'sharing_media', 'payroll', 'mou', 'sp'];

// Tab aktif disimpan di sessionStorage supaya saat terapis pindah ke aplikasi
// email untuk mengecek kode OTP lalu kembali, tampilan tetap di tab
// Payroll/MOU (sesi verifikasi OTP-nya sendiri sudah persist di localStorage
// lewat PayrollAuthGate/MouAuthGate) — bukan balik ke tab default.
const getInitialTab = () => {
  const stored = sessionStorage.getItem(ACTIVE_TAB_KEY);
  return VALID_TABS.includes(stored) ? stored : 'upload_konten';
};

const TherapistDocuments = ({ therapist }) => {
  const [activeTab, setActiveTab] = useState(getInitialTab);

  const handleTabChange = (value) => {
    setActiveTab(value);
    sessionStorage.setItem(ACTIVE_TAB_KEY, value);
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <TabsTrigger value="upload_konten" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-xl py-2 px-3 flex gap-1.5 items-center text-xs font-medium">
            <UploadCloud className="w-3.5 h-3.5" /> Upload Konten
          </TabsTrigger>
          <TabsTrigger value="sharing_media" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-xl py-2 px-3 flex gap-1.5 items-center text-xs font-medium">
            <ImageIcon className="w-3.5 h-3.5" /> Sharing Media
          </TabsTrigger>
          <TabsTrigger value="payroll" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-xl py-2 px-3 flex gap-1.5 items-center text-xs font-medium">
            <Receipt className="w-3.5 h-3.5" /> Payroll
          </TabsTrigger>
          <TabsTrigger value="mou" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-xl py-2 px-3 flex gap-1.5 items-center text-xs font-medium">
            <ScrollText className="w-3.5 h-3.5" /> MOU Kemitraan
          </TabsTrigger>
          <TabsTrigger value="sp" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-xl py-2 px-3 flex gap-1.5 items-center text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5" /> Surat Peringatan
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="upload_konten">
            <TherapistDriveUpload />
          </TabsContent>
          <TabsContent value="sharing_media">
            <TherapistSharedMedia therapist={therapist} />
          </TabsContent>
          <TabsContent value="payroll">
            <PayrollAuthGate therapist={therapist}>
              <TherapistPayrollList therapist={therapist} />
            </PayrollAuthGate>
          </TabsContent>
          <TabsContent value="mou">
            <MouAuthGate therapist={therapist}>
              <TherapistMouList />
            </MouAuthGate>
          </TabsContent>
          <TabsContent value="sp">
            <TherapistWarningLetterList therapist={therapist} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default TherapistDocuments;
