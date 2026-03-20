import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Users, Package } from 'lucide-react';
import OwnerPatientManagement from '@/components/owner/OwnerPatientManagement';
import OwnerPackageRecap from '@/components/owner/OwnerPackageRecap';

const OwnerDatabasePatientsPage = () => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Database Patients</h1>
        <p className="text-slate-500 mt-1">Kelola data pasien dan riwayat paket perawatan secara terpusat.</p>
      </div>

      <Tabs defaultValue="patients" className="w-full space-y-6">
        <TabsList className="grid w-full md:w-[400px] grid-cols-2 p-1 bg-slate-100/80 rounded-xl">
          <TabsTrigger 
            value="patients" 
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"
          >
            <Users className="w-4 h-4" /> Pasien
          </TabsTrigger>
          <TabsTrigger 
            value="packages" 
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"
          >
            <Package className="w-4 h-4" /> Riwayat Paket
          </TabsTrigger>
        </TabsList>

        <TabsContent value="patients" className="mt-0 outline-none">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <OwnerPatientManagement />
          </div>
        </TabsContent>
        
        <TabsContent value="packages" className="mt-0 outline-none">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <OwnerPackageRecap />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OwnerDatabasePatientsPage;