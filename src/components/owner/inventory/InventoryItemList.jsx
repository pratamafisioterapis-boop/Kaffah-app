import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, PackagePlus, Boxes, AlertTriangle, Search, ChevronLeft, ChevronRight, X, ArrowUpDown } from 'lucide-react';
import { deleteInventoryItem } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const PAGE_SIZE = 8;

const SORT_OPTIONS = [
  { value: 'name', label: 'Nama Barang (A-Z)' },
  { value: 'latest', label: 'Input Barang Terbaru' },
];

const InventoryItemList = ({ items = [], onRefresh, onRestock, onViewHistory }) => {
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('name');

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

  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
  };

  const handleSortChange = (value) => {
    setSortBy(value);
    setPage(1);
  };

  const filteredItems = items
    .filter(item => (item.item_name || '').toLowerCase().includes(search.trim().toLowerCase()))
    .slice()
    .sort((a, b) => {
      if (sortBy === 'latest') {
        const aTime = new Date(a.created_at || 0).getTime();
        const bTime = new Date(b.created_at || 0).getTime();
        return bTime - aTime;
      }
      const aEmpty = Number(a.current_stock) <= 0;
      const bEmpty = Number(b.current_stock) <= 0;
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
      return (a.item_name || '').localeCompare(b.item_name || '', 'id-ID');
    });
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white">
      {items.length > 0 && (
        <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Cari nama barang..."
              className="pl-9 pr-9 h-9 text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="relative sm:w-56">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="w-full h-9 pl-8 pr-3 rounded-md border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
          <div className="bg-slate-100 p-4 rounded-full mb-3"><Boxes className="w-8 h-8 text-slate-400" /></div>
          <h3 className="text-lg font-medium text-slate-900">Belum ada barang di gudang</h3>
          <p className="text-slate-500 max-w-sm mt-1">Tambahkan barang baru melalui formulir di samping.</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
          <div className="bg-slate-100 p-4 rounded-full mb-3"><Search className="w-8 h-8 text-slate-400" /></div>
          <h3 className="text-lg font-medium text-slate-900">Barang tidak ditemukan</h3>
          <p className="text-slate-500 max-w-sm mt-1">Coba kata kunci lain.</p>
        </div>
      ) : (
        <>
          {/* Mobile / PWA: kartu, tanpa geser horizontal */}
          <div className="sm:hidden divide-y divide-slate-100">
            {pageItems.map(item => {
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
                {pageItems.map(item => {
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-500">
                Halaman {currentPage} dari {totalPages} <span className="text-slate-400">({filteredItems.length} barang)</span>
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-slate-200"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-slate-200"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InventoryItemList;