import React, { useRef, useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '@/lib/supabase';
import { 
  Dialog, 
  DialogContent, 
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, X, Loader2, Send } from "lucide-react";
import InvoiceTemplate from './InvoiceTemplate';
import { useToast } from "@/components/ui/use-toast";
import { getInvoiceSettings, getWaApiSettings } from '@/lib/api';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const InvoiceModal = ({ isOpen, onClose, data, onSent }) => {
  const { userDetails } = useAuth();
  const [detailData, setDetailData]       = useState(null);
  const componentRef                       = useRef();
  const { toast }                          = useToast();
  const [isGenerating, setIsGenerating]   = useState(false);
  const [isSendingManualWA, setIsSendingManualWA] = useState(false);
  const [isSendingWA, setIsSendingWA]     = useState(false);
  const [logoUrl, setLogoUrl]             = useState(null);
  const [invoiceSettings, setInvoiceSettings] = useState({
    invoiceTitle: 'Invoice',
    invoiceSubtitle: 'Layanan Fisioterapi',
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [waAutoAvailable, setWaAutoAvailable] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      fetchDetailData();
      fetchWaAvailability();
    }
  }, [isOpen, data?.id]);

  // ── Cek apakah klinik ini sudah punya API Key WA (untuk kirim otomatis) ───
  const fetchWaAvailability = async () => {
    const { data: waSettings } = await getWaApiSettings();
    setWaAutoAvailable(!!(waSettings?.enabled && waSettings?.api_key));
  };

  // ── Fetch Invoice Settings ────────────────────────────────────────────────
  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      const { data: settingsData, error } = await getInvoiceSettings();
      if (settingsData && !error) {
        setInvoiceSettings({
          invoiceTitle:    settingsData.invoice_title    || 'Invoice',
          invoiceSubtitle: settingsData.invoice_subtitle || 'Layanan Fisioterapi',
        });
        setLogoUrl(settingsData.logo_url || null);
      }
    } catch (err) {
      console.error("Error fetching invoice settings:", err);
    } finally {
      setLoadingSettings(false);
    }
  };

  // ── Fetch Detail Data ─────────────────────────────────────────────────────
  // FIX: destructure error dengan benar (sebelumnya error tidak terdefinisi)
  const fetchDetailData = async () => {
    if (!data?.id) return;

    const { data: recap, error } = await supabase
      .from('daily_recaps')
      .select('*')
      .eq('id', data.id)
      .single();

    if (error || !recap) {
      console.error("Error fetching recap:", error);
      return;
    }

    let physioData = null;
    let clinicData = null;
    if (recap.therapist_id) {
      const { data: physio } = await supabase
        .from('physiotherapists')
        .select('name, signature_url, stamp_url, clinic_id')
        .eq('id', recap.therapist_id)
        .single();
      if (physio) {
        physioData = physio;
        if (physio.clinic_id) {
          const { data: clinic } = await supabase
            .from('clinics')
            .select('name, address, phone, email, logo_url')
            .eq('id', physio.clinic_id)
            .single();
          if (clinic) clinicData = clinic;
        }
      }
    }

    setDetailData({
      ...recap,
      therapist_name: physioData?.name || recap.therapist_name || '-',
      signature_url:  physioData?.signature_url || null,
      stamp_url:      physioData?.stamp_url     || null,
      clinic: clinicData,
    });
  };

  // ── Helper: Generate PDF ──────────────────────────────────────────────────
  const generatePDF = async () => {
    const element = componentRef.current;
    if (!element) throw new Error("Element invoice tidak ditemukan");

    await new Promise(resolve => setTimeout(resolve, 500));

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
    });

    const imgData   = canvas.toDataURL('image/png');
    const pdfWidth  = 210;
    const pdfHeight = 297;

    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const imgProps    = pdf.getImageProperties(imgData);
    const pdfImgH     = (imgProps.height * pdfWidth) / imgProps.width;
    const finalHeight = Math.min(pdfImgH, pdfHeight);

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, finalHeight);
    return pdf;
  };

  // ── Helper: Medical Record Number ────────────────────────────────────────
  // FIX: medical_record_number ada di data.patients (hasil join di getDailyRecaps)
  // bukan di root data, makanya selalu fallback ke RM00000
  const getMedicalRecordNumber = () =>
    data?.patients?.medical_record_number ||
    data?.patient?.medical_record_number  ||
    data?.medical_record_number           ||
    'RM00000';

  // ── Helper: Nama Pasien (dipakai untuk nama file PDF) ─────────────────────
  const getPatientNameSlug = () => {
    const name =
      data?.patients?.full_name ||
      data?.patient?.full_name  ||
      data?.guest_name          ||
      data?.patient_name        ||
      'Pasien';
    return name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  };

  // ── Helper: Invoice Number ────────────────────────────────────────────────
  const getInvoiceNumber = () => {
    const rm      = getMedicalRecordNumber();
    const dateStr = data?.recap_date || new Date().toISOString().split('T')[0];
    return `INV/KFF/${dateStr}/${rm}`;
  };

  // ── Helper: Nomor HP Pasien ───────────────────────────────────────────────
  // FIX: data.patient (singular) bukan data.patients
  const getPatientPhone = () =>
    data?.patient?.phone     ||
    data?.patients?.phone    ||   // fallback lama
    data?.guest_phone        ||
    detailData?.guest_phone  ||
    '';

  // ── Helper: Upload PDF ke Supabase Storage → return public URL ───────────
  // FIX: fileName diterima sebagai parameter, bukan hardcode inv_${data.id}.pdf
  const uploadPDF = async (pdf, fileName) => {
    const blob = pdf.output('blob');

    const { error: uploadError } = await supabase
      .storage
      .from('invoices')
      .upload(fileName, blob, { contentType: 'application/pdf', upsert: true });

    if (uploadError) throw new Error(`Upload gagal: ${uploadError.message}`);

    const { data: publicUrlData } = supabase
      .storage
      .from('invoices')
      .getPublicUrl(fileName);

    const fileUrl = publicUrlData.publicUrl;

    // Simpan URL ke daily_recaps
    const { error: saveUrlError } = await supabase
      .from('daily_recaps')
      .update({ invoice_url: fileUrl })
      .eq('id', data.id);

    if (saveUrlError) throw new Error(`Gagal menyimpan invoice_url: ${saveUrlError.message}`);

    return fileUrl;
  };

  // ── Helper: Simpan Invoice Record ─────────────────────────────────────────
  const saveInvoiceRecord = async (invoiceNumber) => {
    const { error: saveReceiptError } = await supabase
      .from('daily_recaps')
      .update({ receipt_number: invoiceNumber })
      .eq('id', data.id);

    if (saveReceiptError) throw new Error(`Gagal menyimpan receipt_number: ${saveReceiptError.message}`);

    const { data: existing } = await supabase
      .from('invoice_records')
      .select('id')
      .eq('daily_recap_id', data.id)
      .maybeSingle();

    if (!existing) {
      await supabase.from('invoice_records').insert([{
        daily_recap_id: data.id,
        patient_id:     data.patient_id,
        therapist_id:   data.therapist_id,
        amount:         data.amount || 0,
        invoice_number: invoiceNumber,
        generated_at:   new Date(),
      }]);
    }
  };

  // ── Download PDF ──────────────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    try {
      const pdf           = await generatePDF();
      const invoiceNumber = getInvoiceNumber();

      await saveInvoiceRecord(invoiceNumber);

      const rm      = getMedicalRecordNumber();
      const rawDate = data?.recap_date || new Date().toISOString().split('T')[0];
      const [yr, mo, dy] = rawDate.split('-');
      const dateFormatted = `${dy}-${mo}-${yr.slice(2)}`;

      pdf.save(`Kwitansi_${getPatientNameSlug()}_${dateFormatted}.pdf`);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      toast({ variant: "destructive", title: "Gagal Mengunduh", description: err.message });
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Kirim Invoice via WA ──────────────────────────────────────────────────
  // FIX UTAMA: pakai supabase.rpc('send_invoice_whatsapp') bukan fetch langsung
  // → Menghindari CORS error karena request ke Wablas lewat database, bukan browser
  const handleSendWA = async () => {
    setIsSendingWA(true);
    try {

      // 1. Validasi nomor HP
      const rawPhone = getPatientPhone();
      if (!rawPhone) {
        toast({
          variant: "destructive",
          title: "Gagal Kirim WA",
          description: "Nomor telepon pasien tidak tersedia.",
        });
        return;
      }

      // 2. Gunakan invoice_url yang sudah ada, atau generate + upload baru
      let fileUrl = data?.invoice_url || detailData?.invoice_url || null;

      // 3. Siapkan nama file dengan format Rcpt_RM_DD-MM-YY.pdf
      const rm       = getMedicalRecordNumber();
      const rawDate  = data?.recap_date || new Date().toISOString().split('T')[0];
      const [yr, mo, dy] = rawDate.split('-');
      const dateFormatted = `${dy}-${mo}-${yr.slice(2)}`;
      const fileName = `Kwitansi_${getPatientNameSlug()}_${dateFormatted}.pdf`;

      if (!fileUrl) {
        toast({ title: "Menyiapkan Invoice...", description: "Sedang generate dan upload PDF." });
        const pdf = await generatePDF();
        // FIX: teruskan fileName ke uploadPDF supaya nama file di Storage juga benar
        fileUrl   = await uploadPDF(pdf, fileName);
        await saveInvoiceRecord(getInvoiceNumber());
      }

      // 4. Siapkan pesan caption
      const clinicName = detailData?.clinic?.name || '';
      const caption =
        `Berikut *Kwitansi Terapi* hari ini.\n\n` +
        `Terima kasih telah mempercayakan pemulihan di *${clinicName}*.\n` +
        `Semoga lekas membaik dan sehat selalu 🌿\n\n` +
        `*Salam Sehat,*\n` +
        `${clinicName}`;

      // 5. Panggil SQL function send_invoice_whatsapp via RPC
      // → Request ke Wablas dilakukan dari DATABASE bukan browser → bebas CORS
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'send_invoice_whatsapp',
        {
          p_phone:       rawPhone,
          p_message:     caption,
          p_file_base64: fileUrl,   // SQL function pakai nama p_file_base64 tapi isinya URL
          p_filename:    fileName,
        }
      );

      if (rpcError) throw new Error(rpcError.message);
      // 6. Cek response dari Wablas
      const status = rpcResult?.status;

      if (
  status === 200 ||
  status === '200' ||
  rpcResult?.request_id
) {
        await supabase
          .from('daily_recaps')
          .update({
            invoice_wa_status: 'terkirim',
            invoice_wa_sent_at: new Date().toISOString(),
          })
          .eq('id', data.id);

        toast({
          title: "✅ Invoice Terkirim",
          description: `Invoice PDF berhasil dikirim via WhatsApp ke ${rawPhone}. Catatan: status berdasarkan respons API, bukan konfirmasi pasien menerima pesan.`,
        });

        onSent?.();
      } else if (rpcResult?.error) {
        throw new Error(rpcResult.error);
      } else {
        throw new Error(
  rpcResult?.content ||
  'Gagal mengirim invoice otomatis'
);
      }

    } catch (err) {
      console.error("handleSendWA error:", err);

      await supabase
        .from('daily_recaps')
        .update({
          invoice_wa_status: 'gagal',
          invoice_wa_sent_at: new Date().toISOString(),
        })
        .eq('id', data.id);

      toast({
        variant: "destructive",
        title: "Gagal Kirim WA",
        description: err.message || "Terjadi kesalahan saat mengirim invoice.",
      });
    } finally {
      setIsSendingWA(false);
    }
  };
const handleSendManualWA = async () => {
  setIsSendingManualWA(true);

  try {

    const rawPhone = getPatientPhone();

    if (!rawPhone) {
      toast({
        variant: "destructive",
        title: "Nomor Tidak Ditemukan",
        description: "Nomor telepon pasien tidak tersedia.",
      });
      return;
    }

    let fileUrl =
      data?.invoice_url ||
      detailData?.invoice_url ||
      null;

    const rm = getMedicalRecordNumber();

    const rawDate =
      data?.recap_date ||
      new Date().toISOString().split('T')[0];

    const [yr, mo, dy] = rawDate.split('-');

    const dateFormatted =
      `${dy}-${mo}-${yr.slice(2)}`;

    const fileName =
      `Kwitansi_${getPatientNameSlug()}_${dateFormatted}.pdf`;

    if (!fileUrl) {

      const pdf = await generatePDF();

      fileUrl = await uploadPDF(
        pdf,
        fileName
      );

      await saveInvoiceRecord(
        getInvoiceNumber()
      );
    }

    const clinicName = detailData?.clinic?.name || '';
    const invoiceLink = `${window.location.origin}/i/${data.id}`;

    const message =
      `Berikut *Kwitansi Terapi* hari ini.\n\n` +
      `Terima kasih telah mempercayakan pemulihan di *${clinicName}*.\n` +
      `Semoga lekas membaik dan sehat selalu 🌿\n\n` +
      `📄 Lihat/unduh kwitansi:\n${invoiceLink}\n\n` +
      `*Salam Sehat,*\n` +
      `${clinicName}`;

    const formattedPhone =
      rawPhone.replace(/^0/, '62');

    await supabase
      .from('daily_recaps')
      .update({
        invoice_wa_status: 'terkirim_manual',
        invoice_wa_sent_at: new Date().toISOString(),
      })
      .eq('id', data.id);

    window.open(
      `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`,
      '_blank'
    );

    onSent?.();

  } catch (err) {

    toast({
      variant: "destructive",
      title: "Gagal",
      description: err.message
    });

  } finally {
    setIsSendingManualWA(false);
  }
};
  // ── Print ─────────────────────────────────────────────────────────────────
  // Render the exact same rasterized image used for the PDF download so the
  // printed result always matches — the browser's native print layout of the
  // raw DOM tends to paginate/reflow the fixed-size invoice unpredictably.
  const [isPrinting, setIsPrinting] = useState(false);
  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const element = componentRef.current;
      if (!element) return;

      await new Promise(resolve => setTimeout(resolve, 300));
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794,
      });
      const imgData = canvas.toDataURL('image/png');

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(`
        <html>
          <head>
            <title>Invoice - ${data?.patient_name || 'Patient'}</title>
            <style>
              @media print {
                body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
                @page { size: A4; margin: 0; }
              }
              body { margin: 0; padding: 0; }
              img { width: 210mm; height: 297mm; display: block; }
            </style>
          </head>
          <body>
            <img src="${imgData}" />
          </body>
        </html>
      `);
      doc.close();

      await new Promise(resolve => setTimeout(resolve, 300));
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    } catch (err) {
      console.error('Print Error:', err);
      toast({ variant: "destructive", title: "Gagal Mencetak", description: err.message });
    } finally {
      setIsPrinting(false);
    }
  };

  if (!data) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[1000px] w-full max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 bg-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-white z-10 shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">Preview Invoice</h2>
          <div className="flex gap-2">

            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting}>
              {isPrinting
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Printer className="w-4 h-4 mr-2" />
              }
              Cetak
            </Button>

            <Button
              size="sm"
              onClick={handleDownloadPDF}
              disabled={isGenerating || loadingSettings}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isGenerating
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Download className="w-4 h-4 mr-2" />
              }
              Download PDF
            </Button>

            {waAutoAvailable && (
              <Button
                size="sm"
                onClick={handleSendWA}
                disabled={isSendingWA || loadingSettings}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isSendingWA
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Send className="w-4 h-4 mr-2" />
                }
                {isSendingWA ? 'Mengirim...' : 'Kirim Otomatis'}
              </Button>
            )}

<Button
  size="sm"
  onClick={handleSendManualWA}
  disabled={isSendingManualWA || loadingSettings}
  className="bg-emerald-500 hover:bg-emerald-600 text-white"
>
  {isSendingManualWA
    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
    : <Send className="w-4 h-4 mr-2" />
  }
  {isSendingManualWA ? 'Membuka...' : 'Kirim Manual'}
</Button>

            <DialogClose asChild>
              <Button variant="ghost" size="icon">
                <X className="w-4 h-4" />
              </Button>
            </DialogClose>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-slate-200/50">
          <div className="shadow-2xl print:shadow-none">
            {loadingSettings ? (
              <div className="flex items-center justify-center h-[297mm] w-[210mm] bg-white">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : (
              <InvoiceTemplate
                ref={componentRef}
                data={{ ...detailData, ...data }}
                logoUrl={logoUrl}
                invoiceTitle={invoiceSettings.invoiceTitle}
                invoiceSubtitle={invoiceSettings.invoiceSubtitle}
              />
            )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
};

export default InvoiceModal;
