import React from 'react';
import { UploadCloud, Image as ImageIcon, Receipt } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TherapistDriveUpload from '@/components/therapist/TherapistDriveUpload';
import TherapistSharedMedia from '@/components/therapist/TherapistSharedMedia';
import TherapistPayrollList from '@/components/therapist/TherapistPayrollList';

const TherapistDocuments = ({ therapist }) => {
  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      <Tabs defaultValue="upload_konten" className="w-full">
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
        </TabsList>

        <div className="mt-6">
          <TabsContent value="upload_konten">
            <TherapistDriveUpload />
          </TabsContent>
          <TabsContent value="sharing_media">
            <TherapistSharedMedia />
          </TabsContent>
          <TabsContent value="payroll">
            <TherapistPayrollList therapist={therapist} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default TherapistDocuments;
