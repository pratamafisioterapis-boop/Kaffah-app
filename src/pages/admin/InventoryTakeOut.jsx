import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getInventoryStockOuts, getInventoryItems } from '@/lib/api';
import InventoryTakeOutForm from '@/components/admin/inventory/InventoryTakeOutForm';
import InventoryTakeOutHistory from '@/components/admin/inventory/InventoryTakeOutHistory';
import InventoryStockOverview from '@/components/admin/inventory/InventoryStockOverview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Boxes, ClipboardList } from 'lucide-react';

const adminNavItems = [
  { label: 'Dashboard', path: '/admin', icon: 'Home' },
  { label: 'Database Patients', path: '/admin/database-patients', icon: 'Database' },
  { label: 'Appointments', path: '/admin/appointments', icon: 'Calendar' },
  { label: 'Medical Records', path: '/admin/medical-records', icon: 'Activity' },
  { label: 'Daily Recaps', path: '/admin/daily-recap', icon: 'FileText' },
  { label: 'Package Recaps', path: '/admin/package-recaps', icon: 'Package' },
  { label: 'Physiotherapist Management', path: '/admin/physiotherapist-management', icon: 'Users' },
  { label: 'Follow Up Management', path: '/admin/follow-up-management', icon: 'ClipboardList' },
  { label: 'Clinical Documents', path: '/admin/clinical-documents', icon: 'FileText' },
  { label: 'Accounting', path: '/admin/accounting', icon: 'DollarSign' },
  { label: 'Ambil Barang Gudang', path: '/admin/inventory-takeout', icon: 'Boxes' },
  { label: 'Check Transaksi', path: '/admin/check-transaksi', icon: 'FileSearch' },
];

const InventoryTakeOutPage = () => {
  const { toast } = useToast();
  const { clinicName } = useAuth();
  const [history, setHistory] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getInventoryStockOuts();
    if (error) toast({ variant: 'destructive', title: 'Gagal memuat riwayat', description: error.message });
    else setHistory(data || []);
    setLoading(false);
  }, [toast]);

  const fetchItems = useCallback(async () => {
    setLoadingItems(true);
    const { data, error } = await getInventoryItems();
    if (error) toast({ variant: 'destructive', title: 'Gagal memuat stok barang', description: error.message });
    else setItems(data || []);
    setLoadingItems(false);
  }, [toast]);

  const refreshAll = useCallback(() => {
    fetchHistory();
    fetchItems();
  }, [fetchHistory, fetchItems]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  return (
    <DashboardLayout navItems={adminNavItems} role="admin" userName="Admin">
      <div className="space-y-6 animate-in fade-in duration-500 pb-12">

        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 md:p-7 shadow-xl">
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="flex-shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-xl bg-indigo-600/80 flex items-center justify-center shadow-lg">
              <Boxes className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div>
              <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-1">{clinicName || 'Kaffah Physiotherapy'}</p>
              <h1 className="text-lg md:text-2xl font-bold tracking-tight">Ambil Barang Gudang</h1>
              <p className="text-slate-400 text-xs mt-1">Setiap pengambilan otomatis mengurangi stok dan tercatat sebagai pengeluaran.</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="ambil" className="w-full space-y-4">
          <TabsList className="grid w-full sm:w-[420px] grid-cols-2 p-1 bg-slate-100 rounded-xl">
            <TabsTrigger
              value="ambil"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"
            >
              <ClipboardList className="w-4 h-4" /> Ambil Barang
            </TabsTrigger>
            <TabsTrigger
              value="stok"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"
            >
              <Boxes className="w-4 h-4" /> Stok Barang
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ambil" className="mt-0 outline-none">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-1"><div className="sticky top-4"><InventoryTakeOutForm onSuccess={refreshAll} /></div></div>
              <div className="xl:col-span-2">
                <h3 className="font-bold text-slate-800 text-lg mb-3">Riwayat Pengambilan</h3>
                {loading ? <div className="text-center py-12 text-slate-400">Memuat data...</div> : <InventoryTakeOutHistory history={history} />}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="stok" className="mt-0 outline-none">
            <h3 className="font-bold text-slate-800 text-lg mb-3">Stok Barang Saat Ini</h3>
            {loadingItems ? (
              <div className="text-center py-12 text-slate-400">Memuat data...</div>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto rounded-2xl">
                <InventoryStockOverview items={items} />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default InventoryTakeOutPage;