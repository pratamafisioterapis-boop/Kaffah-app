import React from 'react';
import { Repeat, ArrowRight, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { requestStatusMeta, formatLongDate, hhmm, formatDuration, timeToMinutes } from '@/lib/leaveRequestUtils';

const shiftText = (name, start, end) =>
  start && end ? `${name ? `${name} ` : ''}${hhmm(start)}–${hhmm(end)}` : '—';

// Ringkasan satu pengajuan tukar shift. `footer` untuk tombol aksi.
const ShiftSwapCard = ({ request, showTherapist = false, footer = null }) => {
  const status = requestStatusMeta(request);
  const minutes = timeToMinutes(request.to_end_time) - timeToMinutes(request.to_start_time);

  return (
    <div className="rounded-app border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {showTherapist && (
              <p className="text-sm font-bold text-slate-900 truncate">{request.therapist_name || 'Terapis'}</p>
            )}
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <Repeat className="w-4 h-4 text-app-accent-bright shrink-0" />
              {formatLongDate(request.swap_date)}
            </p>
          </div>
          <span className={cn('text-[11px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap', status.className)}>
            {status.label}
          </span>
        </div>

        <div className="rounded-app-sm bg-app-soft/60 border border-app-accent/15 p-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-600">
            {shiftText(request.from_shift_name, request.from_start_time, request.from_end_time)}
          </span>
          <ArrowRight className="w-4 h-4 text-app-accent" />
          <span className="bg-white border border-app-accent/25 rounded-md px-2 py-1 font-semibold text-slate-800">
            {shiftText(request.to_shift_name, request.to_start_time, request.to_end_time)}
          </span>
          <span className="text-app-accent-hover">({formatDuration(minutes)})</span>
        </div>

        {request.notes && (
          <p className="text-xs text-slate-600 bg-slate-50 rounded-app-sm px-3 py-2">“{request.notes}”</p>
        )}

        {request.revoked_at && (
          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-app-sm px-3 py-2">
            Persetujuan dibatalkan{request.revoked_by_name ? ` oleh ${request.revoked_by_name}` : ''}
            {request.revoke_note ? `: ${request.revoke_note}` : ''}. Jam kerja sudah dikembalikan.
          </p>
        )}

        {request.status !== 'pending' && !request.revoked_at && (request.review_note || request.reviewed_by_name) && (
          <p className="text-xs text-slate-500 flex items-start gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              {request.reviewed_by_name ? <b>{request.reviewed_by_name}</b> : 'Peninjau'}
              {request.review_note ? `: ${request.review_note}` : ''}
            </span>
          </p>
        )}
      </div>
      {footer && <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">{footer}</div>}
    </div>
  );
};

export default ShiftSwapCard;
