import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { getActiveTherapistTarget, getTherapistTargetProgress } from '@/lib/api';

const CIRC = 238.76; // keliling lingkaran r=38

// Kartu "Target bulan ini" berbentuk cincin. Sumber data sama dengan kartu Target di Ringkasan Aktivitas
// (target aktif terapis + progres kunjungan dari getTherapistTargetProgress).
const TherapistTargetRing = ({ therapist }) => {
  const [info, setInfo] = useState(null); // { target, actual, pct, start, end }

  useEffect(() => {
    if (!therapist?.id) return undefined;
    let alive = true;
    (async () => {
      try {
        const active = (await getActiveTherapistTarget(therapist.id))?.data;
        const progress = active
          ? (await getTherapistTargetProgress(therapist.id, active.start_date, active.end_date))?.data
          : null;
        if (!alive) return;
        setInfo(progress
          ? { target: progress.target_visits || 0, actual: progress.actual_visits || 0, pct: progress.achievement_percentage || 0, end: progress.end_date }
          : { target: 0, actual: 0, pct: 0, end: null });
      } catch (e) {
        console.error('[TherapistTargetRing]', e);
        if (alive) setInfo({ target: 0, actual: 0, pct: 0, end: null });
      }
    })();
    return () => { alive = false; };
  }, [therapist?.id]);

  const pct = Math.round(Math.min(info?.pct || 0, 100));
  const remaining = info ? Math.max(info.target - info.actual, 0) : 0;
  const periodLabel = info?.end ? format(new Date(`${info.end}T00:00:00`), 'MMM yyyy', { locale: idLocale }) : format(new Date(), 'MMM yyyy', { locale: idLocale });

  return (
    <section className="flex flex-col rounded-[18px] border border-app-border bg-white p-4 lg:p-5">
      <div className="mb-3 flex items-center justify-between gap-2.5">
        <h3 className="text-[17px] font-extrabold text-app-ink">Target bulan ini</h3>
        <span className="rounded-full bg-app-soft px-2.5 py-[3px] text-[12.5px] font-bold text-app-accent">{periodLabel}</span>
      </div>
      <div className="my-auto flex items-center gap-4">
        <svg className="h-24 w-24 shrink-0 lg:h-[76px] lg:w-[76px] xl:h-24 xl:w-24" viewBox="0 0 100 100" role="img" aria-label={`${pct} persen`}>
          <circle cx="50" cy="50" r="38" fill="none" strokeWidth="9" className="stroke-app-soft" />
          <motion.circle
            cx="50" cy="50" r="38" fill="none" strokeWidth="9" strokeLinecap="round" className="stroke-app-accent"
            style={{ rotate: -90, transformOrigin: '50% 50%' }}
            strokeDasharray={CIRC}
            initial={{ strokeDashoffset: CIRC }}
            animate={{ strokeDashoffset: CIRC * (1 - pct / 100) }}
            transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1], delay: 0.2 }}
          />
          <text x="50" y="57" textAnchor="middle" className="tv2-display" style={{ font: '800 21px Manrope, sans-serif', fill: '#10242F' }}>{pct}%</text>
        </svg>
        <div className="min-w-0">
          {info && info.target > 0 ? (
            <>
              <b className="tv2-display block text-[19px] leading-tight text-app-ink">{info.actual} dari {info.target} kunjungan</b>
              <p className="mt-0.5 text-[13.5px] leading-snug text-app-muted">
                {remaining > 0 ? `Tinggal ${remaining} kunjungan lagi sampai akhir periode.` : 'Target periode ini sudah tercapai.'}
              </p>
            </>
          ) : (
            <p className="text-[13.5px] leading-snug text-app-muted">{info ? 'Belum ada target aktif untuk periode ini.' : 'Memuat target...'}</p>
          )}
        </div>
      </div>
    </section>
  );
};

export default TherapistTargetRing;
