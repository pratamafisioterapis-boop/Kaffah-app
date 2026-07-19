import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import {
  X, User, Activity, Search, BarChart, FileSearch,
  Target, UserCog, Pencil, FileText
} from 'lucide-react';

const Field = ({ label, value, full = false }) => (
  <div className={full ? 'col-span-2' : ''}>
    <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#94a3b8' }}>{label}</div>
    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
      {value || <span className="text-slate-300 italic text-xs">—</span>}
    </div>
  </div>
);

const Section = ({ title, icon: Icon, color, children }) => (
  <div className="mb-6">
    <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: `2px solid ${color}30` }}>
      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: color + '15' }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{title}</span>
    </div>
    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
      {children}
    </div>
  </div>
);

const MedicalRecordViewSheet = ({ isOpen, onClose, record, onEdit, diagnoses = [] }) => {
  if (!record) return null;

  const resolveOne = (id) => {
    const found = diagnoses.find(d => d.value === id || d.id === id);
    return found ? found.label : id;
  };

  const resolveDiagnosis = (val) => {
    if (!val) return null;
    let ids = val;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        ids = Array.isArray(parsed) ? parsed : val;
      } catch {
        ids = val;
      }
    }
    if (Array.isArray(ids)) {
      return ids.map(resolveOne).join(', ');
    }
    return resolveOne(ids);
  };

  const fmt = (dateStr) => {
    if (!dateStr) return '-';
    try { return format(new Date(dateStr), 'dd MMMM yyyy', { locale: id }); }
    catch { return dateStr; }
  };

  const patientName = record.patient?.full_name || '-';
  const rmNumber = record.patient?.medical_record_number || '-';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', borderBottom: '1px solid #334155' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}>
              <FileText className="w-4 h-4" style={{ color: '#818cf8' }} />
            </div>
            <div>
              <div className="text-white font-bold text-sm">{patientName}</div>
              <div className="text-xs font-mono" style={{ color: '#818cf8' }}>{rmNumber} · {fmt(record.record_date)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button onClick={() => { onClose(); onEdit(record); }}
                className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#94a3b8' }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body — single scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-white">

          {/* IDENTITAS */}
          <Section title="Identitas & Keluhan" icon={User} color="#4f46e5">
            <Field label="Tanggal Pemeriksaan" value={fmt(record.record_date)} />
            <Field label="Diagnosis Medis" value={resolveDiagnosis(record.medical_diagnosis)} />
            <Field label="History Taking & Main Problem" value={record.history_main_problem} full />
          </Section>

          {/* TANDA VITAL */}
          <Section title="Tanda Vital" icon={Activity} color="#0891b2">
            <Field label="Nadi (bpm)" value={record.vital_nadi} />
            <Field label="Tekanan Darah" value={record.vital_blood_pressure} />
            <Field label="Tinggi (cm)" value={record.vital_height} />
            <Field label="Berat (kg)" value={record.vital_weight} />
            <Field label="Suhu (°C)" value={record.vital_temperature} />
            <Field label="RR (x/min)" value={record.vital_respiration} />
            <Field label="SpO2 (%)" value={record.vital_spo2} />
          </Section>

          {/* PEMERIKSAAN FISIK */}
          <Section title="Pemeriksaan Fisik" icon={Search} color="#059669">
            {[
              ['Quick Test', 'phy_quick_test'],
              ['Inspeksi', 'phy_inspection'],
              ['Palpasi', 'phy_palpation'],
              ['End Feel', 'phy_endfeel'],
              ['Auskultasi', 'phy_auscultation'],
              ['ROM', 'phy_rom'],
              ['Antropometri', 'phy_anthropometry'],
              ['Kekuatan Otot', 'phy_muscle_strength'],
              ['Nyeri Diam', 'phy_pain_rest'],
              ['Nyeri Gerak', 'phy_pain_motion'],
              ['Nyeri Tekan', 'phy_pain_pressure'],
            ].map(([label, key]) => (
              <Field key={key} label={label} value={record[key]} />
            ))}
          </Section>

          {/* PENILAIAN FISIOTERAPI */}
          <Section title="Penilaian Fisioterapi" icon={BarChart} color="#7c3aed">
            <Field label="Body Structure & Function" value={record.physio_body_structure} full />
            <Field label="Functional Limitation" value={record.physio_functional_limitation} full />
            <Field label="Participation Restriction" value={record.physio_participation_restriction} full />
          </Section>

          {/* PEMERIKSAAN PENUNJANG */}
          <Section title="Pemeriksaan Penunjang" icon={FileSearch} color="#d97706">
            <Field label="Specific Test" value={record.specific_test} />
            <Field label="Radiology / Lab" value={record.radiology_lab} />
          </Section>

          {/* RENCANA TERAPI */}
          <Section title="Rencana Terapi" icon={Target} color="#e11d48">
            <Field label="Treatment Goal & Plan" value={record.treatment_goal} full />
          </Section>

          {/* INFORMASI TERAPIS */}
          <Section title="Informasi Terapis" icon={UserCog} color="#64748b">
            <Field label="Nama Terapis" value={record.therapist_name} />
          </Section>

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MedicalRecordViewSheet;