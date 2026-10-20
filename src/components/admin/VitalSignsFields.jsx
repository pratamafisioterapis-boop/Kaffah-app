import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Activity } from 'lucide-react';

const FIELDS = [
  { key: 'pulse', label: 'Nadi (x/mnt)', ph: '80', mode: 'numeric', required: true },
  { key: 'respiration', label: 'RR (x/mnt, 4-80)', ph: '18', mode: 'numeric' },
  { key: 'spo2', label: 'SpO2 (%)', ph: '98', required: true },
  { key: 'temperature', label: 'Suhu (°C)', ph: '36.5' },
  { key: 'weight', label: 'Berat (kg)', ph: '65' },
  { key: 'height', label: 'Tinggi (cm)', ph: '170' },
];

const VitalSignsFields = ({ value, onChange }) => {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="rounded-app border border-cyan-200 bg-cyan-50/40 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-cyan-800">
        <Activity className="w-4 h-4" /> Tanda-Tanda Vital <span className="text-xs font-normal text-slate-500">(<span className="text-red-500">*</span> wajib diisi, terhubung ke SOAP)</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1 col-span-2 md:col-span-1">
          <Label className="text-xs">Tekanan Darah (mmHg) <span className="text-red-500">*</span></Label>
          <div className="flex items-center gap-1">
            <Input inputMode="numeric" value={value.systolic} onChange={(e) => set('systolic', e.target.value)} placeholder="120" className="bg-white" />
            <span className="text-slate-400">/</span>
            <Input inputMode="numeric" value={value.diastolic} onChange={(e) => set('diastolic', e.target.value)} placeholder="80" className="bg-white" />
          </div>
        </div>
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs">{f.label}{f.required && <span className="text-red-500"> *</span>}</Label>
            <Input inputMode={f.mode || 'decimal'} value={value[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.ph} className="bg-white" />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Catatan vital</Label>
        <Input value={value.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Mis. diukur setelah istirahat 5 menit" className="bg-white" />
      </div>
    </div>
  );
};

export default VitalSignsFields;
