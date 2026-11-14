import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import SearchableSelect from '@/components/ui/searchable-select';
import { fetchPatients } from '@/lib/dailyRecapHelpers';
import { getRenewalTerms } from '@/lib/packageRenewalTerms';

const idr = (v) => `Rp ${Math.round(Number(v) || 0).toLocaleString('id-ID')}`;

// Tambah paket dari Package Recaps untuk pasien yang membayar di awal: hanya pembayaran +
// kwitansi (tanpa rekap kunjungan). Pasien dipilih di dialog ini.
const RenewPackageDialog = ({ isOpen, onClose, clinicId, onDone }) => {
  const { toast } = useToast();
  const terms = getRenewalTerms(clinicId);

  const [packages, setPackages] = useState([]);
  const [methods, setMethods] = useState([]);
  const [packageLabel, setPackageLabel] = useState('');
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState('');
  const [previousPackage, setPreviousPackage] = useState(null);

  useEffect(() => {
    if (!isOpen || !clinicId) return;
    let cancelled = false;
    setMethod('');
    setSaving(false);
    setPatientId('');
    setPreviousPackage(null);
    setPackageLabel('');
    setAmount('');
    (async () => {
      fetchPatients().then((list) => { if (!cancelled) setPatients(Array.isArray(list) ? list : []); });
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
  }, [isOpen, clinicId]);

  // Pasien dipilih: tampilkan paket terakhirnya dan isi paket/nominal dari paket itu (bisa diubah).
  const handlePatientChange = async (id) => {
    setPatientId(id);
    setPreviousPackage(null);
    if (!id) return;
    const { data } = await supabase
      .from('package_tracking')
      .select('id, package_name, nominal, sessions_used, total_sessions, sessions_remaining, status')
      .eq('patient_id', id)
      .order('created_at', { ascending: false })
      .limit(1);
    const prev = data?.[0] || null;
    setPreviousPackage(prev);
    if (prev) {
      setPackageLabel(prev.package_name || '');
      setAmount(prev.nominal ? String(Math.round(Number(prev.nominal))) : '');
    }
  };

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
          <div className="space-y-1">
            <Label>Pasien</Label>
            <SearchableSelect
              options={patients}
              value={patientId}
              onChange={handlePatientChange}
              placeholder="Cari pasien..."
            />
            {previousPackage?.package_name && (
              <p className="text-xs text-slate-500">
                Paket terakhir: {previousPackage.package_name} ({previousPackage.sessions_used}/{previousPackage.total_sessions} sesi, {previousPackage.status})
              </p>
            )}
            {previousPackage && (previousPackage.sessions_remaining ?? 0) > 0 && ['aktif', 'pending', 'diperpanjang'].includes((previousPackage.status || '').toLowerCase()) && (
              <p className="text-xs text-red-600">Pasien ini masih punya sisa sesi di paket sebelumnya; penambahan akan ditolak.</p>
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
              {selected.session_count} sesi · berlaku {selected.validity_days || 30} hari sejak sesi pertama. Masa berlaku dan sesi baru mulai saat pasien datang.
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
