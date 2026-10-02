import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ClipboardCheck, Minus, Pencil, Plus, RotateCcw, Sparkles, Stethoscope, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FunctionalFormDialog from '@/components/therapist/FunctionalFormDialog';
import { FUNCTIONAL_FORMS } from '@/data/functionalForms';
import { cn } from '@/lib/utils';
import {
  DURATION_UNITS,
  countProgress,
  parseTemplate,
  renderTemplate,
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
    if (!tok.flag) return 'bg-blue-600 border-blue-600 text-white';
    return ['ada', 'ya'].includes(opt.toLowerCase())
      ? 'bg-emerald-600 border-emerald-600 text-white'
      : 'bg-slate-600 border-slate-600 text-white';
  };

  return (
    <span className="mx-1 inline-flex flex-wrap items-center gap-1 align-middle">
      {(tok.prefix || tok.hint) && <span className="text-xs text-slate-500">{tok.prefix || `${tok.hint}:`}</span>}
      {tok.options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(opt)}
            className={cn(
              'min-h-[32px] rounded-full border px-3 py-1 text-[13px] leading-tight transition-all active:scale-95',
              active
                ? cn(tone(opt), 'font-medium shadow-sm')
                : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
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
    <span className="mx-1 inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-blue-100 bg-blue-50/60 p-1 align-middle">
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white">
        <button
          type="button"
          aria-label="Kurangi"
          onClick={() => set({ n: Math.max(0, n - 1) })}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 active:scale-90"
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
          className="h-8 w-10 border-0 bg-transparent p-0 text-center text-sm font-semibold text-slate-800 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label="Tambah"
          onClick={() => set({ n: n + 1 })}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 active:scale-90"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </span>
      <span className="inline-flex gap-0.5 rounded-full bg-white p-0.5 ring-1 ring-slate-200">
        {DURATION_UNITS.map((u) => (
          <button
            key={u}
            type="button"
            aria-pressed={unit === u}
            onClick={() => set({ unit: u, n: n || 1 })}
            className={cn(
              'rounded-full px-2.5 py-1 text-[13px] transition-colors',
              unit === u && n > 0 ? 'bg-blue-600 font-medium text-white' : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            {u}
          </button>
        ))}
      </span>
      {n === 0 && (
        <span className="inline-flex gap-1">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => set({ n: q })}
              className="h-7 min-w-[28px] rounded-full border border-slate-200 bg-white px-2 text-xs text-slate-500 hover:border-blue-300 hover:text-blue-600"
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
      style={{ width: `${width}ch` }}
      className={cn(
        'mx-1 h-8 max-w-full rounded-lg border bg-white px-2 align-middle text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100',
        value?.trim() ? 'border-blue-300 bg-blue-50/40' : 'border-dashed border-slate-300'
      )}
    />
  );
};

const todayIso = () => {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const DateInput = ({ value, onChange }) => (
  <span className="mx-1 inline-flex items-center gap-1 align-middle">
    <input
      type="date"
      value={value || ''}
      max="2100-12-31"
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-8 rounded-lg border bg-white px-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100',
        value ? 'border-blue-300 bg-blue-50/40' : 'border-dashed border-slate-300'
      )}
    />
    {!value && (
      <button
        type="button"
        onClick={() => onChange(todayIso())}
        className="h-7 rounded-full border border-slate-200 bg-white px-2.5 text-xs text-slate-500 hover:border-blue-300 hover:text-blue-600"
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
      'my-0.5 mr-1 inline-flex max-w-full items-start gap-1.5 rounded-xl border px-2.5 py-1.5 text-left text-[13px] leading-snug transition-all active:scale-[0.99]',
      value
        ? 'border-blue-600 bg-blue-600 font-medium text-white shadow-sm'
        : 'border-dashed border-slate-300 bg-white text-slate-500 hover:border-blue-300 hover:bg-blue-50'
    )}
  >
    <span
      className={cn(
        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
        value ? 'border-white bg-white text-blue-600' : 'border-slate-300'
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
    if (tok.max !== 10) return 'bg-blue-600 border-blue-600 text-white';
    return n <= 3 ? 'bg-emerald-500 border-emerald-500 text-white' : n <= 6 ? 'bg-amber-500 border-amber-500 text-white' : 'bg-rose-500 border-rose-500 text-white';
  };
  return (
    <span className="mx-1 inline-flex flex-wrap items-center gap-1 align-middle">
      {tok.label && <span className="text-xs text-slate-500">{tok.label}:</span>}
      {nums.map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={value === n}
          onClick={() => onChange(value === n ? undefined : n)}
          className={cn(
            'h-8 min-w-[32px] rounded-full border px-2 text-[13px] transition-all active:scale-95',
            value === n ? cn(tone(Number(n)), 'font-semibold shadow-sm') : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
          )}
        >
          {n}
        </button>
      ))}
    </span>
  );
};

const FormButtons = ({ tok, value, onOpen, onClear }) => (
  <span className="mx-1 inline-flex flex-wrap items-center gap-1.5 align-middle">
    {value?.text ? (
      <span className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 bg-blue-50 py-1 pl-3 pr-1.5 text-[13px] font-medium text-blue-800">
        {value.text}
        <button type="button" aria-label="Ubah" onClick={() => onOpen(value.form)} className="rounded-lg p-1 text-blue-600 hover:bg-blue-100"><Pencil className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label="Hapus" onClick={onClear} className="rounded-lg px-1.5 py-1 text-xs text-slate-500 hover:bg-rose-50 hover:text-rose-600">✕</button>
      </span>
    ) : (
      tok.forms.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onOpen(f)}
          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl border border-dashed border-blue-400 bg-blue-50/60 px-3 py-1 text-[13px] font-medium text-blue-700 hover:bg-blue-100 active:scale-95"
        >
          <ClipboardCheck className="h-4 w-4" /> Isi {FUNCTIONAL_FORMS[f]?.name || f}
        </button>
      ))
    )}
  </span>
);

const renderToken = (tok, key, values, setValue, openForm) => {
  if (tok.t === 'gopen' || tok.t === 'gclose') return null;
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

/**
 * Template Subjective klik-pilih.
 *
 * @param templates   [{ key, label, template }] — satu per diagnosa yang punya template
 * @param currentText isi Subjective saat ini (untuk menentukan ganti / tambahkan)
 * @param onApply     (text, { replace }) => void
 */
const SubjectiveTemplateBuilder = ({ templates, currentText, onApply, compact = false, variables, previewOnly = false, defaultOpen = true, mode = 'subjective', embedded = false }) => {
  const [activeKey, setActiveKey] = useState(templates[0]?.key);
  const [valuesByKey, setValuesByKey] = useState({});
  const [open, setOpenState] = useState(defaultOpen);
  const setOpen = embedded ? () => {} : setOpenState;
  const [lastApplied, setLastApplied] = useState('');
  const [formDialog, setFormDialog] = useState(null);
  const isObjective = mode === 'objective';
  const noun = isObjective ? 'Objective' : 'Subjective';

  useEffect(() => {
    if (!templates.some((t) => t.key === activeKey)) setActiveKey(templates[0]?.key);
  }, [templates, activeKey]);

  const active = templates.find((t) => t.key === activeKey) || templates[0];
  const parsed = useMemo(() => parseTemplate(active?.template, variables), [active?.template, variables]);
  const values = valuesByKey[active?.key] || {};

  const setValue = (id, v) =>
    setValuesByKey((prev) => {
      const cur = { ...(prev[active.key] || {}) };
      if (v === undefined) delete cur[id];
      else cur[id] = v;
      return { ...prev, [active.key]: cur };
    });

  const output = useMemo(() => renderTemplate(parsed, values, { inline: isObjective }), [parsed, values, isObjective]);
  const { filled, total } = useMemo(() => countProgress(parsed, values), [parsed, values]);

  if (!active || !parsed) return null;

  const existing = (currentText || '').trim();
  const willReplace = !existing || existing === lastApplied.trim();
  const reset = () => setValuesByKey((prev) => ({ ...prev, [active.key]: {} }));

  const apply = () => {
    if (!output) return;
    onApply(output, { replace: willReplace });
    setLastApplied(willReplace ? output : `${existing}\n\n${output}`);
    setOpen(false);
  };

  return (
    <div className={embedded ? '' : 'border-b bg-gradient-to-b from-blue-50/70 to-white'}>
      {!embedded && (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn('flex w-full items-center justify-between gap-3 text-left', compact ? 'px-4 py-3' : 'px-6 py-4')}
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            {isObjective ? <Stethoscope className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-800">Isi {noun} Cepat</span>
            <span className="block truncate text-xs text-slate-500">
              {open ? 'Klik pilihan & isi titik-titik, bagian kosong tidak ikut tampil' : `Template ${active.label}`}
            </span>
          </span>
        </span>
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
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
                    'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    t.key === active.key
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: total ? `${Math.round((filled / total) * 100)}%` : '0%' }}
              />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-slate-500">{filled}/{total} terisi</span>
            <button
              type="button"
              onClick={reset}
              disabled={filled === 0}
              className="flex shrink-0 items-center gap-1 text-xs text-slate-500 hover:text-rose-600 disabled:opacity-40"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            {parsed.sections.map((section, sIdx) => (
              <div key={`${sIdx}-${section.title}`}>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-blue-700">{section.title}</div>
                <div className="text-sm leading-[2.5rem] text-slate-700">
                  {section.sentences.map((sentence, si) => (
                    <React.Fragment key={si}>
                      {sentence.tokens.map((tok, ti) => renderToken(tok, `${si}-${ti}`, values, setValue, (id, f) => setFormDialog({ id, form: f })))}{' '}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <Sparkles className="h-3 w-3" /> Hasil
            </div>
            <div
              className={cn(
                'min-h-[64px] whitespace-pre-wrap rounded-xl border px-3 py-2.5 text-sm leading-relaxed',
                output ? 'border-blue-100 bg-white text-slate-800' : 'border-dashed border-slate-200 bg-slate-50 text-slate-400'
              )}
            >
              {output || 'Teks akan muncul di sini setelah Anda memilih atau mengisi.'}
            </div>
          </div>

          {!previewOnly && (
          <Button
            type="button"
            onClick={apply}
            disabled={!output}
            className="h-11 w-full gap-2 rounded-xl bg-blue-600 text-sm font-semibold hover:bg-blue-700"
          >
            <Check className="h-4 w-4" />
            {willReplace ? `Masukkan ke ${noun}` : `Tambahkan ke ${noun}`}
          </Button>
          )}
        </div>
      )}

      <FunctionalFormDialog
        formId={formDialog?.form}
        open={!!formDialog}
        initial={formDialog && values[formDialog.id]?.form === formDialog.form ? values[formDialog.id] : null}
        onClose={() => setFormDialog(null)}
        onApply={(result) => setValue(formDialog.id, result)}
      />
    </div>
  );
};

export default SubjectiveTemplateBuilder;
