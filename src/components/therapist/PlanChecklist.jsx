import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Info, Loader2, Plus, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { getPlanForDiagnoses, getPlanOptions, getPlanExercisesByIds, searchPlanExercises } from '@/lib/api';
import { PHASE_TITLES, REQUIRED_MANUAL_OPTIONS, mergePlanPhases, buildPlanText } from '@/data/planModalities';

const EMPTY = { epa: [], manual: [], dose: {}, exercises: {}, exDose: {}, notes: '' };

const PlanCard = ({ title, count, open, onToggleOpen, addLabel = 'Tambah', children, picker }) => (
  <section className="rounded-app-lg border border-slate-200 bg-white">
    <header className="flex items-center justify-between gap-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
        {count > 0 && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600">{count}</span>}
      </div>
      <button
        type="button"
        onClick={onToggleOpen}
        className={cn(
          'flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
          open ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
        )}
      >
        {open ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        {open ? 'Tutup' : addLabel}
      </button>
    </header>
    <div className="space-y-2 px-4 pb-4">{children}</div>
    {open && <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">{picker}</div>}
  </section>
);

const EmptyHint = ({ children }) => <p className="rounded-app border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-400">{children}</p>;

const DoseRow = ({ name, dose, placeholder, onDose, onRemove, onInfo, infoOpen, detail }) => (
  <div className="rounded-app border border-slate-100 bg-slate-50/60 px-3 py-2">
    <div className="flex flex-wrap items-center gap-2">
      <p className="min-w-0 flex-1 basis-40 text-sm font-medium text-slate-800">{name}</p>
      <Input
        value={dose || ''}
        onChange={(e) => onDose(e.target.value)}
        placeholder={placeholder}
        aria-label={`Dosis ${name}`}
        className="h-8 w-full rounded-app-sm border-slate-200 bg-white text-xs sm:w-56"
      />
      {onInfo && (
        <button type="button" onClick={onInfo} aria-label="Detail latihan" className="rounded-app-sm p-1 text-slate-400 hover:bg-white">
          <Info className="h-4 w-4" />
        </button>
      )}
      <button type="button" onClick={onRemove} aria-label={`Hapus ${name}`} className="rounded-app-sm p-1 text-slate-400 hover:bg-white hover:text-rose-500">
        <X className="h-4 w-4" />
      </button>
    </div>
    {infoOpen && detail}
  </div>
);

const OptionPicker = ({ options, selected, onAdd }) => {
  const [q, setQ] = useState('');
  const list = options.filter((o) => !selected.includes(o) && o.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari..." className="h-8 rounded-app-sm bg-white pl-8 text-xs" />
      </div>
      <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
        {list.map((o) => (
          <button key={o} type="button" onClick={() => onAdd(o)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-rose-300 hover:bg-rose-50">
            + {o}
          </button>
        ))}
        {list.length === 0 && <p className="text-xs text-slate-400">Tidak ada pilihan lain.</p>}
      </div>
    </div>
  );
};

const ExerciseDetail = ({ ex }) => (
  <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600">
    {ex.h && <p><span className="font-semibold">Cara:</span> {ex.h}</p>}
    {ex.p && <p><span className="font-semibold">Progresi:</span> {ex.p}</p>}
    {ex.c && <p><span className="font-semibold">Perhatian:</span> {ex.c}</p>}
  </div>
);

/**
 * Plan SOAP berbentuk kartu: modalitas elektrofisis, manual therapy, dan exercise.
 * Item yang dipilih masuk ke kartunya masing-masing dan dosisnya bisa diatur.
 * value: { epa, manual, dose, exercises: {id: true}, exDose: {id: teks}, notes } | null
 * onChange(data, text, exerciseNames): text = ringkasan untuk kolom `plan`; exerciseNames = latihan terpilih.
 */
const PlanChecklist = ({ diagnosisLabels, value, onChange }) => {
  // Daftar latihan diambil dari database untuk diagnosa terpilih (disimpan kumulatif).
  const [catalog, setCatalog] = useState({ byDiagnosis: {}, exercises: {}, fetched: [] });
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState({ epa: [], manual: [] });
  const [openPicker, setOpenPicker] = useState(null);
  const [openPhase, setOpenPhase] = useState(0);
  const [openInfo, setOpenInfo] = useState(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState({});
  const data = { ...EMPTY, ...(value || {}) };

  useEffect(() => {
    let alive = true;
    getPlanOptions().then(({ data: opts }) => alive && setOptions({
      epa: opts.epa,
      manual: [...opts.manual, ...REQUIRED_MANUAL_OPTIONS.filter((o) => !opts.manual.includes(o))],
    }));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const missing = diagnosisLabels.filter((l) => !catalog.fetched.includes(String(l).trim().toLowerCase()));
    if (missing.length === 0) return undefined;
    let alive = true;
    setLoading(true);
    getPlanForDiagnoses(missing).then(({ data: res }) => {
      if (!alive) return;
      setCatalog((prev) => ({
        byDiagnosis: { ...prev.byDiagnosis, ...res.byDiagnosis },
        exercises: { ...prev.exercises, ...res.exercises },
        fetched: [...new Set([...prev.fetched, ...missing.map((l) => String(l).trim().toLowerCase())])],
      }));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [diagnosisLabels, catalog.fetched]);

  // Latihan tambahan tersimpan yang belum ada di katalog (mis. saat membuka rekam medis lama).
  const selectedIds = Object.keys(data.exercises).filter((id) => data.exercises[id]);
  const unknownIds = selectedIds.filter((id) => !catalog.exercises[id]).join(',');
  useEffect(() => {
    if (!unknownIds) return undefined;
    let alive = true;
    getPlanExercisesByIds(unknownIds.split(',')).then(({ data: res }) => {
      if (alive) setCatalog((prev) => ({ ...prev, exercises: { ...prev.exercises, ...res } }));
    });
    return () => { alive = false; };
  }, [unknownIds]);

  // Pencarian exercise di seluruh katalog (debounce).
  useEffect(() => {
    if (query.trim().length < 2) { setResults({}); setSearching(false); return undefined; }
    let alive = true;
    setSearching(true);
    const t = setTimeout(() => {
      searchPlanExercises(query).then(({ data: res }) => {
        if (!alive) return;
        setResults(res);
        setCatalog((prev) => ({ ...prev, exercises: { ...prev.exercises, ...res } }));
        setSearching(false);
      });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [query]);

  const merged = useMemo(
    () => mergePlanPhases(diagnosisLabels, catalog.byDiagnosis),
    [catalog, diagnosisLabels]
  );

  const emit = (next) => {
    const names = Object.keys(next.exercises || {})
      .filter((id) => next.exercises[id] && catalog.exercises[id])
      .map((id) => catalog.exercises[id].n);
    onChange(next, buildPlanText(next, merged.phases, catalog.exercises), names);
  };
  const addItem = (key) => (opt) => emit({ ...data, [key]: [...data[key], opt] });
  const removeItem = (key) => (opt) => {
    const dose = { ...data.dose };
    delete dose[opt];
    emit({ ...data, [key]: data[key].filter((x) => x !== opt), dose });
  };
  const setDose = (name, text) => emit({ ...data, dose: { ...data.dose, [name]: text } });
  const addExercise = (id) => emit({ ...data, exercises: { ...data.exercises, [id]: true } });
  const removeExercise = (id) => {
    const exercises = { ...data.exercises };
    const exDose = { ...data.exDose };
    delete exercises[id];
    delete exDose[id];
    emit({ ...data, exercises, exDose });
  };
  const setExDose = (id, text) => emit({ ...data, exDose: { ...data.exDose, [id]: text } });

  const togglePicker = (name) => setOpenPicker((cur) => (cur === name ? null : name));
  const totalExercises = merged.phases.reduce((n, ids) => n + ids.length, 0);
  const searchIds = Object.keys(results).filter((id) => !data.exercises[id]);
  const searchMode = query.trim().length >= 2;

  const modalityCard = (key, title, list) => (
    <PlanCard
      title={title}
      count={data[key].length}
      open={openPicker === key}
      onToggleOpen={() => togglePicker(key)}
      addLabel="Tambah"
      picker={<OptionPicker options={list} selected={data[key]} onAdd={addItem(key)} />}
    >
      {data[key].length === 0 && <EmptyHint>Belum ada {title.toLowerCase()} dipilih.</EmptyHint>}
      {data[key].map((name) => (
        <DoseRow
          key={name}
          name={name}
          dose={data.dose[name]}
          placeholder="Dosis, mis. 10 menit / 3x seminggu"
          onDose={(t) => setDose(name, t)}
          onRemove={() => removeItem(key)(name)}
        />
      ))}
    </PlanCard>
  );

  return (
    <div className="space-y-3">
      {modalityCard('epa', 'Modalitas elektrofisis', options.epa)}
      {modalityCard('manual', 'Manual therapy', options.manual)}

      <PlanCard
        title="Exercise"
        count={selectedIds.length}
        open={openPicker === 'exercise'}
        onToggleOpen={() => togglePicker('exercise')}
        picker={(
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari exercise (nama atau kelompok)..." className="h-8 rounded-app-sm bg-white pl-8 text-xs" />
            </div>
            {searchMode ? (
              <div className="max-h-64 space-y-1.5 overflow-y-auto">
                {searching && <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Mencari...</div>}
                {!searching && searchIds.length === 0 && <p className="text-xs text-slate-400">Tidak ada exercise yang cocok.</p>}
                {searchIds.map((id) => (
                  <button key={id} type="button" onClick={() => addExercise(id)} className="flex w-full items-center justify-between gap-2 rounded-app border border-slate-200 bg-white px-3 py-2 text-left hover:border-rose-300 hover:bg-rose-50">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800">{results[id].n}</span>
                      <span className="block text-xs text-slate-500">{[results[id].g, results[id].d].filter(Boolean).join(' · ')}</span>
                    </span>
                    <Plus className="h-4 w-4 shrink-0 text-rose-500" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {loading && <div className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat daftar latihan...</div>}
                {diagnosisLabels.length === 0 && <p className="text-xs text-slate-400">Pilih diagnosa di atas untuk melihat saran latihan, atau cari exercise di kolom atas.</p>}
                {!loading && diagnosisLabels.length > 0 && totalExercises === 0 && <p className="text-xs text-slate-400">Belum ada saran latihan untuk diagnosa ini. Gunakan pencarian di atas.</p>}
                {merged.phases.map((ids, i) => {
                  const avail = ids.filter((id) => catalog.exercises[id] && !data.exercises[id]);
                  if (!ids.length) return null;
                  return (
                    <div key={PHASE_TITLES[i]} className="rounded-app border border-slate-200 bg-white">
                      <button type="button" onClick={() => setOpenPhase(openPhase === i ? -1 : i)} className="flex w-full items-center justify-between px-3 py-2 text-left">
                        <span className="text-sm font-semibold text-slate-700">{PHASE_TITLES[i]}</span>
                        <span className="flex items-center gap-2 text-xs text-slate-500">
                          {ids.length - avail.length}/{ids.length}
                          <ChevronDown className={cn('h-4 w-4 transition-transform', openPhase === i && 'rotate-180')} />
                        </span>
                      </button>
                      {openPhase === i && (
                        <ul className="space-y-1.5 px-2 pb-2">
                          {avail.length === 0 && <li className="px-1 py-1 text-xs text-slate-400">Semua latihan fase ini sudah dipilih.</li>}
                          {avail.map((id) => (
                            <li key={id}>
                              <button type="button" onClick={() => addExercise(id)} className="flex w-full items-center justify-between gap-2 rounded-app-sm border border-slate-100 px-3 py-2 text-left hover:border-rose-300 hover:bg-rose-50">
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium text-slate-800">{catalog.exercises[id].n}</span>
                                  <span className="block text-xs text-slate-500">{catalog.exercises[id].d}</span>
                                </span>
                                <Plus className="h-4 w-4 shrink-0 text-rose-500" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      >
        {selectedIds.length === 0 && <EmptyHint>Belum ada exercise dipilih.</EmptyHint>}
        {selectedIds.map((id) => {
          const ex = catalog.exercises[id];
          if (!ex) return <div key={id} className="flex items-center gap-2 px-1 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat latihan...</div>;
          return (
            <DoseRow
              key={id}
              name={ex.n}
              dose={data.exDose[id]}
              placeholder={ex.d || 'Dosis'}
              onDose={(t) => setExDose(id, t)}
              onRemove={() => removeExercise(id)}
              onInfo={() => setOpenInfo(openInfo === id ? null : id)}
              infoOpen={openInfo === id}
              detail={<ExerciseDetail ex={ex} />}
            />
          );
        })}
        {merged.cautions.map((c) => (
          <p key={c.label} className="rounded-app-sm bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span className="font-semibold">Perhatian{merged.cautions.length > 1 ? ` (${c.label})` : ''}:</span> {c.text}
          </p>
        ))}
      </PlanCard>

      <section className="rounded-app-lg border border-slate-200 bg-white px-4 py-3">
        <h4 className="mb-2 text-sm font-semibold text-slate-800">Catatan tambahan</h4>
        <Textarea
          placeholder="Edukasi, home program, target, frekuensi kunjungan..."
          className="min-h-[80px] resize-none rounded-app border-slate-200 bg-slate-50/80 focus:bg-white"
          value={data.notes}
          onChange={(e) => emit({ ...data, notes: e.target.value })}
        />
      </section>
    </div>
  );
};

export default PlanChecklist;
