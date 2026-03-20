import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Users, Package, Upload, Loader2, AlertTriangle } from 'lucide-react';
import PatientManagement from '@/components/admin/PatientManagement';
import PackageRecap from '@/components/admin/PackageRecap';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import PatientImportCSV from '@/components/admin/PatientImportCSV';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const DatabasePatientsPage = () => {
  const { role, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Memuat data...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Akses Ditolak</AlertTitle>
          <AlertDescription>
            Silakan login untuk mengakses halaman ini.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Database Patients</h1>
          <p className="text-slate-500 mt-1">Kelola data pasien dan riwayat paket perawatan secara terpusat.</p>
        </div>
        
        {role === 'owner' && (
             <Dialog>
                <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 bg-white hover:bg-slate-50">
                        <Upload className="w-4 h-4"/> Import Pasien CSV
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <PatientImportCSV onImportSuccess={() => window.location.reload()} />
                </DialogContent>
             </Dialog>
         )}
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
            <Package className="w-4 h-4" /> Paket
          </TabsTrigger>
        </TabsList>

        <TabsContent value="patients" className="mt-0 outline-none">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <PatientManagement />
          </div>
        </TabsContent>
        
        <TabsContent value="packages" className="mt-0 outline-none">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <PackageRecap />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DatabasePatientsPage;