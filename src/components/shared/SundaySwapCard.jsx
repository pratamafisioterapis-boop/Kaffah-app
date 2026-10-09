import React from 'react';
import { CalendarClock, ArrowRight, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatLongDate, hhmm } from '@/lib/leaveRequestUtils';

export const SUNDAY_STATUS_META = {
  pending_substitute: { label: 'Menunggu terapis pengganti', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  pending_owner: { label: 'Menunggu owner', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  approved: { label: 'Disetujui', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Ditolak', className: 'bg-red-50 text-red-700 border-red-200' },
};

// Ringkasan satu pengajuan tukar jadwal Minggu. `footer` untuk tombol aksi.
const SundaySwapCard = ({ request, footer = null }) => {
  const status = request.revoked_at
    ? { label: 'Dibatalkan', className: 'bg-slate-100 text-slate-600 border-slate-300' }
    : (SUNDAY_STATUS_META[request.status] || SUNDAY_STATUS_META.pending_substitute);
  const rejectedBySub = request.status === 'rejected' && request.rejected_by === 'substitute';

  return (
    <div className="rounded-app border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4 text-app-accent-bright shrink-0" />
            {formatLongDate(request.swap_date)}
          </p>
          <span className={cn('text-[11px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap', status.className)}>
            {rejectedBySub ? 'Ditolak terapis pengganti' : status.label}
          </span>
        </div>

        <div className="rounded-app-sm bg-app-soft/60 border border-app-accent/15 p-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-600">
            {request.therapist_name || 'Terapis'} (libur)
          </span>
          <ArrowRight className="w-4 h-4 text-app-accent" />
          <span className="bg-white border border-app-accent/25 rounded-md px-2 py-1 font-semibold text-slate-800">
            {request.substitute_name || 'Pengganti'} masuk
          </span>
          <span className="text-app-accent-hover">{hhmm(request.start_time)}–{hhmm(request.end_time)}</span>
        </div>

        <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-app-sm px-3 py-2">
          Jatah libur mingguan setelahnya (Senin / Selasa): <b>{request.therapist_name || 'terapis yang libur'}</b> tidak mendapat jatah libur (tetap masuk), jatahnya diberikan kepada <b>{request.substitute_name || 'terapis pengganti'}</b> di hari yang sama (satu libur per minggu; libur mingguan lain pengganti di minggu itu dipindahkan).
        </p>

        {request.notes && (
          <p className="text-xs text-slate-600 bg-slate-50 rounded-app-sm px-3 py-2">“{request.notes}”</p>
        )}
        {request.substitute_note && (
          <p className="text-xs text-slate-500 flex items-start gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span><b>{request.substitute_name}</b>: {request.substitute_note}</span>
          </p>
        )}
        {request.revoked_at && (
          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-app-sm px-3 py-2">
            Persetujuan dibatalkan{request.revoked_by_name ? ` oleh ${request.revoked_by_name}` : ''}
            {request.revoke_note ? `: ${request.revoke_note}` : ''}. Jadwal sudah dikembalikan.
          </p>
        )}
        {request.reviewed_by_name && !request.revoked_at && (
          <p className="text-xs text-slate-500 flex items-start gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span><b>{request.reviewed_by_name}</b>{request.review_note ? `: ${request.review_note}` : ''}</span>
          </p>
        )}
      </div>
      {footer && <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">{footer}</div>}
    </div>
  );
};

export default SundaySwapCard;
