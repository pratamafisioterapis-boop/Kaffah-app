import React, { useState, useEffect } from 'react';
import { 
  X, Save, Loader2, User, Activity, Search, FileText,
  BarChart, FileSearch, Target, UserCog, Calendar,
  ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import SearchableSelect from '@/components/ui/searchable-select';
import { useToast } from '@/components/ui/use-toast';
import { 
  getPatients, 
  getActivePhysiotherapists,
  createMedicalRecordDetailed,
  updateMedicalRecordDetailed,
  getDiagnosisOptions 
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const initialFormState = {
  record_date: format(new Date(), 'yyyy-MM-dd'),
  patient_id: '',
  medical_diagnosis: '',
  history_main_problem: '',
  vital_nadi: '',
  vital_blood_pressure: '',
  vital_height: '',
  vital_weight: '',
  vital_temperature: '',
  vital_respiration: '',
  vital_spo2: '',
  phy_quick_test: '',
  phy_inspection: '',
  phy_palpation: '',
  phy_endfeel: '',
  phy_auscultation: '',
  phy_rom: '',
  phy_anthropometry: '',
  phy_muscle_strength: '',
  phy_pain_rest: '',
  phy_pain_motion: '',
  phy_pain_pressure: '',
  physio_body_structure: '',
  physio_functional_limitation: '',
  physio_participation_restriction: '',
  specific_test: '',
  radiology_lab: '',
  treatment_goal: '',
  therapist_id: '',
  therapist_name: ''
};

const SectionHeader = ({ title, icon: Icon, isExpanded, onToggle, color = '#4f46e5' }) => (
  <button
    type="button"
    onClick={onToggle}
    className="w-full flex items-center justify-between px-4 py-3 transition-colors"
    style={{
      background: isExpanded ? '#fafafa' : 'white',
      borderBottom: isExpanded ? '1px solid #f1f5f9' : 'none',
    }}
  >
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: color + '15' }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#334155' }}>{title}</span>
    </div>
    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#f1f5f9' }}>
      {isExpanded
        ? <ChevronUp className="w-3 h-3 text-slate-400" />
        : <ChevronDown className="w-3 h-3 text-slate-400" />}
    </div>
  </button>
);

const MedicalRecordsModal = ({ isOpen, onClose, onSave, recordData }) => {
  const { toast } = useToast();
  
  // Data State
  const [formData, setFormData] = useState(initialFormState);
  const [patients, setPatients] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    identity: true,
    vitals: true,
    physical: false,
    assessment: false,
    investigation: false,
    plan: false,
    therapist: true
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchDropdownData();
      if (recordData) {

  console.log('MODAL RECORD DATA:', recordData);

  setFormData({
    ...initialFormState,
    ...recordData,
    record_date: recordData.record_date
      ? format(new Date(recordData.record_date), 'yyyy-MM-dd')
      : initialFormState.record_date
  });

} else {
  setFormData(initialFormState);
}
    }
  }, [isOpen, recordData]);

  const fetchDropdownData = async () => {
    setLoading(true);
    try {
      const [patientsRes, therapistsList, diagnosesRes] = await Promise.all([
  getPatients(),
  getActivePhysiotherapists(),
  getDiagnosisOptions()
]);
console.log('DIAGNOSES RES:', diagnosesRes);

const diagnosesList = diagnosesRes?.data || [];

      setPatients(patientsRes.data || []);
      
      const therapistOptions = (therapistsList.data || []).map(t => ({
        value: t.name,
        label: t.name,
        original: t
      }));
      setTherapists(therapistOptions);

      // Map diagnoses using updated getDiagnosisOptions structure
      // getDiagnosisOptions returns {id, label, category, value}
      // SearchableSelect needs label/value
      const diagnosisOptions = diagnosesList.map(d => ({
  value: d.id,
  label: d.label  
}));
console.log('DIAGNOSIS OPTIONS:', diagnosisOptions);
      setDiagnoses([...diagnosisOptions]);

    } catch (err) {
      console.error("Error fetching form data:", err);
      toast({
        variant: "destructive",
        title: "Gagal memuat data",
        description: "Terjadi kesalahan saat mengambil data referensi."
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value, option) => {
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      return newData;
    });
  };

  const handleTherapistChange = (val) => {
      if (!val) {
        setFormData(prev => ({
            ...prev,
            therapist_id: '',
            therapist_name: ''
        }));
        return;
      }
      // val = nama terapis langsung (bukan UUID)
      setFormData(prev => ({
          ...prev,
          therapist_id: val,
          therapist_name: val
      }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.record_date || !formData.patient_id) {
      setError("Mohon lengkapi Tanggal Pemeriksaan dan Nama Pasien.");
      setExpandedSections(prev => ({ ...prev, identity: true }));
      toast({
        variant: "destructive",
        title: "Validasi Gagal",
        description: "Mohon lengkapi field yang wajib diisi."
      });
      return;
    }

    setSaving(true);
    try {
        // Clean up data before sending - Remove therapist fields
        // Note: Even though api.js also cleans it, it's safer to not send it from here if possible, 
        // but since the component state has it, we pass it and let api.js handle the stripping 
        // OR strip here. The prompt asks to update the handler.
        // Let's strip here as well for clarity and redundancy as requested in Task 3.
        const {
  therapist_id,
  therapist_name,
  patient,
  created_at,
  created_by,
  id,
  ...cleanedData
} = formData;
        
        // However, we need to pass formData to the API functions which expect an object.
        // The API functions (Task 1 & 2) are now updated to destructure these out.
        // So passing formData is safe, but let's pass cleanedData to be explicit about intent in the UI layer too if desired.
        // Actually, the API functions expect the full object or whatever we pass.
        // I will pass the full formData because the API function signatures (Task 1 & 2) now handle the exclusion.
        // BUT Task 3 explicitly says: "destructure formData to remove therapist_id and therapist_name before calling... Only submit the valid fields to the API."
        
        let result;
        if (recordData?.id) {
           result = await updateMedicalRecordDetailed(recordData.id, cleanedData);
        } else {
           result = await createMedicalRecordDetailed(cleanedData);
        }
  
        if (result.error) throw result.error;

      toast({
        title: (
          <div className="flex items-center gap-2">
            <Save className="h-4 w-4 text-green-600" />
            <span className="font-semibold text-green-600">Berhasil Disimpan!</span>
          </div>
        ),
        description: recordData ? "Data rekam medis berhasil diperbarui." : "Data rekam medis baru berhasil ditambahkan.",
        className: "bg-green-50 border-green-200",
      });

      if (onSave) {
  await onSave(result.data);
}

onClose();

    } catch (err) {
      console.error("Submit error:", err);
      setError(err.message || "Gagal menyimpan data.");
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan",
        description: err.message || "Terjadi kesalahan saat menyimpan data."
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #f1f5f9', background: 'white' }}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#eef2ff' }}>
                <FileText className="w-4 h-4" style={{ color: '#4f46e5' }} />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-slate-800">
                  {recordData ? 'Edit Rekam Medis' : 'Input Rekam Medis'}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-0.5">
                  Lengkapi data rekam medis pasien di bawah ini
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-slate-500">Memuat data...</p>
            </div>
          ) : (
            <form id="medical-record-form" onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              )}

              {/* 1. IDENTITAS & KELUHAN */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <SectionHeader title="Identitas & Keluhan" icon={User} isExpanded={expandedSections.identity} onToggle={() => toggleSection('identity')} color="#4f46e5" />
                {expandedSections.identity && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Tanggal Pemeriksaan <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input 
                          type="date" 
                          name="record_date"
                          value={formData.record_date}
                          onChange={handleInputChange}
                          className="pl-9"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Nama Pasien <span className="text-red-500">*</span></label>
                      <SearchableSelect 
                        options={patients}
                        value={formData.patient_id}
                        onChange={(val) => handleSelectChange('patient_id', val)}
                        placeholder="Cari pasien (RM - Nama)..."
                        disabled={!!recordData}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-sm font-medium text-slate-700">Diagnosis Medis</label>
                      <SearchableSelect 
                        options={diagnoses}
                        value={formData.medical_diagnosis}
                        onChange={(val) => handleSelectChange('medical_diagnosis', val)}
                        placeholder="Pilih atau cari diagnosis..."
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-sm font-medium text-slate-700">History Taking & Main Problem</label>
                      <Textarea 
                        name="history_main_problem"
                        value={formData.history_main_problem}
                        onChange={handleInputChange}
                        rows={4}
                        placeholder="Riwayat penyakit dan keluhan utama..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. TANDA VITAL */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <SectionHeader title="Tanda Vital" icon={Activity} isExpanded={expandedSections.vitals} onToggle={() => toggleSection('vitals')} color="#0891b2" />
                {expandedSections.vitals && (
                  <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2 duration-200">
                    {[
                      { label: 'Nadi (bpm)', name: 'vital_nadi', ph: '80' },
                      { label: 'TD (mmHg)', name: 'vital_blood_pressure', ph: '120/80' },
                      { label: 'Tinggi (cm)', name: 'vital_height', ph: '170' },
                      { label: 'Berat (kg)', name: 'vital_weight', ph: '65' },
                      { label: 'Suhu (°C)', name: 'vital_temperature', ph: '36.5' },
                      { label: 'RR (x/min)', name: 'vital_respiration', ph: '18' },
                      { label: 'SpO2 (%)', name: 'vital_spo2', ph: '98' },
                    ].map((field) => (
                      <div key={field.name} className="space-y-1">
                        <label className="text-xs font-medium text-slate-500">{field.label}</label>
                        <Input 
                          name={field.name} 
                          value={formData[field.name]} 
                          onChange={handleInputChange} 
                          placeholder={field.ph} 
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. PEMERIKSAAN FISIK */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <SectionHeader title="Pemeriksaan Fisik" icon={Search} isExpanded={expandedSections.physical} onToggle={() => toggleSection('physical')} color="#059669" />
                {expandedSections.physical && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                    {[
                      'phy_quick_test', 'phy_inspection', 'phy_palpation', 'phy_endfeel', 
                      'phy_auscultation', 'phy_rom', 'phy_anthropometry', 'phy_muscle_strength',
                      'phy_pain_rest', 'phy_pain_motion', 'phy_pain_pressure'
                    ].map((name) => {
                      const label = name.replace('phy_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                      return (
                        <div key={name} className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">{label}</label>
                          <Textarea 
                            name={name}
                            value={formData[name]}
                            onChange={handleInputChange}
                            rows={3}
                            className="resize-none"
                            placeholder={`Hasil pemeriksaan ${label.toLowerCase()}...`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4. PENILAIAN FISIOTERAPI */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <SectionHeader title="Penilaian Fisioterapi" icon={BarChart} isExpanded={expandedSections.assessment} onToggle={() => toggleSection('assessment')} color="#7c3aed" />
                {expandedSections.assessment && (
                  <div className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Body Structure & Function</label>
                      <Textarea name="physio_body_structure" value={formData.physio_body_structure} onChange={handleInputChange} rows={4} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Functional Limitation</label>
                      <Textarea name="physio_functional_limitation" value={formData.physio_functional_limitation} onChange={handleInputChange} rows={4} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Participation Restriction</label>
                      <Textarea name="physio_participation_restriction" value={formData.physio_participation_restriction} onChange={handleInputChange} rows={4} />
                    </div>
                  </div>
                )}
              </div>

              {/* 5. PEMERIKSAAN PENUNJANG */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <SectionHeader title="Pemeriksaan Penunjang" icon={FileSearch} isExpanded={expandedSections.investigation} onToggle={() => toggleSection('investigation')} color="#d97706" />
                {expandedSections.investigation && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Specific Test</label>
                      <Textarea name="specific_test" value={formData.specific_test} onChange={handleInputChange} rows={4} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Radiology / Lab</label>
                      <Textarea name="radiology_lab" value={formData.radiology_lab} onChange={handleInputChange} rows={4} />
                    </div>
                  </div>
                )}
              </div>

              {/* 6. RENCANA TERAPI */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <SectionHeader title="Rencana Terapi" icon={Target} isExpanded={expandedSections.plan} onToggle={() => toggleSection('plan')} color="#e11d48" />
                {expandedSections.plan && (
                  <div className="p-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Treatment Goal & Plan</label>
                      <Textarea name="treatment_goal" value={formData.treatment_goal} onChange={handleInputChange} rows={4} placeholder="Tujuan dan rencana terapi..." />
                    </div>
                  </div>
                )}
              </div>

              {/* 7. INFORMASI TERAPIS */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <SectionHeader title="Informasi Terapis" icon={UserCog} isExpanded={expandedSections.therapist} onToggle={() => toggleSection('therapist')} color="#64748b" />
                {expandedSections.therapist && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Pilih Terapis (Opsional)</label>
                      <SearchableSelect 
                        options={therapists}
                        value={formData.therapist_name}
                        onChange={handleTherapistChange}
                        placeholder="Cari Terapis..."
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        ℹ️ Field ini hanya untuk referensi, tidak disimpan ke database
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Nama Terapis (Auto)</label>
                      <Input 
                        value={formData.therapist_name} 
                        readOnly 
                        className="bg-gray-50 cursor-not-allowed text-slate-500" 
                        placeholder="Nama terapis akan muncul otomatis"
                      />
                    </div>
                  </div>
                )}
              </div>

            </form>
          )}
        </div>

        <div className="px-5 py-3.5 flex justify-end gap-2 flex-shrink-0"
          style={{ borderTop: '1px solid #e2e8f0', background: 'white' }}>
          <button type="button" onClick={onClose} disabled={saving}
            className="px-4 h-9 rounded-xl text-xs font-semibold transition-all"
            style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
            Batal
          </button>
          <button type="submit" form="medical-record-form" disabled={saving || loading}
            className="flex items-center gap-2 px-5 h-9 rounded-xl text-xs font-bold text-white transition-all min-w-[120px] justify-center"
            style={{ background: saving ? '#818cf8' : '#4f46e5' }}>
            {saving ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan...</>
            ) : (
              <><Save className="w-3.5 h-3.5" /> Simpan Data</>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MedicalRecordsModal;