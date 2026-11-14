import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { getRenewalTerms } from '@/lib/packageRenewalTerms';

const idr = (v) => `Rp ${Math.round(Number(v) || 0).toLocaleString('id-ID')}`;

// Perpanjang paket dari Package Recaps: hanya pembayaran + kwitansi (tanpa rekap kunjungan).
const RenewPackageDialog = ({ isOpen, onClose, clinicId, previousPackage, onDone }) => {
  const { toast } = useToast();
  const terms = getRenewalTerms(clinicId);

  const [packages, setPackages] = useState([]);
  const [methods, setMethods] = useState([]);
  const [packageLabel, setPackageLabel] = useState('');
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const patientId = previousPackage?.patient_id;
  const patientName = previousPackage?.patients?.full_name || '-';

  useEffect(() => {
    if (!isOpen || !clinicId) return;
    let cancelled = false;
    setMethod('');
    setSaving(false);
    // Default: paket yang sama dengan sebelumnya dan nominal terakhir (bisa diubah).
    setPackageLabel(previousPackage?.package_name || '');
    setAmount(previousPackage?.nominal ? String(Math.round(Number(previousPackage.nominal))) : '');
    (async () => {
      const [pk, pm] = await Promise.all([
        supabase.from('operational_options')
          .select('id, label, session_count, validity_days, price')
          .eq('clinic_id', clinicId).eq('category', 'tipe_paket').eq('is_active', true)
          .gt('session_count', 1).order('session_count'),
        supabase.from('operational_options')
          .select('id, label')
          .eq('clinic_id', clinicId).eq('category', 'payment_method').eq('is_active', true),
      ]);
      if (cancelled) return;
      setPackages(pk.data || []);
      setMethods((pm.data || []).filter((m) => (m.label || '').toLowerCase() !== 'package'));
    })();
    return () => { cancelled = true; };
  }, [isOpen, clinicId, previousPackage?.id, previousPackage?.package_name, previousPackage?.nominal]);

  const selected = packages.find((p) => p.label === packageLabel) || null;
  const amountNum = parseFloat(amount) || 0;
  const canSubmit = !!selected && !!method && amountNum > 0 && !!patientId && !saving;

  const handleSelectPackage = (label) => {
    setPackageLabel(label);
    const p = packages.find((x) => x.label === label);
    if (p?.price != null) setAmount(String(Math.round(Number(p.price))));
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('praxis_renew_package', {
        p_patient_id: patientId,
        p_package_label: selected.label,
        p_payment_method: method,
        p_amount: amountNum,
      });
      if (error) throw error;
      toast({ title: 'Pembayaran tercatat', description: `${selected.label} · ${idr(amountNum)} · ${data?.receipt_number || ''}` });
      onDone?.(data);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal mencatat pembayaran', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!saving && !o) onClose?.(); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{terms.dialogTitle}</DialogTitle>
          <DialogDescription>{terms.dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md bg-slate-50 p-2 text-sm text-slate-700">
            Pasien: <strong>{patientName}</strong>
            {previousPackage?.package_name && (
              <span className="block text-xs text-slate-500">
                Paket sebelumnya: {previousPackage.package_name} ({previousPackage.sessions_used}/{previousPackage.total_sessions} sesi)
              </span>
            )}
          </div>

          <div className="space-y-1">
            <Label>Paket</Label>
            <Select value={packageLabel} onValueChange={handleSelectPackage}>
              <SelectTrigger><SelectValue placeholder="Pilih paket" /></SelectTrigger>
              <SelectContent>
                {packages.map((p) => (
                  <SelectItem key={p.id} value={p.label}>{p.label} ({p.session_count} sesi)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Nominal (Rp)</Label>
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Mis. 1500000"
            />
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
              {selected.session_count} sesi · berlaku {selected.validity_days || 30} hari sejak hari ini. Sesi belum terpakai sampai pasien datang.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {terms.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RenewPackageDialog;
