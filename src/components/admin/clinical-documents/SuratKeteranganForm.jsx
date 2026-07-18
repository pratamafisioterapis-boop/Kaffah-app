import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Eye } from 'lucide-react';
import SearchableSelect from '@/components/ui/searchable-select';
import { useToast } from '@/components/ui/use-toast';
import { normalizeGender } from '@/lib/utils';
import {
  getPatients, getPatientById, getPhysiotherapists, getClinicDetails,
  createClinicalDocument, getNextClinicalDocumentNumber,
} from '@/lib/api';
import ClinicalDocumentPreviewModal from './ClinicalDocumentPreviewModal';
import SuratKeteranganTemplate from './SuratKeteranganTemplate';
import DiagnosisServiceField from './DiagnosisServiceField';

const emptyForm = {
  patient_id: '',
  therapist_id: '',
  document_number: '',
  document_date: new Date().toISOString().slice(0, 10),
  address: '',
  phone: '',
  service_id: '',
  diagnosa_id: '',
  diagnosa: '',
  keterangan_tambahan: '',
  tempat: 'Balikpapan',
};

const calcAge = (birthDate) => {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
};

const SuratKeteranganForm = ({ onSaved }) => {
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
      const [{ data: p }, { data: t }, { data: c }, { data: nextNo }] = await Promise.all([
        getPatients(), getPhysiotherapists(), getClinicDetails(),
        getNextClinicalDocumentNumber('surat_keterangan', 'SKF'),
      ]);
      setPatients(p || []);
      setTherapists(t || []);
      setClinic(c || null);
      setForm((f) => ({ ...f, document_number: nextNo || '' }));
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
    setForm((f) => ({ ...f, address: data?.address || '', phone: data?.phone || '' }));
  };

  const buildDocumentData = () => {
    const therapist = therapists.find((t) => t.id === form.therapist_id);
    return {
      document_number: form.document_number,
      patient_name: selectedPatient?.full_name || '-',
      birth_date: selectedPatient?.birth_date || null,
      age: calcAge(selectedPatient?.birth_date),
      gender: normalizeGender(selectedPatient?.gender),
      address: form.address,
      phone: form.phone,
      service_id: form.service_id,
      diagnosa_id: form.diagnosa_id,
      diagnosa: form.diagnosa,
      keterangan_tambahan: form.keterangan_tambahan,
      document_date: form.document_date,
      tempat: form.tempat,
      therapist_name: therapist?.name || '-',
      therapist_signature_url: therapist?.signature_url || null,
      therapist_license: therapist?.license_number || null,
    };
  };

  const resetForm = async () => {
    const { data: nextNo } = await getNextClinicalDocumentNumber('surat_keterangan', 'SKF');
    setForm({ ...emptyForm, document_number: nextNo || '' });
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
        document_type: 'surat_keterangan',
        document_number: form.document_number,
        document_date: form.document_date,
        data: documentData,
      });
      if (error) throw error;

      toast({ title: 'Berhasil', description: 'Surat keterangan berhasil disimpan.' });
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
              <div><p className="text-slate-400 uppercase tracking-wide text-[10px]">Usia</p><p className="font-semibold text-slate-800">{calcAge(selectedPatient.birth_date) ?? '-'} Th</p></div>
              <div><p className="text-slate-400 uppercase tracking-wide text-[10px]">JK</p><p className="font-semibold text-slate-800">{normalizeGender(selectedPatient.gender)}</p></div>
              <div className="col-span-2"><p className="text-slate-400 uppercase tracking-wide text-[10px]">No. RM</p><p className="font-semibold text-slate-800">{selectedPatient.medical_record_number || '-'}</p></div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">No. Surat</Label>
              <Input value={form.document_number} onChange={(e) => setForm((f) => ({ ...f, document_number: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tanggal Surat</Label>
              <Input type="date" value={form.document_date} onChange={(e) => setForm((f) => ({ ...f, document_date: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Alamat</Label>
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Telepon</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>

          <DiagnosisServiceField
            serviceId={form.service_id}
            diagnosaId={form.diagnosa_id}
            onChange={({ serviceId, diagnosaId, diagnosaLabel }) => setForm((f) => ({ ...f, service_id: serviceId, diagnosa_id: diagnosaId, diagnosa: diagnosaLabel }))}
          />

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Keterangan Tambahan (opsional)</Label>
            <Textarea rows={2} placeholder="Kosongkan untuk memakai kalimat standar..." value={form.keterangan_tambahan} onChange={(e) => setForm((f) => ({ ...f, keterangan_tambahan: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tempat</Label>
            <Input placeholder="Balikpapan" value={form.tempat} onChange={(e) => setForm((f) => ({ ...f, tempat: e.target.value }))} />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button type="button" variant="outline" className="gap-2" onClick={handlePreview}>
              <Eye className="w-4 h-4" /> Pratinjau
            </Button>
            <Button type="button" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveAndPreview} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Simpan &amp; Buat Dokumen
            </Button>
          </div>
        </CardContent>
      </Card>

      <ClinicalDocumentPreviewModal
        isOpen={!!previewData}
        onClose={() => setPreviewData(null)}
        title="Surat Keterangan Fisioterapi"
        fileName={`Surat_Keterangan_${(previewData?.patient_name || 'Pasien').replace(/\s+/g, '_')}`}
      >
        {previewData && <SuratKeteranganTemplate data={previewData} clinic={clinic} />}
      </ClinicalDocumentPreviewModal>
    </>
  );
};

export default SuratKeteranganForm;
