import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getInventoryItems } from '@/lib/api';
import InventoryItemForm from '@/components/owner/inventory/InventoryItemForm';
import InventoryItemList from '@/components/owner/inventory/InventoryItemList';
import InventoryRestockModal from '@/components/owner/inventory/InventoryRestockModal';
import { useToast } from '@/components/ui/use-toast';

const ownerNavItems = [
  { label: 'Dashboard', path: '/owner/dashboard', icon: 'Home' },
  { label: 'Appointments', path: '/owner/appointments', icon: 'Calendar' },
  { label: 'Daily Recaps', path: '/owner/daily-recap', icon: 'FileText' },
  { label: 'Database Patients', path: '/owner/database-patients', icon: 'Database' },
  { label: 'Medical Records', path: '/owner/medical-records', icon: 'Activity' },
  { label: 'Follow Up Management', path: '/owner/follow-up-management', icon: 'ClipboardList' },
  { label: 'Physiotherapist Management', path: '/owner/physiotherapist-management', icon: 'Users' },
  { label: 'Accounting System', path: '/owner/accounting', icon: 'BriefcaseMedical' },
  { label: 'Stok Barang', path: '/owner/inventory', icon: 'Boxes' },
  { label: 'Rekonsiliasi BSI', path: '/owner/bsi-reconciliation', icon: 'FileSearch' },
  { label: 'Setup', path: '/owner/settings', icon: 'Settings' }
];

const InventoryStockPage = () => {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restockTarget, setRestockTarget] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getInventoryItems();
    if (error) toast({ variant: 'destructive', title: 'Gagal memuat data barang', description: error.message });
    else setItems(data || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const totalValue = items.reduce((acc, it) => acc + (Number(it.current_stock) * Number(it.price_per_unit)), 0);

  return (
    <DashboardLayout navItems={ownerNavItems} role="owner" userName="Owner">
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stok Barang Gudang</h1>
          <p className="text-slate-500 mt-1">Kelola barang operasional klinik, kuantitas, satuan, dan harga.</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Total Nilai Stok Gudang</p>
            <p className="text-2xl font-bold text-slate-900">Rp {totalValue.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Jumlah Jenis Barang</p>
            <p className="text-2xl font-bold text-slate-900">{items.length}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1"><div className="sticky top-4"><InventoryItemForm onSuccess={fetchItems} /></div></div>
          <div className="xl:col-span-2">
            {loading ? <div className="text-center py-12 text-slate-400">Memuat data...</div> : (
              <InventoryItemList items={items} onRefresh={fetchItems} onRestock={(item) => setRestockTarget(item)} />
            )}
          </div>
        </div>
      </div>
      <InventoryRestockModal isOpen={!!restockTarget} onClose={() => setRestockTarget(null)} item={restockTarget} onSuccess={fetchItems} />
    </DashboardLayout>
  );
};

export default InventoryStockPage;