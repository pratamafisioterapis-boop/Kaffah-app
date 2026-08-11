import React, { useState, useEffect } from 'react';
import { CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, ChevronRight, UserX } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const COLOR_PALETTE = [
  { color: '#6366f1', bg: 'bg-indigo-50',  text: 'text-indigo-600'  },
  { color: '#8b5cf6', bg: 'bg-violet-50',  text: 'text-violet-600'  },
  { color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { color: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-600'   },
  { color: '#06b6d4', bg: 'bg-cyan-50',    text: 'text-cyan-600'    },
  { color: '#f43f5e', bg: 'bg-rose-50',    text: 'text-rose-600'    },
  { color: '#ec4899', bg: 'bg-pink-50',    text: 'text-pink-600'    },
  { color: '#84cc16', bg: 'bg-lime-50',    text: 'text-lime-600'    },
  { color: '#0ea5e9', bg: 'bg-sky-50',     text: 'text-sky-600'     },
];
const UNKNOWN_STYLE = { color: '#94a3b8', bg: 'bg-slate-100', text: 'text-slate-500' };
const OLD_PATIENT_LABEL = 'Pasien Lama';
const OLD_PATIENT_STYLE = { color: '#334155', bg: 'bg-slate-100', text: 'text-slate-700' };

const PatientSourceChart = ({ dateRange }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [unknownPatients, setUnknownPatients] = useState([]);
  const [showUnknownModal, setShowUnknownModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

        let query = supabase
          .from('daily_recaps')
          .select('patient_id, recap_date, patients!daily_recap_patient_id_fkey(id, full_name, medical_record_number, phone, additional_info_option_id, patient_info_options(label))')
          .eq('clinic_id', userRow?.clinic_id);

        if (dateRange?.startDate) query = query.gte('recap_date', dateRange.startDate);
        if (dateRange?.endDate) query = query.lte('recap_date', dateRange.endDate);

        const { data: recaps, error } = await query;

        if (error) throw error;

        const totalCount = (recaps || []).length;
        setTotal(totalCount);

        // Pasien Lama = pernah punya sesi sebelum awal periode filter (dihitung dari riwayat kunjungan,
        // bukan dari opsi "Info Tambahan" yang dipilih manual saat pendaftaran).
        let oldPatientIds = new Set();
        const patientIds = [...new Set((recaps || []).map(r => r.patient_id).filter(Boolean))];
        if (patientIds.length > 0 && dateRange?.startDate) {
          const { data: priorRecaps, error: priorError } = await supabase
            .from('daily_recaps')
            .select('patient_id')
            .eq('clinic_id', userRow?.clinic_id)
            .in('patient_id', patientIds)
            .lt('recap_date', dateRange.startDate);

          if (priorError) throw priorError;
          oldPatientIds = new Set((priorRecaps || []).map(r => r.patient_id));
        }

        const countMap = {};
        const unknownMap = {};
        (recaps || []).forEach(r => {
          const isOld = oldPatientIds.has(r.patient_id);
          const label = isOld
            ? OLD_PATIENT_LABEL
            : (r.patients?.patient_info_options?.label || 'Tidak Diketahui');
          countMap[label] = (countMap[label] || 0) + 1;

          if (!isOld && !r.patients?.patient_info_options?.label && r.patient_id) {
            const existing = unknownMap[r.patient_id];
            if (existing) {
              existing.sessionCount += 1;
              if (r.recap_date && (!existing.lastRecapDate || r.recap_date > existing.lastRecapDate)) {
                existing.lastRecapDate = r.recap_date;
              }
            } else {
              unknownMap[r.patient_id] = {
                id: r.patient_id,
                full_name: r.patients?.full_name || 'Tanpa Nama',
                medical_record_number: r.patients?.medical_record_number || '-',
                phone: r.patients?.phone || '-',
                sessionCount: 1,
                lastRecapDate: r.recap_date || null,
              };
            }
          }
        });

        setUnknownPatients(
          Object.values(unknownMap).sort((a, b) => a.full_name.localeCompare(b.full_name))
        );

        let paletteIndex = 0;
        const result = Object.entries(countMap)
          .map(([label, count]) => {
            let style;
            if (label === 'Tidak Diketahui') style = UNKNOWN_STYLE;
            else if (label === OLD_PATIENT_LABEL) style = OLD_PATIENT_STYLE;
            else style = COLOR_PALETTE[paletteIndex++ % COLOR_PALETTE.length];

            return {
              key: label,
              count,
              pct: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
              ...style
            };
          })
          .sort((a, b) => b.count - a.count);

        setData(result);
      } catch (err) {
        console.error('PatientSourceChart error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden h-full">
      {/* Header */}
      <div className="px-5 md:px-6 pt-5 md:pt-6 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">Sumber Pasien</h3>
            <p className="text-xs text-slate-400 mt-0.5">Dari mana pasien tahu klinik, per sesi pada periode ini</p>
          </div>
          {!loading && (
            <div className="text-right">
              <p className="text-xl font-black text-slate-900 leading-none">{total.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Total Sesi</p>
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-slate-50 mx-5" />

      <CardContent className="px-5 md:px-6 py-4">
        {loading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-slate-200" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
            Belum ada data sesi pada periode ini.
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((s) => {
              const isUnknown = s.key === 'Tidak Diketahui';
              const isClickable = isUnknown && unknownPatients.length > 0;
              return (
                <div
                  key={s.key}
                  className={`space-y-1 ${isClickable ? 'cursor-pointer group -mx-2 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors' : ''}`}
                  onClick={isClickable ? () => setShowUnknownModal(true) : undefined}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') setShowUnknownModal(true); } : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-xs font-semibold text-slate-700 truncate">{s.key}</span>
                      {isClickable && (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                        {s.count.toLocaleString('id-ID')}
                      </span>
                      <span className="text-[10px] text-slate-400 w-8 text-right">{s.pct}%</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={showUnknownModal} onOpenChange={setShowUnknownModal}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0 overflow-hidden sm:rounded-xl">
          <DialogHeader className="px-5 py-4 border-b border-slate-100 bg-slate-50/80">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserX className="w-4.5 h-4.5 text-slate-400" />
              Pasien Belum Terisi Sumbernya
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {unknownPatients.length} pasien pada periode ini belum diisi "Info Tambahan" (sumber pasien) pada data pasiennya.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="divide-y divide-slate-100">
              {unknownPatients.map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{p.full_name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      RM {p.medical_record_number} • {p.phone}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      {p.sessionCount} sesi
                    </span>
                    {p.lastRecapDate && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        {format(new Date(p.lastRecapDate), 'd MMM yyyy', { locale: idLocale })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientSourceChart;
