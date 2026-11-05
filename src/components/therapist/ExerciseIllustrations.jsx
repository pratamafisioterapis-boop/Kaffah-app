import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, ImagePlus, Trash2, ImageOff, CheckCircle2, Upload } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { resizeImageToJpeg } from '@/lib/imageResize';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { confirmAction } from '@/lib/confirmAction';
import { readExerciseIllustrationZip } from '@/lib/exerciseIllustrationZip';

const BUCKET = 'exercise-illustrations';
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

// Latihan yang belum punya video: terapis melengkapinya dengan foto ilustrasi gerakan.
const ExerciseIllustrations = ({ therapist }) => {
  const { toast } = useToast();
  const [exercises, setExercises] = useState([]);
  const [illus, setIllus] = useState({});
  const [steps, setSteps] = useState({});
  const [stepUrls, setStepUrls] = useState({});
  const [activeStep, setActiveStep] = useState({});
  const [zipPreview, setZipPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const zipFileRef = useRef(null);
  const [urls, setUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('todo');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const fileRef = useRef(null);
  const targetId = useRef(null);

  const load = useCallback(async () => {
    const [ex, vi, il, st] = await Promise.all([
      supabase.from('plan_exercises').select('id, name, grp, how_to, dose').order('id'),
      supabase.from('exercise_video_assets').select('exercise_id'),
      supabase.from('exercise_illustrations').select('exercise_id, storage_path, uploader_name, updated_at'),
      supabase.from('exercise_illustration_steps').select('exercise_id, step_number, storage_path').order('step_number'),
    ]);
    const err = ex.error || vi.error || il.error || st.error;
    if (err) toast({ variant: 'destructive', title: 'Gagal memuat daftar latihan', description: err.message });
    const hasVideo = new Set((vi.data || []).map((v) => v.exercise_id));
    setExercises((ex.data || []).filter((e) => !hasVideo.has(e.id)));
    const map = Object.fromEntries((il.data || []).map((r) => [r.exercise_id, r]));
    setIllus(map);
    const stepMap = {};
    for (const entry of st.data || []) (stepMap[entry.exercise_id] ||= []).push(entry);
    setSteps(stepMap);
    const allSteps = Object.values(stepMap).flat();
    if (allSteps.length) {
      const signedSteps = await supabase.storage.from(BUCKET).createSignedUrls(allSteps.map(s => s.storage_path), 3600);
      const urlMap = {};
      allSteps.forEach((st, index) => { (urlMap[st.exercise_id] ||= {})[st.step_number] = signedSteps.data?.[index]?.signedUrl || null; });
      setStepUrls(urlMap);
    } else setStepUrls({});

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

  const todo = useMemo(() => exercises.filter((e) => !illus[e.id] && !steps[e.id]?.length), [exercises, illus, steps]);
  const done = useMemo(() => exercises.filter((e) => illus[e.id] || steps[e.id]?.length), [exercises, illus, steps]);
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


  const onZipFile = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    setZipPreview(null);
    setImportProgress(null);
    try {
      const zip = await readExerciseIllustrationZip(file, new Set(exercises.map((e) => e.id.toUpperCase())));
      const existing = new Set(Object.values(steps).flat().map((r) => r.exercise_id.toUpperCase() + '/' + r.step_number));
      // Never overwrite an already imported stage or an existing legacy illustration.
      const included = zip.entries.filter((entry) => !existing.has(entry.id + '/' + entry.step) && !(entry.step === 1 && illus[entry.id]));
      const skipped = zip.entries.length - included.length;
      setZipPreview({ zip, included, skipped, name: file.name });
      if (!included.length) toast({ title: 'Tidak ada gambar baru untuk diimpor', description: 'Periksa ID latihan, penamaan step, dan ilustrasi yang sudah ada.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'ZIP tidak dapat dibaca', description: err.message });
    }
  };

  const importZip = async () => {
    if (!zipPreview || importing || !zipPreview.included.length) return;
    setImporting(true);
    const { zip, included } = zipPreview;
    const failed = [];
    let successful = 0;
    for (const [index, entry] of included.entries()) {
      setImportProgress({ done: index, total: included.length, successful, failures: failed.length });
      const path = entry.id + '/step-' + String(entry.step).padStart(2, '0') + '.' + entry.ext;
      try {
        const blob = await zip.extract(entry);
        const upload = await supabase.storage.from(BUCKET).upload(path, blob, {
          upsert: false, contentType: blob.type, cacheControl: '3600',
        });
        if (upload.error) throw upload.error;
        const save = await supabase.from('exercise_illustration_steps').upsert({
          exercise_id: entry.id, step_number: entry.step, storage_path: path, size_bytes: blob.size,
        }, { onConflict: 'exercise_id,step_number' });
        if (save.error) throw save.error;
        // Existing patient portal uses the legacy table, so the first image is
        // also registered as the primary illustration (without replacing any prior image).
        if (entry.step === 1 && !illus[entry.id]) {
          const legacy = await supabase.from('exercise_illustrations').upsert({
            exercise_id: entry.id, storage_path: path, size_bytes: blob.size,
            uploaded_by: therapist?.user_id || null,
            uploader_name: therapist?.name || 'Import ZIP', updated_at: new Date().toISOString(),
          }, { onConflict: 'exercise_id' });
          if (legacy.error) throw legacy.error;
        }
        successful++;
      } catch (error) {
        failed.push(entry.rawName + ': ' + (error?.message || 'Kesalahan tidak diketahui'));
      }
    }
    setImportProgress({ done: included.length, total: included.length, successful, failures: failed.length, failed });
    setZipPreview(null);
    setImporting(false);
    await load();
    toast({
      title: successful + ' gambar berhasil diimpor',
      description: failed.length ? failed.length + ' gagal; lihat laporan di bawah.' : 'Seluruh gambar berhasil disimpan ke Supabase.',
      ...(failed.length ? { variant: 'destructive' } : {}),
    });
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
      <input ref={zipFileRef} type="file" accept=".zip,application/zip" className="hidden" onChange={onZipFile} />
      <section className="rounded-app-lg border border-blue-200 bg-blue-50/60 p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-slate-900">Import Ilustrasi Massal (ZIP)</h3>
          <p className="text-sm text-slate-600 mt-1">
            Masukkan beberapa gambar per latihan dengan struktur folder <code>RO01/step-01.jpg</code>,
            <code className="ml-1">RO01/step-02.jpg</code>, dan seterusnya.
            ID harus sesuai kode latihan tanpa video. File gambar JPG, PNG, WebP maksimal 5 MB,
            maksimal 12 tahap per latihan, ZIP maksimal 200 MB. Berkas yang sudah terpasang tidak ditimpa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={importing} onClick={() => zipFileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" /> Pilih ZIP ilustrasi
          </Button>
          {zipPreview && <Button size="sm" variant="outline" disabled={importing} onClick={() => { setZipPreview(null); setImportProgress(null); }}>Batalkan</Button>}
        </div>
        {zipPreview && (
          <div className="rounded-lg bg-white border p-3 space-y-2 text-sm">
            <p className="font-medium break-all">{zipPreview.name}</p>
            <p>{zipPreview.included.length} gambar siap diimpor untuk {new Set(zipPreview.included.map(e => e.id)).size} latihan.
              {zipPreview.skipped > 0 && <span> {zipPreview.skipped} gambar sudah ada (dilewati).</span>}
              {zipPreview.zip.rejected.length > 0 && <span> {zipPreview.zip.rejected.length} file tidak cocok (dilewati).</span>}
            </p>
            {!!zipPreview.zip.rejected.length && <details><summary className="cursor-pointer text-amber-800">Lihat file yang ditolak</summary>
              <ul className="max-h-36 overflow-y-auto list-disc pl-5 mt-1">{zipPreview.zip.rejected.map((item, i) => <li key={i}>{item}</li>)}</ul>
            </details>}
            <Button size="sm" disabled={importing || !zipPreview.included.length} onClick={importZip}>
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Mulai impor {zipPreview.included.length} gambar
            </Button>
          </div>
        )}
        {importProgress && <div className="rounded-lg bg-white border p-3 text-sm space-y-2">
          <p>Progres: {importProgress.done}/{importProgress.total} gambar • {importProgress.successful} berhasil • {importProgress.failures} gagal</p>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all" style={{ width: (importProgress.total ? 100 * importProgress.done / importProgress.total : 0) + '%' }} />
          </div>
          {!!importProgress.failed?.length && <details><summary className="cursor-pointer text-red-700">Lihat rincian kegagalan</summary>
            <ul className="list-disc pl-5 max-h-44 overflow-auto mt-1">{importProgress.failed.map((item, i) => <li key={i}>{item}</li>)}</ul>
          </details>}
        </div>}
      </section>
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
            const stageList = steps[e.id] || [];
            const stageIndex = Math.min(activeStep[e.id] || 0, Math.max(0, stageList.length - 1));
            const stage = stageList[stageIndex];
            const stageUrl = stage ? stepUrls[e.id]?.[stage.step_number] : null;
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                  {stageUrl || urls[e.id] ? <img src={stageUrl || urls[e.id]} alt={`Ilustrasi ${e.name}`} className="h-full w-full object-cover" loading="lazy" /> : <ImageOff className="h-5 w-5" />}
                </div>
                <span className="font-mono text-xs bg-slate-100 text-slate-700 rounded px-2 py-1">{e.id}</span>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-medium text-slate-900 break-words">{e.name}</p>
                  <p className="text-xs text-slate-500">{e.grp}</p>
                  {stageList.length > 0 && <div className="mt-1 flex items-center gap-2 text-xs text-blue-700">
                    <span>Gambar {stageIndex + 1} dari {stageList.length}</span>
                    {stageList.length > 1 && <>
                      <button className="rounded border px-2 py-0.5 disabled:opacity-40" disabled={stageIndex === 0} onClick={() => setActiveStep(v => ({ ...v, [e.id]: stageIndex - 1 }))} aria-label={'Gambar sebelumnya untuk ' + e.id}>‹</button>
                      <button className="rounded border px-2 py-0.5 disabled:opacity-40" disabled={stageIndex === stageList.length - 1} onClick={() => setActiveStep(v => ({ ...v, [e.id]: stageIndex + 1 }))} aria-label={'Gambar berikutnya untuk ' + e.id}>›</button>
                    </>}
                  </div>}
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
