import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { getTherapistRecaps } from '@/lib/api';
import { format } from 'date-fns';

const TherapistPatientTypeDistribution = ({ therapist }) => {
  const [patientTypeStats, setPatientTypeStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (therapist?.id) loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapist]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const now = new Date();

      // Periode 28-27, sama seperti TherapistMetrics
      let startPeriod, endPeriod;
      if (now.getDate() >= 28) {
        startPeriod = new Date(now.getFullYear(), now.getMonth(), 28);
        endPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 27);
      } else {
        startPeriod = new Date(now.getFullYear(), now.getMonth() - 1, 28);
        endPeriod = new Date(now.getFullYear(), now.getMonth(), 27);
      }
      const startCustom = format(startPeriod, 'yyyy-MM-dd');
      const endCustom = format(endPeriod, 'yyyy-MM-dd');

      const { data } = await getTherapistRecaps(therapist.id, { startDate: startCustom, endDate: endCustom });
      const periodRecaps = data || [];

      const stats = periodRecaps.reduce((acc, item) => {
        const type = item.patient_type || 'LAINNYA';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      setPatientTypeStats(stats);
    } catch (error) {
      console.error('Error loading patient type distribution:', error);
    } finally {
      setLoading(false);
    }
  };

  const total = Object.values(patientTypeStats).reduce((s, v) => s + v, 0);
  const colors = [
    { bar: 'bg-indigo-500', light: 'bg-indigo-50', text: 'text-indigo-600' },
    { bar: 'bg-violet-500', light: 'bg-violet-50', text: 'text-violet-600' },
    { bar: 'bg-blue-500',   light: 'bg-blue-50',   text: 'text-blue-600'   },
    { bar: 'bg-cyan-500',   light: 'bg-cyan-50',   text: 'text-cyan-600'   },
    { bar: 'bg-teal-500',   light: 'bg-teal-50',   text: 'text-teal-600'   },
    { bar: 'bg-emerald-500',light: 'bg-emerald-50',text: 'text-emerald-600' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <h3 className="text-sm font-bold text-slate-700">Distribusi Tipe Pasien</h3>
        </div>
        <span className="text-xs text-slate-400 font-medium">{total} total</span>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-50 mx-5" />

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mb-3 animate-pulse">
            <Users className="w-5 h-5 text-slate-300" />
          </div>
          <p className="text-xs font-medium text-slate-400">Memuat data...</p>
        </div>
      ) : Object.keys(patientTypeStats).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mb-3">
            <Users className="w-5 h-5 text-slate-300" />
          </div>
          <p className="text-xs font-medium text-slate-400">Belum ada data periode ini</p>
        </div>
      ) : (
        <div className="px-5 py-4 space-y-3">
          {Object.entries(patientTypeStats)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count], i) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const color = colors[i % colors.length];
              return (
                <div key={type} className="flex items-center gap-3 group">
                  {/* Color dot */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${color.bar}`} />
                  {/* Label */}
                  <span className="text-xs font-medium text-slate-600 w-24 truncate capitalize">
                    {type.toLowerCase()}
                  </span>
                  {/* Bar */}
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${color.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {/* Count badge */}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color.light} ${color.text} min-w-[2rem] text-center`}>
                    {count}
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default TherapistPatientTypeDistribution;
