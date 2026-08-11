import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ClipboardList, Eye } from 'lucide-react';
import SearchableSelect from '@/components/ui/searchable-select';
import { useToast } from '@/components/ui/use-toast';
import { normalizeGender } from '@/lib/utils';
import {
  getPatients, getPatientById, getPhysiotherapists, getClinicDetails,
  createClinicalDocument, getLatestClinicalDocumentForPatient,
} from '@/lib/api';
import ClinicalDocumentPreviewModal from './ClinicalDocumentPreviewModal';
import ResumeMedisTemplate from './ResumeMedisTemplate';
import DiagnosisServiceField from './DiagnosisServiceField';

const PROGRAM_TERAPI_OPTIONS = [
  { key: 'tens', label: 'TENS' },
  { key: 'usd', label: 'USD (Ultrasound Diathermy)' },
  { key: 'infrared', label: 'Infrared' },
  { key: 'stretching_exercise', label: 'Stretching Exercise' },
  { key: 'strengthening_exercise', label: 'Strengthening Exercise' },
  { key: 'manual_therapy', label: 'Manual Therapy' },
];

const emptyForm = {
  patient_id: '',
  therapist_id: '',
  document_date: new Date().toISOString().slice(0, 10),
  anamnesa: '',
  pemeriksaan_fisik: '',
  diagnosa_id: '',
  diagnosa: '',
  program_terapi: [],
  program_terapi_lainnya: '',
  rekomendasi: '',
  tempat: 'Balikpapan',
};

const ResumeMedisForm = ({ onSaved }) => {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [therapists, setTherapists] = useState([]);
  const [clinic, setClinic] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: t }, { data: c }] = await Promise.all([
        getPatients(), getPhysiotherapists(), getClinicDetails(),
      ]);
      setPatients(p || []);
      setTherapists(t || []);
      setClinic(c || null);
    })();
  }, []);

  const handleSearchPatient = useCallback(async (term) => {
    setIsSearching(true);
    const { data } = await getPatients(term);
    setPatients(data || []);
    setIsSearching(false);
  }, []);

  const handleSelectPatient = async (patientId) => {
    setForm((f) => ({ ...f, patient_id: patientId }));
    const { data } = await getPatientById(patientId);
    setSelectedPatient(data || null);

    const { data: lastDoc } = await getLatestClinicalDocumentForPatient('resume_medis', patientId);
    if (lastDoc?.data) {
      setForm((f) => ({
        ...f,
        anamnesa: lastDoc.data.anamnesa || '',
        pemeriksaan_fisik: lastDoc.data.pemeriksaan_fisik || '',
        diagnosa_id: lastDoc.data.diagnosa_id || '',
        diagnosa: lastDoc.data.diagnosa || '',
        program_terapi: lastDoc.data.program_terapi || [],
        program_terapi_lainnya: lastDoc.data.program_terapi_lainnya || '',
        rekomendasi: lastDoc.data.rekomendasi || '',
      }));
      toast({
        title: 'Riwayat resume medis ditemukan',
        description: `Data dari resume terakhir (${lastDoc.document_date}) otomatis diisi. Silakan sesuaikan jika perlu.`,
      });
    }
  };

  const toggleProgram = (key) => {
    setForm((f) => ({
      ...f,
      program_terapi: f.program_terapi.includes(key)
        ? f.program_terapi.filter((k) => k !== key)
        : [...f.program_terapi, key],
    }));
  };

  const buildDocumentData = () => {
    const therapist = therapists.find((t) => t.id === form.therapist_id);
    return {
      patient_name: selectedPatient?.full_name || '-',
      medical_record_number: selectedPatient?.medical_record_number || '-',
      birth_date: selectedPatient?.birth_date || null,
      gender: normalizeGender(selectedPatient?.gender),
      therapist_name: therapist?.name || '-',
      therapist_signature_url: therapist?.signature_url || null,
      therapist_license: therapist?.license_number || null,
      document_date: form.document_date,
      anamnesa: form.anamnesa,
      pemeriksaan_fisik: form.pemeriksaan_fisik,
      diagnosa_id: form.diagnosa_id,
      diagnosa: form.diagnosa,
      program_terapi: form.program_terapi,
      program_terapi_lainnya: form.program_terapi_lainnya,
      rekomendasi: form.rekomendasi,
      tempat: form.tempat,
    };
  };

  const resetForm = () => {
    setForm(emptyForm);
    setSelectedPatient(null);
  };

  const validate = () => {
    if (!form.patient_id) return 'Pilih pasien terlebih dahulu.';
    if (!form.therapist_id) return 'Pilih fisioterapis.';
    if (!form.diagnosa.trim()) return 'Diagnosa wajib diisi.';
    return null;
  };

  const handlePreview = () => {
    const err = validate();
    if (err) { toast({ variant: 'destructive', title: 'Data belum lengkap', description: err }); return; }
    setPreviewData(buildDocumentData());
  };

  const handleSaveAndPreview = async () => {
    const err = validate();
    if (err) { toast({ variant: 'destructive', title: 'Data belum lengkap', description: err }); return; }

    setIsSaving(true);
    try {
      const documentData = buildDocumentData();
      const { error } = await createClinicalDocument({
        patient_id: form.patient_id,
        therapist_id: form.therapist_id,
        document_type: 'resume_medis',
        document_date: form.document_date,
        data: documentData,
      });
      if (error) throw error;

      toast({ title: 'Berhasil', description: 'Resume medis berhasil disimpan.' });
      setPreviewData(documentData);
      onSaved?.();
      resetForm();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const patientOptions = patients.map((p) => ({ value: p.id, label: p.label || `${p.medical_record_number || 'RM'} - ${p.full_name}` }));
  const therapistOptions = therapists.map((t) => ({ value: t.id, label: t.name }));

  return (
    <>
      <Card className="border-slate-200 shadow-sm rounded-2xl">
        <CardContent className="p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nama Pasien</Label>
              <SearchableSelect
                options={patientOptions}
                value={form.patient_id}
                onChange={handleSelectPatient}
                onSearch={handleSearchPatient}
                isLoading={isSearching}
                placeholder="Cari nama / no. rekam medis..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fisioterapis</Label>
              <SearchableSelect
                options={therapistOptions}
                value={form.therapist_id}
                onChange={(val) => setForm((f) => ({ ...f, therapist_id: val }))}
                placeholder="Pilih fisioterapis..."
              />
            </div>
          </div>

          {selectedPatient && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
              <div><p className="text-slate-400 uppercase tracking-wide text-[10px]">No. RM</p><p className="font-semibold text-slate-800">{selectedPatient.medical_record_number || '-'}</p></div>
              <div><p className="text-slate-400 uppercase tracking-wide text-[10px]">Tgl Lahir</p><p className="font-semibold text-slate-800">{selectedPatient.birth_date || '-'}</p></div>
              <div><p className="text-slate-400 uppercase tracking-wide text-[10px]">JK</p><p className="font-semibold text-slate-800">{normalizeGender(selectedPatient.gender)}</p></div>
              <div><p className="text-slate-400 uppercase tracking-wide text-[10px]">Telepon</p><p className="font-semibold text-slate-800">{selectedPatient.phone || '-'}</p></div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tanggal Resume</Label>
              <Input type="date" value={form.document_date} onChange={(e) => setForm((f) => ({ ...f, document_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tempat</Label>
              <Input placeholder="Balikpapan" value={form.tempat} onChange={(e) => setForm((f) => ({ ...f, tempat: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Anamnesa</Label>
            <Textarea rows={2} placeholder="Keluhan pasien..." value={form.anamnesa} onChange={(e) => setForm((f) => ({ ...f, anamnesa: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pemeriksaan Fisik</Label>
            <Textarea rows={2} placeholder="Hasil pemeriksaan fisik..." value={form.pemeriksaan_fisik} onChange={(e) => setForm((f) => ({ ...f, pemeriksaan_fisik: e.target.value }))} />
          </div>

          <DiagnosisServiceField
            diagnosaId={form.diagnosa_id}
            onChange={({ diagnosaId, diagnosaLabel }) => setForm((f) => ({ ...f, diagnosa_id: diagnosaId, diagnosa: diagnosaLabel }))}
          />

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Program Terapi</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PROGRAM_TERAPI_OPTIONS.map((opt) => (
                <label key={opt.key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <Checkbox checked={form.program_terapi.includes(opt.key)} onCheckedChange={() => toggleProgram(opt.key)} />
                  {opt.label}
                </label>
              ))}
            </div>
            <Input placeholder="Program lainnya (opsional)" value={form.program_terapi_lainnya} onChange={(e) => setForm((f) => ({ ...f, program_terapi_lainnya: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Rekomendasi Fisioterapi</Label>
            <Input placeholder="Contoh: 5x (1-2x seminggu)" value={form.rekomendasi} onChange={(e) => setForm((f) => ({ ...f, rekomendasi: e.target.value }))} />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button type="button" variant="outline" className="gap-2" onClick={handlePreview}>
              <Eye className="w-4 h-4" /> Pratinjau
            </Button>
            <Button type="button" className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={handleSaveAndPreview} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
              Simpan &amp; Buat Dokumen
            </Button>
          </div>
        </CardContent>
      </Card>

      <ClinicalDocumentPreviewModal
        isOpen={!!previewData}
        onClose={() => setPreviewData(null)}
        title="Resume Medis"
        fileName={`Resume_Medis_${(previewData?.patient_name || 'Pasien').replace(/\s+/g, '_')}`}
      >
        {previewData && <ResumeMedisTemplate data={previewData} clinic={clinic} />}
      </ClinicalDocumentPreviewModal>
    </>
  );
};

export default ResumeMedisForm;
