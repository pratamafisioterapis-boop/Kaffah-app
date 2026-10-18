import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtClock, pickReminder } from '@/lib/soapReminder';

const LEVEL_STYLE = {
  info: { bar: 'bg-[#E0F0F8] border-[#DCE7EE]', icon: 'bg-[#0B6FA4] text-white', fill: 'bg-[#0B6FA4]', btn: 'bg-[#0B6FA4] hover:brightness-110 text-white', sub: 'text-[#53697A]' },
  warn: { bar: 'bg-[#FDF0D8] border-[#F2A93B]/45', icon: 'bg-[#F2A93B] text-[#3A2504]', fill: 'bg-[#F2A93B]', btn: 'bg-[#F2A93B] hover:brightness-105 text-[#3A2504]', sub: 'text-[#53697A]' },
  crit: { bar: 'bg-[#FBE6E1] border-[#C5432F]/30', icon: 'bg-[#C5432F] text-white', fill: 'bg-[#C5432F]', btn: 'bg-[#C5432F] hover:brightness-110 text-white', sub: 'text-[#C5432F] font-semibold' },
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
    <div role="status" className={cn('relative mb-4 flex items-center gap-[11px] overflow-hidden rounded-[14px] border px-3.5 py-[9px] lg:px-6 lg:py-2.5', style.bar)}>
      <span className={cn('flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]', style.icon, level === 'crit' && 'tv2-nudge')}>
        <AlertTriangle className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold leading-tight text-[#10242F] lg:text-[15px]">Isi SOAP {firstName} sebelum sesi berakhir</p>
        <p className={cn('mt-0.5 text-xs leading-snug', style.sub)}>
          Sesi {fmtClock(session.slot.start)}–{fmtClock(session.slot.end)} · {sisa}
        </p>
      </div>
      <button type="button" onClick={open} className={cn('h-9 shrink-0 rounded-xl px-3.5 text-sm font-bold transition', style.btn)}>
        Isi SOAP
      </button>
      <span className={cn('absolute bottom-0 left-0 h-[3px] transition-[width] duration-500', style.fill)} style={{ width: `${Math.round(progress * 100)}%` }} />
    </div>
  );
};

export default SoapSessionReminder;
