import React from 'react';
import { Plus, Trash2, Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const MAX_GOALS = 6;

const newGoalId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Goal treatment (tampil di portal pasien Clinara). goals: [{ id, text, progress 0-100 }].
 * Id goal tetap saat dibawa ke SOAP berikutnya, supaya portal bisa menampilkan perkembangannya per sesi.
 * previousGoals: goal dari SOAP sebelumnya, ditawarkan untuk disalin bila goal masih kosong.
 */
const GoalTreatment = ({ goals, onChange, previousGoals }) => {
  const list = Array.isArray(goals) ? goals : [];
  const update = (id, patch) => onChange(list.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const canCopy = list.length === 0 && Array.isArray(previousGoals) && previousGoals.length > 0;

  return (
    <section className="rounded-app-lg border border-slate-200 bg-white px-4 py-3">
      <div className="mb-1 flex items-center gap-2">
        <h4 className="text-sm font-semibold text-slate-800">Goal treatment</h4>
        {canCopy && (
          <Button type="button" variant="outline" size="sm" className="ml-auto h-8 gap-1 text-xs"
            onClick={() => onChange(previousGoals.map((g) => ({ id: g.id, text: g.text, progress: g.progress ?? 0 })))}>
            <Copy className="h-3.5 w-3.5" /> Salin dari SOAP sebelumnya
          </Button>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-500">Target terapi yang dilihat pasien di aplikasi Clinara, beserta progresnya. Perbarui progres tiap sesi.</p>
      <div className="space-y-3">
        {list.map((g, i) => (
          <div key={g.id} className="rounded-app-sm border border-slate-100 bg-slate-50/70 p-3">
            <div className="flex items-center gap-2">
              <Input value={g.text} maxLength={200} onChange={(e) => update(g.id, { text: e.target.value })}
                placeholder="mis. Berjalan 500 m tanpa nyeri" aria-label={`Goal ${i + 1}`} className="h-9 bg-white" />
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-slate-400 hover:text-red-600"
                onClick={() => onChange(list.filter((x) => x.id !== g.id))} aria-label={`Hapus goal ${i + 1}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <input type="range" min={0} max={100} step={5} value={g.progress ?? 0} aria-label={`Progres goal ${i + 1}`}
                onChange={(e) => update(g.id, { progress: Number(e.target.value) })} className="h-2 flex-1 accent-teal-600" />
              <span className="w-12 text-right text-sm font-semibold tabular-nums text-slate-700">{g.progress ?? 0}%</span>
            </div>
          </div>
        ))}
      </div>
      {list.length < MAX_GOALS && (
        <Button type="button" variant="outline" size="sm" className="mt-3 h-9 gap-1"
          onClick={() => onChange([...list, { id: newGoalId(), text: '', progress: 0 }])}>
          <Plus className="h-4 w-4" /> Tambah goal
        </Button>
      )}
    </section>
  );
};

export default GoalTreatment;
