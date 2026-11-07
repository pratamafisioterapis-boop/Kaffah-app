import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getInventoryStockIns, deleteInventoryStockIn, getInventoryStockOuts } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { format, isValid } from 'date-fns';
import { Loader2, PackagePlus, ShoppingBag, Pencil, Trash2, ClipboardList } from 'lucide-react';
import InventoryStockInEditModal from './InventoryStockInEditModal';
import { confirmAction } from '@/lib/confirmAction';

const formatDate = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  return isValid(date) ? format(date, 'dd MMM yyyy') : '-';
};

const InventoryPurchaseHistoryModal = ({ isOpen, onClose, item, onItemsChange }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [activeTab, setActiveTab] = useState('pembelian');
  const [loadingOuts, setLoadingOuts] = useState(true);
  const [takeOuts, setTakeOuts] = useState([]);

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

  const fetchTakeOuts = useCallback(async () => {
    if (!item) return;
    setLoadingOuts(true);
    const { data, error } = await getInventoryStockOuts({ itemId: item.id });
    if (error) toast({ variant: 'destructive', title: 'Gagal memuat riwayat pengambilan', description: error.message });
    else setTakeOuts(data || []);
    setLoadingOuts(false);
  }, [item, toast]);

  useEffect(() => {
    if (isOpen && item) {
      setActiveTab('pembelian');
      fetchTakeOuts();
    }
  }, [isOpen, item, fetchTakeOuts]);

  const totalTakeOutQty = takeOuts.reduce((acc, r) => acc + Number(r.quantity || 0), 0);
  const totalTakeOutCost = takeOuts.reduce((acc, r) => acc + Number(r.total_cost || 0), 0);

  const handleDelete = async (row) => {
    if (!await confirmAction(`Hapus riwayat pembelian tanggal ${formatDate(row.purchase_date)}? Stok dan harga rata-rata akan disesuaikan kembali.`)) return;
    setDeletingId(row.id);
    try {
      const { error } = await deleteInventoryStockIn(row.id);
      if (error) throw error;
      toast({ title: 'Riwayat pembelian dihapus' });
      fetchHistory();
      if (onItemsChange) onItemsChange();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menghapus', description: err.message });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-600" />
            Riwayat: {item?.item_name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-app text-sm">
          {[
            { value: 'pembelian', label: 'Pembelian', Icon: ShoppingBag, count: history.length },
            { value: 'pengambilan', label: 'Pengambilan', Icon: ClipboardList, count: takeOuts.length },
          ].map(({ value, label, Icon, count }) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-app-sm font-medium transition-colors ${activeTab === value ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Icon className="w-4 h-4" /> {label} <span className="opacity-60 text-xs">({count})</span>
            </button>
          ))}
        </div>

        {activeTab === 'pengambilan' ? (
          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {loadingOuts ? (
              <div className="flex items-center justify-center py-12 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : takeOuts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-slate-100 p-4 rounded-full mb-3"><ClipboardList className="w-8 h-8 text-slate-500" /></div>
                <h3 className="text-sm font-medium text-slate-900">Belum ada riwayat pengambilan</h3>
                <p className="text-slate-500 text-xs mt-1">Riwayat akan muncul setelah barang diambil.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs bg-slate-50 border border-slate-100 rounded-app-sm px-3 py-2 mb-1">
                  <span className="text-slate-500">Total diambil: <span className="font-mono font-semibold text-slate-700">{totalTakeOutQty.toLocaleString('id-ID', { maximumFractionDigits: 2 })} {item?.unit}</span></span>
                  <span className="font-mono font-bold text-rose-600">Rp {totalTakeOutCost.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {takeOuts.map(row => (
                    <div key={row.id} className="py-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900">{formatDate(row.taken_date)}</span>
                        <span className="text-sm font-bold text-rose-600">Rp {Number(row.total_cost || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {Number(row.quantity).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {row.unit || item?.unit}
                      </p>
                      {row.notes && <p className="text-xs text-slate-500 mt-1">{row.notes}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-slate-100 p-4 rounded-full mb-3"><PackagePlus className="w-8 h-8 text-slate-500" /></div>
              <h3 className="text-sm font-medium text-slate-900">Belum ada riwayat pembelian</h3>
              <p className="text-slate-500 text-xs mt-1">Riwayat akan muncul setelah stok ditambahkan.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map(row => (
                <div key={row.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">{formatDate(row.purchase_date)}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-slate-900">Rp {Number(row.total_price).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-app-accent hover:bg-app-soft rounded-app-sm" onClick={() => setEditingRow(row)} title="Edit Riwayat">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-app-sm" onClick={() => handleDelete(row)} disabled={deletingId === row.id} title="Hapus Riwayat">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1 text-xs text-slate-500">
                    <span>{Number(row.quantity).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {row.inventory_items?.unit || item?.unit} × Rp {Number(row.unit_price).toLocaleString('id-ID', { maximumFractionDigits: 2 })}</span>
                  </div>
                  {row.notes && <p className="text-xs text-slate-500 mt-1">{row.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </DialogContent>

      <InventoryStockInEditModal
        isOpen={!!editingRow}
        onClose={() => setEditingRow(null)}
        row={editingRow}
        item={item}
        onSuccess={() => {
          fetchHistory();
          if (onItemsChange) onItemsChange();
        }}
      />
    </Dialog>
  );
};

export default InventoryPurchaseHistoryModal;
