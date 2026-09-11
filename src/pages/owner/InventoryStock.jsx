import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getInventoryItems } from '@/lib/api';
import InventoryItemForm from '@/components/owner/inventory/InventoryItemForm';
import InventoryItemList from '@/components/owner/inventory/InventoryItemList';
import InventoryRestockModal from '@/components/owner/inventory/InventoryRestockModal';
import InventoryPurchaseHistoryModal from '@/components/owner/inventory/InventoryPurchaseHistoryModal';
import InventoryItemEditModal from '@/components/owner/inventory/InventoryItemEditModal';
import InventoryMonthlyTakeOut from '@/components/owner/inventory/InventoryMonthlyTakeOut';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { generateInventoryStockPDF } from '@/lib/exportUtils';
import { Boxes, Wallet, Download, ClipboardList } from 'lucide-react';
import { OWNER_NAV_ITEMS as ownerNavItems } from '@/lib/navItems';

const InventoryStockPage = () => {
  const { toast } = useToast();
  const { clinicName } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restockTarget, setRestockTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getInventoryItems();
    if (error) toast({ variant: 'destructive', title: 'Gagal memuat data barang', description: error.message });
    else setItems(data || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const totalValue = items.reduce((acc, it) => acc + (Number(it.current_stock) * Number(it.price_per_unit)), 0);

  const handleExportPDF = () => {
    if (items.length === 0) {
      toast({ variant: 'destructive', title: 'Tidak ada data untuk diekspor' });
      return;
    }
    generateInventoryStockPDF(items, clinicName);
    toast({ title: 'PDF berhasil dibuat' });
  };

  return (
    <DashboardLayout navItems={ownerNavItems} role="owner" userName="Owner">
      <div className="space-y-6 animate-in fade-in duration-500 pb-12">

        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-[18px] sm:rounded-[22px] border border-[#DCE8F2] shadow-sm h-44 sm:h-52 md:h-60 lg:h-72">
          <img
            src="/hero/clinara-stock-hero.webp"
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
                Stok<br />
                <span className="text-[#2F8CFF] underline decoration-wavy decoration-2 md:decoration-[3px] underline-offset-4 md:underline-offset-8">
                  Barang
                </span>
              </h1>
              <p className="text-[#5B6B7D] text-[10px] sm:text-xs md:text-sm mt-1.5 md:mt-3 leading-snug md:leading-relaxed">
                Kelola barang operasional klinik, kuantitas, satuan, dan harga.
              </p>
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Nilai Stok Gudang</p>
              <p className="text-2xl font-bold text-slate-900">Rp {totalValue.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Boxes className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Jumlah Jenis Barang</p>
              <p className="text-2xl font-bold text-slate-900">{items.length}</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="stok" className="w-full space-y-4">
          <TabsList className="grid w-full sm:w-[420px] grid-cols-2 p-1 bg-slate-100 rounded-xl">
            <TabsTrigger
              value="stok"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"
            >
              <Boxes className="w-4 h-4" /> Stok Barang
            </TabsTrigger>
            <TabsTrigger
              value="pengambilan"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 flex items-center gap-2"
            >
              <ClipboardList className="w-4 h-4" /> Pengambilan Bulanan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stok" className="mt-0 outline-none">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-1"><div className="sticky top-4"><InventoryItemForm onSuccess={fetchItems} /></div></div>
              <div className="xl:col-span-2 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-700">Daftar Barang</h2>
                  <Button
                    onClick={handleExportPDF}
                    variant="outline"
                    disabled={loading || items.length === 0}
                    className="h-8 px-3 text-xs border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Export PDF
                  </Button>
                </div>
                {loading ? (
                  <div className="text-center py-12 text-slate-400">Memuat data...</div>
                ) : (
                  <InventoryItemList items={items} onRefresh={fetchItems} onRestock={(item) => setRestockTarget(item)} onViewHistory={(item) => setHistoryTarget(item)} onEdit={(item) => setEditTarget(item)} />
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pengambilan" className="mt-0 outline-none">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Riwayat Pengambilan Barang per Bulan</h2>
            <InventoryMonthlyTakeOut />
          </TabsContent>
        </Tabs>
      </div>

      <InventoryRestockModal isOpen={!!restockTarget} onClose={() => setRestockTarget(null)} item={restockTarget} onSuccess={fetchItems} />
      <InventoryPurchaseHistoryModal isOpen={!!historyTarget} onClose={() => setHistoryTarget(null)} item={historyTarget} />
      <InventoryItemEditModal isOpen={!!editTarget} onClose={() => setEditTarget(null)} item={editTarget} onSuccess={fetchItems} />
    </DashboardLayout>
  );
};

export default InventoryStockPage;