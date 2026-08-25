import React, { useState, useEffect } from 'react';
import { Users, X, CheckCircle2, XCircle } from 'lucide-react';
import { getTherapistRecaps, getTherapistFilledRecapIds } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const TherapistPatientTypeDistribution = ({ therapist }) => {
  const [patientTypeStats, setPatientTypeStats] = useState({});
  const [recapsByType, setRecapsByType] = useState({});
  const [filledRecapIds, setFilledRecapIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(null);

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

      const [{ data }, { data: filledIds }] = await Promise.all([
        getTherapistRecaps(therapist.id, { startDate: startCustom, endDate: endCustom }),
        getTherapistFilledRecapIds(therapist.id, startCustom, endCustom),
      ]);
      const periodRecaps = data || [];

      const stats = {};
      const byType = {};
      periodRecaps.forEach((item) => {
        const type = item.patient_type || 'LAINNYA';
        stats[type] = (stats[type] || 0) + 1;
        if (!byType[type]) byType[type] = [];
        byType[type].push(item);
      });

      setPatientTypeStats(stats);
      setRecapsByType(byType);
      setFilledRecapIds(new Set(filledIds || []));
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

  const sortedTypes = Object.entries(patientTypeStats).sort((a, b) => b[1] - a[1]);

  const selectedRecaps = selectedType
    ? [...(recapsByType[selectedType] || [])].sort(
        (a, b) => new Date(b.recap_date) - new Date(a.recap_date)
      )
    : [];

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
      ) : sortedTypes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mb-3">
            <Users className="w-5 h-5 text-slate-300" />
          </div>
          <p className="text-xs font-medium text-slate-400">Belum ada data periode ini</p>
        </div>
      ) : (
        <div className="px-5 py-4 space-y-3">
          {sortedTypes.map(([type, count], i) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const color = colors[i % colors.length];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className="w-full flex items-center gap-3 group text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-slate-50 transition-colors"
                >
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
                </button>
              );
            })}
        </div>
      )}

      {/* Detail modal */}
      <Dialog open={!!selectedType} onOpenChange={(open) => !open && setSelectedType(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 capitalize">
              <Users className="w-5 h-5 text-indigo-500" />
              {selectedType ? selectedType.toLowerCase() : ''}
              <span className="text-xs font-normal text-slate-400 normal-case">
                ({selectedRecaps.length} kunjungan)
              </span>
            </DialogTitle>
            <DialogDescription>
              Daftar kunjungan periode ini untuk tipe pasien ini.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 mt-2 space-y-2.5">
            {selectedRecaps.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                Tidak ada data.
              </div>
            ) : (
              selectedRecaps.map((item) => {
                const isFilled = filledRecapIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    className="border border-slate-200 rounded-xl p-3.5 bg-white hover:border-indigo-200 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">
                          {item.patients?.full_name || 'Pasien tidak diketahui'}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {item.recap_date
                            ? format(new Date(item.recap_date), 'dd MMMM yyyy', { locale: idLocale })
                            : '-'}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${
                          isFilled
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-rose-50 text-rose-600'
                        }`}
                      >
                        {isFilled ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {isFilled ? 'SOAP terisi' : 'SOAP belum'}
                      </span>
                    </div>

                    <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      <div>
                        <span className="text-slate-400">Diagnosa: </span>
                        <span className="text-slate-600 font-medium">
                          {item.diagnosis || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Tipe paket: </span>
                        <span className="text-slate-600 font-medium">
                          {item.service_type || '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TherapistPatientTypeDistribution;
