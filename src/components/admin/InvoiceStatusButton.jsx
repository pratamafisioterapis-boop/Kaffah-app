import React from 'react';
import { Check, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONES = {
  sent: {
    label: 'Terkirim',
    Icon: Check,
    strip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    title:
      'Status berdasarkan respons API — bukan konfirmasi pasien menerima. Jika pasien 24 jam terakhir tidak WA klinik, pesan bisa gagal masuk walau status ini hijau.',
  },
  failed: {
    label: 'Gagal',
    Icon: X,
    strip: 'bg-red-50 text-red-700 border-red-200',
    title: 'Gagal dikirim',
  },
  pending: {
    label: 'Belum Dikirim',
    Icon: Clock,
    strip: 'bg-amber-50 text-amber-700 border-amber-200',
    title: 'Invoice belum pernah dikirim ke WhatsApp pasien',
  },
};

const getTone = (status) =>
  status === 'gagal' ? TONES.failed : status ? TONES.sent : TONES.pending;

/**
 * Tombol Invoice dengan status pengiriman WhatsApp menyatu di bawahnya
 * (satu kontrol, bukan tombol + badge terpisah).
 */
export default function InvoiceStatusButton({ recap, onClick, className }) {
  const disabled = parseFloat(recap?.amount || 0) === 0;
  const tone = getTone(recap?.invoice_wa_status);
  const { Icon } = tone;

  return (
    <div
      className={cn(
        'w-full min-w-[84px] overflow-hidden rounded-md border bg-white transition-colors',
        disabled ? 'border-slate-200 opacity-60' : 'border-blue-200 hover:border-blue-300',
        className
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="flex h-8 w-full items-center justify-center px-2 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent xl:h-9 xl:text-sm"
      >
        Invoice
      </button>
      {!disabled && (
        <div
          title={tone.title}
          className={cn(
            'flex items-center justify-center gap-1 border-t px-2 py-1 text-[11px] font-semibold leading-tight',
            tone.strip
          )}
        >
          <Icon className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />
          <span className="whitespace-nowrap">{tone.label}</span>
        </div>
      )}
    </div>
  );
}
