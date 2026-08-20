import React, { useState, useEffect, useCallback } from 'react';
import { format, isValid } from 'date-fns';
import { Boxes, CalendarDays } from 'lucide-react';
import { getInventoryStockOuts } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

const getMonthRange = (monthValue) => {
  const [year, month] = monthValue.split('-').map(Number);
  const startDate = `${monthValue}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${monthValue}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
};

const InventoryMonthlyTakeOut = () => {
  const { toast } = useToast();
  const [monthValue, setMonthValue] = useState(() => format(new Date(), 'yyyy-MM'));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { startDate, endDate } = getMonthRange(monthValue);
    const { data, error } = await getInventoryStockOuts({ startDate, endDate });
    if (error) toast({ variant: 'destructive', title: 'Gagal memuat riwayat pengambilan', description: error.message });
    else setRows(data || []);
    setLoading(false);
  }, [monthValue, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatDate = (d) => {
    if (!d) return '-';
    const date = new Date(d);
    return isValid(date) ? format(date, 'dd/MM/yyyy') : '-';
  };

  const total = rows.reduce((acc, row) => acc + Number(row.total_cost || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-slate-500" />
          <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Pilih Bulan:</label>
          <input
            type="month"
            value={monthValue}
            onChange={(e) => setMonthValue(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-white text-sm outline-none"
          />
        </div>
        <div className="text-sm text-slate-600">
          Total Nominal: <span className="font-bold text-rose-600">Rp {total.toLocaleString('id-ID')}</span>
        </div>
      </div>

      <div className="w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Memuat data...</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
            <div className="bg-slate-100 p-4 rounded-full mb-3"><Boxes className="w-8 h-8 text-slate-400" /></div>
            <h3 className="text-lg font-medium text-slate-900">Belum ada pengambilan barang di bulan ini</h3>
          </div>
        ) : (
          <>
            {/* Mobile / PWA: kartu, tanpa geser horizontal */}
            <div className="sm:hidden divide-y divide-slate-100">
              {rows.map(row => (
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
                </div>
              ))}
              <div className="p-4 flex items-center justify-between bg-slate-50">
                <span className="text-sm font-semibold text-slate-700">Total Bulan Ini</span>
                <span className="text-sm font-bold text-rose-600">Rp {total.toLocaleString('id-ID')}</span>
              </div>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 text-slate-600">{formatDate(row.taken_date)}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{row.inventory_items?.item_name || '-'}</td>
                      <td className="px-6 py-4 text-right font-mono text-slate-700">{Number(row.quantity).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {row.unit}</td>
                      <td className="px-6 py-4 text-right font-mono text-rose-600 font-bold">Rp {Number(row.total_cost).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td colSpan={3} className="px-6 py-3.5 text-right font-semibold text-slate-700">Total Nominal Bulan Ini</td>
                    <td className="px-6 py-3.5 text-right font-bold text-rose-600">Rp {total.toLocaleString('id-ID')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InventoryMonthlyTakeOut;
