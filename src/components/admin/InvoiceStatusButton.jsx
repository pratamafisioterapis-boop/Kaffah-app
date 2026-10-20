import React from 'react';
import { Check, X, Clock, AlertTriangle, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { invoiceStatusView } from '@/lib/invoiceDelivery';

// Ikon kecil di dalam tombol (tanpa teks agar hemat tempat); arti lengkap ada di tooltip.
const ICONS = {
  green: { Icon: Check, cls: 'text-emerald-600' },
  amber: { Icon: Clock, cls: 'text-amber-500' },
  orange: { Icon: AlertTriangle, cls: 'text-orange-500' },
  red: { Icon: X, cls: 'text-red-600' },
  slate: { Icon: Minus, cls: 'text-slate-400' },
};

/**
 * Tombol Invoice dengan penanda status pengiriman WhatsApp.
 * Hijau hanya bila ada bukti sampai (delivered/read/link dibuka/konfirmasi admin); kuning = menunggu bukti;
 * oranye = menunggu terlalu lama; merah = gagal.
 */
export default function InvoiceStatusButton({ recap, onClick, className }) {
  const disabled = parseFloat(recap?.amount || 0) === 0;
  const view = invoiceStatusView(recap);
  const { Icon, cls } = ICONS[view.color] || ICONS.amber;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 w-full min-w-[84px] items-center justify-center gap-1.5 rounded-md border border-blue-200 bg-white px-2 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white xl:h-9 xl:px-3 xl:text-sm',
        className
      )}
    >
      Invoice
      {!disabled && (
        <span title={`${view.label}. ${view.hint}`} className="inline-flex">
          <Icon className={cn('h-3.5 w-3.5 shrink-0', cls)} strokeWidth={3} aria-hidden="true" />
          <span className="sr-only">{view.label}</span>
        </span>
      )}
    </button>
  );
}
