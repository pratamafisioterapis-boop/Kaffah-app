import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getInventoryItems } from '@/lib/api';
import InventoryItemForm from '@/components/owner/inventory/InventoryItemForm';
import InventoryItemList from '@/components/owner/inventory/InventoryItemList';
import InventoryRestockModal from '@/components/owner/inventory/InventoryRestockModal';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Boxes, Wallet } from 'lucide-react';

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
  const { clinicName } = useAuth();
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
              <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-1">{clinicName || ''}</p>
              <h1 className="text-lg md:text-2xl font-bold tracking-tight">Stok Barang Gudang</h1>
              <p className="text-slate-400 text-xs mt-1">Kelola barang operasional klinik, kuantitas, satuan, dan harga.</p>
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

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1"><div className="sticky top-4"><InventoryItemForm onSuccess={fetchItems} /></div></div>
          <div className="xl:col-span-2">
            {loading ? (
              <div className="text-center py-12 text-slate-400">Memuat data...</div>
            ) : (
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