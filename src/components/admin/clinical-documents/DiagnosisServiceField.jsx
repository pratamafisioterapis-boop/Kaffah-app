import React, { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import SearchableSelect from '@/components/ui/searchable-select';
import { useToast } from '@/components/ui/use-toast';
import { getServiceOptions, getDiagnosisOptions, createOperationalOption } from '@/lib/api';

// Layanan + Diagnosa picker shared by clinical document forms. Mirrors the
// service -> diagnosa hierarchy from DiagnosisServiceManager: a new diagnosa
// can only be created once a Layanan (service) is selected, since every
// diagnosa row is stored with parent_id pointing at its service.
const DiagnosisServiceField = ({ serviceId, diagnosaId, onChange }) => {
  const { toast } = useToast();
  const [services, setServices] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: d }] = await Promise.all([getServiceOptions(), getDiagnosisOptions()]);
      setServices(s || []);
      setDiagnoses(d || []);
    })();
  }, []);

  const handleCreateDiagnosis = async (label) => {
    if (!serviceId) {
      toast({ variant: 'destructive', title: 'Pilih layanan dulu', description: 'Pilih Layanan terlebih dahulu sebelum menambahkan diagnosa baru.' });
      return false;
    }
    const { data, error } = await createOperationalOption('diagnosa', label, { parent_id: serviceId });
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal menambah diagnosa', description: error.message });
      return false;
    }
    const newOption = { id: data.id, value: data.id, label: data.label, parent_id: data.parent_id };
    setDiagnoses((prev) => [...prev, newOption]);
    onChange({ serviceId, diagnosaId: newOption.value, diagnosaLabel: newOption.label });
    toast({ title: 'Diagnosa ditambahkan', description: `"${newOption.label}" berhasil ditambahkan.` });
    return true;
  };

  const selectedDiagnosaLabel = diagnoses.find((d) => d.value === diagnosaId)?.label || '';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Layanan</Label>
        <SearchableSelect
          options={services}
          value={serviceId}
          onChange={(val) => onChange({ serviceId: val, diagnosaId, diagnosaLabel: selectedDiagnosaLabel })}
          placeholder="Pilih layanan..."
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Diagnosa</Label>
        <SearchableSelect
          options={diagnoses}
          value={diagnosaId}
          onChange={(val) => {
            const opt = diagnoses.find((d) => d.value === val);
            onChange({ serviceId, diagnosaId: val, diagnosaLabel: opt?.label || '' });
          }}
          allowCreate
          onCreateOption={handleCreateDiagnosis}
          placeholder="Cari atau tambah diagnosa..."
        />
      </div>
    </div>
  );
};

export default DiagnosisServiceField;
