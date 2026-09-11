import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getInventoryStockOuts, getInventoryItems } from '@/lib/api';
import InventoryTakeOutForm from '@/components/admin/inventory/InventoryTakeOutForm';
import InventoryTakeOutHistory from '@/components/admin/inventory/InventoryTakeOutHistory';
import InventoryTakeOutEditModal from '@/components/admin/inventory/InventoryTakeOutEditModal';
import InventoryStockOverview from '@/components/admin/inventory/InventoryStockOverview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Boxes, ClipboardList } from 'lucide-react';
import { ADMIN_NAV_ITEMS as adminNavItems } from '@/lib/navItems';

const InventoryTakeOutPage = () => {
  const { toast } = useToast();
  const { clinicName } = useAuth();
  const [history, setHistory] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);
  const [editingRow, setEditingRow] = useState(null);

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
        <div className="relative overflow-hidden rounded-[18px] sm:rounded-[22px] border border-[#DCE8F2] shadow-sm h-44 sm:h-52 md:h-60 lg:h-72">
          <img
            src="/hero/clinara-stock-hero.png"
            alt="Kaffah Physiotherapy"
            className="absolute inset-0 w-full h-full object-cover object-[38%_center]"
          />
          <div className="absolute inset-0 flex flex-col justify-center px-4 sm:px-6 md:px-10 lg:px-14">
            <div className="max-w-[74%] sm:max-w-[62%] md:max-w-sm">
              <p className="text-[#5B6B7D] text-xs sm:text-sm font-medium mb-1">{clinicName || ''}</p>
              <h1
                style={{ fontFamily: "'Caveat', cursive" }}
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#102F52] leading-[0.85]"
              >
                Ambil<br />
                <span className="text-[#2F8CFF] underline decoration-wavy decoration-2 md:decoration-[3px] underline-offset-4 md:underline-offset-8">
                  Barang Gudang
                </span>
              </h1>
              <p className="text-[#5B6B7D] text-[10px] sm:text-xs md:text-sm mt-1.5 md:mt-3 leading-snug md:leading-relaxed">
                Setiap pengambilan otomatis mengurangi stok dan tercatat sebagai pengeluaran.
              </p>
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
              <div className="xl:col-span-1"><div className="sticky top-4"><InventoryTakeOutForm items={items} onSuccess={refreshAll} /></div></div>
              <div className="xl:col-span-2">
                <h3 className="font-bold text-slate-800 text-lg mb-3">Riwayat Pengambilan</h3>
                {loading ? <div className="text-center py-12 text-slate-400">Memuat data...</div> : (
                  <InventoryTakeOutHistory history={history} onEdit={setEditingRow} onRefresh={refreshAll} />
                )}
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

        <InventoryTakeOutEditModal
          isOpen={!!editingRow}
          row={editingRow}
          onClose={() => setEditingRow(null)}
          onSuccess={refreshAll}
        />
      </div>
    </DashboardLayout>
  );
};

export default InventoryTakeOutPage;