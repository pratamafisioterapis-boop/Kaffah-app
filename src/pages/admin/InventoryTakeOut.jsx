import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getInventoryStockOuts } from '@/lib/api';
import InventoryTakeOutForm from '@/components/admin/inventory/InventoryTakeOutForm';
import InventoryTakeOutHistory from '@/components/admin/inventory/InventoryTakeOutHistory';
import { useToast } from '@/components/ui/use-toast';

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
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getInventoryStockOuts();
    if (error) toast({ variant: 'destructive', title: 'Gagal memuat riwayat', description: error.message });
    else setHistory(data || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return (
    <DashboardLayout navItems={adminNavItems} role="admin" userName="Admin">
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ambil Barang Gudang</h1>
          <p className="text-slate-500 mt-1">Setiap pengambilan otomatis mengurangi stok dan tercatat sebagai pengeluaran.</p>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1"><div className="sticky top-4"><InventoryTakeOutForm onSuccess={fetchHistory} /></div></div>
          <div className="xl:col-span-2">
            <h3 className="font-bold text-slate-800 text-lg mb-3">Riwayat Pengambilan</h3>
            {loading ? <div className="text-center py-12 text-slate-400">Memuat data...</div> : <InventoryTakeOutHistory history={history} />}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default InventoryTakeOutPage;