import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, ClipboardList, ArrowUp, ArrowDown, Trash2, Plus, RotateCcw } from 'lucide-react';
import { QUESTIONNAIRE_CLINIC_IDS } from '@/lib/clinicIds';
import { DEFAULT_PRAXIS_QUESTIONS, normalizeQuestions } from '@/lib/praxisQuestionnaire';

const TYPE_LABELS = { choice: 'Pilihan', text: 'Teks singkat', textarea: 'Teks panjang' };

// Editor kuesioner feedback pasien (khusus Praxis): owner mengubah, menambah,
// menghapus, dan mengurutkan pertanyaan. Disimpan di clinics.feedback_questionnaire.
const FeedbackQuestionnaireSettings = () => {
  const { userDetails } = useAuth();
  const { toast } = useToast();
  const clinicId = userDetails?.clinic_id;
  const [questions, setQuestions] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!QUESTIONNAIRE_CLINIC_IDS.includes(clinicId)) return;
    let cancelled = false;
    supabase.from('clinics').select('feedback_questionnaire').eq('id', clinicId).single().then(({ data }) => {
      if (!cancelled) setQuestions(normalizeQuestions(data?.feedback_questionnaire) || DEFAULT_PRAXIS_QUESTIONS);
    });
    return () => { cancelled = true; };
  }, [clinicId]);

  if (!QUESTIONNAIRE_CLINIC_IDS.includes(clinicId)) return null;
  if (!questions) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-app-accent" /></div>;
  }

  const update = (i, patch) => setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  const move = (i, d) => setQuestions((qs) => {
    const j = i + d;
    if (j < 0 || j >= qs.length) return qs;
    const next = [...qs];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const setRating = (i) => setQuestions((qs) => qs.map((q, idx) => ({ ...q, isRating: idx === i })));
  const add = () => setQuestions((qs) => [
    ...qs,
    { id: `q${Date.now()}`, type: 'choice', required: true, isRating: false, label: '', options: ['Ya', 'Tidak'] },
  ]);

  const handleSave = async () => {
    const cleaned = normalizeQuestions(questions);
    if (!cleaned || cleaned.length !== questions.length) {
      toast({
        variant: 'destructive',
        title: 'Kuesioner belum valid',
        description: 'Setiap pertanyaan harus punya teks, dan pertanyaan pilihan minimal 2 opsi.',
      });
      return;
    }
    if (!cleaned.some((q) => q.type === 'choice' && q.isRating)) {
      toast({ variant: 'destructive', title: 'Pilih satu pertanyaan penentu rating', description: 'Tandai satu pertanyaan pilihan sebagai penentu rating bintang.' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('clinics').update({ feedback_questionnaire: cleaned }).eq('id', clinicId);
    setSaving(false);
    if (error) toast({ variant: 'destructive', title: 'Gagal menyimpan kuesioner', description: error.message });
    else toast({ title: 'Kuesioner tersimpan' });
  };

  return (
    <div className="bg-white p-6 rounded-app border border-slate-200 space-y-4 max-w-2xl">
      <h3 className="font-semibold text-slate-800 flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Kuesioner Feedback Pasien</h3>
      <p className="text-sm text-slate-500">
        Pertanyaan yang tampil di link feedback pasien sebelum diarahkan ke Google Review. Gunakan <code>{'{clinic}'}</code> untuk nama klinik.
        Opsi pilihan diurutkan dari yang terbaik ke terburuk; pertanyaan penentu rating memetakannya ke bintang 5 → 1.
      </p>

      {questions.map((q, i) => (
        <div key={q.id} className="border border-slate-200 rounded-app-sm p-3 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-xs text-slate-400 mt-2">{i + 1}.</span>
            <textarea
              value={q.label}
              onChange={(e) => update(i, { label: e.target.value })}
              rows={2}
              placeholder="Teks pertanyaan"
              className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            />
            <div className="flex flex-col">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Naik" className="p-1 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === questions.length - 1} aria-label="Turun" className="p-1 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
            </div>
            <button type="button" onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))} aria-label="Hapus" className="p-1 text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <select
              value={q.type}
              onChange={(e) => update(i, { type: e.target.value, isRating: e.target.value === 'choice' ? q.isRating : false, options: q.options?.length ? q.options : ['Ya', 'Tidak'] })}
              className="rounded-md border border-slate-200 px-2 py-1"
            >
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={!!q.required} onChange={(e) => update(i, { required: e.target.checked })} /> Wajib diisi
            </label>
            {q.type === 'choice' && (
              <label className="flex items-center gap-1.5">
                <input type="radio" name="rating-q" checked={!!q.isRating} onChange={() => setRating(i)} /> Penentu rating bintang
              </label>
            )}
          </div>
          {q.type === 'choice' && (
            <textarea
              value={(q.options || []).join('\n')}
              onChange={(e) => update(i, { options: e.target.value.split('\n') })}
              rows={Math.max(3, (q.options || []).length)}
              placeholder="Satu opsi per baris (terbaik di atas)"
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            />
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={add}><Plus className="w-4 h-4 mr-1" /> Tambah Pertanyaan</Button>
        <Button type="button" variant="outline" onClick={() => setQuestions(DEFAULT_PRAXIS_QUESTIONS)}><RotateCcw className="w-4 h-4 mr-1" /> Kembalikan Default</Button>
        <Button type="button" onClick={handleSave} disabled={saving} className="ml-auto">
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Simpan
        </Button>
      </div>
    </div>
  );
};

export default FeedbackQuestionnaireSettings;
