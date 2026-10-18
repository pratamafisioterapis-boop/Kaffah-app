import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtClock, pickReminder } from '@/lib/soapReminder';

const LEVEL_STYLE = {
  info: { bar: 'bg-app-soft border-app-border', icon: 'bg-app-accent text-white', fill: 'bg-app-accent', btn: 'bg-app-accent hover:bg-app-accent-hover text-white', sub: 'text-app-muted' },
  warn: { bar: 'bg-amber-50 border-amber-200', icon: 'bg-amber-400 text-amber-950', fill: 'bg-amber-400', btn: 'bg-amber-400 hover:bg-amber-500 text-amber-950', sub: 'text-amber-800' },
  crit: { bar: 'bg-red-50 border-red-200', icon: 'bg-red-600 text-white', fill: 'bg-red-600', btn: 'bg-red-600 hover:bg-red-700 text-white', sub: 'text-red-700 font-semibold' },
};

// Bar pengingat di bawah header dashboard terapis: tampil di semua halaman selama ada sesi
// yang slotnya sedang berjalan (atau sudah lewat) dan SOAP-nya belum diisi. Warna naik
// seiring sisa waktu slot (biru, kuning di 15 menit terakhir, merah di 5 menit terakhir).
const SoapSessionReminder = ({ today }) => {
  const navigate = useNavigate();
  if (!today?.soapActive) return null;
  const reminder = pickReminder(today.sessions, today.now);
  if (!reminder) return null;

  const { session, remainingMin, level, progress } = reminder;
  const style = LEVEL_STYLE[level];
  const firstName = session.name.split(' ')[0];
  const sisa = remainingMin > 0 ? `sisa ${remainingMin} menit` : 'waktu sesi sudah habis';
  const open = () => navigate(session.patientId
    ? `/therapist/records/new/${session.patientId}?date=${today.today}&dailyRecapId=${session.id}`
    : '/therapist/records');

  return (
    <div role="status" className={cn('relative mb-4 flex items-center gap-3 overflow-hidden rounded-app border px-3 py-2.5 sm:px-4', style.bar)}>
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-app-sm', style.icon, level === 'crit' && 'motion-safe:animate-pulse')}>
        <AlertTriangle className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold leading-tight text-app-ink sm:text-sm">Isi SOAP {firstName} sebelum sesi berakhir</p>
        <p className={cn('mt-0.5 text-xs leading-snug', style.sub)}>
          Sesi {fmtClock(session.slot.start)}–{fmtClock(session.slot.end)} · {sisa}
        </p>
      </div>
      <button type="button" onClick={open} className={cn('h-9 shrink-0 rounded-app-sm px-3.5 text-sm font-semibold transition-colors', style.btn)}>
        Isi SOAP
      </button>
      <span className={cn('absolute bottom-0 left-0 h-[3px] transition-[width] duration-500', style.fill)} style={{ width: `${Math.round(progress * 100)}%` }} />
    </div>
  );
};

export default SoapSessionReminder;
