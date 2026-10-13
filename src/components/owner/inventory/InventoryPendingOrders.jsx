import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Truck, PackageCheck, XCircle } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { getPendingInventoryOrders, receivePendingInventoryOrder, cancelPendingInventoryOrder } from '@/lib/api';
import { confirmAction } from '@/lib/confirmAction';

const formatDate = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  return isValid(date) ? format(date, 'dd MMM yyyy') : '-';
};

const InventoryPendingOrders = ({ onChanged }) => {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getPendingInventoryOrders();
    if (error) toast({ variant: 'destructive', title: 'Gagal memuat pesanan', description: error.message });
    else setOrders(data || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleReceive = async (order) => {
    const unit = order.inventory_items?.unit || '';
    if (!await confirmAction(`Barang "${order.inventory_items?.item_name}" (${Number(order.quantity)} ${unit}) sudah diterima? Stok gudang akan bertambah.`)) return;
    setBusyId(order.id);
    try {
      const { error } = await receivePendingInventoryOrder(order.id);
      if (error) throw error;
      toast({ title: 'Barang diterima, stok ditambahkan' });
      await fetchOrders();
      if (onChanged) onChanged();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menerima barang', description: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (order) => {
    if (!await confirmAction(`Batalkan pesanan "${order.inventory_items?.item_name}"? Stok tidak akan bertambah.`)) return;
    setBusyId(order.id);
    try {
      const { error } = await cancelPendingInventoryOrder(order.id);
      if (error) throw error;
      toast({ title: 'Pesanan dibatalkan' });
      fetchOrders();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal membatalkan', description: err.message });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="flex justify-center py-12 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="bg-slate-100 p-4 rounded-full mb-3"><Truck className="w-8 h-8 text-slate-500" /></div>
        <h3 className="text-sm font-medium text-slate-900">Tidak ada pesanan yang sedang dikirim</h3>
        <p className="text-xs text-slate-500 mt-1">Centang "Pembelian online" saat Tambah Stok untuk mencatat pesanan yang belum datang.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-app-lg border border-slate-200 divide-y divide-slate-100">
      {orders.map((o) => (
        <div key={o.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{o.inventory_items?.item_name}</p>
            <p className="text-xs text-slate-500">
              {Number(o.quantity).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {o.inventory_items?.unit} · Rp {Number(o.total_price).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-slate-500">
              Dibayar {formatDate(o.paid_date)}{o.expected_date ? ` · Perkiraan tiba ${formatDate(o.expected_date)}` : ''}
            </p>
            {o.notes && <p className="text-xs text-slate-500">{o.notes}</p>}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" disabled={busyId === o.id} onClick={() => handleReceive(o)}>
              <PackageCheck className="w-4 h-4 mr-1.5" /> Barang Diterima
            </Button>
            <Button size="sm" variant="outline" disabled={busyId === o.id} onClick={() => handleCancel(o)} className="text-red-600">
              <XCircle className="w-4 h-4 mr-1.5" /> Batalkan
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default InventoryPendingOrders;
