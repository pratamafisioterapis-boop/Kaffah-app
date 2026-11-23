import { supabase } from '@/lib/customSupabaseClient';
import { KAFFAH_CLINIC_ID } from '@/lib/clinicIds';

// Pengiriman Surat Keterangan Fisioterapi / Resume Medis lewat WhatsApp khusus Kaffah Physiotherapy.
// Server memilih jalur (fungsi clinical_doc_send):
//   - pasien chat ke klinik < 23 jam lalu -> PDF langsung (nama file benar, caption lengkap);
//   - selain itu -> template Meta dengan tombol "Kirim Dokumen"; PDF dikirim otomatis oleh server
//     begitu pasien menekan tombol (webhook wa-watzap-webhook -> clinical_doc_on_button).

export const isKaffahClinic = (clinic) => clinic?.id === KAFFAH_CLINIC_ID;

const FOLDERS = { surat_keterangan: 'surat-keterangan', resume_medis: 'resume-medis' };

// 22-11-26 (WITA bila tanggal tidak diberikan), sama seperti nama file kwitansi.
const dateSuffix = (docDate) => {
  const iso = docDate || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date());
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return y && m && d ? `${d}-${m}-${y.slice(2)}` : '';
};

/**
 * @param {object} p
 * @param {'surat_keterangan'|'resume_medis'} p.docType
 * @param {string} p.patientId
 * @param {string} p.phone
 * @param {object} p.pdf       instance jsPDF
 * @param {string} p.fileName  nama dasar tanpa .pdf, mis. Surat_Keterangan_Budi
 * @param {string} [p.docDate] YYYY-MM-DD
 * @param {Function} p.toast
 */
export async function sendClinicalDocViaWa({ docType, patientId, phone, pdf, fileName, docDate, toast }) {
  if (!phone) throw new Error('Nomor telepon pasien tidak tersedia.');
  if (!FOLDERS[docType]) throw new Error('Jenis dokumen tidak dikenal.');

  // Nama berkas acak di storage (tautan tidak mudah ditebak); nama yang dilihat pasien diatur lewat filename.
  const shortId = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => (b % 36).toString(36)).join('');
  const path = `${FOLDERS[docType]}/${shortId}.pdf`;
  const { error: upErr } = await supabase.storage
    .from('invoices')
    .upload(path, pdf.output('blob'), { contentType: 'application/pdf', upsert: true });
  if (upErr) throw new Error(`Upload gagal: ${upErr.message}`);
  const fileUrl = supabase.storage.from('invoices').getPublicUrl(path).data.publicUrl;

  const suffix = dateSuffix(docDate);
  const filename = `${fileName}${suffix ? `_${suffix}` : ''}.pdf`;

  const { data: sent, error: sendErr } = await supabase.rpc('clinical_doc_send', {
    p_doc_type: docType,
    p_patient_id: patientId || null,
    p_phone: phone,
    p_file_url: fileUrl,
    p_filename: filename,
    p_doc_date: docDate || null,
  });
  if (sendErr) throw new Error(sendErr.message);
  if (!sent?.id) throw new Error('Pengiriman tidak tercatat di server.');

  // Status akhir ditetapkan server dari balasan Watzap; browser hanya menanyakan hasilnya (maks ~30 dtk).
  let final = null;
  for (let i = 0; i < 15 && !final; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      const { data: rs } = await supabase.rpc('clinical_doc_resolve', { p_id: sent.id });
      if (rs?.status && rs.status !== 'mengirim') final = rs;
    } catch (pollErr) {
      console.warn('clinical_doc_resolve:', pollErr); // cron tetap menyelesaikan
    }
  }

  if (final?.status === 'gagal') {
    throw new Error(final.detail || 'Watzap menolak pengiriman dokumen.');
  }
  if (final?.status === 'terkirim') {
    toast({ title: 'Dokumen Terkirim', description: `Dikirim via WhatsApp ke ${phone}.` });
  } else if (final?.status === 'menunggu_tombol') {
    toast({
      title: 'Template Terkirim',
      description: `Pasien di luar 24 jam, jadi dikirim template. Dokumen akan terkirim otomatis begitu pasien menekan tombol "Kirim Dokumen" (${phone}).`,
    });
  } else {
    toast({
      title: 'Masih diproses',
      description: 'Watzap belum membalas. Cek WhatsApp pasien sebelum mengirim ulang agar tidak terkirim dobel.',
    });
  }
  return { via: sent.via, status: final?.status || 'mengirim' };
}
