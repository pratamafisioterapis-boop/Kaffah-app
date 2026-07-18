import React from 'react';
import { Boxes, AlertTriangle, CheckCircle2 } from 'lucide-react';

const InventoryStockOverview = ({ items = [] }) => {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 text-center bg-slate-50/50">
          <div className="bg-slate-100 p-4 rounded-full mb-3"><Boxes className="w-8 h-8 text-slate-400" /></div>
          <h3 className="text-lg font-medium text-slate-900">Belum ada barang di gudang</h3>
          <p className="text-slate-500 max-w-sm mt-1">Owner belum menambahkan barang ke stok gudang.</p>
        </div>
      ) : (
        <>
          {/* Mobile / PWA: kartu, tanpa geser horizontal */}
          <div className="sm:hidden divide-y divide-slate-100">
            {items.map(item => {
              const isLow = item.minimum_stock > 0 && item.current_stock <= item.minimum_stock;
              const isEmpty = Number(item.current_stock) <= 0;
              return (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-slate-900 min-w-0 break-words">{item.item_name}</span>
                    <div className="shrink-0">
                      {isEmpty ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                          <AlertTriangle className="w-3 h-3" /> Habis
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                          <AlertTriangle className="w-3 h-3" /> Menipis
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Aman
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Sisa Stok</p>
                      <p className="font-mono text-slate-700">{Number(item.current_stock).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {item.unit}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 uppercase tracking-wide text-[10px] mb-0.5">Harga/Satuan</p>
                      <p className="font-mono text-slate-500">Rp {Number(item.price_per_unit).toLocaleString('id-ID', { maximumFractionDigits: 2 })}</p>
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
                  <th className="px-6 py-3.5 font-semibold text-right">Sisa Stok</th>
                  <th className="px-6 py-3.5 font-semibold text-right">Harga/Satuan</th>
                  <th className="px-6 py-3.5 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(item => {
                  const isLow = item.minimum_stock > 0 && item.current_stock <= item.minimum_stock;
                  const isEmpty = Number(item.current_stock) <= 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-slate-900">{item.item_name}</td>
                      <td className="px-6 py-3.5 text-right font-mono text-slate-700">
                        {Number(item.current_stock).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {item.unit}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-slate-500">
                        Rp {Number(item.price_per_unit).toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        {isEmpty ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                            <AlertTriangle className="w-3 h-3" /> Habis
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                            <AlertTriangle className="w-3 h-3" /> Menipis
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Aman
                          </span>
                        )}
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

export default InventoryStockOverview;