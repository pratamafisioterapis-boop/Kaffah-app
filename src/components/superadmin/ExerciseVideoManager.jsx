import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Upload, Trash2, Play, Search, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel, Pill, EmptyState } from '@/components/superadmin/ui';
import { confirmAction } from '@/lib/confirmAction';

// Super Admin mengunggah satu video per kode latihan Plan SOAP (plan_exercises). Berkas masuk ke bucket
// privat exercise-videos; pasien memutarnya lewat Edge Function portal-exercise-video, dan hanya jika
// klinik pasien mengaktifkan Link Clinara. Skema: supabase/manual/9_portal_pasien_clinara.sql
const BUCKET = 'exercise-videos';
const MAX_BYTES = 200 * 1024 * 1024;

const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtDur = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');

const readDuration = (file) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { const d = Number.isFinite(v.duration) ? Math.round(v.duration) : null; URL.revokeObjectURL(url); resolve(d); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    v.src = url;
  });

const ExerciseVideoManager = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [exercises, setExercises] = useState([]);
  const [assets, setAssets] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [preview, setPreview] = useState(null); // { id, url }
  const fileRef = useRef(null);
  const targetRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [ex, as] = await Promise.all([
      supabase.from('plan_exercises').select('id, name, grp').order('id'),
      supabase.from('exercise_video_assets').select('exercise_id, storage_path, duration_seconds, size_bytes, created_at'),
    ]);
    if (ex.error) toast({ variant: 'destructive', title: 'Gagal memuat daftar latihan', description: ex.error.message });
    if (as.error) toast({ variant: 'destructive', title: 'Gagal memuat data video', description: as.error.message });
    setExercises(ex.data || []);
    setAssets(Object.fromEntries((as.data || []).map((a) => [a.exercise_id, a])));
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const pick = (id) => { targetRef.current = id; fileRef.current?.click(); };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const id = targetRef.current;
    if (!file || !id) return;
    if (!file.type.startsWith('video/')) { toast({ variant: 'destructive', title: 'Pilih berkas video (mp4, mov, webm)' }); return; }
    if (file.size > MAX_BYTES) { toast({ variant: 'destructive', title: 'Video terlalu besar', description: `Maksimal ${fmtSize(MAX_BYTES)} per video.` }); return; }

    setBusyId(id);
    try {
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
      const path = `${id}.${ext}`;
      const duration = await readDuration(file);
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from('exercise_video_assets').upsert(
        { exercise_id: id, storage_path: path, duration_seconds: duration, size_bytes: file.size, uploaded_by: user?.id || null },
        { onConflict: 'exercise_id' },
      );
      if (dbErr) throw dbErr;
      // Ganti video dengan ekstensi berbeda: hapus berkas lama supaya tidak menumpuk.
      const old = assets[id]?.storage_path;
      if (old && old !== path) await supabase.storage.from(BUCKET).remove([old]);
      toast({ title: `Video ${id} tersimpan` });
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal mengunggah video', description: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id) => {
    if (!(await confirmAction(`Hapus video ${id}? Pasien tidak lagi bisa memutar video ini.`))) return;
    setBusyId(id);
    try {
      const path = assets[id]?.storage_path;
      const { error } = await supabase.from('exercise_video_assets').delete().eq('exercise_id', id);
      if (error) throw error;
      if (path) await supabase.storage.from(BUCKET).remove([path]);
      toast({ title: `Video ${id} dihapus` });
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal menghapus', description: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const play = async (id) => {
    if (preview?.id === id) { setPreview(null); return; }
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(assets[id].storage_path, 600);
    if (error || !data?.signedUrl) { toast({ variant: 'destructive', title: 'Gagal membuka video' }); return; }
    setPreview({ id, url: data.signedUrl });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) =>
      (!onlyMissing || !assets[e.id]) &&
      (!q || e.id.toLowerCase().includes(q) || (e.name || '').toLowerCase().includes(q) || (e.grp || '').toLowerCase().includes(q)));
  }, [exercises, assets, query, onlyMissing]);

  const done = Object.keys(assets).length;

  return (
    <Panel className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9" placeholder="Cari kode, nama, atau kelompok latihan" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Cari latihan" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> Hanya yang belum ada video
        </label>
        <Pill tone={done === exercises.length && done > 0 ? 'ok' : 'neutral'} dot={false}>{done} dari {exercises.length} ada video</Pill>
      </div>

      <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={onFile} />

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Tidak ada latihan yang cocok">Ubah kata kunci atau filter.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((e) => {
            const a = assets[e.id];
            const busy = busyId === e.id;
            return (
              <li key={e.id} className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs bg-slate-100 text-slate-700 rounded px-2 py-1">{e.id}</span>
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-medium text-slate-900 break-words">{e.name}</p>
                    <p className="text-xs text-slate-500">{e.grp}</p>
                  </div>
                  {a ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" /> {[fmtDur(a.duration_seconds), a.size_bytes ? fmtSize(a.size_bytes) : ''].filter(Boolean).join(' · ') || 'Ada'}
                    </span>
                  ) : <span className="text-xs text-slate-400">Belum ada video</span>}
                  <div className="flex items-center gap-1.5">
                    {a && <Button size="sm" variant="outline" onClick={() => play(e.id)} disabled={busy}><Play className="w-4 h-4 mr-1" /> {preview?.id === e.id ? 'Tutup' : 'Putar'}</Button>}
                    <Button size="sm" onClick={() => pick(e.id)} disabled={busy}>
                      {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />} {a ? 'Ganti' : 'Unggah'}
                    </Button>
                    {a && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(e.id)} disabled={busy} aria-label={`Hapus video ${e.id}`}><Trash2 className="w-4 h-4" /></Button>}
                  </div>
                </div>
                {preview?.id === e.id && (
                  <video src={preview.url} controls autoPlay playsInline className="mt-3 w-full max-w-xl rounded-lg bg-black" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
};

export default ExerciseVideoManager;
