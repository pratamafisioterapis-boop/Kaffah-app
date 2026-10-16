import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Loader2, FileText } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { normalizeGender } from '@/lib/utils';
import { getLatestClinicalDocumentForPatient, getWaApiSettings } from '@/lib/api';
import ClinicalDocumentPreviewModal from './ClinicalDocumentPreviewModal';
import ResumeMedisTemplate from './ResumeMedisTemplate';
import { getPatientAdmissionNumber } from '@/lib/admission';

const isBlank = (v) => !v || v === '-';

// Resume medis (format Praxis) dari halaman CPPT. Pengguna memilih catatan SOAP
// mana yang dijadikan resume (satu, beberapa, atau semua); tiap catatan menjadi
// satu halaman resume di PDF yang sama. Resume tersimpan terakhir milik pasien
// hanya dipakai untuk catatan terbaru, dan untuk data tetap (tanda tangan, SIPF).
const ResumeMedisCpptDialog = ({ isOpen, onClose, group, clinic }) => {
  const { toast } = useToast();
  const [ctx, setCtx] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [previewing, setPreviewing] = useState(false);

  const records = useMemo(
    () => [...(group?.records || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [group]
  );

  useEffect(() => {
    setPreviewing(false);
    if (!isOpen || !group?.patient?.id) { setCtx(null); setSelectedIds([]); return undefined; }
    // Default: catatan terbaru saja, sama seperti perilaku sebelumnya.
    setSelectedIds(records[0] ? [records[0].id] : []);
    let cancelled = false;
    (async () => {
      const [{ data: p }, { data: lastDoc }, admissionNumber] = await Promise.all([
        supabase.from('patients').select('*').eq('id', group.patient.id).maybeSingle(),
        getLatestClinicalDocumentForPatient('resume_medis', group.patient.id),
        getPatientAdmissionNumber(group.patient.id),
      ]);
      if (cancelled) return;
      setCtx({ patient: p || group.patient, lastDoc: lastDoc?.data || null, admissionNumber });
    })();
    return () => { cancelled = true; };
  }, [isOpen, group, records]);

  const selectedRecords = records.filter((r) => selectedIds.includes(r.id));
  const allSelected = records.length > 0 && selectedIds.length === records.length;

  const toggle = (recordId) => setSelectedIds((prev) => (
    prev.includes(recordId) ? prev.filter((x) => x !== recordId) : [...prev, recordId]
  ));

  const docs = useMemo(() => {
    if (!previewing || !ctx) return [];
    const { patient: pt, lastDoc, admissionNumber } = ctx;
    const soapTherapist = records.map((r) => r?.therapist?.full_name).find((n) => !isBlank(n));
    return records
      .filter((r) => selectedIds.includes(r.id))
      // Urut dari kunjungan terlama ke terbaru supaya PDF terbaca kronologis.
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((soap) => {
        const isLatest = soap.id === records[0]?.id;
        const fromSoap = {
          anamnesa: soap.subjective || '',
          pemeriksaan_fisik: soap.objective || '',
          diagnosa: soap.assessment || '',
          tindakan: soap.plan || '',
          therapist_name: soap.therapist?.full_name || '-',
        };
        // Catatan terbaru memakai resume tersimpan (bila ada); catatan lain
        // memakai isi SOAP-nya sendiri plus data tetap dari resume tersimpan.
        const base = lastDoc
          ? (isLatest
            ? lastDoc
            : {
              ...fromSoap,
              therapist_signature_url: lastDoc.therapist_signature_url,
              therapist_license: lastDoc.therapist_license,
              tempat: lastDoc.tempat,
            })
          : fromSoap;
        return {
          key: soap.id,
          data: {
            ...base,
            therapist_name: !isBlank(base.therapist_name) ? base.therapist_name : (soapTherapist || '-'),
            patient_name: pt.full_name || '-',
            medical_record_number: pt.medical_record_number || '-',
            birth_date: pt.birth_date || null,
            gender: normalizeGender(pt.gender),
            admission_number: admissionNumber || base.admission_number || '',
            document_date: (isLatest && !lastDoc ? new Date() : new Date(soap.created_at)).toISOString().slice(0, 10),
          },
        };
      });
  }, [previewing, ctx, records, selectedIds]);

  const slug = (ctx?.patient?.full_name || group?.patient?.full_name || 'Pasien').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  const fileName = docs.length > 1 ? `Resume_Medis_${slug}_${docs.length}_Catatan` : `Resume_Medis_${slug}`;

  // Upload PDF lalu kirim lewat WhatsApp: otomatis bila API WA klinik aktif,
  // selain itu membuka WhatsApp dengan tautan berkas.
  const handleSend = async (pdf) => {
    const phone = ctx?.patient?.phone;
    if (!phone) throw new Error('Nomor telepon pasien tidak tersedia.');

    // Nama berkas acak & pendek supaya tautan WhatsApp ringkas (/r/<kode>).
    const shortId = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => (b % 36).toString(36)).join('');
    const path = `resume-medis/${shortId}.pdf`;
    const { error: upErr } = await supabase.storage
      .from('invoices')
      .upload(path, pdf.output('blob'), { contentType: 'application/pdf', upsert: true });
    if (upErr) throw new Error(`Upload gagal: ${upErr.message}`);
    const fileUrl = supabase.storage.from('invoices').getPublicUrl(path).data.publicUrl;
    // Tautan pendek (di-rewrite oleh vercel.json); localhost tidak punya rewrite.
    const { origin, hostname } = window.location;
    const shareUrl = hostname === 'localhost' || hostname === '127.0.0.1' ? fileUrl : `${origin}/r/${shortId}`;

    const clinicName = clinic?.name || '';
    const caption =
      `Berikut *Resume Medis* Anda.\n\n` +
      `Terima kasih telah mempercayakan pemulihan di *${clinicName}*.\n` +
      `Semoga lekas membaik dan sehat selalu.\n\n` +
      `*Salam Sehat,*\n${clinicName}`;

    const { data: wa } = await getWaApiSettings();
    if (wa?.enabled && wa?.api_key) {
      const { data: res, error } = await supabase.rpc('send_invoice_whatsapp', {
        p_phone: phone, p_message: caption, p_file_base64: fileUrl, p_filename: `${fileName}.pdf`,
      });
      if (error) throw new Error(error.message);
      if (!(res?.status === 200 || res?.status === '200' || res?.request_id)) {
        throw new Error(res?.error || res?.content || 'Gagal mengirim resume medis');
      }
      toast({ title: 'Resume Medis Terkirim', description: `Dikirim via WhatsApp ke ${phone}.` });
      return;
    }
    window.open(
      `https://wa.me/${phone.replace(/^0/, '62')}?text=${encodeURIComponent(`${caption}\n\nLihat/unduh resume medis:\n${shareUrl}`)}`,
      '_blank'
    );
  };

  return (
    <>
      <Dialog open={isOpen && !previewing} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Pilih Catatan untuk Resume Medis</DialogTitle>
            <DialogDescription>
              {group?.patient?.full_name}. Tiap catatan yang dipilih menjadi satu halaman resume.
            </DialogDescription>
          </DialogHeader>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer px-1">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(v) => setSelectedIds(v ? records.map((r) => r.id) : [])}
            />
            Pilih semua ({records.length} catatan)
          </label>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {records.map((r) => (
              <label
                key={r.id}
                className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50"
              >
                <Checkbox className="mt-0.5" checked={selectedIds.includes(r.id)} onCheckedChange={() => toggle(r.id)} />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-slate-900">
                    {format(new Date(r.created_at), 'EEEE, dd MMM yyyy · HH:mm', { locale: idLocale })}
                  </p>
                  <p className="text-xs text-slate-500">Oleh: {r.therapist?.full_name || 'Terapis'}</p>
                  {(r.assessment || r.subjective) && (
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{r.assessment || r.subjective}</p>
                  )}
                </div>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Batal</Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={!ctx || selectedRecords.length === 0}
              onClick={() => setPreviewing(true)}
            >
              {ctx ? <FileText className="w-4 h-4 mr-2" /> : <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Lihat Resume ({selectedRecords.length})
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ClinicalDocumentPreviewModal
        isOpen={isOpen && previewing && docs.length > 0}
        onClose={() => setPreviewing(false)}
        title={docs.length > 1 ? `Resume Medis (${docs.length} catatan)` : 'Resume Medis'}
        fileName={fileName}
        onSend={handleSend}
      >
        {docs.map(({ key, data }) => (
          <div key={key} data-doc-page style={{ marginBottom: docs.length > 1 ? 16 : 0 }}>
            <ResumeMedisTemplate data={data} clinic={clinic} />
          </div>
        ))}
      </ClinicalDocumentPreviewModal>
    </>
  );
};

export default ResumeMedisCpptDialog;
