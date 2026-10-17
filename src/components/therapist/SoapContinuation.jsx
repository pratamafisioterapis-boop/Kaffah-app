import React, { useState } from 'react';
import { Check, ChevronDown, History, Pencil, Repeat2 } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Alur "terapi lanjutan": pasien yang sudah punya SOAP ditanya apakah diagnosanya masih sama.
// Bila sama, S/O/P disalin dari kunjungan lalu dan terapis cukup mengisi perkembangan + menyesuaikan tindakan.

export const PROGRESS_NOTE_RE = /(^|\n)Update Perkembangan:[^\n]*/i;

const STATUS = [
  { key: 'Membaik', active: 'border-emerald-600 bg-emerald-600 text-white' },
  { key: 'Tetap', active: 'border-slate-600 bg-slate-600 text-white' },
  { key: 'Memburuk', active: 'border-rose-600 bg-rose-600 text-white' },
];

// Sisipkan / ganti / hapus baris "Update Perkembangan" di Subjective.
export const applyProgressNote = (text, line) => {
  const base = (text || '').trim();
  if (!line) return base.replace(PROGRESS_NOTE_RE, '').trim();
  return PROGRESS_NOTE_RE.test(base)
    ? base.replace(PROGRESS_NOTE_RE, (_, lead) => `${lead}${line}`)
    : [base, line].filter(Boolean).join('\n\n');
};

// Baris "Update Perkembangan" harus satu baris: PROGRESS_NOTE_RE hanya mengganti baris pertama,
// jadi Enter di kolom catatan dijadikan spasi agar sisa baris tidak menumpuk tiap ketikan.
const buildNoteLine = (status, note) => {
  const parts = [status, note.replace(/\s*\n+\s*/g, ' ').trim()].filter(Boolean);
  return parts.length ? `Update Perkembangan: ${parts.join('. ')}` : '';
};

const formatDay = (value) => {
  try { return format(new Date(value), 'd MMM yyyy', { locale: localeId }); } catch { return ''; }
};

/**
 * Kartu pertanyaan di atas form. decision: null (belum dijawab) | 'same' | 'different'.
 */
export const SoapContinuationPrompt = ({ record, diagnosisLabels, decision, onSame, onDifferent, onReset, onOpenHistory }) => {
  const [expanded, setExpanded] = useState(false);
  if (!record || diagnosisLabels.length === 0) return null;
  const day = formatDay(record.created_at);

  if (decision) {
    return (
      <div className="flex items-center gap-2 border-b border-slate-100 bg-app-soft/40 px-4 py-2.5 text-sm text-slate-700">
        <Repeat2 className="h-4 w-4 shrink-0 text-app-accent" aria-hidden="true" />
        <p className="min-w-0 flex-1 leading-snug">
          {decision === 'same' ? <>Lanjutan SOAP <strong className="font-semibold">{day}</strong>, diagnosa sama.</> : <>Diagnosa berbeda, diisi dari awal.</>}
        </p>
        <button type="button" onClick={onReset} className="tap-target shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-app-accent-hover hover:bg-white">
          Ubah
        </button>
      </div>
    );
  }

  const subjective = (record.subjective || '').trim();
  return (
    <section aria-label="Lanjutan terapi" className="border-b border-slate-100 bg-app-soft/50 px-4 py-4 sm:px-6">
      <h3 className="text-base font-semibold leading-snug text-slate-900">Diagnosa masih sama dengan kunjungan terakhir?</h3>
      <p className="mt-0.5 text-xs text-slate-500">SOAP terakhir {day}</p>

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {diagnosisLabels.map((label) => (
          <li key={label} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">{label}</li>
        ))}
      </ul>

      {subjective && (
        <div className="mt-3 rounded-app border border-slate-200 bg-white px-3 py-2.5">
          <p className={cn('whitespace-pre-line text-sm leading-relaxed text-slate-700', !expanded && 'line-clamp-3')}>{subjective}</p>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="tap-target mt-1 inline-flex items-center gap-1 text-xs font-semibold text-app-accent-hover"
          >
            {expanded ? 'Ringkas' : 'Lihat Subjective lengkap'}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
          </button>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
        <button
          type="button"
          onClick={onSame}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-app bg-app-accent px-4 text-sm font-semibold text-white shadow-sm hover:bg-app-accent-hover active:scale-[0.99]"
        >
          <Check className="h-4 w-4" /> Ya, sama
        </button>
        <button
          type="button"
          onClick={onDifferent}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-app border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.99]"
        >
          <Pencil className="h-4 w-4" /> Berbeda
        </button>
      </div>
      <button type="button" onClick={onOpenHistory} className="tap-target mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-app-accent-hover">
        <History className="h-3.5 w-3.5" /> Lihat riwayat SOAP lainnya
      </button>
    </section>
  );
};

/**
 * Isian perkembangan singkat di atas Subjective saat melanjutkan terapi (diagnosa sama).
 * Hasilnya satu baris "Update Perkembangan: ..." di Subjective.
 */
export const SubjectiveProgressNote = ({ subjective, onChange }) => {
  const existing = PROGRESS_NOTE_RE.exec(subjective || '')?.[0]?.replace(/^\n/, '').replace(/^Update Perkembangan:\s*/i, '') || '';
  const initialStatus = STATUS.find((s) => existing.startsWith(s.key))?.key || '';
  const [status, setStatus] = useState(initialStatus);
  const [note, setNote] = useState(initialStatus ? existing.slice(initialStatus.length).replace(/^\.\s*/, '') : existing);

  const emit = (nextStatus, nextNote) => onChange(applyProgressNote(subjective, buildNoteLine(nextStatus, nextNote)));

  return (
    <div className="mb-3 rounded-app-lg border border-app-accent/20 bg-white p-3.5">
      <h4 className="text-sm font-semibold text-slate-800">Perkembangan sejak kunjungan lalu</h4>
      <div role="group" aria-label="Kondisi keseluruhan" className="mt-2.5 grid grid-cols-3 gap-1.5">
        {STATUS.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={status === s.key}
            onClick={() => { const next = status === s.key ? '' : s.key; setStatus(next); emit(next, note); }}
            className={cn(
              'h-11 rounded-full border text-sm transition-colors active:scale-[0.97]',
              status === s.key ? cn(s.active, 'font-semibold') : 'border-slate-200 bg-white text-slate-600 hover:border-app-accent/40 hover:bg-app-soft'
            )}
          >
            {s.key}
          </button>
        ))}
      </div>
      <label htmlFor="soap-progress-note" className="sr-only">Catatan perkembangan</label>
      <textarea
        id="soap-progress-note"
        value={note}
        onChange={(e) => { setNote(e.target.value); emit(status, e.target.value); }}
        rows={2}
        placeholder="Mis. nyeri lutut berkurang, sudah bisa berjalan 10 menit tanpa tongkat"
        className="mt-2.5 block w-full resize-none rounded-app border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-base leading-relaxed text-slate-800 outline-none placeholder:text-slate-500 focus:border-app-accent-bright focus:bg-white focus:ring-2 focus:ring-app-accent/15"
      />
    </div>
  );
};
