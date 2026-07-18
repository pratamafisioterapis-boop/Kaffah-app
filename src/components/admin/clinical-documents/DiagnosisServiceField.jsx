import React, { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import SearchableSelect from '@/components/ui/searchable-select';
import { Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { getServiceOptions, getDiagnosisOptions, createOperationalOption } from '@/lib/api';

// Diagnosa picker backed by the operational_options 'diagnosa' catalog. Every
// diagnosa row belongs to a Layanan (service) via parent_id (see
// DiagnosisServiceManager), so creating a brand-new diagnosis prompts for its
// Layanan in a small dialog instead of exposing a separate always-visible
// Layanan field on the main form.
const DiagnosisServiceField = ({ diagnosaId, onChange }) => {
  const { toast } = useToast();
  const [services, setServices] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  const [pendingLabel, setPendingLabel] = useState(null);
  const [pendingServiceId, setPendingServiceId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: d }] = await Promise.all([getServiceOptions(), getDiagnosisOptions()]);
      setServices(s || []);
      setDiagnoses(d || []);
    })();
  }, []);

  const handleRequestCreate = async (label) => {
    setPendingLabel(label);
    setPendingServiceId('');
    return true; // close the select's own dropdown; the dialog takes over
  };

  const closeDialog = () => {
    setPendingLabel(null);
    setPendingServiceId('');
  };

  const confirmCreate = async () => {
    if (!pendingServiceId) {
      toast({ variant: 'destructive', title: 'Pilih layanan', description: 'Pilih Layanan untuk diagnosa ini terlebih dahulu.' });
      return;
    }
    setIsCreating(true);
    const { data, error } = await createOperationalOption('diagnosa', pendingLabel, { parent_id: pendingServiceId });
    setIsCreating(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menambah diagnosa', description: error.message });
      return;
    }
    const newOption = { id: data.id, value: data.id, label: data.label, parent_id: data.parent_id };
    setDiagnoses((prev) => [...prev, newOption]);
    onChange({ diagnosaId: newOption.value, diagnosaLabel: newOption.label });
    toast({ title: 'Diagnosa ditambahkan', description: `"${newOption.label}" berhasil ditambahkan.` });
    closeDialog();
  };

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Diagnosa</Label>
        <SearchableSelect
          options={diagnoses}
          value={diagnosaId}
          onChange={(val) => {
            const opt = diagnoses.find((d) => d.value === val);
            onChange({ diagnosaId: val, diagnosaLabel: opt?.label || '' });
          }}
          allowCreate
          onCreateOption={handleRequestCreate}
          placeholder="Cari atau tambah diagnosa..."
        />
      </div>

      <Dialog open={!!pendingLabel} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Tambah Diagnosa Baru</DialogTitle>
            <DialogDescription>
              Pilih layanan untuk diagnosa "{pendingLabel}" agar tersimpan di kategori yang tepat.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-1.5">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Layanan</Label>
            <SearchableSelect
              options={services}
              value={pendingServiceId}
              onChange={setPendingServiceId}
              placeholder="Pilih layanan..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Batal</Button>
            <Button onClick={confirmCreate} disabled={isCreating || !pendingServiceId} className="bg-indigo-600 hover:bg-indigo-700">
              {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DiagnosisServiceField;
