import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ClipboardCheck, Minus, Pencil, Plus, RotateCcw, Sparkles, Stethoscope, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FunctionalFormDialog from '@/components/therapist/FunctionalFormDialog';
import { FUNCTIONAL_FORMS } from '@/data/functionalForms';
import { cn } from '@/lib/utils';
import {
  DURATION_UNITS,
  countProgress,
  mergeVitalSections,
  normalVitalValues,
  parseTemplate,
  renderMergedTemplates,
  renderTemplate,
  splitVariants,
} from '@/lib/subjectiveTemplate';

// ───────────── Kontrol isian inline ─────────────

const ChoiceChips = ({ tok, value, onChange }) => {
  const selected = tok.flag ? (value ? [value] : []) : (Array.isArray(value) ? value : []);

  const toggle = (opt) => {
    if (tok.flag) return onChange(value === opt ? undefined : opt);
    if (tok.single) return onChange(selected.includes(opt) ? undefined : [opt]);
    onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt]);
  };

  const tone = (opt) => {
    if (!tok.flag) return 'bg-app-accent border-app-accent text-white';
    return ['ada', 'ya'].includes(opt.toLowerCase())
      ? 'bg-emerald-600 border-emerald-600 text-white'
      : 'bg-slate-600 border-slate-600 text-white';
  };

  return (
    <span className="my-1.5 flex flex-wrap items-center gap-1.5 sm:contents">
      {(tok.prefix || tok.hint) && <span className="text-xs text-slate-500 sm:mx-1">{tok.prefix || `${tok.hint}:`}</span>}
      {tok.options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(opt)}
            className={cn(
              'inline-flex min-h-[40px] items-center justify-center rounded-full border px-4 py-2 text-sm leading-none transition-[color,background-color,border-color,box-shadow,transform,opacity] active:scale-[0.97] max-sm:max-w-full max-sm:text-left max-sm:leading-snug sm:mx-0.5 sm:my-0.5 [@media(pointer:coarse)]:sm:min-h-[40px] sm:min-h-[32px] sm:whitespace-nowrap sm:px-3 sm:py-1 sm:align-middle sm:text-[13px]',
              active
                ? cn(tone(opt), 'font-medium shadow-sm')
                : 'border-slate-200 bg-white text-slate-600 hover:border-app-accent/40 hover:bg-app-soft'
            )}
          >
            {opt}
          </button>
        );
      })}
    </span>
  );
};

const DurationInput = ({ value, onChange }) => {
  const n = value?.n ? Number(value.n) : 0;
  const unit = value?.unit || 'hari';
  const set = (patch) => {
    const next = { n, unit, ...patch };
    onChange(next.n > 0 ? next : undefined);
  };
  // Pilihan cepat untuk durasi yang paling sering.
  const quick = [1, 2, 3, 5, 7];

  return (
    <span className="my-1.5 flex w-full flex-col gap-2 rounded-app-lg border border-app-accent/15 bg-app-soft/60 p-2 sm:mx-1 sm:my-0 sm:inline-flex sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-1.5 sm:p-1 sm:align-middle">
      <span className="flex items-center justify-between rounded-full border border-slate-200 bg-white sm:inline-flex sm:justify-start">
        <button
          type="button"
          aria-label="Kurangi"
          onClick={() => set({ n: Math.max(0, n - 1) })}
          className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 active:scale-90 sm:h-8 sm:w-8 [@media(pointer:coarse)]:sm:h-10 [@media(pointer:coarse)]:sm:w-10"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={n || ''}
          placeholder="0"
          onChange={(e) => set({ n: Math.max(0, parseInt(e.target.value, 10) || 0) })}
          className="h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-center text-base font-semibold sm:h-8 [@media(pointer:coarse)]:sm:h-10 sm:w-10 sm:flex-none sm:text-sm text-slate-800 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label="Tambah"
          onClick={() => set({ n: n + 1 })}
          className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 active:scale-90 sm:h-8 sm:w-8 [@media(pointer:coarse)]:sm:h-10 [@media(pointer:coarse)]:sm:w-10"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </span>
      <span className="grid grid-cols-4 gap-0.5 rounded-full bg-white p-0.5 ring-1 ring-slate-200 sm:inline-flex">
        {DURATION_UNITS.map((u) => (
          <button
            key={u}
            type="button"
            aria-pressed={unit === u}
            onClick={() => set({ unit: u, n: n || 1 })}
            className={cn(
              'rounded-full px-2.5 py-2.5 text-sm transition-colors sm:py-1 sm:text-[13px]',
              unit === u && n > 0 ? 'bg-app-accent font-medium text-white' : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            {u}
          </button>
        ))}
      </span>
      {n === 0 && (
        <span className="flex flex-wrap gap-1.5 sm:inline-flex sm:gap-1">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => set({ n: q })}
              className="h-10 min-w-[44px] rounded-full border border-slate-200 bg-white px-3 text-sm sm:h-7 [@media(pointer:coarse)]:sm:h-9 sm:min-w-[28px] sm:px-2 sm:text-xs text-slate-500 hover:border-app-accent/40 hover:text-app-accent"
            >
              {q}
            </button>
          ))}
        </span>
      )}
    </span>
  );
};

const FreeInput = ({ tok, value, onChange }) => {
  const placeholder = tok.label || 'isi...';
  const width = Math.min(Math.max(placeholder.length, (value || '').length, 6) + 3, 36);
  return (
    <input
      type="text"
      inputMode={tok.numeric ? 'decimal' : 'text'}
      value={value || ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ '--w': `${width}ch` }}
      className={cn(
        'my-1.5 block h-11 w-full rounded-app-sm border bg-white px-3 text-base text-slate-800 sm:mx-1 sm:my-0 sm:inline-block sm:h-8 [@media(pointer:coarse)]:sm:h-10 sm:w-[var(--w)] sm:max-w-full sm:px-2 sm:align-middle sm:text-sm outline-none transition-colors placeholder:text-slate-500 focus:border-app-accent-bright focus:ring-2 focus:ring-app-accent/15',
        value?.trim() ? 'border-app-accent/40 bg-app-soft/40' : 'border-dashed border-slate-300'
      )}
    />
  );
};

const hasValue = (v) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);

const todayIso = () => {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const DateInput = ({ value, onChange }) => (
  <span className="my-1.5 flex flex-wrap items-center gap-2 sm:mx-1 sm:my-0 sm:inline-flex sm:gap-1 sm:align-middle">
    <input
      type="date"
      value={value || ''}
      max="2100-12-31"
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-11 min-w-0 flex-1 rounded-app-sm border bg-white px-3 text-base text-slate-800 outline-none focus:border-app-accent-bright sm:h-8 [@media(pointer:coarse)]:sm:h-10 sm:flex-none sm:px-2 sm:text-sm focus:ring-2 focus:ring-app-accent/15',
        value ? 'border-app-accent/40 bg-app-soft/40' : 'border-dashed border-slate-300'
      )}
    />
    {!value && (
      <button
        type="button"
        onClick={() => onChange(todayIso())}
        className="h-10 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-500 hover:border-app-accent/40 hover:text-app-accent sm:h-7 [@media(pointer:coarse)]:sm:h-9 sm:px-2.5 sm:text-xs"
      >
        Hari ini
      </button>
    )}
  </span>
);

const ToggleSentence = ({ tok, value, onChange }) => (
  <button
    type="button"
    aria-pressed={!!value}
    onClick={() => onChange(value ? undefined : true)}
    className={cn(
      'my-1 flex w-full items-start gap-2 rounded-app border px-3 py-2.5 text-left text-sm leading-snug sm:mr-1 sm:my-0.5 sm:inline-flex sm:w-auto sm:max-w-full sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-[13px] transition-[color,background-color,border-color,box-shadow,transform,opacity] active:scale-[0.99]',
      value
        ? 'border-app-accent bg-app-accent font-medium text-white shadow-sm'
        : 'border-dashed border-slate-300 bg-white text-slate-500 hover:border-app-accent/40 hover:bg-app-soft'
    )}
  >
    <span
      className={cn(
        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
        value ? 'border-white bg-white text-app-accent' : 'border-slate-300'
      )}
    >
      {value && <Check className="h-3 w-3" />}
    </span>
    <span>{tok.text}</span>
  </button>
);

const ScaleChips = ({ tok, value, onChange }) => {
  const nums = Array.from({ length: tok.max - tok.min + 1 }, (_, i) => String(tok.min + i));
  const tone = (n) => {
    if (tok.max !== 10) return 'bg-app-accent border-app-accent text-white';
    return n <= 3 ? 'bg-emerald-500 border-emerald-500 text-white' : n <= 6 ? 'bg-amber-500 border-amber-500 text-white' : 'bg-rose-500 border-rose-500 text-white';
  };
  return (
    <span className="my-1.5 flex flex-wrap items-center gap-1.5 sm:contents">
      {tok.label && <span className="w-full text-xs text-slate-500 sm:mx-1 sm:w-auto">{tok.label}:</span>}
      {nums.map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={value === n}
          onClick={() => onChange(value === n ? undefined : n)}
          className={cn(
            'inline-flex h-10 min-w-[40px] items-center justify-center rounded-full border px-2 text-sm sm:mx-0.5 sm:my-0.5 sm:h-8 [@media(pointer:coarse)]:sm:h-10 sm:min-w-[32px] [@media(pointer:coarse)]:sm:min-w-[40px] sm:align-middle sm:text-[13px] leading-none transition-[color,background-color,border-color,box-shadow,transform,opacity] active:scale-[0.97]',
            value === n ? cn(tone(Number(n)), 'font-semibold shadow-sm') : 'border-slate-200 bg-white text-slate-600 hover:border-app-accent/40 hover:bg-app-soft'
          )}
        >
          {n}
        </button>
      ))}
    </span>
  );
};

const FormButtons = ({ tok, value, onOpen, onClear }) => (
  <span className="my-1.5 flex flex-wrap items-center gap-1.5 sm:mx-1 sm:my-0 sm:inline-flex sm:align-middle">
    {value?.text ? (
      <span className="inline-flex items-center gap-1.5 rounded-app border border-app-accent/40 bg-app-soft py-1 pl-3 pr-1.5 text-[13px] font-medium text-app-accent-hover">
        {value.text}
        <button type="button" aria-label="Ubah" onClick={() => onOpen(value.form)} className="rounded-app-sm p-1 text-app-accent hover:bg-app-accent/15"><Pencil className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label="Hapus" onClick={onClear} className="rounded-app-sm px-1.5 py-1 text-xs text-slate-500 hover:bg-rose-50 hover:text-rose-600">✕</button>
      </span>
    ) : (
      tok.forms.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onOpen(f)}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-app border border-dashed border-blue-400 bg-blue-50/60 px-3 py-1 text-[13px] font-medium text-blue-700 hover:bg-blue-100 active:scale-[0.97]"
        >
          <ClipboardCheck className="h-4 w-4" /> Isi {FUNCTIONAL_FORMS[f]?.name || f}
        </button>
      ))
    )}
  </span>
);

const renderToken = (tok, key, values, setValue, openForm) => {
  if (tok.t === 'gopen' || tok.t === 'gclose') return null;
  // Tanda baca yang berdiri sendiri (".", ",", ")") hanya berguna di teks yang mengalir;
  // di HP kontrol tampil satu per baris, jadi tanda baca itu cuma menjadi baris kosong.
  if (tok.t === 'text' && /^[\s.,;:()]+$/.test(tok.v)) return <span key={key} className="max-sm:hidden">{tok.v}</span>;
  if (tok.t === 'text') return <span key={key}>{tok.v}</span>;
  const value = values[tok.id];
  const onChange = (v) => setValue(tok.id, v);
  switch (tok.t) {
    case 'choice': return <ChoiceChips key={key} tok={tok} value={value} onChange={onChange} />;
    case 'duration': return <DurationInput key={key} value={value} onChange={onChange} />;
    case 'date': return <DateInput key={key} value={value} onChange={onChange} />;
    case 'toggle': return <ToggleSentence key={key} tok={tok} value={value} onChange={onChange} />;
    case 'scale': return <ScaleChips key={key} tok={tok} value={value} onChange={onChange} />;
    case 'form': return <FormButtons key={key} tok={tok} value={value} onOpen={(f) => openForm(tok.id, f)} onClear={() => onChange(undefined)} />;
    default: return <FreeInput key={key} tok={tok} value={value} onChange={onChange} />;
  }
};

// ───────────── Komponen utama ─────────────

const VITAL_RE = /vital/i;
const VITAL_LINE_RE = /(^|\n)(Vital Sign:|Tanda Vital)/i;
// Pengukuran khas per diagnosa tidak digabung; sisanya (Inspeksi, Palpasi, Gerak, Kekuatan, Tes Khusus, ...)
// cukup diisi satu kali bila muncul di lebih dari satu diagnosa.
const NOT_SHARED_RE = /^pengukuran/i;

const tokenSignature = (sentence) => JSON.stringify([sentence.kind, sentence.tokens.map(({ id, ...rest }) => rest)]);

/**
 * Template Subjective klik-pilih.
 *
 * @param templates   [{ key, label, template }] — satu per diagnosa yang punya template
 * @param currentText isi Subjective saat ini (untuk menentukan ganti / tambahkan)
 * @param onApply     (text, { replace }) => void
 */
const SubjectiveTemplateBuilder = ({ templates: rawTemplates, currentText, onApply, compact = false, variables, previewOnly = false, defaultOpen = true, mode = 'subjective', embedded = false }) => {
  const [activeKey, setActiveKey] = useState(rawTemplates[0]?.key);
  const [valuesByKey, setValuesByKey] = useState({});
  // Diagnosa dengan beberapa varian template: terapis memilih varian, template yang dipakai = varian itu.
  const [variantByKey, setVariantByKey] = useState({});
  const variantsOf = useMemo(
    () => Object.fromEntries(rawTemplates.map((t) => [t.key, splitVariants(t.template)])),
    [rawTemplates]
  );
  const templates = useMemo(
    () => rawTemplates.map((t) => {
      const list = variantsOf[t.key];
      return { ...t, template: (list[variantByKey[t.key]] || list[0])?.text };
    }),
    [rawTemplates, variantsOf, variantByKey]
  );
  const [open, setOpenState] = useState(defaultOpen);
  const setOpen = embedded ? () => {} : setOpenState;
  const [lastApplied, setLastApplied] = useState('');
  const [formDialog, setFormDialog] = useState(null);
  const isObjective = mode === 'objective';
  const noun = isObjective ? 'Objective' : 'Subjective';

  // Beberapa diagnosa: hasil otomatis digabung dari semua template yang terisi.
  const merged = templates.length > 1;

  useEffect(() => {
    if (!templates.some((t) => t.key === activeKey)) setActiveKey(templates[0]?.key);
  }, [templates, activeKey]);

  const active = templates.find((t) => t.key === activeKey) || templates[0];
  const activeVariants = variantsOf[active?.key] || [];
  const activeVariantIdx = variantByKey[active?.key] || 0;
  const chooseVariant = (idx) => {
    if (idx === activeVariantIdx) return;
    setVariantByKey((prev) => ({ ...prev, [active.key]: idx }));
    // Id isian berbeda tiap varian, jadi isian lama dikosongkan.
    setValuesByKey((prev) => ({ ...prev, [active.key]: {} }));
  };
  const fullParsed = useMemo(() => parseTemplate(active?.template, variables), [active?.template, variables]);
  const values = valuesByKey[active?.key] || {};

  // Vital sign milik pasien, bukan diagnosa: satu isian dipakai bersama semua tab diagnosa.
  const sharedVital = useMemo(() => {
    if (!isObjective) return null;
    return mergeVitalSections(
      templates.map((t) => parseTemplate(t.template, variables)?.sections.find((s) => VITAL_RE.test(s.title)))
    );
  }, [isObjective, templates, variables]);
  const [vitalValues, setVitalValues] = useState({});
  const setVitalValue = (id, v) =>
    setVitalValues((prev) => {
      const cur = { ...prev };
      if (v === undefined) delete cur[id];
      else cur[id] = v;
      return cur;
    });

  // Bagian bernama sama di lebih dari satu diagnosa (mis. Inspeksi, Palpasi, Kekuatan) disatukan:
  // kalimat kembar dibuang, sisanya diisi satu kali untuk semua diagnosa.
  const sharedSections = useMemo(() => {
    if (!isObjective || templates.length < 2) return [];
    const byTitle = new Map();
    templates.forEach((t) => {
      const seen = new Set();
      (parseTemplate(t.template, variables)?.sections || []).forEach((sec) => {
        const k = sec.title.toLowerCase();
        if (VITAL_RE.test(sec.title) || NOT_SHARED_RE.test(sec.title) || seen.has(k)) return;
        seen.add(k);
        if (!byTitle.has(k)) byTitle.set(k, { title: sec.title, layout: sec.layout, count: 0, sentences: [], sigs: new Set() });
        const entry = byTitle.get(k);
        entry.count += 1;
        sec.sentences.forEach((sentence) => {
          const sig = tokenSignature(sentence);
          if (entry.sigs.has(sig)) return;
          entry.sigs.add(sig);
          const n = entry.sentences.length;
          entry.sentences.push({
            ...sentence,
            tokens: sentence.tokens.map((tok) => (tok.id ? { ...tok, id: `sh${byTitle.size}_${n}_${tok.id}` } : tok)),
          });
        });
      });
    });
    return [...byTitle.values()].filter((e) => e.count > 1).map(({ title, layout, sentences }) => ({ title, layout, sentences }));
  }, [isObjective, templates, variables]);
  const sharedTitles = useMemo(() => new Set(sharedSections.map((sec) => sec.title.toLowerCase())), [sharedSections]);
  const sharedParsed = useMemo(() => (sharedSections.length ? { sections: sharedSections } : null), [sharedSections]);
  const [sharedValues, setSharedValues] = useState({});
  const setSharedValue = (id, v) =>
    setSharedValues((prev) => {
      const cur = { ...prev };
      if (v === undefined) delete cur[id];
      else cur[id] = v;
      return cur;
    });

  const stripShared = (full) => {
    if (!full) return full;
    const sections = full.sections.filter((sec) => !(sharedVital && VITAL_RE.test(sec.title)) && !sharedTitles.has(sec.title.toLowerCase()));
    return sections.length ? { ...full, sections } : null;
  };

  const parsed = useMemo(() => stripShared(fullParsed), [fullParsed, sharedVital, sharedTitles]); // eslint-disable-line react-hooks/exhaustive-deps
  const vitalParsed = useMemo(() => (sharedVital ? { sections: [sharedVital] } : null), [sharedVital]);

  const setValue = (id, v) =>
    setValuesByKey((prev) => {
      const cur = { ...(prev[active.key] || {}) };
      if (v === undefined) delete cur[id];
      else cur[id] = v;
      return { ...prev, [active.key]: cur };
    });

  const parsedAll = useMemo(
    () => templates.map((t) => ({ key: t.key, label: t.label, parsed: stripShared(parseTemplate(t.template, variables)) })),
    [templates, variables, sharedVital, sharedTitles] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const progressAll = useMemo(
    () => parsedAll.map((p) => ({ ...p, ...countProgress(p.parsed, valuesByKey[p.key] || {}) })),
    [parsedAll, valuesByKey]
  );
  const existing = (currentText || '').trim();
  const willReplace = !existing || existing === lastApplied.trim();

  const output = useMemo(() => {
    const body = merged
      ? renderMergedTemplates(
        [
          ...(sharedParsed ? [{ parsed: sharedParsed, values: sharedValues }] : []),
          ...parsedAll.map((p) => ({ parsed: p.parsed, values: valuesByKey[p.key] || {} })),
        ],
        { inline: isObjective }
      )
      : renderTemplate(parsed, values, { inline: isObjective });
    // Saat menambahkan diagnosa lain ke teks yang sudah memuat Vital Sign, jangan tulis ulang.
    const vital = vitalParsed && (willReplace || !VITAL_LINE_RE.test(existing))
      ? renderTemplate(vitalParsed, vitalValues, { inline: true })
      : '';
    return [vital, body].filter(Boolean).join('\n');
  }, [parsed, values, merged, parsedAll, valuesByKey, isObjective, vitalParsed, vitalValues, willReplace, existing, sharedParsed, sharedValues]);
  // Hasil bisa diedit bebas (free text); perubahan pilihan/isian membangun ulang teks dari template.
  const [edited, setEdited] = useState(null);
  useEffect(() => { setEdited(null); }, [output]);
  const finalText = edited ?? output;
  const { filled, total } = useMemo(() => {
    const a = countProgress(parsed, values);
    const b = countProgress(vitalParsed, vitalValues);
    const c = countProgress(sharedParsed, sharedValues);
    return { filled: a.filled + b.filled + c.filled, total: a.total + b.total + c.total };
  }, [parsed, values, vitalParsed, vitalValues, sharedParsed, sharedValues]);

  if (!active || (!parsed && !vitalParsed && !sharedParsed)) return null;

  const reset = () => {
    setValuesByKey((prev) => ({ ...prev, [active.key]: {} }));
    setVitalValues({});
    setSharedValues({});
  };

  const apply = () => {
    if (!finalText.trim()) return;
    onApply(finalText, { replace: willReplace });
    setLastApplied(willReplace ? finalText : `${existing}\n\n${finalText}`);
    setOpen(false);
  };

  return (
    <div className={cn('soap-root', embedded ? '' : 'border-b bg-gradient-to-b from-app-soft/70 to-white')}>
      {!embedded && (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn('flex w-full items-center justify-between gap-3 text-left', compact ? 'px-4 py-3' : 'px-6 py-4')}
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-app bg-app-accent text-white shadow-sm">
            {isObjective ? <Stethoscope className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-800">Isi {noun} Cepat</span>
            <span className="block truncate text-xs text-slate-500">
              {open ? 'Klik pilihan & isi titik-titik, bagian kosong tidak ikut tampil' : `Template ${active.label}`}
            </span>
          </span>
        </span>
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>
      )}

      {(open || embedded) && (
        <div className={cn('space-y-4 pb-4', embedded ? '' : compact ? 'px-4' : 'px-6')}>
          {templates.length > 1 && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {templates.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveKey(t.key)}
                  className={cn(
                    'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-xs',
                    t.key === active.key
                      ? 'border-app-accent bg-app-accent text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-app-accent/40'
                  )}
                >
                  {t.label}
                  {progressAll.find((p) => p.key === t.key)?.filled > 0 && (
                    <span className="ml-1.5 opacity-80">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {activeVariants.length > 1 && (
            <div role="group" aria-label="Varian template" className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Varian:</span>
              {activeVariants.map((v, idx) => (
                <button
                  key={v.name}
                  type="button"
                  aria-pressed={idx === activeVariantIdx}
                  onClick={() => chooseVariant(idx)}
                  className={cn(
                    'rounded-full border px-4 py-2 text-sm font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-xs',
                    idx === activeVariantIdx
                      ? 'border-app-accent bg-app-accent text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-app-accent/40'
                  )}
                >
                  {v.name}
                </button>
              ))}
            </div>
          )}

          <div className="soap-split space-y-4">
          <div className="soap-main min-w-0">
          <div className="space-y-5">
            {[
              ...(vitalParsed ? [{ section: sharedVital, shared: 'vital' }] : []),
              ...sharedSections.map((section) => ({ section, shared: 'common' })),
              ...(parsed?.sections || []).map((section) => ({ section, shared: false })),
            ].map(({ section, shared }, sIdx) => (
              <div key={`${sIdx}-${section.title}`}>
                {(section.title || shared) && <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-app-accent-hover">
                  <span>
                    {section.title}
                    {shared && templates.length > 1 && <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-500">(berlaku untuk semua diagnosa)</span>}
                  </span>
                  {shared === 'vital' && (
                    <button
                      type="button"
                      onClick={() => setVitalValues((prev) => ({ ...prev, ...normalVitalValues(sharedVital) }))}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold normal-case tracking-normal text-emerald-700 hover:bg-emerald-100"
                    >
                      Normal
                    </button>
                  )}
                </div>}
                {(() => {
                  const store = shared === 'vital' ? vitalValues : shared === 'common' ? sharedValues : values;
                  const setter = shared === 'vital' ? setVitalValue : shared === 'common' ? setSharedValue : setValue;
                  const openForm = (id, f) => setFormDialog({ id, form: f, shared });
                  if (section.layout !== 'lines') {
                    return (
                      <div className="space-y-2">
                        {section.sentences.map((sentence, si) => {
                          const inputs = sentence.tokens.filter((tok) => tok.id);
                          // Kalimat tanpa isian hanya teks penjelas.
                          if (inputs.length === 0) {
                            return (
                              <p key={si} className="px-1 text-sm leading-6 text-slate-600">
                                {sentence.tokens.map((tok, ti) => renderToken(tok, `${si}-${ti}`, store, setter, openForm))}
                              </p>
                            );
                          }
                          const done = inputs.some((tok) => hasValue(store[tok.id]));
                          return (
                            <div
                              key={si}
                              className={cn(
                                'flex gap-3 rounded-app border px-3 py-2.5 transition-colors',
                                done ? 'border-app-accent/30 bg-app-soft/40' : 'border-slate-200 bg-white'
                              )}
                            >
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border sm:mt-2',
                                  done ? 'border-app-accent bg-app-accent text-white' : 'border-slate-300 bg-white'
                                )}
                              >
                                {done && <Check className="h-3 w-3" />}
                              </span>
                              <div className="min-w-0 flex-1 text-[15px] leading-7 text-slate-700 sm:text-sm sm:leading-9">
                                {sentence.tokens.map((tok, ti) => renderToken(tok, `${si}-${ti}`, store, setter, openForm))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }
                  // Format daftar: satu baris per pemeriksaan, label di kiri, pilihan/isian di kanan.
                  return (
                    <div className="divide-y divide-slate-100 overflow-hidden rounded-app border border-slate-100">
                      {section.sentences.map((sentence, si) => {
                        const sepIdx = sentence.kind === 'kv' ? sentence.tokens.findIndex((t) => t.t === 'text' && t.v === ' : ') : -1;
                        const labelToks = sepIdx > 0 ? sentence.tokens.slice(0, sepIdx) : [];
                        const bodyToks = sepIdx > 0 ? sentence.tokens.slice(sepIdx + 1) : sentence.tokens;
                        return (
                          <div key={si} className="flex flex-col gap-0.5 px-3 py-1.5 sm:flex-row sm:items-start sm:gap-3">
                            {sepIdx > 0 ? (
                              <div className="shrink-0 pt-0.5 text-[13px] font-medium leading-9 text-slate-600 sm:w-44">
                                {labelToks.map((tok, ti) => renderToken(tok, `l${si}-${ti}`, store, setter, openForm))}
                              </div>
                            ) : (
                              <span className="hidden pt-0.5 text-slate-300 sm:block sm:leading-9">•</span>
                            )}
                            <div className="min-w-0 flex-1 text-[15px] leading-7 text-slate-700 sm:text-sm sm:leading-9">
                              {bodyToks.map((tok, ti) => renderToken(tok, `b${si}-${ti}`, store, setter, openForm))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>

          </div>

          <div className="soap-aside min-w-0">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Sparkles className="h-3 w-3" /> {merged ? 'Hasil gabungan semua diagnosa' : 'Hasil'}
            </div>
            <textarea
              value={finalText}
              onChange={(e) => setEdited(e.target.value)}
              placeholder="Teks akan muncul di sini setelah Anda memilih atau mengisi. Bisa diedit langsung."
              rows={Math.min(14, Math.max(5, finalText.split('\n').length + 1))}
              className={cn(
                'block w-full resize-y rounded-app border px-3 py-2.5 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-app-accent/25',
                finalText ? 'border-app-accent/15 bg-white text-slate-800' : 'border-dashed border-slate-200 bg-slate-50 text-slate-500'
              )}
            />
          </div>
          </div>

          <div className="soap-actions sticky bottom-0 z-10 -mx-1 flex items-center gap-3 border-t border-slate-200 bg-white px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3">
            <div className="min-w-0 flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-app-accent-bright transition-[width] duration-300 ease-out motion-reduce:transition-none"
                  style={{ width: total ? `${Math.round((filled / total) * 100)}%` : '0%' }}
                />
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                <span className="tabular-nums">{filled}/{total} terisi</span>
                <button
                  type="button"
                  onClick={reset}
                  disabled={filled === 0}
                  className="tap-target flex items-center gap-1 hover:text-rose-600 disabled:opacity-40"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              </div>
            </div>
            {!previewOnly && (
              <Button
                type="button"
                onClick={apply}
                disabled={!finalText.trim()}
                className="h-11 shrink-0 gap-2 rounded-app bg-app-accent px-4 text-sm font-semibold hover:bg-app-accent-hover sm:px-6"
              >
                <Check className="h-4 w-4" />
                {willReplace ? `Masukkan ke ${noun}` : `Tambahkan ke ${noun}`}
              </Button>
            )}
          </div>
        </div>
      )}

      <FunctionalFormDialog
        formId={formDialog?.form}
        open={!!formDialog}
        initial={(() => {
          if (!formDialog) return null;
          const store = formDialog.shared === 'vital' ? vitalValues : formDialog.shared === 'common' ? sharedValues : values;
          return store[formDialog.id]?.form === formDialog.form ? store[formDialog.id] : null;
        })()}
        onClose={() => setFormDialog(null)}
        onApply={(result) => (formDialog.shared === 'vital' ? setVitalValue : formDialog.shared === 'common' ? setSharedValue : setValue)(formDialog.id, result)}
      />
    </div>
  );
};

export default SubjectiveTemplateBuilder;
