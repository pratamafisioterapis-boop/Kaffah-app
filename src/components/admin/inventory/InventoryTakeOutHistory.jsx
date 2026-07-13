import React from 'react';
import { format, isValid } from 'date-fns';
import { Boxes } from 'lucide-react';

const InventoryTakeOutHistory = ({ history = [] }) => {
  const formatDate = (d) => {
    if (!d) return '-';
    const date = new Date(d);
    return isValid(date) ? format(date, 'dd/MM/yyyy') : '-';
  };

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
          <div className="bg-slate-100 p-4 rounded-full mb-3"><Boxes className="w-8 h-8 text-slate-400" /></div>
          <h3 className="text-lg font-medium text-slate-900">Belum ada riwayat pengambilan</h3>
        </div>
      ) : (
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
            <tr>
              <th className="px-6 py-3">Tanggal</th>
              <th className="px-6 py-3">Nama Barang</th>
              <th className="px-6 py-3 text-right">Jumlah</th>
              <th className="px-6 py-3 text-right">Nilai (Rp)</th>
              <th className="px-6 py-3">Catatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.map(row => (
              <tr key={row.id} className="hover:bg-slate-50/50">
                <td className="px-6 py-4 text-slate-600">{formatDate(row.taken_date)}</td>
                <td className="px-6 py-4 font-medium text-slate-900">{row.inventory_items?.item_name || '-'}</td>
                <td className="px-6 py-4 text-right font-mono">{Number(row.quantity).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {row.unit}</td>
                <td className="px-6 py-4 text-right font-mono text-rose-600 font-semibold">Rp {Number(row.total_cost).toLocaleString('id-ID')}</td>
                <td className="px-6 py-4 text-slate-500">{row.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default InventoryTakeOutHistory;