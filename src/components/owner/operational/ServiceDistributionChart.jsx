import React, { useState, useEffect } from 'react';
import { CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, ChevronRight, HelpCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const SERVICE_CONFIG = [
  { key: 'Musculoskeletal Treatment',         short: 'Musculo',   color: '#6366f1', bg: 'bg-indigo-50',  text: 'text-indigo-600'  },
  { key: 'Neurological Rehabilitation',       short: 'Neuro',     color: '#8b5cf6', bg: 'bg-violet-50',  text: 'text-violet-600'  },
  { key: 'Pre-Post Operative Rehabilitation', short: 'Pre-Post',  color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { key: 'Sport Injury Treatment',            short: 'Sport',     color: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-600'   },
  { key: 'Recovery Treatment',                short: 'Recovery',  color: '#06b6d4', bg: 'bg-cyan-50',    text: 'text-cyan-600'    },
  { key: 'Cardiorespiratory Physiotherapy',   short: 'Cardio',    color: '#f43f5e', bg: 'bg-rose-50',    text: 'text-rose-600'    },
];

const ServiceDistributionChart = ({ dateRange }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [unclassifiedRecaps, setUnclassifiedRecaps] = useState([]);
  const [showUnclassifiedModal, setShowUnclassifiedModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        const { data: userRow } = await supabase.from('users').select('clinic_id').eq('id', userId).single();

        let query = supabase
          .from('daily_recaps')
          .select(`
            id,
            service_type,
            recap_date,
            guest_name,
            therapist_name,
            patients!patient_id(id, full_name, medical_record_number),
            actual_patients:patients!actual_patient_id(id, full_name, medical_record_number)
          `)
          .eq('clinic_id', userRow?.clinic_id);

        if (dateRange?.startDate) query = query.gte('recap_date', dateRange.startDate);
        if (dateRange?.endDate) query = query.lte('recap_date', dateRange.endDate);

        const { data: recaps, error } = await query;

        if (error) throw error;

        const totalCount = (recaps || []).length;
        setTotal(totalCount);

        const knownKeys = new Set(SERVICE_CONFIG.map(s => s.key));
        const countMap = {};
        const unclassifiedList = [];
        (recaps || []).forEach(r => {
          if (r.service_type && knownKeys.has(r.service_type)) {
            countMap[r.service_type] = (countMap[r.service_type] || 0) + 1;
          } else {
            const patient = r.actual_patients || r.patients;
            unclassifiedList.push({
              id: r.id,
              patientName: patient?.full_name || r.guest_name || 'Tanpa Nama',
              medicalRecordNumber: patient?.medical_record_number || null,
              therapistName: r.therapist_name || '-',
              recapDate: r.recap_date || null,
              serviceTypeRaw: r.service_type || null,
            });
          }
        });

        setUnclassifiedRecaps(
          unclassifiedList.sort((a, b) => (b.recapDate || '').localeCompare(a.recapDate || ''))
        );

        const result = SERVICE_CONFIG.map(s => ({
          ...s,
          count: countMap[s.key] || 0,
          pct: totalCount > 0 ? Math.round(((countMap[s.key] || 0) / totalCount) * 100) : 0
        })).filter(s => s.count > 0).sort((a, b) => b.count - a.count);

        if (unclassifiedList.length > 0) {
          result.push({
            key: 'Tidak Terklasifikasi',
            short: 'Lainnya',
            color: '#94a3b8',
            bg: 'bg-slate-100',
            text: 'text-slate-500',
            count: unclassifiedList.length,
            pct: totalCount > 0 ? Math.round((unclassifiedList.length / totalCount) * 100) : 0
          });
        }

        setData(result);
      } catch (err) {
        console.error('ServiceDistributionChart error:', err);
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
            <h3 className="text-base font-bold text-slate-800">Distribusi Layanan</h3>
            <p className="text-xs text-slate-400 mt-0.5">Breakdown tipe layanan keseluruhan</p>
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
            Belum ada data layanan.
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((s) => {
              const isUnclassified = s.key === 'Tidak Terklasifikasi';
              const isClickable = isUnclassified && unclassifiedRecaps.length > 0;
              return (
                <div
                  key={s.key}
                  className={`space-y-1 ${isClickable ? 'cursor-pointer group -mx-2 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors' : ''}`}
                  onClick={isClickable ? () => setShowUnclassifiedModal(true) : undefined}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') setShowUnclassifiedModal(true); } : undefined}
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

      <Dialog open={showUnclassifiedModal} onOpenChange={setShowUnclassifiedModal}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[85vh] overflow-y-auto p-0 sm:rounded-xl">
          <DialogHeader className="sticky top-0 z-10 px-5 py-4 border-b border-slate-100 bg-slate-50/95 backdrop-blur">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-4.5 h-4.5 text-slate-400 shrink-0" />
              Sesi Belum Terklasifikasi
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {unclassifiedRecaps.length} sesi pada periode ini belum diisi tipe layanannya dengan benar.
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y divide-slate-100">
            {unclassifiedRecaps.map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{r.patientName}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {r.therapistName}
                    {r.serviceTypeRaw ? ` • Tipe: "${r.serviceTypeRaw}"` : ' • Tipe layanan kosong'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {r.recapDate && (
                    <p className="text-[10px] text-slate-400">
                      {format(new Date(r.recapDate), 'd MMM yyyy', { locale: idLocale })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServiceDistributionChart;