import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, ImagePlus, Trash2, ImageOff, CheckCircle2, Upload } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { resizeImageToJpeg } from '@/lib/imageResize';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { confirmAction } from '@/lib/confirmAction';

const BUCKET = 'exercise-illustrations';
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

// Latihan yang belum punya video: terapis melengkapinya dengan foto ilustrasi gerakan.
const ExerciseIllustrations = ({ therapist }) => {
  const { toast } = useToast();
  const [exercises, setExercises] = useState([]);
  const [illus, setIllus] = useState({});
  const [urls, setUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('todo');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const fileRef = useRef(null);
  const targetId = useRef(null);

  const load = useCallback(async () => {
    const [ex, vi, il] = await Promise.all([
      supabase.from('plan_exercises').select('id, name, grp, how_to, dose').order('id'),
      supabase.from('exercise_video_assets').select('exercise_id'),
      supabase.from('exercise_illustrations').select('exercise_id, storage_path, uploader_name, updated_at'),
    ]);
    const err = ex.error || vi.error || il.error;
    if (err) toast({ variant: 'destructive', title: 'Gagal memuat daftar latihan', description: err.message });
    const hasVideo = new Set((vi.data || []).map((v) => v.exercise_id));
    setExercises((ex.data || []).filter((e) => !hasVideo.has(e.id)));
    const map = Object.fromEntries((il.data || []).map((r) => [r.exercise_id, r]));
    setIllus(map);

    const rows = Object.values(map);
    if (rows.length) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.storage_path), 3600);
      setUrls(Object.fromEntries(rows.map((r, i) => [r.exercise_id, signed?.[i]?.signedUrl || null])));
    } else {
      setUrls({});
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const todo = useMemo(() => exercises.filter((e) => !illus[e.id]), [exercises, illus]);
  const done = useMemo(() => exercises.filter((e) => illus[e.id]), [exercises, illus]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tab === 'todo' ? todo : done).filter((e) =>
      !q || e.id.toLowerCase().includes(q) || (e.name || '').toLowerCase().includes(q) || (e.grp || '').toLowerCase().includes(q));
  }, [tab, todo, done, query]);

  const pick = (id) => { targetId.current = id; fileRef.current?.click(); };

  const onFile = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    const id = targetId.current;
    if (!file || !id) return;
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Berkas harus berupa foto', description: 'Pilih file JPG, PNG, atau WebP.' });
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      toast({ variant: 'destructive', title: 'Foto terlalu besar', description: 'Maksimal 25 MB.' });
      return;
    }
    setBusyId(id);
    try {
      const blob = await resizeImageToJpeg(file);
      const path = `${id}.jpg`;
      const up = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
      if (up.error) throw up.error;
      const { error } = await supabase.from('exercise_illustrations').upsert({
        exercise_id: id, storage_path: path, size_bytes: blob.size,
        uploaded_by: therapist.user_id || null, uploader_name: therapist.name, updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast({ title: `Ilustrasi ${id} tersimpan` });
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Foto gagal diunggah', description: e.message });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (e) => {
    if (!(await confirmAction(`Hapus ilustrasi ${e.id}? Latihan ini akan kembali ke daftar "Belum ada ilustrasi".`))) return;
    setBusyId(e.id);
    const { error } = await supabase.from('exercise_illustrations').delete().eq('exercise_id', e.id);
    if (!error) await supabase.storage.from(BUCKET).remove([illus[e.id].storage_path]);
    setBusyId(null);
    if (error) { toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message }); return; }
    toast({ title: `Ilustrasi ${e.id} dihapus` });
    await load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <div className="rounded-app-lg border border-slate-200 bg-white p-4 space-y-3">
        <p className="text-sm text-slate-600">
          Daftar ini berisi latihan yang belum punya video. Unggah foto ilustrasi gerakannya (dari kamera atau galeri) supaya pasien tetap bisa melihat contoh gerakan.
          Mengunggah lagi akan mengganti foto lama.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={tab === 'todo' ? 'default' : 'outline'} onClick={() => setTab('todo')}>Belum ada ilustrasi ({todo.length})</Button>
          <Button size="sm" variant={tab === 'done' ? 'default' : 'outline'} onClick={() => setTab('done')}>Sudah ada ilustrasi ({done.length})</Button>
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input className="pl-9" placeholder="Cari kode, nama, atau jenis" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Cari latihan" />
          </div>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-8">{tab === 'todo' ? 'Semua latihan tanpa video sudah punya ilustrasi. Terima kasih!' : 'Belum ada ilustrasi yang diunggah.'}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-app-lg border border-slate-200 bg-white">
          {shown.map((e) => {
            const r = illus[e.id];
            const busy = busyId === e.id;
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                  {urls[e.id] ? <img src={urls[e.id]} alt={`Ilustrasi ${e.name}`} className="h-full w-full object-cover" loading="lazy" /> : <ImageOff className="h-5 w-5" />}
                </div>
                <span className="font-mono text-xs bg-slate-100 text-slate-700 rounded px-2 py-1">{e.id}</span>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-medium text-slate-900 break-words">{e.name}</p>
                  <p className="text-xs text-slate-500">{e.grp}</p>
                  {r && <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> Diunggah {r.uploader_name || 'terapis'}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant={r ? 'outline' : 'default'} onClick={() => pick(e.id)} disabled={busy}>
                    {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : r ? <Upload className="w-4 h-4 mr-1" /> : <ImagePlus className="w-4 h-4 mr-1" />}
                    {r ? 'Ganti foto' : 'Unggah foto'}
                  </Button>
                  {r && (
                    <Button size="sm" variant="ghost" onClick={() => remove(e)} disabled={busy} aria-label={`Hapus ilustrasi ${e.id}`}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ExerciseIllustrations;
