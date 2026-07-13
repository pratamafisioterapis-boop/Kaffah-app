import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, PackagePlus, Boxes, AlertTriangle } from 'lucide-react';
import { deleteInventoryItem } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const InventoryItemList = ({ items = [], onRefresh, onRestock }) => {
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (item) => {
    if (!window.confirm(`Hapus barang "${item.item_name}" dari daftar? Riwayat pengambilan sebelumnya tidak akan terhapus.`)) return;
    setDeletingId(item.id);
    try {
      const { error } = await deleteInventoryItem(item.id);
      if (error) throw error;
      toast({ title: 'Barang dihapus' });
      if (onRefresh) onRefresh();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menghapus', description: err.message });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
          <div className="bg-slate-100 p-4 rounded-full mb-3"><Boxes className="w-8 h-8 text-slate-400" /></div>
          <h3 className="text-lg font-medium text-slate-900">Belum ada barang di gudang</h3>
          <p className="text-slate-500 max-w-sm mt-1">Tambahkan barang baru melalui formulir di samping.</p>
        </div>
      ) : (
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
            <tr>
              <th className="px-6 py-3">Nama Barang</th>
              <th className="px-6 py-3 text-right">Stok</th>
              <th className="px-6 py-3 text-right">Harga/Satuan</th>
              <th className="px-6 py-3 text-right">Nilai Stok</th>
              <th className="px-6 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(item => {
              const isLow = item.minimum_stock > 0 && item.current_stock <= item.minimum_stock;
              return (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {item.item_name}
                    {isLow && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        <AlertTriangle className="w-3 h-3" /> Stok Menipis
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-mono">{Number(item.current_stock).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {item.unit}</td>
                  <td className="px-6 py-4 text-right font-mono">Rp {Number(item.price_per_unit).toLocaleString('id-ID', { maximumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4 text-right font-mono font-semibold">Rp {(item.current_stock * item.price_per_unit).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" onClick={() => onRestock(item)} title="Tambah Stok">
                        <PackagePlus className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(item)} disabled={deletingId === item.id} title="Hapus Barang">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default InventoryItemList;