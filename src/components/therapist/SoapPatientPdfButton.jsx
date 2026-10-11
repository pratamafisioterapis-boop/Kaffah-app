import React, { useState } from 'react';
import { FileDown, Loader2, Download, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import PdfPreviewModal from '@/components/shared/PdfPreviewModal';
import { supabase } from '@/lib/customSupabaseClient';
import { getOperationalOptionsByCategory, getEducationForDiagnoses, getPlanExercisesByIds } from '@/lib/api';
import { generateSoapPatientPDF } from '@/lib/soapPatientPdf';
import { BUSINESS } from '@/lib/businessInfo';
import { isValidUUID } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const loadLogo = async () => {
  try {
    const res = await fetch('/logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (_e) {
    return null;
  }
};

const toWaNumber = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  return digits.replace(/^0/, '62');
};

/**
 * Tombol "PDF Pasien" khusus klinik Kaffah: menyusun laporan terapi dari SOAP yang sudah dibuat,
 * menampilkan pratinjau, lalu mengunduh atau membagikannya ke pasien lewat WhatsApp.
 * record: baris medical_records (butuh id, patient_id, daily_recap_id, created_by, ...).
 */
const SoapPatientPdfButton = ({ record, patient = null, label = 'PDF Pasien', size = 'sm', className = '', variant = 'outline' }) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState(null); // { blob, fileName, url, phone, patientName, visitLabel }

  const build = async () => {
    setBusy(true);
    try {
      // Selalu pakai SOAP yang sudah tersimpan; bila baris yang diberikan belum lengkap, muat ulang dari database.
      let rec = record;
      if (rec.subjective === undefined && rec.id) {
        const { data, error } = await supabase.from('medical_records').select('*').eq('id', rec.id).single();
        if (error) throw error;
        rec = { ...rec, ...data };
      }
      const patientRow = patient?.phone !== undefined && patient?.full_name
        ? patient
        : (await supabase.from('patients').select('id, full_name, medical_record_number, phone').eq('id', rec.patient_id).maybeSingle()).data;

      const recapRes = rec.daily_recap_id && isValidUUID(rec.daily_recap_id)
        ? await supabase.from('daily_recaps').select('recap_date, diagnosis').eq('id', rec.daily_recap_id).maybeSingle()
        : { data: null };
      const recap = recapRes.data || rec.daily_recap || null;
      const visitDate = recap?.recap_date || String(rec.created_at || '').slice(0, 10);

      const { data: options } = await getOperationalOptionsByCategory('diagnosa');
      const diagnoses = (recap?.diagnosis || [])
        .map((d) => {
          const opt = (options || []).find((o) => o.id === d || o.value === d);
          if (opt) return opt.label;
          return isValidUUID(d) ? null : d;
        })
        .filter(Boolean);

      let therapistName = rec.therapist_name || '';
      if (!therapistName && rec.created_by) {
        const { data } = await supabase.from('physiotherapists').select('name').eq('user_id', rec.created_by).maybeSingle();
        therapistName = data?.name || '';
      }

      const exerciseIds = Object.keys(rec.plan_data?.exercises || {}).filter((k) => rec.plan_data.exercises[k]);
      const [{ data: education }, { data: exercises }, logo] = await Promise.all([
        getEducationForDiagnoses(diagnoses),
        getPlanExercisesByIds(exerciseIds),
        loadLogo(),
      ]);

      const { blob, fileName } = generateSoapPatientPDF({
        patient: patientRow || { full_name: 'Pasien' },
        visitDate,
        therapistName,
        diagnoses,
        record: rec,
        exercises: exercises || {},
        education: education || {},
        logo,
      });

      let visitLabel = '';
      try {
        visitLabel = format(new Date(`${visitDate}T00:00:00`), 'd MMMM yyyy', { locale: idLocale });
      } catch (_e) {
        visitLabel = '';
      }
      setPdf({
        blob,
        fileName,
        url: URL.createObjectURL(blob),
        phone: toWaNumber(patientRow?.phone),
        patientName: patientRow?.full_name || 'Pasien',
        visitLabel,
      });
    } catch (err) {
      console.error('[SoapPatientPdf]', err);
      toast({ variant: 'destructive', title: 'Gagal membuat PDF', description: err?.message || 'Terjadi kesalahan saat menyusun laporan.' });
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(pdf.blob);
    a.download = pdf.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const message = pdf
    ? `Halo ${pdf.patientName}, berikut laporan terapi Anda${pdf.visitLabel ? ` tanggal ${pdf.visitLabel}` : ''} dari ${BUSINESS.name}. ` +
      'Mohon dibaca saran dan latihan di dalamnya. Semoga lekas pulih.'
    : '';

  const share = async () => {
    const file = new File([pdf.blob], pdf.fileName, { type: 'application/pdf' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Laporan Terapi', text: message });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return; // dibatalkan pengguna
    }
    // Peramban tanpa berbagi file: unduh PDF lalu buka chat WhatsApp pasien untuk dilampirkan.
    download();
    if (pdf.phone) {
      window.open(`https://wa.me/${pdf.phone}?text=${encodeURIComponent(message)}`, '_blank');
      toast({ title: 'PDF diunduh', description: 'Lampirkan file PDF yang baru diunduh pada chat WhatsApp pasien.' });
    } else {
      toast({ title: 'PDF diunduh', description: 'Nomor WhatsApp pasien belum tersimpan. Kirim file secara manual.' });
    }
  };

  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} onClick={(e) => { e.stopPropagation(); build(); }} disabled={busy}>
        {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <FileDown className="mr-1 h-3 w-3" />}
        {label}
      </Button>
      <PdfPreviewModal
        open={!!pdf}
        onClose={() => setPdf(null)}
        url={pdf?.url || null}
        title="Laporan Terapi untuk Pasien"
        footer={pdf && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-app" onClick={download}>
              <Download className="mr-1.5 h-4 w-4" /> Unduh
            </Button>
            <Button type="button" className="rounded-app bg-emerald-600 text-white hover:bg-emerald-700" onClick={share}>
              <Send className="mr-1.5 h-4 w-4" /> Kirim ke Pasien
            </Button>
          </div>
        )}
      />
    </>
  );
};

export default SoapPatientPdfButton;
