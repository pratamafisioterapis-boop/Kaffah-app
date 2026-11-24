import React, { useState } from 'react';
import { Check, Mic } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import VoiceDictationButton from '@/components/therapist/VoiceDictationButton';
import { parseSubjectiveDictation } from '@/lib/soapDictation';

/**
 * Dikte / tulis bebas untuk Subjective. Tidak butuh diagnosa atau template terpilih:
 * terapis bercerita, tombol "Susun ke Subjective" merapikannya dan menarik NRS, pemberat,
 * peringan, dan red flag bila disebut. Yang tidak terbaca tetap masuk sebagai Keluhan Utama.
 */
const SubjectiveDictationBox = ({ disabled = false, onApply }) => {
  const [draft, setDraft] = useState('');
  const [found, setFound] = useState(null);
  const ready = draft.trim().length >= 10;

  const apply = () => {
    const { text, found: got } = parseSubjectiveDictation(draft);
    if (!text) return;
    onApply(text);
    setFound(got);
    setDraft('');
  };

  return (
    <div className="mb-3 rounded-xl border border-app-accent/20 bg-white p-3">
      <div className="flex items-center gap-1.5">
        <Mic className="h-4 w-4 shrink-0 text-app-accent" aria-hidden="true" />
        <h4 className="text-sm font-bold text-slate-800">Dikte atau tulis keluhan</h4>
      </div>
      <p className="mt-0.5 text-xs text-slate-500">Bicara bebas, tanpa memilih diagnosa atau template dulu.</p>
      <label htmlFor="soap-dictation-draft" className="sr-only">Keluhan pasien</label>
      <Textarea
        id="soap-dictation-draft"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        placeholder="Mis. nyeri punggung bawah sejak 2 minggu, nyeri 6 dari 10, bertambah saat duduk lama. Tidak ada red flag."
        className="mt-2 min-h-[72px] resize-none rounded-lg border-slate-200 bg-slate-50/80 text-sm focus:bg-white"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="[&>div]:mb-0">
          <VoiceDictationButton
            disabled={disabled}
            onAppend={(t) => setDraft((prev) => (prev.trim() ? `${prev.replace(/\s+$/, '')} ${t}` : t))}
          />
        </div>
        <button
          type="button"
          onClick={apply}
          disabled={!ready || disabled}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-app-accent px-3.5 text-sm font-semibold text-white hover:bg-app-accent-hover disabled:opacity-50"
        >
          <Check className="h-4 w-4" /> Susun ke Subjective
        </button>
      </div>
      {found && (
        <p className="mt-2 text-xs text-emerald-700" aria-live="polite">
          Masuk ke Subjective{found.length ? `. Terbaca: ${found.join(', ')}` : ', tersimpan sebagai Keluhan Utama'}.
        </p>
      )}
    </div>
  );
};

export default SubjectiveDictationBox;
