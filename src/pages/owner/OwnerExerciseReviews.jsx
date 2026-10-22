import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Loader2, Play, Search, Film, X } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KAFFAH_CLINIC_ID } from '@/lib/clinicIds';

const BUCKET = 'exercise-videos';

const OwnerExerciseReviews = () => {
  const { userDetails } = useAuth();
  const { toast } = useToast();
  const allowed = userDetails?.clinic_id === KAFFAH_CLINIC_ID;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);

  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    (async () => {
      const [rv, ex] = await Promise.all([
        supabase.from('exercise_reviews').select('exercise_id, reviewer_name, reviewed_at').order('reviewed_at', { ascending: false }),
        supabase.from('plan_exercises').select('id, name, grp, how_to, dose'),
      ]);
      const err = rv.error || ex.error;
      if (err) toast({ variant: 'destructive', title: 'Gagal memuat review latihan', description: err.message });
      const byId = Object.fromEntries((ex.data || []).map((e) => [e.id, e]));
      setRows((rv.data || []).filter((r) => byId[r.exercise_id]).map((r) => ({ ...byId[r.exercise_id], ...r })));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => !q
      || r.id.toLowerCase().includes(q) || (r.name || '').toLowerCase().includes(q)
      || (r.grp || '').toLowerCase().includes(q) || (r.reviewer_name || '').toLowerCase().includes(q));
  }, [rows, query]);

  const open = async (r) => {
    setActive(r);
    setVideoUrl(null);
    const { data: asset } = await supabase.from('exercise_video_assets').select('storage_path').eq('exercise_id', r.id).maybeSingle();
    if (!asset) return;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(asset.storage_path, 1800);
    setVideoUrl(data?.signedUrl || null);
  };
  const close = () => { setActive(null); setVideoUrl(null); };

  if (!allowed) return <p className="text-sm text-app-muted">Fitur ini hanya tersedia untuk klinik Kaffah.</p>;
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-app-accent" /></div>;

  return (
    <div className="space-y-4">
      <Helmet><title>Hasil Review Video Latihan</title></Helmet>
      <div className="rounded-app-lg border border-slate-200 bg-white p-4 space-y-3">
        <h1 className="text-lg font-semibold text-slate-900">Hasil Review Video Latihan ({rows.length})</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9" placeholder="Cari kode, nama, jenis, atau terapis" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Cari latihan" />
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-8">Belum ada latihan yang direview.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-app-lg border border-slate-200 bg-white">
          {shown.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="font-mono text-xs bg-slate-100 text-slate-700 rounded px-2 py-1">{r.id}</span>
              <div className="min-w-0 flex-1 basis-48">
                <p className="font-medium text-slate-900 break-words">{r.name}</p>
                <p className="text-xs text-slate-500">{r.grp} · Direview {r.reviewer_name}, {format(new Date(r.reviewed_at), 'dd/MM/yyyy HH:mm')}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => open(r)}><Play className="w-4 h-4 mr-1" /> Lihat</Button>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-2xl sm:rounded-2xl bg-white p-4 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900"><span className="font-mono text-slate-500">{active.id}</span> {active.name}</h2>
                <p className="text-sm text-emerald-700">Direview {active.reviewer_name}, {format(new Date(active.reviewed_at), 'dd/MM/yyyy HH:mm')}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={close} aria-label="Tutup"><X className="w-4 h-4" /></Button>
            </div>
            {videoUrl
              ? <video src={videoUrl} controls playsInline className="w-full rounded-lg bg-black" />
              : <div className="flex items-center justify-center gap-2 h-40 rounded-lg bg-slate-100 text-slate-500 text-sm"><Film className="w-5 h-5" /> Memuat video…</div>}
            <dl className="space-y-2 text-sm">
              <div><dt className="font-medium text-slate-700">Jenis</dt><dd className="text-slate-600">{active.grp || '-'}</dd></div>
              <div><dt className="font-medium text-slate-700">Cara melakukan</dt><dd className="text-slate-600 whitespace-pre-line">{active.how_to || '-'}</dd></div>
              <div><dt className="font-medium text-slate-700">Dosis</dt><dd className="text-slate-600">{active.dose || '-'}</dd></div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerExerciseReviews;
