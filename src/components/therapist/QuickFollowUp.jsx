import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyProgressNote, buildNoteLine, STATUS } from '@/components/therapist/SoapContinuation';
import { ITEMS, STATES, applyProgressLine, buildProgressLine, previousVas } from '@/components/therapist/ObjectiveProgressUpdate';

const vasTone = (n) => (n <= 3 ? 'bg-emerald-500 border-emerald-500 text-white' : n <= 6 ? 'bg-amber-500 border-amber-500 text-white' : 'bg-rose-500 border-rose-500 text-white');
const SHORT = { better: 'Membaik', same: 'Tetap', worse: 'Memburuk' };

/**
 * Lanjutan kilat: satu kartu untuk kunjungan lanjutan. Terapis hanya menjawab perubahan
 * (kondisi umum, NRS, parameter); baris "Update Perkembangan" di Subjective dan "Update Kondisi"
 * di Objective ditulis langsung, tanpa dialog dan tanpa tombol terapkan.
 */
const QuickFollowUp = ({ subjective, objective, onChange, disabled = false, nrsRequired = false }) => {
  const [prevVas] = useState(() => previousVas(objective));
  const [overall, setOverall] = useState('');
  const [note, setNote] = useState('');
  const [vas, setVas] = useState(undefined);
  const [states, setStates] = useState({});

  const emit = (next) => {
    const o = next.overall ?? overall;
    const n = next.note ?? note;
    const v = 'vas' in next ? next.vas : vas;
    const st = next.states ?? states;
    onChange({
      subjective: applyProgressNote(subjective, buildNoteLine(o, n)),
      objective: applyProgressLine(objective, buildProgressLine({ vas: v, prevVas, states: st })),
    });
  };

  const setAll = (key) => {
    const next = Object.fromEntries(ITEMS.map((it) => [it.key, key]));
    setStates(next);
    emit({ states: next });
  };
  const toggleState = (itemKey, key) => {
    const next = { ...states };
    if (next[itemKey] === key) delete next[itemKey]; else next[itemKey] = key;
    setStates(next);
    emit({ states: next });
  };

  return (
    <section id="quick-followup" aria-label="Lanjutan kilat" className="border-b border-slate-100 bg-app-soft/30 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <Zap className="h-4 w-4 shrink-0 text-app-accent" aria-hidden="true" />
        <h3 className="whitespace-nowrap text-sm font-semibold text-slate-900">Lanjutan kilat</h3>
        <span className="basis-full text-xs text-slate-500">S, O, dan Plan sudah disalin. Cukup isi perubahannya.</span>
      </div>

      <div className="mt-3 space-y-4">
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Kondisi keseluruhan</div>
          <div role="group" aria-label="Kondisi keseluruhan" className="grid grid-cols-3 gap-1.5">
            {STATUS.map((s) => (
              <button
                key={s.key}
                type="button"
                disabled={disabled}
                aria-pressed={overall === s.key}
                onClick={() => { const v = overall === s.key ? '' : s.key; setOverall(v); emit({ overall: v }); }}
                className={cn('h-12 rounded-full border text-sm transition-colors active:scale-[0.97]', overall === s.key ? cn(s.active, 'font-semibold') : 'border-slate-200 bg-white text-slate-600 hover:border-app-accent/40 hover:bg-app-soft')}
              >
                {s.key}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Nyeri hari ini (NRS){prevVas !== null && <span className="ml-1.5 font-normal normal-case tracking-normal">sebelumnya {prevVas}/10</span>}
          </div>
          <div className="grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                type="button"
                disabled={disabled}
                aria-pressed={vas === n}
                aria-label={`NRS ${n}`}
                onClick={() => { const v = vas === n ? undefined : n; setVas(v); emit({ vas: v }); }}
                className={cn('h-11 rounded-lg border text-[13px] tabular-nums transition-colors active:scale-[0.97]', vas === n ? cn(vasTone(n), 'font-semibold') : 'border-slate-200 bg-white text-slate-600 hover:border-app-accent/40')}
              >
                {n}
              </button>
            ))}
          </div>
          {vas === undefined && <p className={cn('mt-1 text-xs', nrsRequired ? 'font-semibold text-rose-600' : 'text-amber-700')} role={nrsRequired ? 'alert' : undefined}>{nrsRequired ? 'NRS hari ini wajib diisi karena kunjungan lalu sudah mencatat NRS.' : 'NRS hari ini belum diisi.'}</p>}
        </div>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Perubahan per parameter</span>
            <button type="button" disabled={disabled} onClick={() => setAll('better')} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-app-soft">Semua membaik</button>
            <button type="button" disabled={disabled} onClick={() => setAll('same')} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-app-soft">Semua tetap</button>
          </div>
          <div className="divide-y divide-slate-100 rounded-app border border-slate-200 bg-white">
            {ITEMS.map((it) => (
              <div key={it.key} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 text-sm text-slate-700">{it.label}</span>
                <div className="flex shrink-0 gap-1">
                  {STATES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      disabled={disabled}
                      aria-pressed={states[it.key] === s.key}
                      aria-label={`${it.label} ${SHORT[s.key]}`}
                      onClick={() => toggleState(it.key, s.key)}
                      className={cn('h-10 min-w-[44px] rounded-lg border px-2 text-xs transition-colors active:scale-[0.97]', states[it.key] === s.key ? cn(s.active, 'font-semibold') : 'border-slate-200 bg-white text-slate-600 hover:bg-app-soft')}
                    >
                      {SHORT[s.key]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">Periksa tiap parameter sebelum memilih Semua. Yang tidak dipilih tidak ikut ditulis.</p>
        </div>

        <div>
          <label htmlFor="quick-followup-note" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Catatan perkembangan (opsional)</label>
          <textarea
            id="quick-followup-note"
            value={note}
            disabled={disabled}
            onChange={(e) => { setNote(e.target.value); emit({ note: e.target.value }); }}
            rows={2}
            placeholder="Mis. sudah bisa duduk 30 menit tanpa nyeri"
            className="block w-full resize-none rounded-app border border-slate-200 bg-white px-3 py-2.5 text-base leading-relaxed text-slate-800 outline-none placeholder:text-slate-500 focus:border-app-accent-bright focus:ring-2 focus:ring-app-accent/15"
          />
        </div>
      </div>
    </section>
  );
};

export default QuickFollowUp;
