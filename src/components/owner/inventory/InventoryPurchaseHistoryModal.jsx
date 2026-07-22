import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getInventoryStockIns } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { format, isValid } from 'date-fns';
import { Loader2, PackagePlus, ShoppingBag } from 'lucide-react';

const formatDate = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  return isValid(date) ? format(date, 'dd MMM yyyy') : '-';
};

const InventoryPurchaseHistoryModal = ({ isOpen, onClose, item }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);

  const fetchHistory = useCallback(async () => {
    if (!item) return;
    setLoading(true);
    const { data, error } = await getInventoryStockIns({ itemId: item.id });
    if (error) toast({ variant: 'destructive', title: 'Gagal memuat riwayat pembelian', description: error.message });
    else setHistory(data || []);
    setLoading(false);
  }, [item, toast]);

  useEffect(() => {
    if (isOpen && item) fetchHistory();
  }, [isOpen, item, fetchHistory]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-600" />
            Riwayat Pembelian: {item?.item_name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-slate-100 p-4 rounded-full mb-3"><PackagePlus className="w-8 h-8 text-slate-400" /></div>
              <h3 className="text-sm font-medium text-slate-900">Belum ada riwayat pembelian</h3>
              <p className="text-slate-500 text-xs mt-1">Riwayat akan muncul setelah stok ditambahkan.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map(row => (
                <div key={row.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">{formatDate(row.purchase_date)}</span>
                    <span className="text-sm font-bold text-slate-900 shrink-0">Rp {Number(row.total_price).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1 text-xs text-slate-500">
                    <span>{Number(row.quantity).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {row.inventory_items?.unit || item?.unit} × Rp {Number(row.unit_price).toLocaleString('id-ID', { maximumFractionDigits: 2 })}</span>
                  </div>
                  {row.notes && <p className="text-xs text-slate-400 mt-1">{row.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InventoryPurchaseHistoryModal;
