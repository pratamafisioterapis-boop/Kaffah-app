import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { OVERRIDE_KIND_LABELS, requestOverride } from '@/lib/soapFirst';

/**
 * Dialog pengajuan pengecualian (override) dengan alasan wajib.
 * Admin mengajukan -> owner menyetujui. Bila pemohon adalah owner, langsung disetujui.
 */
const SoapOverrideDialog = ({ open, onOpenChange, kind, recapId = null, packageId = null, payload = {}, description, withAmount = false, onDone }) => {
  const { toast } = useToast();
  const { userDetails } = useAuth();
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const isOwner = ['owner', 'super_admin'].includes(userDetails?.role);

  useEffect(() => { if (open) { setReason(''); setAmount(''); } }, [open]);

  const submit = async () => {
    if (reason.trim().length < 5) {
      toast({ variant: 'destructive', title: 'Alasan wajib diisi', description: 'Tulis alasan minimal 5 karakter.' });
      return;
    }
    if (withAmount && !(Number(amount) >= 0 && amount !== '')) {
      toast({ variant: 'destructive', title: 'Nominal wajib diisi', description: 'Isi nominal baru yang benar.' });
      return;
    }
    setSaving(true);
    try {
      await requestOverride({ kind, recapId, packageId, reason: reason.trim(), payload: withAmount ? { ...payload, amount: Number(amount) } : payload });
      toast({
        title: isOwner ? 'Pengecualian diterapkan' : 'Pengajuan terkirim',
        description: isOwner ? 'Pengajuan disetujui otomatis karena diajukan oleh owner.' : 'Menunggu persetujuan owner. Owner mendapat notifikasi.',
      });
      onOpenChange(false);
      if (onDone) onDone();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal mengajukan', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{OVERRIDE_KIND_LABELS[kind] || 'Ajukan pengecualian'}</DialogTitle>
          <DialogDescription>{description || 'Pengecualian hanya berlaku setelah disetujui owner dan tercatat beserta alasannya.'}</DialogDescription>
        </DialogHeader>
        {withAmount && (
          <div className="space-y-2">
            <Label>Nominal baru (Rp) <span className="text-red-500">*</span></Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
        )}
        <div className="space-y-2">
          <Label>Alasan <span className="text-red-500">*</span></Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Jelaskan alasan pengecualian ini" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isOwner ? 'Terapkan' : 'Kirim Pengajuan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SoapOverrideDialog;
