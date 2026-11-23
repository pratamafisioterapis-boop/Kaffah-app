import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

const idr = (v) => `Rp ${Math.round(Number(v) || 0).toLocaleString('id-ID')}`;
const fmtDate = (ymd) => {
  if (!ymd) return '-';
  const d = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Refund kelebihan bayar untuk recap yang sudah berinvoice (khusus owner).
// Recap/invoice tidak diubah; uang keluar dicatat sebagai pengeluaran "REFUND PASIEN"
// pada rekening/kas sumber refund (lihat migrasi 20261123230000_recap_refunds.sql).
const RecapRefundPanel = ({ recapId }) => {
  const { toast } = useToast();
  const { userDetails, role } = useAuth();
  const isOwner = role === 'owner' || role === 'super_admin';
  const clinicId = userDetails?.clinic_id;

  const [recap, setRecap] = useState(null);
  const [refunds, setRefunds] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [suggested, setSuggested] = useState(null);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [accountId, setAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!recapId || !isOwner) return;
    const [{ data: rc }, { data: rf }] = await Promise.all([
      supabase.from('daily_recaps').select('id, amount, invoice_created_at, receipt_number').eq('id', recapId).maybeSingle(),
      supabase.from('recap_refunds').select('id, refund_amount, reason, bank_account_name, refund_date').eq('recap_id', recapId).order('refunded_at', { ascending: false }),
    ]);
    setRecap(rc || null);
    setRefunds(rf || []);
    // Saran nominal = selisih dibayar vs harga yang seharusnya (mis. promo pelajar otomatis).
    const { data: q } = await supabase.rpc('soap_first_quote', { p_recap_id: recapId });
    const paid = Number(rc?.amount) || 0;
    const total = q?.total != null ? Number(q.total) : null;
    setSuggested(total != null && paid > total ? paid - total : null);
  }, [recapId, isOwner]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!open || !clinicId) return;
    supabase.from('bank_accounts').select('id, bank_name').eq('clinic_id', clinicId).order('bank_name')
      .then(({ data }) => setAccounts(data || []));
  }, [open, clinicId]);

  if (!isOwner || !recap?.invoice_created_at) return null;

  const refunded = refunds.reduce((s, r) => s + (Number(r.refund_amount) || 0), 0);
  const remaining = Math.max((Number(recap.amount) || 0) - refunded, 0);
  const remainingSuggestion = suggested != null ? Math.max(Math.min(suggested - refunded, remaining), 0) : null;

  const openDialog = () => {
    setAmount(remainingSuggestion ? String(remainingSuggestion) : '');
    setReason(remainingSuggestion ? 'Koreksi promo pelajar: pasien sudah membayar harga normal' : '');
    setAccountId('');
    setOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('refund_recap_overpayment', {
        p_recap_id: recapId,
        p_amount: Number(amount),
        p_reason: reason,
        p_bank_account_id: accountId || null,
      });
      if (error) throw error;
      toast({ title: 'Refund dicatat', description: `${idr(amount)} dicatat sebagai pengeluaran "REFUND PASIEN".` });
      setOpen(false);
      await load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Refund gagal', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const valid = Number(amount) > 0 && Number(amount) <= remaining && reason.trim().length >= 5 && !!accountId;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <Undo2 className="h-4 w-4" /> Refund kelebihan bayar
      </div>
      {remainingSuggestion > 0 && (
        <p className="text-xs text-amber-900">
          Harga yang seharusnya lebih rendah. Selisih yang perlu dikembalikan ke pasien: <strong>{idr(remainingSuggestion)}</strong>.
        </p>
      )}
      {refunds.map((r) => (
        <p key={r.id} className="text-xs text-amber-800">
          {fmtDate(r.refund_date)} · {idr(r.refund_amount)} dari {r.bank_account_name || 'kas'} · {r.reason}
        </p>
      ))}
      {remaining > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={openDialog}>
          Catat refund
        </Button>
      )}

      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catat refund</DialogTitle>
            <DialogDescription>
              Dibayar pasien {idr(recap.amount)}{refunded > 0 ? `, sudah direfund ${idr(refunded)}` : ''}. Invoice tidak diubah; refund tercatat sebagai pengeluaran dan mengurangi saldo rekening/kas yang dipilih.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nominal refund (Rp)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
              {Number(amount) > remaining && <p className="text-xs text-red-600">Maksimal {idr(remaining)}.</p>}
            </div>
            <div className="space-y-1">
              <Label>Dibayar dari rekening / kas</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Pilih rekening/kas" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.bank_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Alasan</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Batal</Button>
            <Button type="button" onClick={submit} disabled={!valid || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecapRefundPanel;
