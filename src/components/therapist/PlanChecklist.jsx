import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Info, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getPlanForDiagnoses, getPlanOptions } from '@/lib/api';
import { PHASE_TITLES, mergePlanPhases, buildPlanText } from '@/data/planModalities';

const EMPTY = { epa: [], manual: [], exercises: {}, notes: '' };

const ChipGroup = ({ title, options, selected, onToggle }) => (
  <div>
    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            aria-pressed={on}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              on ? 'border-rose-500 bg-rose-500 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  </div>
);

const ExerciseRow = ({ id, ex, checked, onToggle }) => {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl border border-slate-100 bg-white px-3 py-2">
      <div className="flex items-start gap-3">
        <Checkbox checked={checked} onCheckedChange={() => onToggle(id)} className="mt-0.5" aria-label={ex.n} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800">{ex.n}</p>
          <p className="text-xs text-slate-500">{ex.d}</p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Detail latihan" className="rounded-lg p-1 text-slate-400 hover:bg-slate-50">
          <Info className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600">
          <p><span className="font-semibold">Cara:</span> {ex.h}</p>
          {ex.p && <p><span className="font-semibold">Progresi:</span> {ex.p}</p>}
          {ex.c && <p><span className="font-semibold">Perhatian:</span> {ex.c}</p>}
        </div>
      )}
    </li>
  );
};

/**
 * Checklist Plan SOAP: modalitas elektrofisis, manual therapy, dan exercise
 * per diagnosa (sumber: Plan_Exercise_Kaffah_329_Diagnosa.xlsx).
 * value: { epa, manual, exercises: {id: true}, notes } | null
 * onChange(data, text, exerciseNames): text = ringkasan untuk kolom `plan`; exerciseNames = latihan yang dicentang.
 */
const PlanChecklist = ({ diagnosisLabels, value, onChange }) => {
  // Daftar latihan diambil dari database untuk diagnosa terpilih (disimpan kumulatif).
  const [catalog, setCatalog] = useState({ byDiagnosis: {}, exercises: {}, fetched: [] });
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState({ epa: [], manual: [] });
  const [openPhase, setOpenPhase] = useState(0);
  const data = { ...EMPTY, ...(value || {}) };

  useEffect(() => {
    let alive = true;
    getPlanOptions().then(({ data: opts }) => alive && setOptions(opts));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const missing = diagnosisLabels.filter((l) => !catalog.fetched.includes(String(l).trim().toLowerCase()));
    if (missing.length === 0) return undefined;
    let alive = true;
    setLoading(true);
    getPlanForDiagnoses(missing).then(({ data }) => {
      if (!alive) return;
      setCatalog((prev) => ({
        byDiagnosis: { ...prev.byDiagnosis, ...data.byDiagnosis },
        exercises: { ...prev.exercises, ...data.exercises },
        fetched: [...new Set([...prev.fetched, ...missing.map((l) => String(l).trim().toLowerCase())])],
      }));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [diagnosisLabels, catalog.fetched]);

  const merged = useMemo(
    () => mergePlanPhases(diagnosisLabels, catalog.byDiagnosis),
    [catalog, diagnosisLabels]
  );

  const emit = (next) => {
    const names = [...new Set(merged.phases.flat())]
      .filter((id) => next.exercises?.[id] && catalog.exercises[id])
      .map((id) => catalog.exercises[id].n);
    onChange(next, buildPlanText(next, merged.phases, catalog.exercises), names);
  };
  const toggleList = (key) => (opt) => {
    const list = data[key].includes(opt) ? data[key].filter((x) => x !== opt) : [...data[key], opt];
    emit({ ...data, [key]: list });
  };
  const toggleExercise = (id) => {
    const exercises = { ...data.exercises };
    if (exercises[id]) delete exercises[id]; else exercises[id] = true;
    emit({ ...data, exercises });
  };

  const totalExercises = merged.phases.reduce((n, ids) => n + ids.length, 0);

  return (
    <div className="space-y-5">
      <ChipGroup title="Modalitas elektrofisis" options={options.epa} selected={data.epa} onToggle={toggleList('epa')} />
      <ChipGroup title="Manual therapy" options={options.manual} selected={data.manual} onToggle={toggleList('manual')} />

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Exercise</p>
        {loading && <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat daftar latihan...</div>}
        {diagnosisLabels.length === 0 && (
          <p className="text-xs text-slate-400">Pilih diagnosa di atas untuk menampilkan daftar latihan.</p>
        )}
        {!loading && diagnosisLabels.length > 0 && totalExercises === 0 && (
          <p className="text-xs text-slate-400">Belum ada daftar latihan untuk diagnosa ini. Tulis di catatan di bawah.</p>
        )}
        {totalExercises > 0 && (
          <div className="space-y-2">
            {merged.phases.map((ids, i) => {
              if (!ids.length) return null;
              const done = ids.filter((id) => data.exercises[id]).length;
              return (
                <div key={PHASE_TITLES[i]} className="rounded-xl border border-slate-200 bg-slate-50/60">
                  <button type="button" onClick={() => setOpenPhase(openPhase === i ? -1 : i)} className="flex w-full items-center justify-between px-3 py-2.5 text-left">
                    <span className="text-sm font-semibold text-slate-700">{PHASE_TITLES[i]}</span>
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      {done}/{ids.length}
                      <ChevronDown className={cn('h-4 w-4 transition-transform', openPhase === i && 'rotate-180')} />
                    </span>
                  </button>
                  {openPhase === i && (
                    <ul className="space-y-1.5 px-2 pb-2">
                      {ids.map((id) => catalog.exercises[id] && (
                        <ExerciseRow key={id} id={id} ex={catalog.exercises[id]} checked={!!data.exercises[id]} onToggle={toggleExercise} />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            {merged.cautions.map((c) => (
              <p key={c.label} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span className="font-semibold">Perhatian{merged.cautions.length > 1 ? ` (${c.label})` : ''}:</span> {c.text}
              </p>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Catatan tambahan</p>
        <Textarea
          placeholder="Edukasi, home program, target, frekuensi kunjungan..."
          className="min-h-[80px] resize-none rounded-xl border-slate-200 bg-slate-50/80 focus:bg-white"
          value={data.notes}
          onChange={(e) => emit({ ...data, notes: e.target.value })}
        />
      </div>
    </div>
  );
};

export default PlanChecklist;
