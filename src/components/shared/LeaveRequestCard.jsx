import React from 'react';
import { CalendarOff, Repeat, Clock, MessageSquare, Paperclip } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import {
  STATUS_META, leaveTypeLabel, formatLongDate, formatShortDate, leaveScopeLabel,
  hhmm, formatDuration, totalShiftMinutes, attendanceImpactNote,
  isSundayDate, mondayAfter,
} from '@/lib/leaveRequestUtils';

// Ringkasan satu pengajuan izin + jadwal penggantinya. `footer` untuk tombol aksi.
const LeaveRequestCard = ({ request, showTherapist = false, footer = null }) => {
  const openProof = async () => {
    const { data, error } = await supabase.storage.from('leave-proofs').createSignedUrl(request.proof_path, 600);
    if (error || !data?.signedUrl) { window.alert('Gagal membuka surat dokter.'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };
  const status = STATUS_META[request.status] || STATUS_META.pending;
  const work = request.physiotherapists;
  const workShift = work?.work_start_time && work?.work_end_time
    ? `${work.work_shift_name ? `${work.work_shift_name} ` : ''}${hhmm(work.work_start_time)}–${hhmm(work.work_end_time)}`
    : null;
  const shifts = [...(request.replacement_shifts || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {showTherapist && (
              <p className="text-sm font-bold text-slate-900 truncate">{request.therapist_name || 'Terapis'}</p>
            )}
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <CalendarOff className="w-4 h-4 text-orange-500 shrink-0" />
              {formatLongDate(request.leave_date)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {leaveScopeLabel(request)} · {leaveTypeLabel(request.leave_type)}
            </p>
            {workShift && (
              <p className="text-xs text-sky-700 mt-0.5">
                Jam kerja: {workShift}{!request.is_partial && ' (izin seharian)'}
              </p>
            )}
          </div>
          <span className={cn('text-[11px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap', status.className)}>
            {status.label}
          </span>
        </div>

        {request.proof_path && (
          <button type="button" onClick={openProof} className="text-xs text-blue-700 hover:underline flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5" /> Lihat surat dokter
          </button>
        )}

        {request.notes && (
          <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">“{request.notes}”</p>
        )}

        {isSundayDate(request.leave_date) && !request.is_partial && request.status !== 'rejected' && (
          <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            <b>Izin hari Minggu:</b> jatah libur mingguan hari Senin ({formatLongDate(mondayAfter(request.leave_date))}) {request.status === 'approved' ? 'dibatalkan' : 'akan dibatalkan bila disetujui'}, terapis tetap masuk.
          </p>
        )}

        {request.leave_type === 'event' && request.status === 'pending' && showTherapist && (
          <p className="text-xs text-violet-800 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
            Event: tentukan apakah event ini memerlukan jadwal pengganti. Bila diperlukan, tolak pengajuan dengan catatan agar terapis mengajukan kembali beserta jadwal pengganti.
          </p>
        )}

        {request.leave_type === 'organization' && request.status === 'pending' && showTherapist && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Kegiatan organisasi: tentukan apakah kegiatan ini memerlukan jadwal pengganti. Bila diperlukan, tolak pengajuan dengan catatan agar terapis mengajukan kembali beserta jadwal pengganti.
          </p>
        )}

        {shifts.length === 0 ? (
          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">Tanpa jadwal pengganti.</p>
        ) : (
        <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3">
          <p className="text-xs font-semibold text-blue-800 flex items-center gap-1.5 mb-2">
            <Repeat className="w-3.5 h-3.5" />
            Jadwal pengganti · total {formatDuration(totalShiftMinutes(shifts))}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {shifts.map((s, i) => (
              <span key={`${s.date}-${i}`} className="text-xs bg-white border border-blue-100 text-slate-700 rounded-md px-2 py-1">
                <span className="font-semibold">{formatShortDate(s.date)}</span> · {hhmm(s.start_time)}–{hhmm(s.end_time)}
              </span>
            ))}
          </div>
        </div>
        )}

        {shifts.length > 0 && (
          <p className="text-[11px] text-sky-800 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
            {attendanceImpactNote(request.is_partial)}
          </p>
        )}

        {request.status !== 'pending' && (request.review_note || request.reviewed_by_name) && (
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

export default LeaveRequestCard;
