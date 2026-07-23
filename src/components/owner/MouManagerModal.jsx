import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2, Trash2, Eye, Download, ScrollText, CalendarClock, UploadCloud, FileCheck2, Pencil, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  getMouDocumentsForTherapist, upsertMouDocument, deleteMouDocument, getCurrentClinic,
  uploadSignedMouFile, markMouAsSigned, getMouSignedFileUrl,
} from '@/lib/api';
import { generateMouAgreementPDF, mouAgreementFileName } from '@/lib/mouAgreementGenerator';
import PdfPreviewModal from '@/components/shared/PdfPreviewModal';
import { addYears, subDays, format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const STATUS_LABEL = { draft: 'Draft', signed: 'Sudah Ditandatangani' };
const STATUS_BADGE_CLASS = {
  draft: 'bg-amber-50 text-amber-700 border border-amber-200',
  signed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
};

const computeNextPeriod = (therapist, records) => {
  if (!therapist?.join_date) return null;
  const joinDate = new Date(therapist.join_date);
  const maxPeriodNumber = records.reduce((max, r) => Math.max(max, r.period_number || 0), 0);
  const nextNumber = maxPeriodNumber + 1;
  const start = addYears(joinDate, nextNumber - 1);
  const end = subDays(addYears(joinDate, nextNumber), 1);
  return {
    period_number: nextNumber,
    period_start: format(start, 'yyyy-MM-dd'),
    period_end: format(end, 'yyyy-MM-dd'),
  };
};

const emptyForm = (therapist, clinic, records) => {
  const next = computeNextPeriod(therapist, records) || { period_number: 1, period_start: '', period_end: '' };
  return {
    id: null,
    period_number: next.period_number,
    period_start: next.period_start,
    period_end: next.period_end,
    agreement_date: format(new Date(), 'yyyy-MM-dd'),
    agreement_city: 'Balikpapan',
    first_party: {
      name: clinic?.owner_full_name || '',
      birth_place: clinic?.owner_birth_place || '',
      birth_date: clinic?.owner_birth_date || '',
      position: clinic?.owner_position || 'Pimpinan Klinik',
    },
    second_party: {
      name: therapist?.name || '',
      birth_place: therapist?.birth_place || '',
      birth_date: therapist?.birth_date || '',
      license_number: therapist?.license_number || '',
    },
    compensation: {
      base_salary: therapist?.base_salary || 0,
      transport_per_visit: therapist?.transport_per_day || 0,
      professional_incentive_note: '',
      off_hour_incentive_per_patient: 0,
      leave_commission_per_12_days: 0,
      annual_leave_days: 12,
      leave_notice_days: 7,
      marriage_leave_days: 3,
      marriage_notice_days: 14,
      maternity_leave_months: 3,
      termination_notice_days: 60,
    },
  };
};

const MouManagerModal = ({ open, onClose, therapist }) => {
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clinic, setClinic] = useState(null);
  const [form, setForm] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [viewingSignedId, setViewingSignedId] = useState(null);

  useEffect(() => {
    if (open && therapist?.id) {
      fetchAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, therapist?.id]);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: clinicData }, { data: recordsData, error }] = await Promise.all([
      getCurrentClinic(),
      getMouDocumentsForTherapist(therapist.id),
    ]);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal Memuat', description: error.message });
    }
    setClinic(clinicData || null);
    setRecords(recordsData || []);
    setForm(emptyForm(therapist, clinicData, recordsData || []));
    setLoading(false);
  };

  const handleNewPeriod = () => {
    setForm(emptyForm(therapist, clinic, records));
  };

  const handleEditRecord = (record) => {
    setForm({
      id: record.id,
      period_number: record.period_number,
      period_start: record.period_start,
      period_end: record.period_end,
      agreement_date: record.agreement_date,
      agreement_city: record.agreement_city,
      first_party: record.first_party || {},
      second_party: record.second_party || {},
      compensation: record.compensation || {},
    });
  };

  const buildRecordForPdf = (f) => ({
    period_number: f.period_number,
    period_start: f.period_start,
    period_end: f.period_end,
    agreement_date: f.agreement_date,
    agreement_city: f.agreement_city,
    first_party: f.first_party,
    second_party: f.second_party,
    compensation: f.compensation,
  });

  const handlePreview = () => {
    if (!form.period_start || !form.period_end) {
      toast({ variant: 'destructive', title: 'Validasi Gagal', description: 'Periode wajib diisi. Klik "Periode Berikutnya" atau isi manual.' });
      return;
    }
    const doc = generateMouAgreementPDF(buildRecordForPdf(form), clinic || {});
    setPreviewUrl(URL.createObjectURL(doc.output('blob')));
  };

  const handleSaveAndDownload = async () => {
    if (!form.period_start || !form.period_end) {
      toast({ variant: 'destructive', title: 'Validasi Gagal', description: 'Periode wajib diisi.' });
      return;
    }
    setSaving(true);
    const { data, error } = await upsertMouDocument({
      id: form.id,
      clinic_id: clinic?.id,
      physiotherapist_id: therapist.id,
      ...buildRecordForPdf(form),
    });
    setSaving(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: error.message });
      return;
    }

    toast({ title: 'Berhasil', description: 'Draft MOU tersimpan.' });
    setForm((prev) => ({ ...prev, id: data.id }));
    setRecords((prev) => {
      const exists = prev.some((r) => r.id === data.id);
      return exists ? prev.map((r) => (r.id === data.id ? data : r)) : [data, ...prev];
    });

    const doc = generateMouAgreementPDF(data, clinic || {});
    doc.save(mouAgreementFileName(data, therapist));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus dokumen MOU ini?')) return;
    const { success, error } = await deleteMouDocument(id);
    if (success) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      if (form?.id === id) setForm(emptyForm(therapist, clinic, records.filter((r) => r.id !== id)));
      toast({ title: 'Terhapus', description: 'Dokumen MOU telah dihapus.' });
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: error?.message });
    }
  };

  const handleUploadSigned = async (record, file) => {
    if (!file) return;
    setUploadingId(record.id);
    const { data: uploaded, error: uploadError } = await uploadSignedMouFile(file, therapist.id, record.id);
    if (uploadError) {
      setUploadingId(null);
      toast({ variant: 'destructive', title: 'Gagal Upload', description: uploadError.message });
      return;
    }
    const { data: updated, error: markError } = await markMouAsSigned(record.id, uploaded);
    setUploadingId(null);
    if (markError) {
      toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: markError.message });
      return;
    }
    setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
    toast({ title: 'Berhasil', description: 'Dokumen yang sudah ditandatangani berhasil diunggah dan tampil di akun terapis.' });
  };

  const handleViewSigned = async (record) => {
    setViewingSignedId(record.id);
    const { data: url, error } = await getMouSignedFileUrl(record.signed_file_path);
    setViewingSignedId(null);
    if (error || !url) {
      toast({ variant: 'destructive', title: 'Gagal Membuka File', description: error?.message });
      return;
    }
    setPreviewUrl(url);
  };

  const handleDownloadSigned = async (record) => {
    setViewingSignedId(record.id);
    const { data: url } = await getMouSignedFileUrl(record.signed_file_path);
    setViewingSignedId(null);
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = record.signed_file_name || 'MOU-Kemitraan.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const updateForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const updateParty = (key, patch) => setForm((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  const updateComp = (patch) => setForm((prev) => ({ ...prev, compensation: { ...prev.compensation, ...patch } }));

  const isFirstYear = (form?.period_number || 1) <= 1;

  const periodLabel = useMemo(() => {
    if (!form?.period_start || !form?.period_end) return '-';
    try {
      return `${format(new Date(form.period_start), 'dd MMM yyyy', { locale: idLocale })} — ${format(new Date(form.period_end), 'dd MMM yyyy', { locale: idLocale })}`;
    } catch (_e) {
      return '-';
    }
  }, [form?.period_start, form?.period_end]);

  if (!form) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-[700px]">
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-emerald-600" /> MOU Kemitraan: {therapist?.name}
          </DialogTitle>
          <DialogDescription>
            Buat/edit draft Perjanjian Kerjasama Kemitraan tahunan, unduh untuk ditandatangani, lalu unggah kembali versi yang sudah ditandatangani.
          </DialogDescription>
        </DialogHeader>

        {!therapist?.join_date && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            Tanggal bergabung terapis ini belum diisi. Isi terlebih dahulu di form edit profil terapis supaya periode MOU dapat dihitung otomatis.
          </p>
        )}

        <div className="rounded-xl border border-slate-200 p-4 space-y-4 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                {form.id ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              </div>
              <div>
                <h4 className="font-semibold text-sm text-slate-800">
                  {form.id ? `Edit MOU — Tahun ke-${form.period_number}` : `MOU Baru — Tahun ke-${form.period_number}`}
                </h4>
                <p className="text-[11px] text-slate-500">{periodLabel}</p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleNewPeriod} className="text-emerald-700 border-emerald-200 hover:bg-emerald-50">
              <CalendarClock className="w-3.5 h-3.5 mr-1.5" /> Periode Berikutnya
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Tahun Ke-</label>
              <Input type="number" min="1" value={form.period_number} onChange={(e) => updateForm({ period_number: parseInt(e.target.value, 10) || 1 })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Periode Mulai</label>
              <Input type="date" value={form.period_start} onChange={(e) => updateForm({ period_start: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Periode Selesai</label>
              <Input type="date" value={form.period_end} onChange={(e) => updateForm({ period_end: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Tanggal Perjanjian</label>
              <Input type="date" value={form.agreement_date} onChange={(e) => updateForm({ agreement_date: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-slate-600">Kota Perjanjian</label>
              <Input value={form.agreement_city} onChange={(e) => updateForm({ agreement_city: e.target.value })} placeholder="Balikpapan" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">PIHAK PERTAMA</p>
              <Input placeholder="Nama & gelar" value={form.first_party.name || ''} onChange={(e) => updateParty('first_party', { name: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Tempat lahir" value={form.first_party.birth_place || ''} onChange={(e) => updateParty('first_party', { birth_place: e.target.value })} />
                <Input type="date" value={form.first_party.birth_date || ''} onChange={(e) => updateParty('first_party', { birth_date: e.target.value })} />
              </div>
              <Input placeholder="Jabatan" value={form.first_party.position || ''} onChange={(e) => updateParty('first_party', { position: e.target.value })} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">PIHAK KEDUA</p>
              <Input placeholder="Nama & gelar" value={form.second_party.name || ''} onChange={(e) => updateParty('second_party', { name: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Tempat lahir" value={form.second_party.birth_place || ''} onChange={(e) => updateParty('second_party', { birth_place: e.target.value })} />
                <Input type="date" value={form.second_party.birth_date || ''} onChange={(e) => updateParty('second_party', { birth_date: e.target.value })} />
              </div>
              <Input placeholder="No. STR / SIP" value={form.second_party.license_number || ''} onChange={(e) => updateParty('second_party', { license_number: e.target.value })} />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div>
              <p className="text-xs font-semibold text-slate-700">KOMPENSASI (Pasal 4)</p>
              {isFirstYear && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1.5">
                  Tahun ke-1 memakai format kontrak fisioterapis baru: belum ada Remunerasi &amp; Komisi Cuti Tahunan (Pasal 4), dan Pasal 6 memakai "Izin Tidak Hadir" — bukan hak Cuti penuh.
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Gaji Pokok / bulan</label>
                <Input type="number" value={form.compensation.base_salary} onChange={(e) => updateComp({ base_salary: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Upah Makan &amp; Transport / kedatangan</label>
                <Input type="number" value={form.compensation.transport_per_visit} onChange={(e) => updateComp({ transport_per_visit: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Insentif Jasa Lainnya / pasien (luar jam kerja)</label>
                <Input type="number" value={form.compensation.off_hour_incentive_per_patient} onChange={(e) => updateComp({ off_hour_incentive_per_patient: e.target.value })} />
              </div>
              {!isFirstYear && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">Komisi Cuti Tahunan / {form.compensation.annual_leave_days || 12} hari</label>
                  <Input type="number" value={form.compensation.leave_commission_per_12_days} onChange={(e) => updateComp({ leave_commission_per_12_days: e.target.value })} />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Keterangan Insentif Jasa Keprofesian</label>
              <Textarea rows={2} value={form.compensation.professional_incentive_note} onChange={(e) => updateComp({ professional_incentive_note: e.target.value })} placeholder="mis. sesuai lampiran ketentuan insentif jasa keprofesian klinik" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {!isFirstYear && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">Cuti Tahunan (hari)</label>
                    <Input type="number" value={form.compensation.annual_leave_days} onChange={(e) => updateComp({ annual_leave_days: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">Cuti Menikah (hari)</label>
                    <Input type="number" value={form.compensation.marriage_leave_days} onChange={(e) => updateComp({ marriage_leave_days: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600">Cuti Hamil (bulan)</label>
                    <Input type="number" value={form.compensation.maternity_leave_months} onChange={(e) => updateComp({ maternity_leave_months: e.target.value })} />
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Notice Putus Kontrak (hari)</label>
                <Input type="number" value={form.compensation.termination_notice_days} onChange={(e) => updateComp({ termination_notice_days: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handlePreview} className="flex-1">
              <Eye className="w-4 h-4 mr-2" /> Lihat Draft
            </Button>
            <Button onClick={handleSaveAndDownload} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
              Simpan &amp; Unduh Draft PDF
            </Button>
          </div>
          <p className="text-[11px] text-slate-400 -mt-1">
            Cetak &amp; tanda tangani draft di atas materai, lalu unggah hasil scan-nya pada baris riwayat di bawah — dokumen akan otomatis tampil di menu Dokumen milik terapis.
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-slate-800">Riwayat MOU</h4>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
          ) : records.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-6">Belum ada dokumen MOU untuk terapis ini.</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {records.map((r) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-slate-100 hover:border-slate-300 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      Tahun ke-{r.period_number} · {format(new Date(r.period_start), 'dd MMM yyyy', { locale: idLocale })} — {format(new Date(r.period_end), 'dd MMM yyyy', { locale: idLocale })}
                    </p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE_CLASS[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Button size="sm" variant="ghost" className="h-8 gap-1 text-slate-600" onClick={() => handleEditRecord(r)} title="Edit">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    {r.status === 'signed' ? (
                      <>
                        <Button size="sm" variant="ghost" className="h-8 gap-1 text-blue-600" onClick={() => handleViewSigned(r)} disabled={viewingSignedId === r.id} title="Lihat File Tertandatangan">
                          {viewingSignedId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck2 className="w-3.5 h-3.5" />} Lihat
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 gap-1 text-emerald-600" onClick={() => handleDownloadSigned(r)} disabled={viewingSignedId === r.id} title="Download">
                          <Download className="w-3.5 h-3.5" /> Download
                        </Button>
                      </>
                    ) : (
                      <label className="cursor-pointer">
                        <span className="inline-flex items-center gap-1 h-8 px-3 text-xs font-medium rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                          {uploadingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                          Upload Tertandatangan
                        </span>
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          className="hidden"
                          disabled={uploadingId === r.id}
                          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; handleUploadSigned(r, f); }}
                        />
                      </label>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => handleDelete(r.id)} title="Hapus">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>

      <PdfPreviewModal
        open={!!previewUrl}
        onClose={() => setPreviewUrl(null)}
        url={previewUrl}
        title="Preview MOU Kemitraan"
      />
    </Dialog>
  );
};

export default MouManagerModal;
