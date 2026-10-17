import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Upload, Trash2, Play, Search, CheckCircle2, Plus, Pencil, Check, X } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { nextExerciseCode, summarizePrefixes, generatePrefix } from '@/lib/exerciseCodes';
import { Panel, Pill, EmptyState } from '@/components/superadmin/ui';
import { confirmAction } from '@/lib/confirmAction';

// Super Admin menambah jenis latihan baru (kode dibuat otomatis) dan mengunggah satu video per kode latihan
// Plan SOAP (plan_exercises). Berkas masuk ke bucket
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

const EMPTY_FORM = { mode: 'existing', prefix: '', name: '', grp: '', howTo: '', dose: '', progression: '', caution: '' };
const nz = (v) => (v && v.trim() ? v.trim() : null);

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
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState(null); // kode latihan yang namanya sedang diedit
  const [editName, setEditName] = useState('');
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

  const startEdit = (e) => { setEditId(e.id); setEditName(e.name || ''); };
  const cancelEdit = () => { setEditId(null); setEditName(''); };

  // Ganti nama saja; kode tidak pernah berubah. SOAP yang sudah tersimpan menyimpan teks rencana saat itu,
  // sedangkan aplikasi pasien dan pencarian Plan SOAP langsung memakai nama baru.
  const saveName = async (id) => {
    const name = editName.trim();
    const current = exercises.find((x) => x.id === id);
    if (!current || name === current.name) { cancelEdit(); return; }
    if (name.length < 3 || name.length > 120) {
      toast({ variant: 'destructive', title: 'Nama latihan 3–120 karakter' });
      return;
    }
    setBusyId(id);
    const { error } = await supabase.from('plan_exercises').update({ name }).eq('id', id);
    setBusyId(null);
    if (error) { toast({ variant: 'destructive', title: 'Gagal mengganti nama', description: error.message }); return; }
    setExercises((prev) => prev.map((x) => (x.id === id ? { ...x, name } : x)));
    toast({ title: `Nama ${id} diperbarui` });
    cancelEdit();
  };

  const prefixes = useMemo(() => summarizePrefixes(exercises), [exercises]);
  const groups = useMemo(() => [...new Set(exercises.map((e) => e.grp).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [exercises]);
  // Awalan baru dibuat otomatis dari nama latihan (tidak diketik); awalan yang ada dipilih dari daftar.
  const nameReady = form.name.trim().length >= 3;
  const chosenPrefix = form.mode === 'new'
    ? (nameReady ? generatePrefix(form.name, new Set(prefixes.map((p) => p.prefix))) || '' : '')
    : form.prefix;
  const prefixValid = Boolean(chosenPrefix);
  const codePreview = prefixValid ? nextExerciseCode(chosenPrefix, exercises.map((e) => e.id)) : null;
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const createExercise = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const grp = form.grp.trim();
    if (!prefixValid) { toast({ variant: 'destructive', title: 'Awalan kode belum ada', description: 'Pilih awalan dari daftar, atau pilih awalan baru (otomatis) dan isi nama latihan dulu.' }); return; }
    if (name.length < 3 || !grp) { toast({ variant: 'destructive', title: 'Nama dan kelompok latihan wajib diisi' }); return; }
    setCreating(true);
    try {
      let ids = exercises.map((x) => x.id);
      let created = null;
      // Kode = nomor terbesar + 1. Jika ada Super Admin lain yang baru saja memakai nomor itu (bentrok kunci),
      // baca ulang dan coba lagi.
      for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
        const id = nextExerciseCode(chosenPrefix, ids);
        const { error } = await supabase.from('plan_exercises').insert({
          id, name, grp, how_to: nz(form.howTo), dose: nz(form.dose), progression: nz(form.progression), caution: nz(form.caution),
        });
        if (!error) { created = id; break; }
        if (error.code !== '23505') throw error;
        const { data } = await supabase.from('plan_exercises').select('id').like('id', `${chosenPrefix}%`);
        ids = (data || []).map((r) => r.id);
      }
      if (!created) throw new Error('Kode bentrok berulang kali. Coba lagi sebentar lagi.');
      toast({ title: `Latihan ${created} dibuat`, description: 'Sudah bisa dipilih di Plan SOAP. Unggah videonya dari daftar ini.' });
      setAddOpen(false);
      setForm(EMPTY_FORM);
      setOnlyMissing(false);
      setQuery(created);
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal membuat jenis latihan', description: err.message });
    } finally {
      setCreating(false);
    }
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
        <Button onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-1" /> Tambah jenis latihan</Button>
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
                    {editId === e.id ? (
                      <form className="flex items-center gap-1.5" onSubmit={(ev) => { ev.preventDefault(); saveName(e.id); }}>
                        <Input value={editName} onChange={(ev) => setEditName(ev.target.value)} maxLength={120} autoFocus
                          onKeyDown={(ev) => { if (ev.key === 'Escape') cancelEdit(); }} aria-label={`Nama latihan ${e.id}`} />
                        <Button type="submit" size="sm" disabled={busy} aria-label="Simpan nama">
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} disabled={busy} aria-label="Batal ganti nama"><X className="w-4 h-4" /></Button>
                      </form>
                    ) : (
                      <p className="font-medium text-slate-900 break-words">
                        {e.name}
                        <button type="button" onClick={() => startEdit(e)} className="ml-1.5 inline-flex align-middle rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Ganti nama ${e.id}`} title="Ganti nama"><Pencil className="w-3.5 h-3.5" /></button>
                      </p>
                    )}
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

      <Dialog open={addOpen} onOpenChange={(o) => { if (!creating) setAddOpen(o); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah jenis latihan</DialogTitle>
            <DialogDescription>Kode dibuat otomatis dari awalan + nomor berikutnya. Latihan baru langsung bisa dipilih terapis di Plan SOAP.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createExercise} className="space-y-4">
            <div>
              <label htmlFor="ex-prefix" className="block text-sm font-medium text-slate-700 mb-1">Awalan kode</label>
              <select id="ex-prefix" className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={form.mode === 'new' ? '__baru' : form.prefix}
                onChange={(e) => setForm((f) => (e.target.value === '__baru' ? { ...f, mode: 'new', prefix: '' } : { ...f, mode: 'existing', prefix: e.target.value }))}>
                <option value="">Pilih awalan…</option>
                <option value="__baru">Awalan baru (dibuat otomatis)</option>
                {prefixes.map((p) => <option key={p.prefix} value={p.prefix}>{p.prefix} · {p.samples.join(', ')} ({p.count} latihan)</option>)}
              </select>
              {form.mode === 'new' && (
                <p className="mt-2 text-xs text-slate-500">
                  Awalan dibuat otomatis dari nama latihan (mis. Bridging → BR) dan dijamin belum dipakai. Gunakan ini hanya jika latihan tidak cocok dengan awalan yang ada.
                </p>
              )}
              <p className="mt-2 text-sm text-slate-600">
                Kode yang akan dibuat: <b className="font-mono text-slate-900">{codePreview || '—'}</b>
                {form.mode === 'new' && !nameReady && <span className="ml-2 text-xs text-slate-400">(isi nama latihan dulu)</span>}
              </p>
            </div>
            <div>
              <label htmlFor="ex-name" className="block text-sm font-medium text-slate-700 mb-1">Nama latihan</label>
              <Input id="ex-name" value={form.name} onChange={setField('name')} maxLength={120} placeholder="mis. Chin tuck (retraksi servikal)" required />
            </div>
            <div>
              <label htmlFor="ex-grp" className="block text-sm font-medium text-slate-700 mb-1">Kelompok</label>
              <Input id="ex-grp" list="ex-grp-list" value={form.grp} onChange={setField('grp')} maxLength={60} placeholder="mis. Penguatan, Peregangan, Mobilitas" required />
              <datalist id="ex-grp-list">{groups.map((g) => <option key={g} value={g} />)}</datalist>
            </div>
            <div>
              <label htmlFor="ex-how" className="block text-sm font-medium text-slate-700 mb-1">Cara melakukan <span className="font-normal text-slate-400">(tampil ke pasien)</span></label>
              <Textarea id="ex-how" value={form.howTo} onChange={setField('howTo')} rows={3} placeholder="Langkah singkat dalam bahasa awam." />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="ex-dose" className="block text-sm font-medium text-slate-700 mb-1">Dosis bawaan</label>
                <Input id="ex-dose" value={form.dose} onChange={setField('dose')} placeholder="mis. 10 kali x 3" />
              </div>
              <div>
                <label htmlFor="ex-prog" className="block text-sm font-medium text-slate-700 mb-1">Progresi</label>
                <Input id="ex-prog" value={form.progression} onChange={setField('progression')} placeholder="mis. Tambah tahan 5 detik" />
              </div>
            </div>
            <div>
              <label htmlFor="ex-caution" className="block text-sm font-medium text-slate-700 mb-1">Perhatian</label>
              <Input id="ex-caution" value={form.caution} onChange={setField('caution')} placeholder="mis. Tanpa nyeri tajam" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={creating}>Batal</Button>
              <Button type="submit" disabled={creating || !prefixValid || form.name.trim().length < 3 || !form.grp.trim()}>
                {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />} Buat latihan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Panel>
  );
};

export default ExerciseVideoManager;
