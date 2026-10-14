import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { normalizeGender } from '@/lib/utils';
import { getLatestClinicalDocumentForPatient, getWaApiSettings } from '@/lib/api';
import ClinicalDocumentPreviewModal from './ClinicalDocumentPreviewModal';
import ResumeMedisTemplate from './ResumeMedisTemplate';

// Resume medis (format Praxis) dari halaman CPPT. Memakai resume tersimpan
// terakhir milik pasien bila ada; jika belum ada, diisi dari SOAP terbaru.
const ResumeMedisCpptDialog = ({ isOpen, onClose, group, clinic }) => {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [patient, setPatient] = useState(null);

  useEffect(() => {
    if (!isOpen || !group?.patient?.id) { setData(null); return undefined; }
    let cancelled = false;
    (async () => {
      const [{ data: p }, { data: lastDoc }, { data: lastRecap }] = await Promise.all([
        supabase.from('patients').select('*').eq('id', group.patient.id).maybeSingle(),
        getLatestClinicalDocumentForPatient('resume_medis', group.patient.id),
        // No Admission = nomor registrasi kunjungan terakhir (daily_recaps).
        supabase.from('daily_recaps').select('admission_number')
          .eq('patient_id', group.patient.id).not('admission_number', 'is', null)
          .order('recap_date', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (cancelled) return;
      const pt = p || group.patient;
      setPatient(pt);
      const soap = group.records?.[0] || {};
      const base = lastDoc?.data || {
        anamnesa: soap.subjective || '',
        pemeriksaan_fisik: soap.objective || '',
        diagnosa: soap.assessment || '',
        tindakan: soap.plan || '',
        therapist_name: soap.therapist?.full_name || '-',
      };
      setData({
        ...base,
        patient_name: pt.full_name || '-',
        medical_record_number: pt.medical_record_number || '-',
        birth_date: pt.birth_date || null,
        gender: normalizeGender(pt.gender),
        admission_number: lastRecap?.admission_number || base.admission_number || '',
        document_date: new Date().toISOString().slice(0, 10),
      });
    })();
    return () => { cancelled = true; };
  }, [isOpen, group]);

  const slug = (data?.patient_name || 'Pasien').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  const fileName = `Resume_Medis_${slug}`;

  // Upload PDF lalu kirim lewat WhatsApp: otomatis bila API WA klinik aktif,
  // selain itu membuka WhatsApp dengan tautan berkas.
  const handleSend = async (pdf) => {
    const phone = patient?.phone;
    if (!phone) throw new Error('Nomor telepon pasien tidak tersedia.');

    const path = `resume-medis/${group.patient.id}_${Date.now()}.pdf`;
    const { error: upErr } = await supabase.storage
      .from('invoices')
      .upload(path, pdf.output('blob'), { contentType: 'application/pdf', upsert: true });
    if (upErr) throw new Error(`Upload gagal: ${upErr.message}`);
    const fileUrl = supabase.storage.from('invoices').getPublicUrl(path).data.publicUrl;

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
      `https://wa.me/${phone.replace(/^0/, '62')}?text=${encodeURIComponent(`${caption}\n\nLihat/unduh resume medis:\n${fileUrl}`)}`,
      '_blank'
    );
  };

  return (
    <ClinicalDocumentPreviewModal
      isOpen={isOpen && !!data}
      onClose={onClose}
      title="Resume Medis"
      fileName={fileName}
      onSend={handleSend}
    >
      {data && <ResumeMedisTemplate data={data} clinic={clinic} />}
    </ClinicalDocumentPreviewModal>
  );
};

export default ResumeMedisCpptDialog;
