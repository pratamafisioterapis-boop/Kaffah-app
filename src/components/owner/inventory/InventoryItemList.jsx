import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, PackagePlus, Boxes, AlertTriangle } from 'lucide-react';
import { deleteInventoryItem } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const InventoryItemList = ({ items = [], onRefresh, onRestock, onViewHistory }) => {
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
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
          <div className="bg-slate-100 p-4 rounded-full mb-3"><Boxes className="w-8 h-8 text-slate-400" /></div>
          <h3 className="text-lg font-medium text-slate-900">Belum ada barang di gudang</h3>
          <p className="text-slate-500 max-w-sm mt-1">Tambahkan barang baru melalui formulir di samping.</p>
        </div>
      ) : (
        <>
          {/* Mobile / PWA: kartu, tanpa geser horizontal */}
          <div className="sm:hidden divide-y divide-slate-100">
            {items.map(item => {
              const isLow = item.minimum_stock > 0 && item.current_stock <= item.minimum_stock;
              const isEmpty = Number(item.current_stock) <= 0;
              return (
                <div
                  key={item.id}
                  className={`p-4 space-y-3 ${onViewHistory ? 'cursor-pointer active:bg-slate-50' : ''}`}
                  onClick={() => onViewHistory && onViewHistory(item)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-medium text-slate-900">{item.item_name}</span>
                      {isEmpty && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 shrink-0">
                          <AlertTriangle className="w-3 h-3" /> Habis
                        </span>
                      )}
                      {!isEmpty && isLow && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                          <AlertTriangle className="w-3 h-3" /> Menipis
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg" onClick={() => onRestock(item)} title="Tambah Stok">
                        <PackagePlus className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" onClick={() => handleDelete(item)} disabled={deletingId === item.id} title="Hapus Barang">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Stok</p>
                      <p className="font-mono text-slate-700">{Number(item.current_stock).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {item.unit}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Harga/Satuan</p>
                      <p className="font-mono text-slate-500">Rp {Number(item.price_per_unit).toLocaleString('id-ID', { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Nilai Stok</p>
                      <p className="font-mono font-bold text-slate-900">Rp {(item.current_stock * item.price_per_unit).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: tabel */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100/60 text-slate-500 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Nama Barang</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Stok</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Harga/Satuan</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Nilai Stok</th>
                  <th className="px-6 py-3.5 font-semibold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(item => {
                  const isLow = item.minimum_stock > 0 && item.current_stock <= item.minimum_stock;
                  const isEmpty = Number(item.current_stock) <= 0;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 transition-colors ${onViewHistory ? 'cursor-pointer' : ''}`}
                      onClick={() => onViewHistory && onViewHistory(item)}
                    >
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.item_name}
                          {isEmpty && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              <AlertTriangle className="w-3 h-3" /> Habis
                            </span>
                          )}
                          {!isEmpty && isLow && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <AlertTriangle className="w-3 h-3" /> Menipis
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-700">{Number(item.current_stock).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {item.unit}</td>
                      <td className="px-6 py-4 text-right font-mono text-slate-500">Rp {Number(item.price_per_unit).toLocaleString('id-ID', { maximumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">Rp {(item.current_stock * item.price_per_unit).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all hover:scale-105" onClick={() => onRestock(item)} title="Tambah Stok">
                            <PackagePlus className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all hover:scale-105" onClick={() => handleDelete(item)} disabled={deletingId === item.id} title="Hapus Barang">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default InventoryItemList;