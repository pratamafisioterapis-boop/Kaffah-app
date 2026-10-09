import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Target, ArrowRight } from 'lucide-react';
import {
  getActivePhysiotherapists,
  getAllTherapistTargets,
  getTherapistTargetProgress,
} from '@/lib/api';
import { getTherapistPeriodRange } from '@/lib/utils';
import { format } from 'date-fns';

// Target periode sebelumnya yang belum tercapai sudah dibuat otomatis oleh
// server (carry_over_unmet_therapist_targets). Untuk terapis yang mencapai
// target, owner yang harus mengisi target periode berjalan: banner ini
// mengingatkan owner saat membuka dashboard.
const TargetFillReminder = () => {
  const [names, setNames] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [targetsRes, therapistsRes] = await Promise.all([
          getAllTherapistTargets(),
          getActivePhysiotherapists(),
        ]);
        const targets = targetsRes?.data || [];
        const therapists = therapistsRes?.data || [];
        const pending = [];

        for (const therapist of therapists) {
          const mine = targets.filter(t => t.therapist_id === therapist.id);
          if (mine.length === 0) continue;
          const { startDate, endDate } = getTherapistPeriodRange(therapist);
          const curStart = format(startDate, 'yyyy-MM-dd');
          const curEnd = format(endDate, 'yyyy-MM-dd');
          if (mine.some(t => t.start_date <= curEnd && t.end_date >= curStart)) continue;

          const previous = mine
            .filter(t => t.end_date < curStart)
            .sort((a, b) => (a.end_date < b.end_date ? 1 : -1))[0];
          if (!previous) continue;

          const { data: progress } = await getTherapistTargetProgress(
            therapist.id, previous.start_date, previous.end_date
          );
          if (progress && progress.target_visits > 0 && progress.actual_visits >= progress.target_visits) {
            pending.push(therapist.name);
          }
        }
        if (!cancelled) setNames(pending);
      } catch (err) {
        console.error('Gagal memeriksa target terapis', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (names.length === 0) return null;

  return (
    <div className="mb-4 rounded-app border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
      <Target className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-emerald-900 text-sm">
          Target periode baru perlu diisi
        </p>
        <p className="text-sm text-emerald-800 mt-0.5">
          {names.join(', ')} mencapai target periode sebelumnya. Silakan isi target periode ini.
        </p>
      </div>
      <Link
        to="/owner/physiotherapist-management?tab=targets"
        className="text-sm font-medium text-emerald-700 hover:underline flex items-center gap-1 shrink-0"
      >
        Isi target <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
};

export default TargetFillReminder;
