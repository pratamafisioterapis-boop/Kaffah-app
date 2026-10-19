import React from 'react';
import { Check, Clock, Link2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmtSent = (iso) =>
  iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '';

/**
 * Tombol Portal dengan penanda tautan sudah dikirim (centang hijau) atau belum
 * (jam kuning). Bentuknya sama dengan InvoiceStatusButton agar sejajar.
 */
export function PortalStatusButton({ sentAt, onClick, className }) {
  const sent = !!sentAt;
  const Icon = sent ? Check : Clock;
  const title = sent ? `Tautan portal terkirim ${fmtSent(sentAt)}` : 'Tautan portal belum dikirim';

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'inline-flex h-7 w-full min-w-[84px] items-center justify-center gap-1.5 rounded-md border border-green-200 bg-white px-2 text-xs font-medium text-green-700 transition-colors hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 xl:h-9 xl:px-3 xl:text-sm',
        className
      )}
    >
      <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      Portal
      <Icon
        className={cn('h-3.5 w-3.5 shrink-0', sent ? 'text-emerald-600' : 'text-amber-500')}
        strokeWidth={3}
        aria-hidden="true"
      />
      <span className="sr-only">{sent ? 'Sudah dikirim' : 'Belum dikirim'}</span>
    </button>
  );
}

/** Penanda kecil: SOAP sudah diisi terapis (hijau) atau belum (abu-abu). */
export function SoapMark({ done, className }) {
  return (
    <span
      title={done ? 'SOAP sudah diisi' : 'SOAP belum diisi'}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-xs font-medium leading-tight',
        done ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
        className
      )}
    >
      <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
      SOAP
      {done ? <Check className="h-3 w-3 shrink-0" strokeWidth={3} aria-hidden="true" /> : <Clock className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />}
      <span className="sr-only">{done ? 'sudah diisi' : 'belum diisi'}</span>
    </span>
  );
}
