import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Braces, CalendarDays, CheckCircle2, ChevronLeft, Clock, Edit2, FileText, ListChecks,
  Loader2, Plus, Save, Search, Send, Trash2, Type, Undo2, Wand2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import SubjectiveTemplateBuilder from '@/components/therapist/SubjectiveTemplateBuilder';
import { FORM_LIST } from '@/data/functionalForms';
import {
  cancelSoapTemplateRequest, deleteSubjectiveVariable, getOperationalOptions, getSoapTemplateRequests,
  getSubjectiveVariables, getTherapistDiagnosisUsage, reviewSoapTemplateRequest, saveSubjectiveVariable, submitSoapTemplateRequest,
  updateDiagnosisSubjectiveTemplate,
} from '@/lib/api';
import { cn } from '@/lib/utils';

const KIND_META = {
  choice: { label: 'Pilihan', icon: ListChecks, hint: 'Terapis tinggal klik salah satu / beberapa pilihan' },
  free: { label: 'Teks bebas', icon: Type, hint: 'Terapis mengetik sendiri' },
  number: { label: 'Angka', icon: Braces, hint: 'Isian angka (mis. skor VAS)' },
  date: { label: 'Tanggal', icon: CalendarDays, hint: 'Pemilih tanggal' },
  duration: { label: 'Durasi', icon: Clock, hint: 'Angka + hari/minggu/bulan/tahun' },
};

const slugify = (text) =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

// Cuplikan yang bisa disisipkan ke template dengan satu klik.
const SNIPPETS = [
  { label: 'Isian teks', text: '(.....)' },
  { label: 'Pilihan', text: '(pilihan 1/pilihan 2)', select: [1, 20] },
  { label: 'Ada / Tidak', text: '(ada/tidak)' },
  { label: 'Ya / Tidak', text: '(ya/tidak)' },
  { label: 'Kanan / Kiri', text: '(kanan/kiri)' },
  { label: 'Durasi', text: 'sejak (.....) hari/minggu/bulan yang lalu' },
  { label: 'Tanggal', text: 'tanggal (.....)' },
  { label: 'Bagian baru', text: '\n**Judul Bagian:** ', select: [3, 15] },
];
const OBJECTIVE_SNIPPETS = [
  { label: 'Positif / Negatif', text: '(+/-)' },
  { label: 'Skala 0-10', text: '(.....)/10' },
  { label: 'Terbatas / Penuh / Nyeri', text: '(terbatas/penuh/nyeri)' },
  { label: 'Kelompok opsional', text: '[teks (.....)]', select: [1, 5] },
  { label: 'Pemisah item', text: ' | ' },
];

// ───────────── Dialog variabel ─────────────

const VariableDialog = ({ open, onClose, variable, onSaved }) => {
  const { toast } = useToast();
  const [form, setForm] = useState({ label: '', key: '', kind: 'choice', optionsText: '', multi: true });
  const [keyTouched, setKeyTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKeyTouched(!!variable);
    setForm(variable
      ? { label: variable.label, key: variable.key, kind: variable.kind, optionsText: (variable.options || []).join('\n'), multi: variable.multi !== false }
      : { label: '', key: '', kind: 'choice', optionsText: '', multi: true });
  }, [open, variable]);

  const options = form.optionsText.split(/\n|,/).map((o) => o.trim()).filter(Boolean);
  const keyValid = /^[a-z0-9_]{2,40}$/.test(form.key);
  const valid = form.label.trim() && keyValid && (form.kind !== 'choice' || options.length >= 2);

  const submit = async () => {
    setSaving(true);
    const { error } = await saveSubjectiveVariable({
      id: variable?.id, key: form.key, label: form.label.trim(), kind: form.kind, options, multi: form.multi,
    });
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan variabel', description: error.code === '23505' ? 'Kode variabel sudah dipakai.' : error.message });
      return;
    }
    toast({ title: 'Variabel tersimpan' });
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{variable ? 'Edit Variabel' : 'Variabel Baru'}</DialogTitle>
          <DialogDescription>Variabel bisa dipakai di banyak template sebagai {'{{kode}}'}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Nama variabel</label>
            <Input
              value={form.label}
              placeholder="mis. Sifat nyeri"
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value, key: keyTouched ? f.key : slugify(e.target.value) }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Kode (dipakai di template)</label>
            <Input
              value={form.key}
              disabled={!!variable}
              placeholder="sifat_nyeri"
              onChange={(e) => { setKeyTouched(true); setForm((f) => ({ ...f, key: slugify(e.target.value) })); }}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Tulis <code className="rounded bg-slate-100 px-1">{`{{${form.key || 'kode'}}}`}</code> di template. Huruf kecil, angka, garis bawah.
              {variable && ' Kode tidak bisa diubah agar template lama tidak rusak.'}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Jenis isian</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(KIND_META).map(([kind, meta]) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, kind }))}
                  className={cn(
                    'flex items-center gap-2 rounded-app border px-3 py-2 text-left text-sm transition-colors',
                    form.kind === kind ? 'border-app-accent bg-app-soft text-app-accent-hover' : 'border-slate-200 hover:border-app-accent/40'
                  )}
                >
                  <meta.icon className="h-4 w-4 shrink-0" />
                  {meta.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{KIND_META[form.kind].hint}</p>
          </div>
          {form.kind === 'choice' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Pilihan (satu per baris, minimal 2)</label>
                <Textarea
                  rows={5}
                  value={form.optionsText}
                  placeholder={'tajam\ntumpul\nterbakar\nberdenyut'}
                  onChange={(e) => setForm((f) => ({ ...f, optionsText: e.target.value }))}
                />
              </div>
              <label className="flex items-center justify-between rounded-app border border-slate-200 px-3 py-2 text-sm">
                <span>Boleh pilih lebih dari satu</span>
                <Switch checked={form.multi} onCheckedChange={(v) => setForm((f) => ({ ...f, multi: v }))} />
              </label>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={!valid || saving} className="bg-app-accent hover:bg-app-accent-hover">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ───────────── Pengajuan perubahan dari terapis (owner) ─────────────

const FIELD_LABEL = { subjective_template: 'Subjective', objective_template: 'Objective' };

const RequestsReviewPanel = ({ requests, diagnoses, onReviewed }) => {
  const { toast } = useToast();
  const [busyId, setBusyId] = useState(null);
  const [notes, setNotes] = useState({});
  const pending = requests.filter((r) => r.status === 'pending');
  if (pending.length === 0) return null;

  const review = async (r, approve) => {
    setBusyId(r.id);
    const { error } = await reviewSoapTemplateRequest(r.id, approve, notes[r.id] || null);
    setBusyId(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal memproses pengajuan', description: error.message });
      return;
    }
    toast({ title: approve ? 'Pengajuan disetujui, template diperbarui' : 'Pengajuan ditolak' });
    onReviewed();
  };

  return (
    <div className="space-y-3 rounded-app-lg border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
      <div>
        <div className="text-sm font-semibold text-amber-900">Pengajuan dari Terapis ({pending.length})</div>
        <div className="text-xs text-amber-800/80">Template baru berlaku untuk semua terapis setelah Anda setujui.</div>
      </div>
      {pending.map((r) => {
        const diagnosis = diagnoses.find((d) => d.id === r.diagnosis_id);
        const before = diagnosis ? diagnosis[r.field] : r.previous_template;
        return (
          <div key={r.id} className="space-y-2 rounded-app border border-amber-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900">{diagnosis?.label || 'Diagnosa'}</span>
              <Badge variant="outline" className="text-[10px]">{FIELD_LABEL[r.field]}</Badge>
              <span className="text-xs text-slate-400">
                oleh {r.requested_by_name || 'Terapis'} · {new Date(r.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Saat ini</div>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-app-sm bg-slate-50 p-2 text-xs text-slate-600">{before || '(kosong)'}</pre>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Usulan</div>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-app-sm bg-emerald-50 p-2 text-xs text-slate-700">{r.proposed_template || '(dihapus / kosong)'}</pre>
              </div>
            </div>
            <Input
              value={notes[r.id] || ''}
              onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
              placeholder="Catatan untuk terapis (opsional)"
              className="text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 rounded-app text-rose-600" disabled={busyId === r.id} onClick={() => review(r, false)}>
                <X className="h-4 w-4" /> Tolak
              </Button>
              <Button size="sm" className="gap-1.5 rounded-app bg-emerald-600 hover:bg-emerald-700" disabled={busyId === r.id} onClick={() => review(r, true)}>
                {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Setujui
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const STATUS_META = {
  pending: { label: 'Menunggu persetujuan owner', className: 'border-amber-300 bg-amber-50 text-amber-700' },
  approved: { label: 'Disetujui', className: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Ditolak', className: 'border-rose-300 bg-rose-50 text-rose-700' },
};

// ───────────── Halaman utama ─────────────

// requestMode = tampilan terapis: perubahan tidak langsung disimpan, tetapi
// diajukan ke owner (butuh fitur diaktifkan Super Admin untuk kliniknya).
const SubjectiveTemplateManager = ({ requestMode = false, requesterName = '', therapistId = null }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [diagnoses, setDiagnoses] = useState([]);
  const [variables, setVariables] = useState([]);
  const [query, setQuery] = useState('');
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [field, setField] = useState('subjective_template');
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [varDialog, setVarDialog] = useState({ open: false, variable: null });
  const [requests, setRequests] = useState([]);
  const [usageCounts, setUsageCounts] = useState({});
  const [listTab, setListTab] = useState('mine');
  const textareaRef = useRef(null);

  const load = useCallback(async () => {
    const [d, v, r, u] = await Promise.all([
      getOperationalOptions('diagnosa'), getSubjectiveVariables(), getSoapTemplateRequests(),
      requestMode ? getTherapistDiagnosisUsage(therapistId) : Promise.resolve({ data: {} }),
    ]);
    setRequests(r.data || []);
    setUsageCounts(u.data || {});
    if (d.error) toast({ variant: 'destructive', title: 'Gagal memuat diagnosa', description: d.error.message });
    setDiagnoses((d.data || []).filter((x) => x.is_active !== false).sort((a, b) => a.label.localeCompare(b.label, 'id', { sensitivity: 'base' })));
    setVariables(v.data || []);
    setLoading(false);
  }, [toast, requestMode, therapistId]);

  useEffect(() => { load(); }, [load]);

  const selected = diagnoses.find((d) => d.id === selectedId) || null;
  const isObjective = field === 'objective_template';
  const pendingFor = (d, f) => (requestMode && d
    ? requests.find((r) => r.status === 'pending' && r.diagnosis_id === d.id && r.field === f) || null
    : null);
  // Draft awal: di mode terapis, pengajuan pending sendiri didahulukan.
  const initialDraft = (d, f) => {
    const pendingRequest = pendingFor(d, f);
    return pendingRequest ? pendingRequest.proposed_template || '' : d[f] || '';
  };
  const pendingRequest = pendingFor(selected, field);
  const current = selected ? initialDraft(selected, field) : '';
  const dirty = selected ? draft !== current : false;

  const select = (d) => {
    if (dirty && !window.confirm('Perubahan belum disimpan. Pindah diagnosa?')) return;
    setSelectedId(d.id);
    setDraft(initialDraft(d, field));
  };

  const switchField = (f) => {
    if (f === field) return;
    if (dirty && !window.confirm('Perubahan belum disimpan. Pindah ke template lain?')) return;
    setField(f);
    setDraft(selected ? initialDraft(selected, f) : '');
    setOnlyEmpty(false);
  };

  // Pemakaian per diagnosa (id atau label teks di rekap), hanya relevan di mode terapis.
  const usageById = useMemo(() => {
    const byLabel = {};
    diagnoses.forEach((d) => { byLabel[d.label.trim().toLowerCase()] = d.id; });
    const result = {};
    Object.entries(usageCounts).forEach(([value, count]) => {
      const id = byLabel[value.trim().toLowerCase()] || value;
      result[id] = (result[id] || 0) + count;
    });
    return result;
  }, [diagnoses, usageCounts]);
  const mineCount = useMemo(() => diagnoses.filter((d) => usageById[d.id] > 0).length, [diagnoses, usageById]);
  const showMine = requestMode && listTab === 'mine';

  // Terapis tanpa riwayat diagnosa langsung melihat daftar lengkap.
  useEffect(() => {
    if (!loading && requestMode && mineCount === 0) setListTab('all');
  }, [loading, requestMode, mineCount]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = diagnoses.filter((d) => (!q || d.label.toLowerCase().includes(q)) && (!onlyEmpty || !d[field])
      && (!showMine || usageById[d.id] > 0));
    return showMine ? [...list].sort((a, b) => usageById[b.id] - usageById[a.id]) : list;
  }, [diagnoses, query, onlyEmpty, field, showMine, usageById]);

  const variableMap = useMemo(() => Object.fromEntries(variables.map((v) => [v.key, v])), [variables]);
  const withTemplate = diagnoses.filter((d) => d[field]).length;

  const insert = (text, select) => {
    const el = textareaRef.current;
    const start = el ? el.selectionStart : draft.length;
    const end = el ? el.selectionEnd : draft.length;
    const next = draft.slice(0, start) + text + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const [from, to] = select ? [start + select[0], start + select[1]] : [start + text.length, start + text.length];
      el.setSelectionRange(from, to);
    });
  };

  const submitRequest = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await submitSoapTemplateRequest({
      diagnosisId: selected.id, field, proposed: draft, previous: selected[field], requesterName,
    });
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal mengajukan perubahan', description: error.message });
      return;
    }
    toast({ title: 'Pengajuan terkirim', description: 'Menunggu persetujuan owner.' });
    const r = await getSoapTemplateRequests();
    setRequests(r.data || []);
  };

  const cancelRequest = async () => {
    if (!pendingRequest || !window.confirm('Batalkan pengajuan ini?')) return;
    const { error } = await cancelSoapTemplateRequest(pendingRequest.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal membatalkan', description: error.message });
      return;
    }
    const r = await getSoapTemplateRequests();
    setRequests(r.data || []);
    setDraft(selected[field] || '');
  };

  const save = async () => {
    if (!selected) return;
    if (requestMode) { await submitRequest(); return; }
    setSaving(true);
    const { error } = await updateDiagnosisSubjectiveTemplate(selected.id, draft, field);
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menyimpan', description: error.message });
      return;
    }
    const value = draft.trim() ? draft : null;
    setDiagnoses((list) => list.map((d) => (d.id === selected.id ? { ...d, [field]: value } : d)));
    setDraft(value || '');
    toast({ title: 'Template tersimpan', description: selected.label });
  };

  const removeVariable = async (v) => {
    if (!window.confirm(`Hapus variabel "${v.label}"? Template yang memakai {{${v.key}}} akan menampilkan isian teks biasa.`)) return;
    const { error } = await deleteSubjectiveVariable(v.id);
    if (error) toast({ variant: 'destructive', title: 'Gagal menghapus', description: error.message });
    else load();
  };

  const missingKeys = useMemo(
    () => [...new Set([...draft.matchAll(/\{\{([a-z0-9_]+)\}\}/g)].map((m) => m[1]))].filter((k) => !variableMap[k]),
    [draft, variableMap]
  );
  const hasSections = /^\*\*.+:\*\*/m.test(draft);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-app-accent" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Wand2 className="h-5 w-5 text-app-accent" /> Template SOAP</h3>
        <p className="text-sm text-slate-500">
          {requestMode
            ? 'Usulkan perubahan template Subjective dan Objective. Perubahan baru berlaku setelah disetujui owner.'
            : 'Atur template Subjective dan Objective tiap diagnosa. Titik-titik dan pilihan otomatis menjadi isian klik-pilih bagi terapis; bagian yang tidak diisi tidak ikut tampil.'}
          <span className="ml-1 text-slate-400">({withTemplate}/{diagnoses.length} diagnosa punya template)</span>
        </p>
      </div>

      {!requestMode && (
        <RequestsReviewPanel requests={requests} diagnoses={diagnoses} onReviewed={load} />
      )}

      {requestMode && requests.length > 0 && (
        <div className="rounded-app-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 text-sm font-semibold text-slate-800">Pengajuan Saya</div>
          <div className="max-h-48 divide-y overflow-y-auto">
            {requests.slice(0, 20).map((r) => {
              const meta = STATUS_META[r.status] || STATUS_META.pending;
              const diagnosis = diagnoses.find((d) => d.id === r.diagnosis_id);
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="font-medium text-slate-800">{diagnosis?.label || 'Diagnosa'}</span>
                  <Badge variant="outline" className="text-[10px]">{FIELD_LABEL[r.field]}</Badge>
                  <Badge variant="outline" className={cn('text-[10px]', meta.className)}>{meta.label}</Badge>
                  {r.review_note && <span className="text-xs text-slate-500">&ldquo;{r.review_note}&rdquo;</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="inline-flex rounded-app bg-slate-100 p-1">
        {[['subjective_template', 'Subjective'], ['objective_template', 'Objective']].map(([f, label]) => (
          <button
            key={f}
            type="button"
            onClick={() => switchField(f)}
            className={cn('rounded-app-sm px-4 py-1.5 text-sm font-medium transition-colors', field === f ? 'bg-white text-app-accent-hover shadow-sm' : 'text-slate-500 hover:text-slate-700')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Variabel */}
      <div className="rounded-app-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-800">Variabel</div>
            <div className="text-xs text-slate-500">Isian yang bisa dipakai ulang di banyak template.</div>
          </div>
          {!requestMode && (
            <Button size="sm" className="gap-1.5 rounded-app bg-app-accent hover:bg-app-accent-hover" onClick={() => setVarDialog({ open: true, variable: null })}>
              <Plus className="h-4 w-4" /> Variabel
            </Button>
          )}
        </div>
        {variables.length === 0 ? (
          <p className="rounded-app border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
            {requestMode ? 'Belum ada variabel.' : <>Belum ada variabel. Contoh: &quot;Sifat nyeri&quot; dengan pilihan tajam / tumpul / terbakar.</>}
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {variables.map((v) => {
              const Meta = KIND_META[v.kind] || KIND_META.free;
              return (
                <div key={v.id} className="flex items-center gap-2 rounded-app border border-slate-200 px-3 py-2">
                  <Meta.icon className="h-4 w-4 shrink-0 text-app-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">{v.label}</div>
                    <div className="truncate text-[11px] text-slate-400">
                      <code>{`{{${v.key}}}`}</code>{v.kind === 'choice' && ` · ${(v.options || []).join(', ')}`}
                    </div>
                  </div>
                  {!requestMode && (
                    <>
                      <button type="button" aria-label="Edit" className="rounded-app-sm p-1.5 text-slate-400 hover:bg-slate-100 hover:text-app-accent" onClick={() => setVarDialog({ open: true, variable: v })}>
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button type="button" aria-label="Hapus" className="rounded-app-sm p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => removeVariable(v)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Daftar diagnosa + editor */}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className={cn('rounded-app-lg border border-slate-200 bg-white shadow-sm', selected && 'hidden lg:block')}>
          <div className="space-y-2 border-b p-3">
            {requestMode && (
              <div className="inline-flex w-full rounded-app bg-slate-100 p-1">
                {[['mine', `Sering saya pakai (${mineCount})`], ['all', 'Semua diagnosa']].map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setListTab(tab)}
                    className={cn('flex-1 rounded-app-sm px-2 py-1.5 text-xs font-medium transition-colors', listTab === tab ? 'bg-white text-app-accent-hover shadow-sm' : 'text-slate-500 hover:text-slate-700')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari diagnosa..." className="pl-9" />
            </div>
            <label className="flex items-center justify-between text-xs text-slate-500">
              Hanya yang belum punya template
              <Switch checked={onlyEmpty} onCheckedChange={setOnlyEmpty} />
            </label>
          </div>
          <div className="max-h-[60vh] divide-y overflow-y-auto">
            {filtered.length === 0 && (
              <p className="p-4 text-center text-sm text-slate-400">
                {showMine && !query && !onlyEmpty
                  ? 'Belum ada diagnosa yang tercatat di rekap Anda. Lihat tab "Semua diagnosa".'
                  : 'Tidak ada diagnosa.'}
              </p>
            )}
            {filtered.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => select(d)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-app-soft',
                  d.id === selectedId && 'bg-app-soft font-medium text-app-accent-hover'
                )}
              >
                <span className="min-w-0 truncate">
                  {d.label}
                  {requestMode && usageById[d.id] > 0 && (
                    <span className="ml-1.5 text-[11px] font-normal text-slate-400">{usageById[d.id]}×</span>
                  )}
                </span>
                {d[field]
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  : <Badge variant="outline" className="shrink-0 text-[10px] text-slate-400">kosong</Badge>}
              </button>
            ))}
          </div>
        </div>

        <div className={cn('space-y-3', !selected && 'hidden lg:block')}>
          {!selected ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 rounded-app-lg border border-dashed border-slate-200 p-8 text-center text-slate-400">
              <FileText className="h-8 w-8" />
              <p className="text-sm">Pilih diagnosa di sebelah kiri untuk mengedit template-nya.</p>
            </div>
          ) : (
            <>
              <div className="rounded-app-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <button type="button" className="rounded-app-sm p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setSelectedId(null)} aria-label="Kembali">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-900">{selected.label}</div>
                    <div className="text-xs text-slate-400">Template {isObjective ? 'Objective' : 'Subjective'}</div>
                  </div>
                </div>

                {requestMode && pendingRequest && (
                  <p className="mb-2 rounded-app-sm bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Pengajuan Anda untuk template ini sedang menunggu persetujuan owner. Mengirim ulang akan memperbarui pengajuan tersebut.
                  </p>
                )}
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {[...SNIPPETS.filter((sn) => !isObjective || ['Isian teks', 'Pilihan', 'Ada / Tidak', 'Kanan / Kiri', 'Bagian baru'].includes(sn.label)), ...(isObjective ? OBJECTIVE_SNIPPETS : [])].map((sn) => (
                    <button
                      key={sn.label}
                      type="button"
                      onClick={() => insert(sn.text, sn.select)}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-app-accent/40 hover:bg-app-soft"
                    >
                      + {sn.label}
                    </button>
                  ))}
                </div>
                {isObjective && (
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Formulir</span>
                    {FORM_LIST.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => insert(`{{form:${f.id}}}`)}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                )}
                {variables.length > 0 && (
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Variabel</span>
                    {variables.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => insert(`{{${v.key}}}`)}
                        className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-100"
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                )}

                <Textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={12}
                  spellCheck={false}
                  className="font-mono text-[13px] leading-relaxed"
                  placeholder={'**Keluhan Utama:** Nyeri leher sejak (.....) hari/minggu/bulan yang lalu.\n**Riwayat Penyakit Sekarang:** Kesemutan (ada/tidak). Sifat nyeri {{sifat_nyeri}}.'}
                />
                <ul className="mt-2 space-y-0.5 text-[11px] text-slate-400">
                  <li>Satu bagian per baris, diawali <code className="rounded bg-slate-100 px-1">**Judul:**</code></li>
                  {isObjective && <li><code className="rounded bg-slate-100 px-1">(+/-)</code> positif/negatif · <code className="rounded bg-slate-100 px-1">(.....)/10</code> skala klik · <code className="rounded bg-slate-100 px-1">[ ... ]</code> kelompok opsional · <code className="rounded bg-slate-100 px-1">{'{{form:barthel}}'}</code> pop-up formulir · <code className="rounded bg-slate-100 px-1">|</code> pemisah item</li>}
                  <li><code className="rounded bg-slate-100 px-1">(.....)</code> isian teks · <code className="rounded bg-slate-100 px-1">(a/b/c)</code> pilihan · <code className="rounded bg-slate-100 px-1">(ada/tidak)</code> ya/tidak · <code className="rounded bg-slate-100 px-1">hari/minggu/bulan</code> durasi · <code className="rounded bg-slate-100 px-1">{'{{kode}}'}</code> variabel</li>
                </ul>
                {draft.trim() && !hasSections && (
                  <p className="mt-2 rounded-app-sm bg-amber-50 px-3 py-2 text-xs text-amber-700">Belum ada judul bagian. Awali baris dengan **Keluhan Utama:** agar template terbaca.</p>
                )}
                {missingKeys.length > 0 && (
                  <p className="mt-2 rounded-app-sm bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Variabel belum dibuat: {missingKeys.map((k) => `{{${k}}}`).join(', ')}. Sementara tampil sebagai isian teks.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  {requestMode && pendingRequest && (
                    <Button variant="outline" size="sm" className="gap-1.5 rounded-app text-rose-600" onClick={cancelRequest}>
                      <X className="h-4 w-4" /> Batalkan Pengajuan
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-app" disabled={!dirty} onClick={() => setDraft(current)}>
                    <Undo2 className="h-4 w-4" /> Batalkan
                  </Button>
                  <Button size="sm" className="gap-1.5 rounded-app bg-app-accent hover:bg-app-accent-hover" disabled={!dirty || saving} onClick={save}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : requestMode ? <Send className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                    {requestMode ? 'Ajukan Perubahan' : 'Simpan'}
                  </Button>
                </div>
              </div>

              <div className="overflow-hidden rounded-app-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Pratinjau (tampilan terapis)</div>
                {draft.trim() ? (
                  <SubjectiveTemplateBuilder
                    key={`${selected.id}-${field}`}
                    mode={isObjective ? 'objective' : 'subjective'}
                    templates={[{ key: selected.id, label: selected.label, template: draft }]}
                    variables={variableMap}
                    currentText=""
                    onApply={() => {}}
                    previewOnly
                    compact
                  />
                ) : (
                  <p className="p-6 text-center text-sm text-slate-400">Tulis template di atas untuk melihat pratinjau.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <VariableDialog
        open={varDialog.open}
        variable={varDialog.variable}
        onClose={() => setVarDialog({ open: false, variable: null })}
        onSaved={load}
      />
    </div>
  );
};

export default SubjectiveTemplateManager;
