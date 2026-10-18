import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { ChevronRight, HelpCircle, X, PieChart } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { getCachedClinicId } from '@/lib/api';
import { cn } from '@/lib/utils';
import FinanceTile, { TileEmpty, TileLoading } from '@/components/owner/finance/FinanceTile';
import { Donut } from '@/components/owner/finance/charts';

const SERVICE_CONFIG = [
  { key: 'Musculoskeletal Treatment',         short: 'Musculo',   color: '#6366f1', bg: 'bg-indigo-50',  text: 'text-indigo-600'  },
  { key: 'Neurological Rehabilitation',       short: 'Neuro',     color: '#8b5cf6', bg: 'bg-violet-50',  text: 'text-violet-600'  },
  { key: 'Pre-Post Operative Rehabilitation', short: 'Pre-Post',  color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { key: 'Sport Injury Treatment',            short: 'Sport',     color: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-600'   },
  { key: 'Recovery Treatment',                short: 'Recovery',  color: '#06b6d4', bg: 'bg-cyan-50',    text: 'text-cyan-600'    },
  { key: 'Cardiorespiratory Physiotherapy',   short: 'Cardio',    color: '#f43f5e', bg: 'bg-rose-50',    text: 'text-rose-600'    },
];

const ServiceDistributionChart = ({ dateRange, className }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [unclassifiedRecaps, setUnclassifiedRecaps] = useState([]);
  const [showUnclassifiedModal, setShowUnclassifiedModal] = useState(false);
  // Layanan yang disorot di donut dan daftar.
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        const userRow = { clinic_id: await getCachedClinicId(userId) };

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

  const donutItems = data.map(s => ({ key: s.key, value: s.count, color: s.color }));
  const current = data.find(s => s.key === selected);

  const handleSelect = (key) => {
    if (key === 'Tidak Terklasifikasi' && unclassifiedRecaps.length > 0) {
      setShowUnclassifiedModal(true);
      return;
    }
    setSelected(selected === key ? null : key);
  };

  return (
    <FinanceTile tone="vio" icon={PieChart} title="Distribusi Layanan" className={className}>
      {loading ? (
        <TileLoading className="py-14" />
      ) : data.length === 0 ? (
        <TileEmpty>Belum ada data layanan.</TileEmpty>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-3">
            <b className="text-3xl font-black tabular-nums leading-none text-slate-900">{total.toLocaleString('id-ID')}</b>
            <span className="text-xs text-slate-500">Total Sesi</span>
          </div>
          <Donut items={donutItems} selected={selected} onSelect={(key) => (key ? handleSelect(key) : setSelected(null))} className="w-[128px] mx-auto mb-3">
            <b className="text-xl font-black tabular-nums leading-tight text-slate-900">{(current ? current.count : total).toLocaleString('id-ID')}</b>
            <small className="text-xs text-slate-500 max-w-[78px] truncate">{current ? current.short : 'Total'}</small>
          </Donut>
          <div className="grid gap-0.5">
            {data.map((s) => {
              const isUnclassified = s.key === 'Tidak Terklasifikasi';
              const isClickable = isUnclassified && unclassifiedRecaps.length > 0;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => handleSelect(s.key)}
                  aria-pressed={selected === s.key}
                  className={cn('w-full grid gap-1.5 px-2 py-2 rounded-xl text-left transition-colors', selected === s.key ? 'bg-slate-100' : 'hover:bg-slate-50')}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="flex-1 min-w-0 text-xs font-semibold text-slate-700 break-words">{s.key}</span>
                    {isClickable && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${s.bg} ${s.text}`}>{s.count.toLocaleString('id-ID')}</span>
                    <span className="text-xs text-slate-500 w-8 text-right shrink-0">{s.pct}%</span>
                  </span>
                  <span className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <span
                      className="block h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
                      style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/*
        DialogContent is deliberately turned into a full-viewport, transparent,
        flex-centering shell here (left-0/top-0/translate-0/w-full/h-full/p-4,
        matching the `fixed inset-0` pattern already used by the sidebar/FAB
        overlays in DashboardLayout.jsx) instead of the shared component's
        default `left-[50%] top-[50%] translate-x-[-50%] w-[..vw..]` centering.
        On this app's mobile preview, width values derived from `vw` render
        wider than the actual visible viewport (text got clipped and required
        a horizontal swipe to reach), while `inset`/percentage-based sizing
        renders correctly — so the visible card below is sized with plain
        `w-full max-w-lg` inside this shell instead of any vw arithmetic.
      */}
      <Dialog open={showUnclassifiedModal} onOpenChange={setShowUnclassifiedModal}>
        <DialogContent hideClose className="left-0 top-0 h-full w-full max-w-none translate-x-0 translate-y-0 flex items-center justify-center gap-0 border-0 bg-transparent p-4 shadow-none rounded-none">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-app bg-white shadow-lg">
            <DialogHeader className="sticky top-0 z-10 px-5 py-4 pr-12 border-b border-slate-100 bg-slate-50/95 backdrop-blur relative">
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-4.5 h-4.5 text-slate-500 shrink-0" />
                Sesi Belum Terklasifikasi
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {unclassifiedRecaps.length} sesi pada periode ini belum diisi tipe layanannya dengan benar.
              </DialogDescription>
              <DialogClose className="absolute right-4 top-4 before:absolute before:-inset-2 before:content-[''] rounded-full p-1 text-slate-500 hover:bg-slate-200/70 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300">
                <X className="w-4 h-4" />
                <span className="sr-only">Tutup</span>
              </DialogClose>
            </DialogHeader>
            <div className="divide-y divide-slate-100">
              {unclassifiedRecaps.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 break-words sm:truncate">{r.patientName}</p>
                    <p className="text-xs text-slate-500 mt-0.5 break-words sm:truncate">
                      {r.therapistName}
                      {r.serviceTypeRaw ? ` • Tipe: "${r.serviceTypeRaw}"` : ' • Tipe layanan kosong'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {r.recapDate && (
                      <p className="text-xs text-slate-500">
                        {format(new Date(r.recapDate), 'd MMM yyyy', { locale: idLocale })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </FinanceTile>
  );
};

export default ServiceDistributionChart;