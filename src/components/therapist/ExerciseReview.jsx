import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Play, CheckCircle2, Search, Save, Film, Info } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { isReviewExempt } from '@/lib/exerciseReviewExempt';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const LABEL = 'block text-sm font-medium text-slate-700 mb-1';
const BUCKET = 'exercise-videos';

// Urutan antrean tiap terapis digeser sesuai posisinya di klinik, jadi 4 terapis yang membuka halaman ini
// bersamaan mulai dari bagian daftar yang berbeda dan tidak mengerjakan video yang sama.
const GUIDE_STEPS = [
  ['Lihat videonya sampai selesai', 'Putar video latihan dan perhatikan gerakannya dengan teliti.'],
  ['Sesuaikan nama latihan dengan gerakan di video', 'Contoh: namanya "Stretching flexor", tetapi di video yang diperagakan stretching extensor. Maka namanya diubah menjadi "Stretching extensor".'],
  ['Periksa cara melakukan', 'Pastikan langkah-langkahnya sesuai dengan yang diperagakan di video dan mudah dipahami pasien.'],
  ['Periksa jenis latihan', 'Pastikan jenisnya tepat, misalnya Penguatan, Peregangan, atau Mobilitas.'],
  ['Periksa dosis latihan', 'Pastikan jumlah pengulangan, set, atau durasinya wajar untuk gerakan itu.'],
  ['Simpan', 'Tekan "Simpan & tandai direview". Latihan yang sudah direview tidak perlu direview terapis lain, dan owner akan diberi tahu.'],
];

const rotate = (list, index, count) => {
  if (!list.length || count < 2) return list;
  const start = Math.floor((index * list.length) / count);
  return [...list.slice(start), ...list.slice(0, start)];
};

const ExerciseReview = ({ therapist }) => {
  const { toast } = useToast();
  const [exercises, setExercises] = useState([]);
  const [videos, setVideos] = useState(new Set());
  const [reviews, setReviews] = useState({});
  const [mates, setMates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('todo');
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [form, setForm] = useState({ name: '', grp: '', howTo: '', dose: '' });
  const [videoUrl, setVideoUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [guideOpen, setGuideOpen] = useState(true);

  const load = useCallback(async () => {
    const [ex, vi, rv, th] = await Promise.all([
      supabase.from('plan_exercises').select('id, name, grp, how_to, dose').order('id'),
      supabase.from('exercise_video_assets').select('exercise_id'),
      supabase.from('exercise_reviews').select('exercise_id, reviewer_name, reviewed_at'),
      supabase.from('physiotherapists').select('id, name').eq('clinic_id', therapist.clinic_id).eq('is_active', true).order('id'),
    ]);
    const err = ex.error || vi.error || rv.error;
    if (err) toast({ variant: 'destructive', title: 'Gagal memuat daftar latihan', description: err.message });
    setExercises(ex.data || []);
    setVideos(new Set((vi.data || []).map((v) => v.exercise_id)));
    setReviews(Object.fromEntries((rv.data || []).map((r) => [r.exercise_id, r])));
    setMates((th.data || []).filter((t) => !isReviewExempt(t.name)).map((t) => t.id));
    setLoading(false);
  }, [therapist.clinic_id, toast]);

  useEffect(() => { load(); }, [load]);

  const myIndex = Math.max(0, mates.indexOf(therapist.id));
  const withVideo = useMemo(() => exercises.filter((e) => videos.has(e.id)), [exercises, videos]);
  const todo = useMemo(() => rotate(withVideo.filter((e) => !reviews[e.id]), myIndex, mates.length), [withVideo, reviews, myIndex, mates.length]);
  const done = useMemo(() => withVideo.filter((e) => reviews[e.id]), [withVideo, reviews]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tab === 'todo' ? todo : done).filter((e) =>
      !q || e.id.toLowerCase().includes(q) || (e.name || '').toLowerCase().includes(q) || (e.grp || '').toLowerCase().includes(q));
  }, [tab, todo, done, query]);

  const open = async (e) => {
    setActiveId(e.id);
    setForm({ name: e.name || '', grp: e.grp || '', howTo: e.how_to || '', dose: e.dose || '' });
    setVideoUrl(null);
    const { data: asset } = await supabase.from('exercise_video_assets').select('storage_path').eq('exercise_id', e.id).maybeSingle();
    if (!asset) return;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(asset.storage_path, 1800);
    setVideoUrl(data?.signedUrl || null);
  };

  const active = exercises.find((e) => e.id === activeId);
  const activeReview = activeId ? reviews[activeId] : null;
  const setField = (k) => (ev) => setForm((f) => ({ ...f, [k]: ev.target.value }));

  // Kunci scroll halaman di belakang saat modal review terbuka, supaya yang bergeser modalnya, bukan kartu di belakangnya.
  const modalOpen = Boolean(active);
  useEffect(() => {
    if (!modalOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [modalOpen]);

  const save = async (ev) => {
    ev.preventDefault();
    setSaving(true);
    const { error } = await supabase.rpc('review_plan_exercise', {
      p_exercise_id: activeId, p_name: form.name, p_grp: form.grp, p_how_to: form.howTo, p_dose: form.dose,
    });
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Review tidak tersimpan', description: error.message });
      await load();
      return;
    }
    toast({ title: activeReview ? `Review ${activeId} diperbarui` : `Review ${activeId} selesai`, description: 'Owner sudah diberi tahu.' });
    setActiveId(null);
    setVideoUrl(null);
    await load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-app-lg border border-slate-200 bg-white p-4 space-y-3">
        <p className="text-sm text-slate-600">
          Tonton video, lalu periksa nama, jenis, cara melakukan, dan dosisnya. Antrean tiap terapis dimulai dari bagian yang berbeda,
          dan latihan yang sudah direview terapis mana pun tidak perlu direview lagi. Latihan yang sudah direview tetap bisa diedit bila ada yang salah. Kode latihan tidak bisa diubah.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setGuideOpen(true)}><Info className="w-4 h-4 mr-1" /> Panduan</Button>
          <Button size="sm" variant={tab === 'todo' ? 'default' : 'outline'} onClick={() => setTab('todo')}>Belum direview ({todo.length})</Button>
          <Button size="sm" variant={tab === 'done' ? 'default' : 'outline'} onClick={() => setTab('done')}>Sudah direview ({done.length})</Button>
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input className="pl-9" placeholder="Cari kode, nama, atau jenis" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Cari latihan" />
          </div>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-8">{tab === 'todo' ? 'Semua video sudah direview. Terima kasih!' : 'Belum ada yang direview.'}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-app-lg border border-slate-200 bg-white">
          {shown.map((e) => {
            const r = reviews[e.id];
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-3 p-3">
                <span className="font-mono text-xs bg-slate-100 text-slate-700 rounded px-2 py-1">{e.id}</span>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-medium text-slate-900 break-words">{e.name}</p>
                  <p className="text-xs text-slate-500">{e.grp}</p>
                </div>
                {r && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" /> Direview {r.reviewer_name}
                  </span>
                )}
                <Button size="sm" variant={r ? 'outline' : 'default'} onClick={() => open(e)}>
                  <Play className="w-4 h-4 mr-1" /> {r ? 'Edit' : 'Review'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cara mereview video latihan</DialogTitle>
            <DialogDescription>Ikuti langkah berikut untuk setiap latihan.</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3">
            {GUIDE_STEPS.map(([title, text], i) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-app-accent text-xs font-semibold text-white">{i + 1}</span>
                <div>
                  <p className="text-sm font-medium text-slate-900">{title}</p>
                  <p className="text-sm text-slate-600">{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <DialogFooter><Button onClick={() => setGuideOpen(false)}>Mengerti, mulai review</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {active && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-2xl sm:rounded-2xl bg-white p-4 sm:p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{activeReview ? 'Edit review' : 'Review latihan'} <span className="font-mono text-slate-500">{active.id}</span></h2>
              {activeReview && <p className="text-sm text-emerald-700">Sudah direview oleh {activeReview.reviewer_name}. Jika ada yang salah, perbaiki lalu simpan ulang.</p>}
            </div>
            {videoUrl
              ? <video src={videoUrl} controls playsInline className="w-full rounded-lg bg-black" />
              : <div className="flex items-center justify-center gap-2 h-40 rounded-lg bg-slate-100 text-slate-500 text-sm"><Film className="w-5 h-5" /> Memuat video…</div>}
            <form onSubmit={save} className="space-y-3">
              <div>
                <label htmlFor="rv-name" className={LABEL}>Nama latihan</label>
                <Input id="rv-name" value={form.name} onChange={setField('name')} maxLength={120} required />
              </div>
              <div>
                <label htmlFor="rv-grp" className={LABEL}>Jenis latihan</label>
                <Input id="rv-grp" value={form.grp} onChange={setField('grp')} maxLength={60} required />
              </div>
              <div>
                <label htmlFor="rv-how" className={LABEL}>Cara melakukan</label>
                <Textarea id="rv-how" value={form.howTo} onChange={setField('howTo')} rows={4} />
              </div>
              <div>
                <label htmlFor="rv-dose" className={LABEL}>Dosis</label>
                <Input id="rv-dose" value={form.dose} onChange={setField('dose')} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => { setActiveId(null); setVideoUrl(null); }} disabled={saving}>
                  Batal
                </Button>
                <Button type="submit" disabled={saving || form.name.trim().length < 3 || !form.grp.trim()}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} {activeReview ? 'Simpan perubahan' : 'Simpan & tandai direview'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExerciseReview;
