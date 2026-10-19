import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Check, X, ChevronDown, ChevronUp, Flag } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import UnpaidSessionsCard from '@/components/shared/UnpaidSessionsCard';
import { supabase } from '@/lib/customSupabaseClient';
import { formatCurrency } from '@/lib/utils';
import { formatVitalsLine } from '@/lib/recapVitals';
import {
  OVERRIDE_KIND_LABELS,
  OVERRIDE_STATUS_LABELS,
  INCENTIVE_REASON_LABELS,
  decideOverride,
  flagRecapIncentive,
  markIncentiveFlags,
} from '@/lib/soapFirst';

const fmtDateTime = (v) => {
  try { return format(new Date(v), 'dd MMM yyyy HH:mm', { locale: idLocale }); } catch { return v || '-'; }
};
const fmtDate = (v) => {
  try { return format(new Date(`${String(v).slice(0, 10)}T00:00:00`), 'dd MMM yyyy', { locale: idLocale }); } catch { return v || '-'; }
};
const recapName = (r) => r?.full_name || r?.guest_name || 'Pasien';

const StatusPill = ({ status }) => {
  const cls = status === 'approved' ? 'bg-emerald-100 text-emerald-700' : status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{OVERRIDE_STATUS_LABELS[status] || status}</span>;
};

const describePayload = (o) => {
  if (o.kind === 'package_extend') return `Berakhir baru: ${o.payload?.new_end_date || '-'}`;
  if (o.kind === 'amount_adjust') return `Nominal baru: ${formatCurrency(o.payload?.amount || 0)}`;
  if (o.kind === 'manual_discount') {
    const v = Number(o.payload?.discount_value || 0);
    return `Diskon ${o.payload?.discount_label || 'manual'}: ${o.payload?.discount_type === 'percentage' ? `${v}%` : formatCurrency(v)}`;
  }
  if (o.kind === 'vitals_edit') {
    const oldLine = formatVitalsLine(o.payload?.old) || '-';
    const newLine = formatVitalsLine(o.payload?.vitals) || '-';
    return `TTV lama: ${oldLine} → TTV baru: ${newLine}`;
  }
  return null;
};

const OverrideQueue = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [recaps, setRecaps] = useState({});
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('soap_overrides').select('*').order('requested_at', { ascending: false }).limit(300);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal memuat', description: error.message });
      setLoading(false);
      return;
    }
    const list = data || [];
    setRows(list);
    const ids = [...new Set(list.map((o) => o.recap_id).filter(Boolean))];
    if (ids.length) {
      const { data: rec } = await supabase.from('daily_recaps').select('id, recap_date, full_name, guest_name, therapist_name, patient_type, amount').in('id', ids);
      setRecaps(Object.fromEntries((rec || []).map((r) => [r.id, r])));
    } else {
      setRecaps({});
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const pending = useMemo(() => rows.filter((o) => o.status === 'pending'), [rows]);
  const history = useMemo(() => rows.filter((o) => o.status !== 'pending'), [rows]);

  const confirmDecision = async () => {
    if (!decision) return;
    setSaving(true);
    try {
      await decideOverride(decision.id, decision.approve, note.trim() || null);
      toast({ title: decision.approve ? 'Pengajuan disetujui' : 'Pengajuan ditolak' });
      setDecision(null);
      setNote('');
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal memutuskan', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const Row = ({ o, withActions }) => {
    const r = recaps[o.recap_id];
    return (
      <div className="rounded-app border bg-white p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{OVERRIDE_KIND_LABELS[o.kind] || o.kind}</span>
          <StatusPill status={o.status} />
          <span className="text-xs text-slate-500 ml-auto">{fmtDateTime(o.requested_at)}</span>
        </div>
        {r && (
          <div className="text-xs text-slate-600">
            {recapName(r)} · {fmtDate(r.recap_date)} · Terapis {r.therapist_name || '-'} · {r.patient_type || '-'} · {formatCurrency(r.amount || 0)}
          </div>
        )}
        {describePayload(o) && <div className="text-xs font-medium text-slate-700">{describePayload(o)}</div>}
        <div className="text-sm text-slate-800">“{o.reason}”</div>
        <div className="text-xs text-slate-500">Diajukan oleh {o.requested_by_name || '-'}{o.decided_at ? ` · Diputuskan oleh ${o.decided_by_name || '-'} (${fmtDateTime(o.decided_at)})` : ''}{o.decision_note ? ` · Catatan: ${o.decision_note}` : ''}</div>
        {withActions && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="h-8" onClick={() => { setNote(''); setDecision({ id: o.id, approve: true }); }}><Check className="h-4 w-4 mr-1" />Setujui</Button>
            <Button size="sm" variant="outline" className="h-8 text-red-600" onClick={() => { setNote(''); setDecision({ id: o.id, approve: false }); }}><X className="h-4 w-4 mr-1" />Tolak</Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Menunggu ({pending.length})</TabsTrigger>
            <TabsTrigger value="history">Riwayat ({history.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="space-y-3 mt-3">
            {pending.length === 0 && <p className="text-sm text-slate-500">Tidak ada pengajuan yang menunggu.</p>}
            {pending.map((o) => <Row key={o.id} o={o} withActions />)}
          </TabsContent>
          <TabsContent value="history" className="space-y-3 mt-3">
            {history.length === 0 && <p className="text-sm text-slate-500">Belum ada riwayat.</p>}
            {history.map((o) => <Row key={o.id} o={o} />)}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!decision} onOpenChange={(v) => !saving && !v && setDecision(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{decision?.approve ? 'Setujui pengajuan' : 'Tolak pengajuan'}</DialogTitle>
            <DialogDescription>Keputusan dicatat beserta nama Anda dan pemohon diberi tahu.</DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Catatan (opsional)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)} disabled={saving}>Batal</Button>
            <Button onClick={confirmDecision} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Konfirmasi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SoapAudit = () => {
  const { toast } = useToast();
  const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() + 8 * 3600 * 1000 - 6 * 86400000).toISOString().slice(0, 10);
  const [start, setStart] = useState(weekAgo);
  const [end, setEnd] = useState(today);
  const [onlyZero, setOnlyZero] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(null);
  const [soap, setSoap] = useState({});
  const [flagTarget, setFlagTarget] = useState(null);
  const [flagReason, setFlagReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_recaps')
        .select('id, recap_date, full_name, guest_name, therapist_name, patient_type, amount, soap_completed_at, invoice_created_at, incentive_zero_manual, incentive_zero_manual_reason, soap_first_applied')
        .gte('recap_date', start)
        .lte('recap_date', end)
        .eq('soap_first_applied', true)
        .order('recap_date', { ascending: false })
        .limit(500);
      if (error) throw error;
      const flagged = await markIncentiveFlags(data || [], { strict: false });
      setRows(flagged);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal memuat', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [start, end, toast]);

  useEffect(() => { load(); }, [load]);

  const toggleOpen = async (r) => {
    if (open === r.id) { setOpen(null); return; }
    setOpen(r.id);
    if (!soap[r.id]) {
      const { data } = await supabase.from('medical_records').select('id, subjective, objective, assessment, plan, created_at').eq('daily_recap_id', r.id).order('created_at', { ascending: true });
      setSoap((prev) => ({ ...prev, [r.id]: data || [] }));
    }
  };

  const saveFlag = async () => {
    if (!flagTarget) return;
    setSaving(true);
    try {
      await flagRecapIncentive(flagTarget.id, flagTarget.zero, flagReason.trim());
      toast({ title: flagTarget.zero ? 'Insentif sesi ini dinolkan' : 'Tanda dicabut' });
      setFlagTarget(null);
      setFlagReason('');
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const shown = onlyZero ? rows.filter((r) => r._incentiveZeroed) : rows;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label className="text-xs">Dari</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9" /></div>
        <div className="space-y-1"><Label className="text-xs">Sampai</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9" /></div>
        <label className="flex items-center gap-2 text-sm pb-2"><input type="checkbox" checked={onlyZero} onChange={(e) => setOnlyZero(e.target.checked)} /> Hanya insentif nol</label>
      </div>
      <p className="text-xs text-slate-500">Audit manual: buka SOAP untuk dibaca. Bila SOAP dinilai asal-asalan, tandai agar jasa sesi itu nol (terapis hanya melihat label netral).</p>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-2">
          {shown.length === 0 && <p className="text-sm text-slate-500">Tidak ada data pada rentang ini.</p>}
          {shown.map((r) => (
            <div key={r.id} className="rounded-app border bg-white">
              <button type="button" onClick={() => toggleOpen(r)} className="w-full flex flex-wrap items-center gap-2 p-3 text-left">
                <span className="text-sm font-semibold text-slate-900">{recapName(r)}</span>
                <span className="text-xs text-slate-500">{fmtDate(r.recap_date)} · {r.therapist_name || '-'} · {r.patient_type || '-'} · {formatCurrency(r.amount || 0)}</span>
                <span className="ml-auto flex items-center gap-2">
                  {r._incentiveZeroed
                    ? <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[11px] font-medium">Insentif nol · {INCENTIVE_REASON_LABELS[r._incentiveReason] || r._incentiveReason}</span>
                    : <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[11px] font-medium">Insentif utuh</span>}
                  {open === r.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </button>
              {open === r.id && (
                <div className="border-t p-3 space-y-3 text-sm">
                  <div className="text-xs text-slate-500">
                    SOAP selesai: {r.soap_completed_at ? fmtDateTime(r.soap_completed_at) : 'belum'} · Invoice: {r.invoice_created_at ? fmtDateTime(r.invoice_created_at) : 'belum'}
                    {r.incentive_zero_manual_reason ? ` · Tanda owner: ${r.incentive_zero_manual_reason}` : ''}
                  </div>
                  {(soap[r.id] || []).length === 0 && <p className="text-xs text-slate-500">Belum ada SOAP.</p>}
                  {(soap[r.id] || []).map((m) => (
                    <div key={m.id} className="grid gap-2 sm:grid-cols-2 text-xs">
                      {['subjective', 'objective', 'assessment', 'plan'].map((k) => (
                        <div key={k} className="rounded-app-sm bg-slate-50 p-2">
                          <div className="font-semibold uppercase text-slate-500">{k}</div>
                          <div className="whitespace-pre-wrap text-slate-800">{m[k] || '-'}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    {r.incentive_zero_manual ? (
                      <Button size="sm" variant="outline" className="h-8" onClick={() => { setFlagReason(''); setFlagTarget({ id: r.id, zero: false }); }}>Cabut tanda</Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-8 text-red-600" onClick={() => { setFlagReason(''); setFlagTarget({ id: r.id, zero: true }); }}><Flag className="h-4 w-4 mr-1" />Tandai asal-asalan (insentif nol)</Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!flagTarget} onOpenChange={(v) => !saving && !v && setFlagTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{flagTarget?.zero ? 'Tandai SOAP asal-asalan' : 'Cabut tanda'}</DialogTitle>
            <DialogDescription>{flagTarget?.zero ? 'Jasa insentif sesi ini dihitung nol. Terapis hanya melihat label netral.' : 'Jasa insentif sesi ini dihitung kembali sesuai aturan waktu.'}</DialogDescription>
          </DialogHeader>
          {flagTarget?.zero && <Textarea value={flagReason} onChange={(e) => setFlagReason(e.target.value)} rows={3} placeholder="Alasan penilaian (wajib)" />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagTarget(null)} disabled={saving}>Batal</Button>
            <Button onClick={saveFlag} disabled={saving || (flagTarget?.zero && flagReason.trim().length < 3)}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SoapFirstOverrides = () => (
  <div className="space-y-4">
    <div>
      <h1 className="text-xl font-bold text-slate-900">Pengajuan & Audit SOAP</h1>
      <p className="text-sm text-slate-500">Setujui pengecualian dari admin dan audit SOAP yang menentukan insentif terapis.</p>
    </div>
    <UnpaidSessionsCard />
    <Tabs defaultValue="queue">
      <TabsList>
        <TabsTrigger value="queue">Pengajuan</TabsTrigger>
        <TabsTrigger value="audit">Audit SOAP</TabsTrigger>
      </TabsList>
      <TabsContent value="queue" className="mt-4"><OverrideQueue /></TabsContent>
      <TabsContent value="audit" className="mt-4"><SoapAudit /></TabsContent>
    </Tabs>
  </div>
);

export default SoapFirstOverrides;
