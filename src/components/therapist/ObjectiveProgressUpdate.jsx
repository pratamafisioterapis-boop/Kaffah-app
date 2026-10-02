import React, { useMemo, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Update kondisi klinis untuk terapi lanjutan: cukup klik perubahan, tanpa mengetik ulang Objective.
// Hasilnya satu baris "Update Kondisi: ..." yang menggantikan baris serupa di Objective (bila ada).

export const PROGRESS_LINE_RE = /(^|\n)Update Kondisi:[^\n]*/i;

const STATES = [
  { key: 'better', label: 'Membaik', active: 'bg-emerald-600 border-emerald-600 text-white' },
  { key: 'same', label: 'Tetap', active: 'bg-slate-600 border-slate-600 text-white' },
  { key: 'worse', label: 'Memburuk', active: 'bg-rose-600 border-rose-600 text-white' },
];

// Kalimat per parameter untuk tiap perubahan.
const ITEMS = [
  { key: 'tenderness', label: 'Nyeri tekan', text: { better: 'nyeri tekan berkurang', same: 'nyeri tekan tetap', worse: 'nyeri tekan meningkat' } },
  { key: 'spasm', label: 'Spasme / tegang otot', text: { better: 'spasme otot berkurang', same: 'spasme otot tetap', worse: 'spasme otot meningkat' } },
  { key: 'swelling', label: 'Bengkak', text: { better: 'bengkak berkurang', same: 'bengkak tetap', worse: 'bengkak bertambah' } },
  { key: 'rom', label: 'Lingkup gerak sendi (ROM)', text: { better: 'ROM bertambah', same: 'ROM tetap', worse: 'ROM berkurang' } },
  { key: 'strength', label: 'Kekuatan otot', text: { better: 'kekuatan otot meningkat', same: 'kekuatan otot tetap', worse: 'kekuatan otot menurun' } },
  { key: 'neuro', label: 'Kesemutan / baal', text: { better: 'kesemutan/baal berkurang', same: 'kesemutan/baal tetap', worse: 'kesemutan/baal bertambah' } },
  { key: 'posture', label: 'Postur / gait', text: { better: 'postur/gait lebih baik', same: 'postur/gait tetap', worse: 'postur/gait memburuk' } },
  { key: 'function', label: 'Fungsi / aktivitas harian', text: { better: 'kemampuan fungsional membaik', same: 'kemampuan fungsional tetap', worse: 'kemampuan fungsional menurun' } },
];

const HOME_PROGRAM = [
  { key: 'rutin', text: 'home program dilakukan rutin' },
  { key: 'kadang', text: 'home program kadang-kadang dilakukan' },
  { key: 'tidak', text: 'home program belum dilakukan' },
];

// Ambil skor nyeri "sekarang" dari Objective sebelumnya (hasil salinan), mis. "Nyeri 0-10: sekarang 6".
const previousVas = (text) => {
  const m = /nyeri[^.\n]*?sekarang\D{0,3}(\d{1,2})(?!\d)/i.exec(text || '') || /NPRS[^\d\n]{0,20}(\d{1,2})(?!\d)/i.exec(text || '');
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 10 ? n : null;
};

const Chip = ({ active, tone, onClick, children }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      'inline-flex min-h-[34px] items-center justify-center whitespace-nowrap rounded-full border px-3.5 py-1 text-[13px] leading-none transition-all active:scale-95',
      active ? cn(tone, 'font-medium shadow-sm') : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
    )}
  >
    {children}
  </button>
);

const vasTone = (n) => (n <= 3 ? 'bg-emerald-500 border-emerald-500 text-white' : n <= 6 ? 'bg-amber-500 border-amber-500 text-white' : 'bg-rose-500 border-rose-500 text-white');

export const buildProgressLine = ({ vas, prevVas, states, home }) => {
  const parts = [];
  if (vas !== undefined) {
    let nyeri = `nyeri sekarang ${vas}/10`;
    if (prevVas !== null) {
      nyeri += vas < prevVas ? ` (turun dari ${prevVas}/10)` : vas > prevVas ? ` (naik dari ${prevVas}/10)` : ` (tetap ${prevVas}/10)`;
    }
    parts.push(nyeri);
  }
  ITEMS.forEach((it) => { if (states[it.key]) parts.push(it.text[states[it.key]]); });
  const h = HOME_PROGRAM.find((o) => o.key === home);
  if (h) parts.push(h.text);
  if (!parts.length) return '';
  const sentence = parts.join(', ');
  return `Update Kondisi: ${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
};

/**
 * @param currentText Objective saat ini (hasil salinan terapi sebelumnya)
 * @param onApply     (newObjectiveText) => void
 */
const ObjectiveProgressUpdate = ({ currentText, onApply }) => {
  const prevVas = useMemo(() => previousVas(currentText), [currentText]);
  const [vas, setVas] = useState(undefined);
  const [states, setStates] = useState({});
  const [home, setHome] = useState(undefined);

  const line = buildProgressLine({ vas, prevVas, states, home });
  const [edited, setEdited] = useState(null);
  const finalLine = edited ?? line;
  const count = (vas !== undefined ? 1 : 0) + Object.keys(states).length + (home ? 1 : 0);

  const setState = (key, value) => {
    setEdited(null);
    setStates((prev) => {
      const next = { ...prev };
      if (next[key] === value) delete next[key]; else next[key] = value;
      return next;
    });
  };
  const setAll = (value) => { setEdited(null); setStates(Object.fromEntries(ITEMS.map((it) => [it.key, value]))); };
  const reset = () => { setVas(undefined); setStates({}); setHome(undefined); setEdited(null); };

  const apply = () => {
    const text = finalLine.trim();
    if (!text) return;
    const base = (currentText || '').trim();
    const next = PROGRESS_LINE_RE.test(base)
      ? base.replace(PROGRESS_LINE_RE, (_, lead) => `${lead}${text}`)
      : [base, text].filter(Boolean).join('\n');
    onApply(next);
  };

  return (
    <div className="space-y-4 pb-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">Klik perubahan kondisi pasien dibanding terapi sebelumnya. Yang tidak diklik tidak ikut ditulis.</p>
        <button type="button" onClick={reset} disabled={count === 0} className="flex shrink-0 items-center gap-1 text-xs text-slate-500 hover:text-rose-600 disabled:opacity-40">
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-700">
            Skala nyeri sekarang (0-10){prevVas !== null && <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">sebelumnya {prevVas}/10</span>}
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                type="button"
                aria-pressed={vas === n}
                onClick={() => { setEdited(null); setVas(vas === n ? undefined : n); }}
                className={cn(
                  'inline-flex h-9 min-w-[36px] items-center justify-center rounded-full border px-2 text-[13px] transition-all active:scale-95',
                  vas === n ? cn(vasTone(n), 'font-semibold shadow-sm') : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
          <span className="text-xs text-slate-500">Cepat, semua parameter:</span>
          {STATES.map((s) => (
            <button key={s.key} type="button" onClick={() => setAll(s.key)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50">
              Semua {s.label.toLowerCase()}
            </button>
          ))}
        </div>

        {ITEMS.map((it) => (
          <div key={it.key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="w-full text-sm text-slate-700 sm:w-52">{it.label}</span>
            <div className="flex flex-wrap gap-1.5">
              {STATES.map((s) => (
                <Chip key={s.key} active={states[it.key] === s.key} tone={s.active} onClick={() => setState(it.key, s.key)}>{s.label}</Chip>
              ))}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-3">
          <span className="w-full text-sm text-slate-700 sm:w-52">Home program</span>
          <div className="flex flex-wrap gap-1.5">
            {HOME_PROGRAM.map((o) => (
              <Chip key={o.key} active={home === o.key} tone="bg-blue-600 border-blue-600 text-white" onClick={() => { setEdited(null); setHome(home === o.key ? undefined : o.key); }}>
                {{ rutin: 'Rutin', kadang: 'Kadang', tidak: 'Belum' }[o.key]}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Hasil (bisa diedit)</div>
        <textarea
          value={finalLine}
          onChange={(e) => setEdited(e.target.value)}
          rows={3}
          placeholder="Klik perubahan di atas, barisnya muncul di sini."
          className="block w-full resize-y rounded-xl border border-blue-100 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
        />
        <p className="mt-1 text-[11px] text-slate-400">Ditambahkan sebagai baris "Update Kondisi" di akhir Objective (menggantikan baris lama bila sudah ada).</p>
      </div>

      <Button type="button" onClick={apply} disabled={!finalLine.trim()} className="h-11 w-full gap-2 rounded-xl bg-blue-600 text-sm font-semibold hover:bg-blue-700">
        <Check className="h-4 w-4" /> Masukkan ke Objective
      </Button>
    </div>
  );
};

export default ObjectiveProgressUpdate;
