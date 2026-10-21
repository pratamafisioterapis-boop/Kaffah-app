import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Wallet, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

const idr = (v) => `Rp ${Math.round(Number(v) || 0).toLocaleString('id-ID')}`;
const wita = (value) => new Date(new Date(value).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const fmtDate = (ymd) => {
  if (!ymd) return '-';
  const d = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Bayar di muka untuk paket homecare dan paket "RU" pada appointment mendatang
// (admin/owner), serta refund penuh oleh owner sebelum terapi dimulai.
const PrepayPackagePanel = ({ appointment, onChanged }) => {
  const { toast } = useToast();
  const { userDetails, role } = useAuth();
  const isOwner = role === 'owner' || role === 'super_admin';
  const isAdmin = role === 'admin' || role === 'clinic_admin';

  const [loading, setLoading] = useState(true);
  const [recap, setRecap] = useState(null);
  const [packages, setPackages] = useState([]);
  const [methods, setMethods] = useState([]);

  const [payOpen, setPayOpen] = useState(false);
  const [packageLabel, setPackageLabel] = useState('');
  const [method, setMethod] = useState('');
  const [saving, setSaving] = useState(false);

  const [refundOpen, setRefundOpen] = useState(false);
  const [reason, setReason] = useState('');

  const clinicId = userDetails?.clinic_id || appointment?.clinic_id;
  const today = wita(Date.now());
  const apptDay = appointment?.appointment_date ? wita(appointment.appointment_date) : null;
  const isFuture = !!apptDay && apptDay > today;
  const statusOk = ['confirmed', 'rescheduled'].includes(appointment?.status);
  const canShow = !!appointment?.id && (isOwner || isAdmin);

  const load = useCallback(async () => {
    if (!canShow) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: rc } = await supabase
        .from('daily_recaps')
        .select('id, amount, payment_method, package_type, prepaid_at, invoice_created_at, recap_date, start_time, soap_completed_at, receipt_number')
        .eq('appointment_id', appointment.id)
        .maybeSingle();
      setRecap(rc || null);

      if (!rc && isFuture && statusOk && appointment.patient_id && clinicId) {
        const [pk, pm] = await Promise.all([
          supabase.from('operational_options')
            .select('id, label, session_count, validity_days, price, is_homecare')
            .eq('clinic_id', clinicId).eq('category', 'tipe_paket').eq('is_active', true)
            .gt('session_count', 1).order('session_count'),
          supabase.from('operational_options')
            .select('id, label')
            .eq('clinic_id', clinicId).eq('category', 'payment_method').eq('is_active', true),
        ]);
        setPackages(pk.data || []);
        setMethods((pm.data || []).filter((m) => (m.label || '').toLowerCase() !== 'package'));
      }
    } finally {
      setLoading(false);
    }
  }, [canShow, appointment?.id, appointment?.patient_id, isFuture, statusOk, clinicId]);

  useEffect(() => { load(); }, [load]);

  const eligible = useMemo(() => packages.filter((p) => {
    if (p.price == null) return false;
    if (p.is_homecare) return !!appointment?.is_homecare;
    return /\sRU$/i.test(p.label || '');
  }), [packages, appointment?.is_homecare]);

  const selected = eligible.find((p) => p.label === packageLabel) || null;

  if (!canShow || (loading && !recap)) return null;

  const prepaid = !!recap?.prepaid_at;
  const started = !!(recap?.start_time || recap?.soap_completed_at);
  const canPay = !recap && isFuture && statusOk && !!appointment?.patient_id && eligible.length > 0;

  if (!prepaid && !canPay) return null;

  const handlePay = async () => {
    if (!selected || !method) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('prepay_package', {
        p_appointment_id: appointment.id,
        p_package_label: selected.label,
        p_payment_method: method,
      });
      if (error) throw error;
      toast({ title: 'Pembayaran di muka tercatat', description: `${selected.label} · ${idr(selected.price)}. Invoice terbit hari ini; sesi terhitung pada hari terapi.` });
      setPayOpen(false);
      setPackageLabel('');
      setMethod('');
      await load();
      onChanged?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal mencatat pembayaran', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRefund = async () => {
    if (reason.trim().length < 5) {
      toast({ variant: 'destructive', title: 'Alasan wajib diisi', description: 'Tulis alasan minimal 5 karakter.' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('refund_prepaid_package', {
        p_recap_id: recap.id,
        p_reason: reason.trim(),
        p_cancel_appointment: true,
      });
      if (error) throw error;
      toast({ title: 'Refund dicatat', description: `${idr(recap.amount)} dikembalikan penuh. Paket dibatalkan dan appointment dibatalkan.` });
      setRefundOpen(false);
      setReason('');
      await load();
      onChanged?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Refund gagal', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
        <Wallet className="h-4 w-4" />
        Pembayaran di muka (paket)
      </div>

      {prepaid ? (
        <>
          <p className="text-sm text-emerald-900">
            {recap.package_type} · <strong>{idr(recap.amount)}</strong> ({recap.payment_method}) · dibayar {fmtDate(wita(recap.invoice_created_at || recap.prepaid_at))}
            {recap.receipt_number ? ` · ${recap.receipt_number}` : ''}
          </p>
          <p className="text-xs text-emerald-800">
            Sesi terhitung terpakai pada hari terapi ({fmtDate(recap.recap_date)}). Masa berlaku paket dihitung dari sesi pertama.
          </p>
          {isOwner && !started && (
            <Button type="button" variant="outline" size="sm" onClick={() => setRefundOpen(true)}>
              <Undo2 className="mr-2 h-4 w-4" /> Refund penuh
            </Button>
          )}
          {!isOwner && !started && (
            <p className="text-xs text-emerald-800">Pembatalan/refund hanya dapat dilakukan owner.</p>
          )}
        </>
      ) : (
        <>
          <p className="text-xs text-emerald-800">
            Pasien membayar paket sebelum terapi. Invoice terbit hari ini; kuota sesi baru terpotong pada hari terapi.
          </p>
          <Button type="button" size="sm" onClick={() => setPayOpen(true)}>
            Bayar di muka
          </Button>
        </>
      )}

      <Dialog open={payOpen} onOpenChange={(o) => !saving && setPayOpen(o)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Bayar di muka</DialogTitle>
            <DialogDescription>
              Terapi {fmtDate(apptDay)}. Pembayaran tercatat hari ini ({fmtDate(today)}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Paket</Label>
              <Select value={packageLabel} onValueChange={setPackageLabel}>
                <SelectTrigger><SelectValue placeholder="Pilih paket" /></SelectTrigger>
                <SelectContent>
                  {eligible.map((p) => (
                    <SelectItem key={p.id} value={p.label}>{p.label} ({p.session_count} sesi) · {idr(p.price)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Metode pembayaran</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue placeholder="Pilih metode" /></SelectTrigger>
                <SelectContent>
                  {methods.map((m) => (
                    <SelectItem key={m.id} value={m.label}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selected && (
              <p className="rounded-md bg-slate-50 p-2 text-sm text-slate-700">
                Total <strong>{idr(selected.price)}</strong> · {selected.session_count} sesi · berlaku {selected.validity_days} hari sejak sesi pertama. Paket tidak bisa diberi diskon.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPayOpen(false)} disabled={saving}>Batal</Button>
            <Button type="button" onClick={handlePay} disabled={saving || !selected || !method}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Catat pembayaran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refundOpen} onOpenChange={(o) => !saving && setRefundOpen(o)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Refund penuh</DialogTitle>
            <DialogDescription>
              {recap ? `${idr(recap.amount)} dikembalikan penuh. Paket dan appointment ini dibatalkan, recap berbayar dihapus, dan tercatat di log refund.` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Alasan (wajib)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Mis. pasien membatalkan karena sakit" rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRefundOpen(false)} disabled={saving}>Batal</Button>
            <Button type="button" variant="destructive" onClick={handleRefund} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PrepayPackagePanel;
