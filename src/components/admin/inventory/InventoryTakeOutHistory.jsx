import React, { useState } from 'react';
import { format, isValid } from 'date-fns';
import { Boxes, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { deleteInventoryStockOut } from '@/lib/api';

const InventoryTakeOutHistory = ({ history = [], onEdit, onRefresh }) => {
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState(null);

  const formatDate = (d) => {
    if (!d) return '-';
    const date = new Date(d);
    return isValid(date) ? format(date, 'dd/MM/yyyy') : '-';
  };

  const handleDelete = async (row) => {
    const itemName = row.inventory_items?.item_name || 'barang ini';
    if (!window.confirm(`Hapus riwayat pengambilan "${itemName}"? Stok akan dikembalikan dan pengeluaran terkait akan dihapus.`)) return;
    setDeletingId(row.id);
    try {
      const { error } = await deleteInventoryStockOut(row.id);
      if (error) throw error;
      toast({ title: 'Riwayat pengambilan dihapus' });
      if (onRefresh) onRefresh();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menghapus', description: err.message });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white">
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
          <div className="bg-slate-100 p-4 rounded-full mb-3"><Boxes className="w-8 h-8 text-slate-400" /></div>
          <h3 className="text-lg font-medium text-slate-900">Belum ada riwayat pengambilan</h3>
        </div>
      ) : (
        <>
          {/* Mobile / PWA: kartu, tanpa geser horizontal */}
          <div className="sm:hidden divide-y divide-slate-100">
            {history.map(row => (
              <div key={row.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-slate-900 min-w-0 flex-1 break-words">{row.inventory_items?.item_name || '-'}</span>
                  <span className="text-xs text-slate-500 shrink-0 whitespace-nowrap">{formatDate(row.taken_date)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Jumlah</p>
                    <p className="font-mono text-slate-700">{Number(row.quantity).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {row.unit}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Nilai (Rp)</p>
                    <p className="font-mono font-bold text-rose-600">Rp {Number(row.total_cost).toLocaleString('id-ID')}</p>
                  </div>
                </div>
                {row.notes && (
                  <div>
                    <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Catatan</p>
                    <p className="text-slate-500 text-xs">{row.notes}</p>
                  </div>
                )}
                <div className="flex items-center justify-end gap-1 pt-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" onClick={() => onEdit && onEdit(row)} title="Edit Riwayat">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" onClick={() => handleDelete(row)} disabled={deletingId === row.id} title="Hapus Riwayat">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: tabel */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100/60 text-slate-500 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Tanggal</th>
                  <th className="px-6 py-3.5 font-semibold">Nama Barang</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Jumlah</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Nilai (Rp)</th>
                  <th className="px-6 py-3.5 font-semibold">Catatan</th>
                  <th className="px-6 py-3.5 font-semibold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 text-slate-600">{formatDate(row.taken_date)}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{row.inventory_items?.item_name || '-'}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-700">{Number(row.quantity).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {row.unit}</td>
                    <td className="px-6 py-4 text-right font-mono text-rose-600 font-bold">Rp {Number(row.total_cost).toLocaleString('id-ID')}</td>
                    <td className="px-6 py-4 text-slate-500">{row.notes || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all hover:scale-105" onClick={() => onEdit && onEdit(row)} title="Edit Riwayat">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all hover:scale-105" onClick={() => handleDelete(row)} disabled={deletingId === row.id} title="Hapus Riwayat">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default InventoryTakeOutHistory;
