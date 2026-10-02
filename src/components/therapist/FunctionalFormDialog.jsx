import React, { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardCheck, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FUNCTIONAL_FORMS, buildFormResult, itemNote, itemOptions } from '@/data/functionalForms';
import { cn } from '@/lib/utils';

/**
 * Pop-up formulir fungsional (Barthel, Berg, NDI, ODI, DASH, LEFS, SPADI, FES-I).
 * Terapis mengisi per item; hasil ({ text, answers, ... }) dikirim lewat onApply.
 */
const FunctionalFormDialog = ({ formId, open, initial, onClose, onApply }) => {
  const form = FUNCTIONAL_FORMS[formId];
  const [answers, setAnswers] = useState({});
  const [manual, setManual] = useState('');

  useEffect(() => {
    if (!open) return;
    setAnswers(initial?.answers || {});
    setManual(initial?.manual ?? '');
  }, [open, initial, formId]);

  const result = useMemo(
    () => (form ? buildFormResult(form, answers, manual) : null),
    [form, answers, manual]
  );

  if (!form) return null;

  const total = form.items.length;
  const done = Object.keys(answers).length;
  const manualMode = manual !== '' && manual !== null;
  const enough = manualMode || done >= form.minAnswered;
  const missing = Math.max(0, form.minAnswered - done);

  const pick = (idx, value) =>
    setAnswers((a) => {
      const next = { ...a };
      if (next[idx] === value) delete next[idx];
      else next[idx] = value;
      return next;
    });

  const apply = () => {
    if (!result) return;
    onApply({ text: result.text, form: form.id, answers: manualMode ? {} : answers, manual: manualMode ? manual : '' });
    onClose();
  };

  let lastGroup = null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-gradient-to-b from-blue-50 to-white px-5 pb-3 pt-5 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white"><ClipboardCheck className="h-4 w-4" /></span>
            {form.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pilih jawaban tiap item. Skor dihitung otomatis dan masuk ke Objective.
          </DialogDescription>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.round((done / total) * 100)}%` }} />
            </div>
            <span className="text-xs tabular-nums text-slate-500">{done}/{total} item</span>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {form.items.map((item, idx) => {
            const options = itemOptions(item);
            const groupHeader = item.group && item.group !== lastGroup ? item.group : null;
            lastGroup = item.group || lastGroup;
            const note = idx === 0 || form.items[idx - 1]?.scale !== item.scale ? itemNote(item) : null;
            return (
              <React.Fragment key={idx}>
                {groupHeader && <div className="pt-1 text-[11px] font-semibold uppercase tracking-wider text-blue-700">{groupHeader}</div>}
                {note && <p className="rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] leading-snug text-slate-500">{note}</p>}
                <div className={cn('rounded-xl border p-3 transition-colors', answers[idx] !== undefined ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white')}>
                  <div className="mb-2 flex gap-2 text-sm font-medium text-slate-800">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] text-slate-500">{idx + 1}</span>
                    {item.label}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {options.map((opt) => {
                      const active = answers[idx] === opt.value;
                      const wide = opt.label !== String(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          aria-pressed={active}
                          onClick={() => pick(idx, opt.value)}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-left text-[13px] leading-tight transition-all active:scale-95',
                            active ? 'border-blue-600 bg-blue-600 font-medium text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300',
                            !wide && 'min-w-[38px] text-center'
                          )}
                        >
                          {wide ? <><b className={active ? 'text-white' : 'text-blue-700'}>{opt.value}</b> · {opt.label}</> : opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {form.manual && (
            <div className="rounded-xl border border-dashed border-slate-300 p-3">
              <div className="mb-1.5 text-xs font-semibold text-slate-500">Sudah punya skor dari lembar resmi?</div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={form.manual.min}
                  max={form.manual.max}
                  value={manual}
                  placeholder={form.manual.label}
                  onChange={(e) => setManual(e.target.value === '' ? '' : String(Math.min(form.manual.max, Math.max(form.manual.min, Number(e.target.value)))))}
                  className="h-9"
                />
                {manualMode && (
                  <button type="button" onClick={() => setManual('')} className="shrink-0 text-xs text-slate-500 hover:text-rose-600">Hapus</button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Jika diisi, skor ini dipakai menggantikan jawaban per item.</p>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t bg-white px-5 py-3">
          <div className={cn('rounded-xl px-3 py-2 text-sm', result ? 'bg-blue-50 text-blue-900' : 'bg-slate-50 text-slate-400')}>
            {result ? <><span className="font-semibold">{result.text}</span></> : 'Skor akan muncul setelah Anda memilih jawaban.'}
          </div>
          {!enough && done > 0 && (
            <p className="text-[11px] text-amber-600">Lengkapi minimal {form.minAnswered} item ({missing} lagi) agar skor valid.</p>
          )}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => { setAnswers({}); setManual(''); }}
              disabled={done === 0 && !manualMode}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 disabled:opacity-40"
            >
              <RotateCcw className="h-3 w-3" /> Kosongkan
            </button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Batal</Button>
              <Button type="button" onClick={apply} disabled={!result || !enough} className="gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700">
                <Check className="h-4 w-4" /> Terapkan
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FunctionalFormDialog;
