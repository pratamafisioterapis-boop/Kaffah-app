import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Scale, Home, Building2, Users, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { KAFFAH_CLINIC_ID } from '@/lib/clinicIds';
import DateRangePicker, { getDefaultDateRange } from '@/components/ui/date-range-picker';
import PageHero from '@/components/shared/PageHero';
import { Button } from '@/components/ui/button';
import { computeWorkload, fetchRecapsForWorkload } from '@/lib/therapistWorkload';

const STATUS_META = {
  high_alert: { label: 'Jauh di atas', bar: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-200' },
  high: { label: 'Di atas rata-rata', bar: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  ok: { label: 'Seimbang', bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  low: { label: 'Di bawah rata-rata', bar: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  low_alert: { label: 'Jauh di bawah', bar: 'bg-sky-500', badge: 'bg-sky-50 text-sky-700 border-sky-200' },
};

const pct = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
const shortName = (n) => (n || '').split(',')[0].trim();

const Stat = ({ icon: Icon, label, value, hint }) => (
  <div className="rounded-app border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><Icon className="h-4 w-4" />{label}</div>
    <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    {hint && <div className="mt-0.5 text-xs text-slate-500 truncate">{hint}</div>}
  </div>
);

const TherapistWorkload = () => {
  const { userDetails } = useAuth();
  const clinicId = userDetails?.clinic_id;
  const [range, setRange] = useState(getDefaultDateRange());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recaps, setRecaps] = useState([]);
  const [therapists, setTherapists] = useState([]);

  const load = useCallback(async () => {
    if (!clinicId || !range?.startDate || !range?.endDate) return;
    setLoading(true); setError(null);
    try {
      const [recapRows, { data: thr, error: thrErr }] = await Promise.all([
        fetchRecapsForWorkload(supabase, clinicId, range.startDate, range.endDate),
        supabase.from('physiotherapists').select('id, name, is_active').eq('clinic_id', clinicId),
      ]);
      if (thrErr) throw thrErr;
      setRecaps(recapRows); setTherapists(thr || []);
    } catch (e) {
      setError(e.message || 'Gagal memuat data');
    } finally { setLoading(false); }
  }, [clinicId, range]);

  useEffect(() => { load(); }, [load]);

  const data = useMemo(() => computeWorkload(recaps, therapists), [recaps, therapists]);
  const maxVisits = Math.max(1, ...data.rows.map((r) => r.visits));

  if (clinicId && clinicId !== KAFFAH_CLINIC_ID) {
    return <div className="p-6 text-sm text-slate-500">Halaman ini hanya tersedia untuk Kaffah Physiotherapy.</div>;
  }

  const suggestion = data.rows.filter((r) => r.status === 'low' || r.status === 'low_alert').map((r) => shortName(r.name));

  return (
    <div className="space-y-6">
      <PageHero image="/hero/clinara-physio-hero.webp" title="Pemerataan" highlight="Pasien" description="Jumlah pasien yang ditangani tiap terapis pada periode yang sama." />

      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2">
        <DateRangePicker align="end" value={range} onChange={setRange} className="w-full sm:w-auto" />
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Muat ulang
        </Button>
      </div>

      {error && <div className="rounded-app border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Users} label="Total kunjungan" value={data.total} hint={`${data.rows.length} terapis`} />
        <Stat icon={Scale} label="Rata-rata / terapis" value={data.avg.toFixed(1)} />
        <Stat icon={Scale} label="Indeks keadilan" value={`${Math.round(data.fairness * 100)}%`} hint="100% = merata sempurna" />
        <Stat icon={Scale} label="Selisih terbesar"
          value={data.max && data.min ? data.max.visits - data.min.visits : 0}
          hint={data.max && data.min ? `${shortName(data.max.name)} vs ${shortName(data.min.name)}` : ''} />
      </div>

      <div className="rounded-app border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="text-sm font-semibold text-slate-800">Kunjungan per terapis</div>
        {data.rows.length === 0 && !loading && <div className="text-sm text-slate-500">Tidak ada data pada periode ini.</div>}
        <div className="relative space-y-2">
          {data.rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] sm:grid-cols-[10rem_1fr_auto] items-center gap-3">
              <div className="truncate text-sm text-slate-700" title={r.name}>{shortName(r.name)}</div>
              <div className="relative h-5 rounded bg-slate-100">
                <div className={`h-5 rounded ${STATUS_META[r.status].bar}`} style={{ width: `${(r.visits / maxVisits) * 100}%` }} />
                <div className="absolute top-[-2px] bottom-[-2px] w-px bg-slate-700" style={{ left: `${(data.avg / maxVisits) * 100}%` }} title={`Rata-rata ${data.avg.toFixed(1)}`} />
              </div>
              <div className="text-sm font-medium tabular-nums text-slate-900 w-8 text-right">{r.visits}</div>
            </div>
          ))}
        </div>
        <div className="text-xs text-slate-500">Garis hitam = rata-rata tim. Adi Pratama tidak diikutkan.</div>
      </div>

      {suggestion.length > 0 && (
        <div className="rounded-app border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          Catatan: <b>{suggestion.join(', ')}</b> berada di bawah rata-rata tim. Pertimbangkan memprioritaskan pasien berikutnya ke terapis tersebut.
        </div>
      )}

      {/* Tabel (desktop) */}
      <div className="hidden md:block rounded-app border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="p-3">Terapis</th><th className="p-3 text-right">Kunjungan</th><th className="p-3 text-right">Pasien unik</th>
              <th className="p-3 text-right">Klinik</th><th className="p-3 text-right">Homecare</th>
              <th className="p-3 text-right">Selisih rata-rata</th><th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="p-3 font-medium text-slate-800">{shortName(r.name)}{!r.active && <span className="ml-2 text-xs text-slate-400">(nonaktif)</span>}</td>
                <td className="p-3 text-right tabular-nums">{r.visits}</td>
                <td className="p-3 text-right tabular-nums">{r.uniquePatients}</td>
                <td className="p-3 text-right tabular-nums">{r.clinic}</td>
                <td className="p-3 text-right tabular-nums">{r.homecare}</td>
                <td className="p-3 text-right tabular-nums">{pct(r.deviation)}</td>
                <td className="p-3"><span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${STATUS_META[r.status].badge}`}>{STATUS_META[r.status].label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Kartu (mobile) */}
      <div className="md:hidden space-y-2">
        {data.rows.map((r) => (
          <div key={r.id} className="rounded-app border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-slate-800 truncate">{shortName(r.name)}</div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${STATUS_META[r.status].badge}`}>{pct(r.deviation)}</span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs text-slate-500">
              <div><div className="text-base font-semibold text-slate-900">{r.visits}</div>Kunjungan</div>
              <div><div className="text-base font-semibold text-slate-900">{r.uniquePatients}</div>Pasien</div>
              <div><div className="flex items-center justify-center gap-1 text-base font-semibold text-slate-900"><Building2 className="h-3 w-3" />{r.clinic}</div>Klinik</div>
              <div><div className="flex items-center justify-center gap-1 text-base font-semibold text-slate-900"><Home className="h-3 w-3" />{r.homecare}</div>Homecare</div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        Dihitung dari rekap harian: setiap sesi yang terlaksana pada tanggal dalam periode dihitung 1 kunjungan (pasien paket 8x = 8 kunjungan, hanya yang tanggalnya masuk periode). Homecare dihitung sama dengan pasien klinik.
        Status: seimbang bila selisih dari rata-rata ≤15%.
      </p>
    </div>
  );
};

export default TherapistWorkload;
