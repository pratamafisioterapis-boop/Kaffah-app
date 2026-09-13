import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, isValid } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value || 0);

const formatDate = (d) => {
  if (!d) return null;
  const date = new Date(d);
  return isValid(date) ? format(date, 'd MMM yyyy', { locale: idLocale }) : null;
};

// Modal rincian generik dipakai oleh tiap baris item di BEP widget (Fixed
// Cost, Pengeluaran, Transport, Insentif) — bentuk barisnya beda-beda tapi
// semuanya diseragamkan jadi { key, label, sublabel, date, amount } sebelum
// dilempar ke sini supaya tampilannya konsisten.
const BepItemDetailModal = ({ isOpen, onClose, title, icon, iconClassName, periodLabel, totalAmount, rows, emptyText }) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col bg-slate-900 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-100">
            {icon && React.cloneElement(icon, { className: cn('w-5 h-5 shrink-0', iconClassName) })}
            {title}
          </DialogTitle>
          {periodLabel && <p className="text-xs text-slate-400">{periodLabel}</p>}
        </DialogHeader>

        <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
          <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Total</p>
          <p className="text-xl font-bold text-white tabular-nums">{formatCurrency(totalAmount)}</p>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {!rows || rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="bg-white/5 p-3 rounded-full mb-3"><Inbox className="w-6 h-6 text-slate-500" /></div>
              <p className="text-sm text-slate-400">{emptyText || 'Belum ada data.'}</p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {rows.map(row => (
                <div key={row.key} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">{row.label}</p>
                    {row.sublabel && <p className="text-xs text-slate-400 mt-0.5">{row.sublabel}</p>}
                    {row.date && <p className="text-[11px] text-slate-500 mt-0.5">{formatDate(row.date)}</p>}
                  </div>
                  <span className="text-sm font-semibold text-slate-100 tabular-nums shrink-0">{formatCurrency(row.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BepItemDetailModal;
