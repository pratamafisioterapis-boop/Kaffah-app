import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2, Trash2, Eye, Download, AlertTriangle, UploadCloud, FileCheck2, Pencil, Plus, Send, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getWarningLettersForTherapist, getWarningLettersForClinic, upsertWarningLetter, deleteWarningLetter, getCurrentClinic,
  markWarningLetterIssued, uploadSignedWarningLetterFile, markWarningLetterAcknowledged, getWarningLetterSignedFileUrl,
} from '@/lib/api';
import { generateWarningLetterPDF, warningLetterFileName, WARNING_LEVEL_LABEL } from '@/lib/warningLetterGenerator';
import PdfPreviewModal from '@/components/shared/PdfPreviewModal';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const STATUS_LABEL = { draft: 'Draft', issued: 'Diterbitkan', acknowledged: 'Sudah Ditandatangani' };
const STATUS_BADGE_CLASS = {
  draft: 'bg-slate-100 text-slate-600 border border-slate-200',
  issued: 'bg-amber-50 text-amber-700 border border-amber-200',
  acknowledged: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
};
const LEVEL_BADGE_CLASS = {
  SP1: 'bg-amber-50 text-amber-700 border border-amber-200',
  SP2: 'bg-orange-50 text-orange-700 border border-orange-200',
  SP3: 'bg-red-50 text-red-700 border border-red-200',
};

// Nomor surat dihitung dari seluruh surat se-klinik (bukan per-terapis) dan
// direset tiap tahun, supaya nomor selalu unik & otomatis lanjut/naik setiap
// kali surat baru dibuat, walau untuk terapis yang berbeda.
const nextLetterNumber = (clinicLetters, level) => {
  const now = new Date();
  const year = now.getFullYear();
  const countThisLevel = clinicLetters.filter((r) => (
    r.level === level && r.letter_date && new Date(r.letter_date).getFullYear() === year
  )).length + 1;
  const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][now.getMonth() + 1];
  return `${String(countThisLevel).padStart(3, '0')}/${level}/KAFFAH/${roman}/${year}`;
};

let violationRowSeq = 0;
const newViolationRow = (date = format(new Date(), 'yyyy-MM-dd'), description = '') => {
  violationRowSeq += 1;
  return { key: `v${violationRowSeq}`, date, description };
};

const emptyForm = (clinicLetters) => ({
  id: null,
  level: 'SP1',
  letter_number: nextLetterNumber(clinicLetters, 'SP1'),
  letter_date: format(new Date(), 'yyyy-MM-dd'),
  letter_city: 'Balikpapan',
  violations: [newViolationRow()],
  consequence_note: '',
});

const WarningLetterManagerModal = ({ open, onClose, therapist }) => {
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [clinicLetters, setClinicLetters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clinic, setClinic] = useState(null);
  const [form, setForm] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [viewingId, setViewingId] = useState(null);

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
      getWarningLettersForTherapist(therapist.id),
    ]);
    if (error) {
      toast({ variant: 'destructive', title: 'Gagal Memuat', description: error.message });
    }
    const { data: clinicLettersData } = await getWarningLettersForClinic(clinicData?.id);
    setClinic(clinicData || null);
    setRecords(recordsData || []);
    setClinicLetters(clinicLettersData || []);
    setForm(emptyForm(clinicLettersData || []));
    setLoading(false);
  };

  const handleNewLetter = () => {
    setForm(emptyForm(clinicLetters));
  };

  const handleEditRecord = (record) => {
    const violations = Array.isArray(record.violations) && record.violations.length > 0
      ? record.violations.map((v) => newViolationRow(v.date || '', v.description))
      : [newViolationRow(record.violation_date || '', record.violation_description)];
    setForm({
      id: record.id,
      level: record.level,
      letter_number: record.letter_number,
      letter_date: record.letter_date,
      letter_city: record.letter_city,
      violations,
      consequence_note: record.consequence_note || '',
    });
  };

  const addViolationRow = () => {
    setForm((prev) => ({ ...prev, violations: [...prev.violations, newViolationRow()] }));
  };

  const removeViolationRow = (key) => {
    setForm((prev) => ({
      ...prev,
      violations: prev.violations.length > 1 ? prev.violations.filter((v) => v.key !== key) : prev.violations,
    }));
  };

  const updateViolationRow = (key, patch) => {
    setForm((prev) => ({
      ...prev,
      violations: prev.violations.map((v) => (v.key === key ? { ...v, ...patch } : v)),
    }));
  };

  const handleLevelChange = (level) => {
    setForm((prev) => ({
      ...prev,
      level,
      letter_number: prev.id ? prev.letter_number : nextLetterNumber(clinicLetters, level),
    }));
  };

  const buildRecordForPdf = (f) => ({
    letter_number: f.letter_number,
    level: f.level,
    letter_date: f.letter_date,
    letter_city: f.letter_city,
    violations: f.violations.map((v) => ({ date: v.date, description: v.description })),
    consequence_note: f.consequence_note,
  });

  const validate = () => {
    if (!form.letter_number?.trim()) {
      toast({ variant: 'destructive', title: 'Validasi Gagal', description: 'Nomor surat wajib diisi.' });
      return false;
    }
    if (form.violations.some((v) => !v.description?.trim())) {
      toast({ variant: 'destructive', title: 'Validasi Gagal', description: 'Uraian pelanggaran wajib diisi untuk setiap baris (tanggal boleh dikosongkan).' });
      return false;
    }
    return true;
  };

  const handlePreview = async () => {
    if (!validate()) return;
    const doc = await generateWarningLetterPDF(buildRecordForPdf(form), clinic || {}, therapist || {});
    setPreviewUrl(URL.createObjectURL(doc.output('blob')));
  };

  const handleSaveAndDownload = async () => {
    if (!validate()) return;
    setSaving(true);
    const { data, error } = await upsertWarningLetter({
      id: form.id,
      clinic_id: clinic?.id,
      physiotherapist_id: therapist.id,
      ...buildRecordForPdf(form),
    });

    if (error) {
      setSaving(false);
      toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: error.message });
      return;
    }

    let record = data;
    if (record.status === 'draft') {
      const { data: issued, error: issueError } = await markWarningLetterIssued(record.id);
      if (issueError) {
        setSaving(false);
        toast({ variant: 'destructive', title: 'Gagal Menerbitkan', description: issueError.message });
        return;
      }
      record = issued;
    }
    setSaving(false);

    toast({ title: 'Berhasil', description: `${WARNING_LEVEL_LABEL[record.level]} tersimpan & diterbitkan.` });
    setForm((prev) => ({ ...prev, id: record.id }));
    setRecords((prev) => {
      const exists = prev.some((r) => r.id === record.id);
      return exists ? prev.map((r) => (r.id === record.id ? record : r)) : [record, ...prev];
    });
    setClinicLetters((prev) => {
      const exists = prev.some((r) => r.id === record.id);
      return exists ? prev.map((r) => (r.id === record.id ? record : r)) : [record, ...prev];
    });

    const doc = await generateWarningLetterPDF(record, clinic || {}, therapist || {});
    doc.save(warningLetterFileName(record, therapist));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus Surat Peringatan ini?')) return;
    const { success, error } = await deleteWarningLetter(id);
    if (success) {
      const remaining = records.filter((r) => r.id !== id);
      const remainingClinicLetters = clinicLetters.filter((r) => r.id !== id);
      setRecords(remaining);
      setClinicLetters(remainingClinicLetters);
      if (form?.id === id) setForm(emptyForm(remainingClinicLetters));
      toast({ title: 'Terhapus', description: 'Surat Peringatan telah dihapus.' });
    } else {
      toast({ variant: 'destructive', title: 'Gagal', description: error?.message });
    }
  };

  const handleFileSelected = async (record, file) => {
    if (!file) return;
    setUploadingId(record.id);
    const { data: uploaded, error: uploadError } = await uploadSignedWarningLetterFile(file, therapist.id, record.id);
    if (uploadError) {
      setUploadingId(null);
      toast({ variant: 'destructive', title: 'Gagal Upload', description: uploadError.message });
      return;
    }
    const { data: updated, error: markError } = await markWarningLetterAcknowledged(record.id, uploaded);
    setUploadingId(null);
    if (markError) {
      toast({ variant: 'destructive', title: 'Gagal Menyimpan', description: markError.message });
      return;
    }
    setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
    toast({ title: 'Berhasil', description: 'Bukti tanda tangan tersimpan — surat kini tampil di akun terapis.' });
  };

  const handleView = async (record) => {
    setViewingId(record.id);
    if (record.status === 'acknowledged' && record.signed_file_path) {
      const { data: url, error } = await getWarningLetterSignedFileUrl(record.signed_file_path);
      setViewingId(null);
      if (error || !url) {
        toast({ variant: 'destructive', title: 'Gagal Membuka File', description: error?.message });
        return;
      }
      setPreviewUrl(url);
      return;
    }
    const doc = await generateWarningLetterPDF(record, clinic || {}, therapist || {});
    setViewingId(null);
    setPreviewUrl(URL.createObjectURL(doc.output('blob')));
  };

  const handleDownload = async (record) => {
    setViewingId(record.id);
    if (record.status === 'acknowledged' && record.signed_file_path) {
      const { data: url } = await getWarningLetterSignedFileUrl(record.signed_file_path);
      setViewingId(null);
      if (!url) return;
      const link = document.createElement('a');
      link.href = url;
      link.download = record.signed_file_name || warningLetterFileName(record, therapist);
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }
    const doc = await generateWarningLetterPDF(record, clinic || {}, therapist || {});
    setViewingId(null);
    doc.save(warningLetterFileName(record, therapist));
  };

  const updateForm = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const letterLabel = useMemo(() => WARNING_LEVEL_LABEL[form?.level] || '-', [form?.level]);

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
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" /> Surat Peringatan: {therapist?.name}
          </DialogTitle>
          <DialogDescription>
            Buat Surat Peringatan (SP) atas pelanggaran yang dilakukan terapis, unduh PDF untuk dicetak & ditandatangani, lalu unggah kembali bukti tanda tangannya.
          </DialogDescription>
        </DialogHeader>

        {!clinic?.owner_full_name && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            Nama & jabatan pimpinan klinik belum diisi, sehingga kolom tanda tangan "Pihak Yang Menerbitkan" pada PDF akan kosong. Isi dulu di menu <span className="font-semibold">Pengaturan &gt; Akun &amp; Klinik</span>.
          </p>
        )}

        <div className="rounded-xl border border-slate-200 p-4 space-y-4 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                {form.id ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              </div>
              <div>
                <h4 className="font-semibold text-sm text-slate-800">
                  {form.id ? `Edit — ${letterLabel}` : `Surat Baru — ${letterLabel}`}
                </h4>
                <p className="text-[11px] text-slate-500">{form.letter_number}</p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleNewLetter} className="text-red-700 border-red-200 hover:bg-red-50">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Surat Baru
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Tingkat SP</label>
              <Select value={form.level} onValueChange={handleLevelChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(WARNING_LEVEL_LABEL).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Nomor Surat</label>
              <Input value={form.letter_number} onChange={(e) => updateForm({ letter_number: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Tanggal Surat</label>
              <Input type="date" value={form.letter_date} onChange={(e) => updateForm({ letter_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Kota Penerbitan</label>
              <Input value={form.letter_city} onChange={(e) => updateForm({ letter_city: e.target.value })} placeholder="Balikpapan" />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600">Tanggal &amp; Jenis Pelanggaran</label>
                <Button type="button" variant="outline" size="sm" onClick={addViolationRow} className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Tanggal
                </Button>
              </div>
              <p className="text-[11px] text-slate-400">
                Tambahkan lebih dari satu tanggal bila pelanggaran terjadi berulang, baik dengan jenis pelanggaran yang sama maupun berbeda. Tanggal boleh dikosongkan kalau hanya ingin menjelaskan pelanggarannya saja.
              </p>
              <div className="space-y-3">
                {form.violations.map((v, idx) => (
                  <div key={v.key} className="rounded-lg border border-slate-200 p-3 space-y-2 bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-1.5 w-44 shrink-0">
                        <label className="text-[11px] font-medium text-slate-500">Tanggal Kejadian {form.violations.length > 1 ? `#${idx + 1}` : ''} (opsional)</label>
                        <Input type="date" value={v.date} onChange={(e) => updateViolationRow(v.key, { date: e.target.value })} />
                      </div>
                      {form.violations.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-600 mt-4"
                          onClick={() => removeViolationRow(v.key)}
                          title="Hapus tanggal ini"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <Textarea
                      rows={3}
                      value={v.description}
                      onChange={(e) => updateViolationRow(v.key, { description: e.target.value })}
                      placeholder="Jelaskan jenis & kronologi pelanggaran yang dilakukan terapis pada tanggal ini secara rinci."
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Konsekuensi / Tindak Lanjut (opsional)</label>
              <Textarea
                rows={2}
                value={form.consequence_note}
                onChange={(e) => updateForm({ consequence_note: e.target.value })}
                placeholder="mis. potongan insentif, masa evaluasi 30 hari, dsb."
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handlePreview} className="flex-1">
              <Eye className="w-4 h-4 mr-2" /> Lihat Draft
            </Button>
            <Button onClick={handleSaveAndDownload} disabled={saving} className="flex-1 bg-red-600 hover:bg-red-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Simpan &amp; Terbitkan PDF
            </Button>
          </div>
          <p className="text-[11px] text-slate-400 -mt-1">
            Cetak surat yang sudah diterbitkan, minta terapis membubuhkan tanda tangan, lalu unggah foto/scan halaman bertanda tangan pada baris riwayat di bawah supaya tersimpan sebagai bukti dan tampil di menu Dokumen milik terapis.
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-slate-800">Riwayat Surat Peringatan</h4>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
          ) : records.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-6">Belum ada Surat Peringatan untuk terapis ini.</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {records.map((r) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-slate-100 hover:border-slate-300 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {r.letter_number} · {format(new Date(r.letter_date), 'dd MMM yyyy', { locale: idLocale })}
                    </p>
                    <p className="text-xs text-slate-500 truncate max-w-[320px]">{r.violation_description}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${LEVEL_BADGE_CLASS[r.level]}`}>
                        {r.level}
                      </span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE_CLASS[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap shrink-0">
                    <Button size="sm" variant="ghost" className="h-8 gap-1 text-slate-600" onClick={() => handleEditRecord(r)} title="Edit">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 gap-1 text-blue-600" onClick={() => handleView(r)} disabled={viewingId === r.id} title="Lihat">
                      {viewingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} Lihat
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 gap-1 text-emerald-600" onClick={() => handleDownload(r)} disabled={viewingId === r.id} title="Download">
                      <Download className="w-3.5 h-3.5" /> Download
                    </Button>
                    {r.status !== 'draft' && (
                      <label className="cursor-pointer" title="Upload bukti tanda tangan terapis">
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50">
                          {uploadingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (r.status === 'acknowledged' ? <FileCheck2 className="w-3.5 h-3.5" /> : <UploadCloud className="w-3.5 h-3.5" />)}
                        </span>
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          className="hidden"
                          disabled={uploadingId === r.id}
                          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; handleFileSelected(r, f); }}
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
        title="Preview Surat Peringatan"
      />
    </Dialog>
  );
};

export default WarningLetterManagerModal;
