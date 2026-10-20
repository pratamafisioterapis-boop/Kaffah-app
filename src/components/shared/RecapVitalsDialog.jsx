import React, { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import VitalSignsFields from '@/components/admin/VitalSignsFields';
import { EMPTY_VITALS, insertRecapVitals, validateVitals, vitalsFromRow, vitalsToRow } from '@/lib/recapVitals';
import { requestOverride } from '@/lib/soapFirst';

/**
 * Pop up pengisian TTV untuk satu recap.
 * - Belum pernah diisi: simpan langsung (setelah konfirmasi), lalu terkunci.
 * - Sudah diisi (existing): hanya bisa mengajukan perubahan + alasan -> disetujui owner.
 */
const RecapVitalsDialog = ({ open, onOpenChange, recap, existing = null, onDone }) => {
  const { toast } = useToast();
  const { userDetails, user } = useAuth();
  const isEdit = !!existing;
  const isOwner = ['owner', 'super_admin'].includes(userDetails?.role);
  const [vitals, setVitals] = useState({ ...EMPTY_VITALS });
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVitals(vitalsFromRow(existing));
    setReason('');
    setConfirmOpen(false);
  }, [open, existing]);

  const askConfirm = () => {
    const err = validateVitals(vitals) || (isEdit && reason.trim().length < 5 ? 'Alasan perubahan wajib diisi (minimal 5 karakter).' : null);
    if (err) {
      toast({ variant: 'destructive', title: 'Data belum lengkap', description: err });
      return;
    }
    setConfirmOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (isEdit) {
        await requestOverride({ kind: 'vitals_edit', recapId: recap.id, reason: reason.trim(), payload: { vitals: vitalsToRow(vitals) } });
        toast({
          title: isOwner ? 'TTV diperbarui' : 'Pengajuan terkirim',
          description: isOwner ? 'Perubahan disetujui otomatis karena diajukan oleh owner.' : 'Perubahan TTV berlaku setelah disetujui owner.',
        });
      } else {
        const { error } = await insertRecapVitals(recap.id, recap.actual_patient_id || recap.patient_id, vitals, { id: user?.id, name: userDetails?.name || userDetails?.full_name });
        if (error) {
          const friendly = {
            '23505': 'TTV untuk sesi ini sudah pernah diisi. Muat ulang lalu ajukan perubahan.',
            '23514': 'Ada nilai TTV di luar batas wajar. Periksa kembali isian (mis. RR 4-80, nadi 20-250, SpO2 50-100).',
            '22P02': 'Ada nilai TTV yang formatnya tidak valid. Pastikan hanya angka (tensi, nadi, dan RR bilangan bulat).',
          };
          throw new Error(friendly[error.code] || error.message);
        }
        toast({ title: 'TTV tersimpan', description: 'Perubahan selanjutnya perlu persetujuan owner.' });
      }
      setConfirmOpen(false);
      onOpenChange(false);
      if (onDone) onDone();
    } catch (err) {
      setConfirmOpen(false);
      toast({ variant: 'destructive', title: 'Gagal menyimpan TTV', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Ajukan Perubahan TTV' : 'Input Tanda-Tanda Vital'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'TTV sudah terkunci. Perubahan baru berlaku setelah disetujui owner.'
                : 'Isi tekanan darah, nadi, SpO2, dan tanda vital lain. Data ini terhubung ke SOAP pasien.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 rounded-app border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {isEdit
                ? 'Perubahan wajib disertai alasan dan menunggu persetujuan owner. Nilai lama tetap berlaku sampai disetujui.'
                : 'Pastikan data yang diisi sudah benar. Setelah disimpan, TTV terkunci; mengubahnya nanti perlu persetujuan owner beserta alasannya.'}
            </p>
          </div>

          <VitalSignsFields value={vitals} onChange={setVitals} />

          {isEdit && (
            <div className="space-y-2">
              <Label>Alasan perubahan <span className="text-red-500">*</span></Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Mis. salah ketik tekanan darah" />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
            <Button onClick={askConfirm} disabled={saving} className="bg-app-accent hover:bg-app-accent-hover text-white">
              {isEdit ? (isOwner ? 'Terapkan' : 'Kirim Pengajuan') : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={(v) => !saving && setConfirmOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pastikan data sudah benar</AlertDialogTitle>
            <AlertDialogDescription>
              {isEdit
                ? 'Pengajuan perubahan akan dikirim ke owner beserta alasan Anda. Periksa kembali nilai TTV sebelum mengirim.'
                : 'Setelah disimpan, TTV tidak bisa diubah langsung. Perubahan hanya bisa lewat pengajuan ke owner dengan alasan. Periksa kembali semua nilai sebelum menyimpan.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Periksa lagi</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); save(); }} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Ya, kirim' : 'Ya, simpan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RecapVitalsDialog;
