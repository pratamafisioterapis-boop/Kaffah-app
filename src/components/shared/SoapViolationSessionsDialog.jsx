import React from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { INCENTIVE_REASON_LABELS } from '@/lib/soapFirst';

const fmtDate = (v) => {
  try { return format(new Date(`${String(v).slice(0, 10)}T00:00:00`), 'EEE, dd MMM yyyy', { locale: idLocale }); } catch { return v || '-'; }
};
const fmtClock = (v) => {
  if (!v) return '-';
  try { return `${new Date(v).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' })} WITA`; } catch { return '-'; }
};

/** Daftar sesi yang melanggar aturan SOAP: tanggal, jam, pasien, dan diagnosa. */
const SoapViolationSessionsDialog = ({ open, onOpenChange, title, sessions = [] }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{sessions.length} sesi melanggar aturan SOAP</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        {sessions.map((s) => (
          <div key={s.id} className="rounded-xl border bg-white p-3 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{s.patient}</span>
              <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                {INCENTIVE_REASON_LABELS[s.reason] || s.reason}
              </span>
            </div>
            <div className="text-xs text-slate-600">{fmtDate(s.date)} · {fmtClock(s.startAt)}</div>
            <div className="text-xs text-slate-700">
              <span className="text-slate-500">Diagnosa: </span>{s.diagnoses.length ? s.diagnoses.join(', ') : '-'}
            </div>
          </div>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);

export default SoapViolationSessionsDialog;
