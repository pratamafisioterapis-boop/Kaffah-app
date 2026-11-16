import React, { useEffect, useMemo, useState } from 'react';
import { Users, Home, Building2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { KAFFAH_CLINIC_ID } from '@/lib/clinicIds';
import { computeWorkload, fetchRecapsForWorkload } from '@/lib/therapistWorkload';

// Label sederhana per terapis, dibandingkan dengan rata-rata tim.
const TAG = {
  high_alert: { text: 'Paling banyak', cls: 'bg-rose-50 text-rose-700 ring-rose-200', bar: 'bg-rose-500' },
  high: { text: 'Agak banyak', cls: 'bg-amber-50 text-amber-700 ring-amber-200', bar: 'bg-amber-400' },
  ok: { text: 'Seimbang', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', bar: 'bg-emerald-500' },
  low: { text: 'Agak sedikit', cls: 'bg-sky-50 text-sky-700 ring-sky-200', bar: 'bg-sky-400' },
  low_alert: { text: 'Perlu diberi pasien', cls: 'bg-sky-100 text-sky-800 ring-sky-300', bar: 'bg-sky-500' },
};

const verdict = (fairness, hasData) => {
  if (!hasData) return { text: 'Belum ada data', cls: 'text-slate-500' };
  if (fairness >= 0.85) return { text: 'Pembagian sudah merata', cls: 'text-emerald-600' };
  if (fairness >= 0.7) return { text: 'Cukup merata', cls: 'text-amber-600' };
  return { text: 'Belum merata', cls: 'text-rose-600' };
};

const firstName = (n) => (n || '').split(',')[0].trim();

const TherapistWorkloadWidget = ({ dateRange }) => {
  const { userDetails } = useAuth();
  const clinicId = userDetails?.clinic_id;
  const [recaps, setRecaps] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const start = dateRange?.startDate;
  const end = dateRange?.endDate;

  useEffect(() => {
    if (clinicId !== KAFFAH_CLINIC_ID || !start || !end) return undefined;
    let cancelled = false;
    setLoading(true); setError(null);
    (async () => {
      try {
        const [rows, { data: thr, error: thrErr }] = await Promise.all([
          fetchRecapsForWorkload(supabase, clinicId, start, end),
          supabase.from('physiotherapists').select('id, name, is_active').eq('clinic_id', clinicId),
        ]);
        if (thrErr) throw thrErr;
        if (!cancelled) { setRecaps(rows); setTherapists(thr || []); }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Gagal memuat data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clinicId, start, end]);

  const data = useMemo(() => computeWorkload(recaps, therapists), [recaps, therapists]);

  if (clinicId !== KAFFAH_CLINIC_ID) return null;

  const hasData = data.total > 0;
  const v = verdict(data.fairness, hasData);
  const maxVisits = Math.max(1, ...data.rows.map((r) => r.visits));
  const needMore = data.rows.filter((r) => r.status === 'low' || r.status === 'low_alert').map((r) => firstName(r.name));

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-slate-800 tracking-tight">Pembagian Pasien Terapis</h3>
      <div className="bg-white rounded-app-lg border shadow-sm p-5 space-y-5">
        {/* Ringkasan */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className={`text-xl font-semibold ${v.cls}`}>{v.text}</div>
            <div className="text-sm text-slate-500">
              {hasData ? `Rata-rata ${data.avg.toFixed(1)} kunjungan per terapis` : 'Tidak ada kunjungan pada periode ini'}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-200">
            <Users className="h-4 w-4" />
            <span><b className="text-slate-900">{data.total}</b> kunjungan • {data.rows.length} terapis</span>
          </div>
        </div>

        {loading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Memuat…</div>}
        {error && <div className="rounded-app-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {/* Daftar terapis */}
        {!loading && !error && hasData && (
          <ul className="space-y-3">
            {data.rows.map((r) => (
              <li key={r.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-800">{firstName(r.name)}</div>
                    <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                      <span>{r.uniquePatients} pasien</span>
                      <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{r.clinic}</span>
                      <span className="inline-flex items-center gap-1"><Home className="h-3 w-3" />{r.homecare}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`hidden sm:inline rounded-full px-2 py-0.5 text-xs ring-1 ${TAG[r.status].cls}`}>{TAG[r.status].text}</span>
                    <span className="w-9 text-right text-xl font-semibold tabular-nums text-slate-900">{r.visits}</span>
                  </div>
                </div>
                <div className="relative h-2.5 rounded-full bg-slate-100">
                  <div className={`h-2.5 rounded-full ${TAG[r.status].bar} transition-[width] duration-500`} style={{ width: `${(r.visits / maxVisits) * 100}%` }} />
                  <div className="absolute -top-1 -bottom-1 w-0.5 rounded bg-slate-700/70" style={{ left: `${(data.avg / maxVisits) * 100}%` }} />
                </div>
                <span className={`sm:hidden inline-block rounded-full px-2 py-0.5 text-xs ring-1 ${TAG[r.status].cls}`}>{TAG[r.status].text}</span>
              </li>
            ))}
          </ul>
        )}

        {needMore.length > 0 && !loading && (
          <div className="rounded-app-sm bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-1 ring-sky-100">
            Pasien berikutnya bisa diarahkan ke <b>{needMore.join(', ')}</b>.
          </div>
        )}

        <p className="text-xs text-slate-400">
          Garis hitam = rata-rata tim. Angka besar = jumlah kunjungan pada periode di atas; pasien paket dihitung per sesi yang terlaksana.
          <Building2 className="mx-1 inline h-3 w-3" />klinik, <Home className="mx-1 inline h-3 w-3" />homecare.
        </p>
      </div>
    </div>
  );
};

export default TherapistWorkloadWidget;
