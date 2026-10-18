import React from 'react';
import { Check, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONES = {
  sent: {
    label: 'Terkirim',
    Icon: Check,
    icon: 'text-emerald-600',
    title:
      'Terkirim. Status berdasarkan respons API — bukan konfirmasi pasien menerima. Jika pasien 24 jam terakhir tidak WA klinik, pesan bisa gagal masuk walau status ini hijau.',
  },
  failed: {
    label: 'Gagal dikirim',
    Icon: X,
    icon: 'text-red-600',
    title: 'Gagal dikirim',
  },
  pending: {
    label: 'Belum dikirim',
    Icon: Clock,
    icon: 'text-amber-500',
    title: 'Invoice belum pernah dikirim ke WhatsApp pasien',
  },
};

const getTone = (status) =>
  status === 'gagal' ? TONES.failed : status ? TONES.sent : TONES.pending;

/**
 * Tombol Invoice dengan penanda status pengiriman WhatsApp (ikon kecil
 * di dalam tombol, tanpa teks agar hemat tempat).
 */
export default function InvoiceStatusButton({ recap, onClick, className }) {
  const disabled = parseFloat(recap?.amount || 0) === 0;
  const tone = getTone(recap?.invoice_wa_status);
  const { Icon } = tone;

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
        <span title={tone.title} className="inline-flex">
          <Icon className={cn('h-3.5 w-3.5 shrink-0', tone.icon)} strokeWidth={3} aria-hidden="true" />
          <span className="sr-only">{tone.label}</span>
        </span>
      )}
    </button>
  );
}
