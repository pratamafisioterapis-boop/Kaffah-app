import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { format, subDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Coins, Loader2 } from 'lucide-react';
import { formatCurrency, getTherapistPeriodRange } from '@/lib/utils';

/**
 * Tips periode sebelumnya. Hanya tampil di HARI PERTAMA periode baru
 * (default tgl 28, mengikuti period_start_day terapis); besoknya hilang.
 * Periode yang dihitung sama dengan payroll: recap_date di dalam periode.
 */
const getPreviousPeriodIfFirstDay = (therapist) => {
  const now = new Date();
  const { startDate: currentStart } = getTherapistPeriodRange(therapist, now);
  if (format(currentStart, 'yyyy-MM-dd') !== format(now, 'yyyy-MM-dd')) return null;

  const { startDate, endDate } = getTherapistPeriodRange(therapist, subDays(currentStart, 1));
  return {
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
    labelStart: format(startDate, 'dd MMM yyyy', { locale: idLocale }),
    labelEnd: format(endDate, 'dd MMM yyyy', { locale: idLocale }),
  };
};

const PreviousPeriodTipsWidget = ({ therapist }) => {
  const period = getPreviousPeriodIfFirstDay(therapist);
  const [loading, setLoading] = useState(true);
  const [tips, setTips] = useState({ total: 0, count: 0 });

  useEffect(() => {
    if (!therapist?.id || !period) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('daily_recaps')
          .select('tips_amount')
          .eq('therapist_id', therapist.id)
          .gte('recap_date', period.startDate)
          .lte('recap_date', period.endDate)
          .gt('tips_amount', 0)
          .limit(5000);
        if (error) throw error;
        if (cancelled) return;
        const rows = data || [];
        setTips({
          total: rows.reduce((s, r) => s + (Number(r.tips_amount) || 0), 0),
          count: rows.length,
        });
      } catch (err) {
        console.error('PreviousPeriodTipsWidget error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapist?.id]);

  if (!period) return null;

  return (
    <div className="bg-white rounded-app-lg border border-app-accent/15 shadow-sm p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-app bg-amber-50 flex items-center justify-center shrink-0">
        <Coins className="w-5 h-5 text-amber-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-700">Tips Periode Sebelumnya</p>
        <p className="text-xs text-slate-500">{period.labelStart} – {period.labelEnd}</p>
      </div>
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-app-accent-bright" />
      ) : (
        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-amber-700">{formatCurrency(tips.total)}</p>
          <p className="text-xs text-slate-500">
            {tips.count > 0 ? `dari ${tips.count} kunjungan` : 'Tidak ada tips'}
          </p>
        </div>
      )}
    </div>
  );
};

export default PreviousPeriodTipsWidget;
