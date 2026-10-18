import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { addDays, format, startOfWeek } from 'date-fns';
import { getTherapistRecaps } from '@/lib/api';
import { cn } from '@/lib/utils';

const DAY_LABEL = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

// Kartu "Pasien per hari": jumlah kunjungan terapis pada minggu berjalan (Senin sampai Minggu),
// dari rekap harian yang sama dengan widget lain.
const TherapistWeeklyBars = ({ therapist }) => {
  const [counts, setCounts] = useState(null);
  const week = useMemo(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    return { start: format(monday, 'yyyy-MM-dd'), end: format(addDays(monday, 6), 'yyyy-MM-dd'), keys: Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), 'yyyy-MM-dd')) };
  }, []);

  useEffect(() => {
    if (!therapist?.id) return undefined;
    let alive = true;
    (async () => {
      try {
        const res = await getTherapistRecaps(therapist.id, { startDate: week.start, endDate: week.end });
        const byDay = Object.fromEntries(week.keys.map((k) => [k, 0]));
        (res?.data || []).forEach((r) => { const k = String(r.recap_date).slice(0, 10); if (k in byDay) byDay[k] += 1; });
        if (alive) setCounts(week.keys.map((k) => byDay[k]));
      } catch (e) {
        console.error('[TherapistWeeklyBars]', e);
        if (alive) setCounts(week.keys.map(() => 0));
      }
    })();
    return () => { alive = false; };
  }, [therapist?.id, week]);

  const values = counts || week.keys.map(() => 0);
  // Minggu hanya ditampilkan bila ada kunjungan, seperti jadwal klinik biasa.
  const shown = values.map((v, i) => ({ v, label: DAY_LABEL[i], key: week.keys[i] })).filter((d, i) => i < 6 || d.v > 0);
  const max = Math.max(1, ...shown.map((d) => d.v));
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  return (
    <section className="flex flex-col rounded-[18px] border border-app-border bg-white p-4 lg:p-5">
      <div className="mb-3 flex items-center justify-between gap-2.5">
        <h3 className="text-[17px] font-extrabold text-app-ink">Pasien per hari</h3>
        <small className="text-[13px] text-app-muted">Minggu ini</small>
      </div>
      <div className="mt-5 flex min-h-[104px] flex-1 items-end gap-[9px] pb-[22px]" role="img" aria-label="Jumlah pasien per hari minggu ini">
        {shown.map((d, i) => (
          <motion.div
            key={d.key}
            className={cn('relative min-h-2 flex-1 rounded-t-[9px] rounded-b-[3px] transition-colors', d.key === todayKey ? 'bg-app-accent' : 'bg-app-soft hover:bg-app-accent/30')}
            style={{ height: `${(d.v / max) * 100}%`, transformOrigin: 'bottom' }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1], delay: 0.2 + i * 0.07 }}
          >
            <b className="absolute -top-[19px] inset-x-0 text-center text-[12.5px] tabular-nums text-app-ink">{d.v}</b>
            <span className="absolute -bottom-[21px] inset-x-0 text-center text-xs font-semibold text-app-muted">{d.label}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default TherapistWeeklyBars;
