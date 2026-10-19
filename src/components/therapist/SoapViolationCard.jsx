import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import SoapViolationSessionsDialog from '@/components/shared/SoapViolationSessionsDialog';
import { useSoapFirstSettings } from '@/hooks/useSoapFirst';
import { fetchSoapViolations, isSoapFirstActiveOn, todayWita } from '@/lib/soapFirst';

/** Jumlah sesi bulan ini yang melanggar aturan SOAP (khusus klinik dengan SOAP-first). */
const SoapViolationCard = ({ therapistId }) => {
  const { settings } = useSoapFirstSettings();
  const [result, setResult] = useState(null);
  const [open, setOpen] = useState(false);
  const active = isSoapFirstActiveOn(settings, todayWita());

  useEffect(() => {
    if (!active || !therapistId) return undefined;
    let cancelled = false;
    const now = new Date();
    fetchSoapViolations({
      startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
      therapistId,
    })
      .then((r) => { if (!cancelled) setResult(r); })
      .catch((e) => console.error('Gagal memuat pelanggaran SOAP', e));
    return () => { cancelled = true; };
  }, [active, therapistId]);

  if (!active || !result) return null;
  const ok = result.total === 0;

  const sessions = result.byTherapist.flatMap((t) => t.sessions);

  return (
    <>
    <div role={ok ? undefined : 'button'} tabIndex={ok ? undefined : 0} onClick={() => !ok && setOpen(true)} onKeyDown={(e) => { if (!ok && e.key === 'Enter') setOpen(true); }} className={`${ok ? '' : 'cursor-pointer'} flex items-center gap-3 rounded-[16px] border p-3.5 ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
        <ShieldAlert className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-bold text-slate-900">
          {ok ? 'Tidak ada pelanggaran SOAP bulan ini' : `${result.total} sesi melanggar aturan SOAP bulan ini`}
        </div>
        <div className="text-xs text-slate-600">
          {ok ? 'Pertahankan, SOAP selalu terisi tepat waktu.' : 'SOAP terlambat atau tidak diisi; insentif sesi tersebut tidak dihitung.'}
        </div>
      </div>
      <div className={`ml-auto text-2xl font-extrabold ${ok ? 'text-emerald-600' : 'text-red-600'}`}>{result.total}</div>
    </div>
    <SoapViolationSessionsDialog open={open} onOpenChange={setOpen} title="Sesi melanggar aturan SOAP" sessions={sessions} />
    </>
  );
};

export default SoapViolationCard;
