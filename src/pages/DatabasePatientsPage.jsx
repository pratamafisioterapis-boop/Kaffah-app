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
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 md:p-7 shadow-xl">
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 backdrop-blur-sm border border-amber-300/30 flex items-center justify-center shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 md:w-6 md:h-6 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-amber-300/80 text-xs font-semibold uppercase tracking-widest mb-1">{useAuth().clinicName || ''}</p>
              <h1 className="text-lg md:text-2xl font-bold tracking-tight">Database Patients</h1>
              <p className="text-slate-400 text-xs mt-1">Kelola data pasien dan riwayat paket perawatan secara terpusat.</p>
            </div>
          </div>
          {role === 'owner' && (
            <div className="shrink-0 w-full sm:w-auto">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-2 w-full sm:w-auto">
                    <Upload className="w-4 h-4"/> Import Pasien CSV
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <PatientImportCSV onImportSuccess={() => window.location.reload()} />
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
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