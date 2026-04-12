import React, { useRef, useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '@/lib/supabase';
import { 
  Dialog, 
  DialogContent, 
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, X, Loader2 } from "lucide-react";
import InvoiceTemplate from './InvoiceTemplate';
import { useToast } from "@/components/ui/use-toast";
import { getInvoiceSettings } from '@/lib/api';

const InvoiceModal = ({ isOpen, onClose, data }) => {
  const [detailData, setDetailData] = useState(null);
  const componentRef = useRef();
  const { toast } = useToast();
  // Deprecated useMediaAssets for logo, now using settings
  // const { getLogoImage } = useMediaAssets();
  const [isGenerating, setIsGenerating] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);
  const [invoiceSettings, setInvoiceSettings] = useState({
    invoiceTitle: 'Invoice',
    invoiceSubtitle: 'Layanan Fisioterapi'
  });
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        
        setLoadingSettings(true);
        
        try {
            // Fetch Settings (including logo)
            const { data: settingsData, error } = await getInvoiceSettings();
            if (settingsData && !error) {
                setInvoiceSettings({
                    invoiceTitle: settingsData.invoice_title || 'Invoice',
                    invoiceSubtitle: settingsData.invoice_subtitle || 'Layanan Fisioterapi'
                });
                if (settingsData.logo_url) {
                    setLogoUrl(settingsData.logo_url);
                } else {
                    setLogoUrl(null); 
                }
            }
        } catch (error) {
            console.error("Error fetching invoice data:", error);
        } finally {
            setLoadingSettings(false);
        }
      };
      const fetchDetailData = async () => {
  if (!data?.id) return;

  // 🔹 ambil daily recap dulu
  const { data: recap } = await supabase
  .from('daily_recaps')
  .select('*')
  .eq('id', data.id)
  .single();

  if (error || !recap) return;

  let therapistName = '-';
let physioData = null;
if (recap.therapist_id) {
  const { data: physio } = await supabase
    .from('physiotherapists')
    .select('name, signature_url, stamp_url')
    .eq('id', recap.therapist_id)
    .single();

  if (physio) {
    physioData = physio;
    therapistName = physio.name || '-';
  }
}

// 🔥 fallback terakhir kalau masih kosong
if (!therapistName || therapistName === '-') {
  if (recap.therapist_name && recap.therapist_name.trim() !== '') {
    therapistName = recap.therapist_name;
  }
}

  // 🔥 kalau therapist_name kosong → ambil manual
  if (!therapistName && recap.therapist_id) {
    const { data: physio } = await supabase
      .from('physiotherapists')
.select('name, signature_url, stamp_url')
.eq('id', recap.therapist_id)
.single();

    therapistName = physio?.name || '-';
  }

  // 🔥 inject ke data final
  setDetailData({
  ...recap,
  therapist_name: physioData?.name || '-',
  signature_url: physioData?.signature_url || null,
  stamp_url: physioData?.stamp_url || null
});
};
      fetchData();
fetchDetailData();
    }
  }, [isOpen]);

  // Manual print handler
  const handlePrint = () => {
    const printContent = componentRef.current;
    if (!printContent) return;

    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    // Write content to iframe
    const doc = iframe.contentWindow.document;
    
    // Copy all styles from current document
    const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
    let styleTags = '';
    styles.forEach(node => {
        styleTags += node.outerHTML;
    });

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Invoice - ${data?.patient_name || 'Patient'}</title>
          ${styleTags}
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
              @page { size: A4; margin: 0; }
              #invoice-root { width: 210mm; min-height: 297mm; }
            }
          </style>
        </head>
        <body style="background: white; display: flex; justify-content: center;">
          <div id="invoice-root">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    // Print after content loaded
    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 500);
  };

  const handleDownloadPDF = async () => {
    const element = componentRef.current;
    if (!element) return;
    
    setIsGenerating(true);
    try {
      console.log('Starting PDF generation...');
      
      // Wait a bit for any images or styles to settle
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(element, {
        scale: 2, // 2x scale for retina-like quality
        useCORS: true, // Allow cross-origin images
        logging: false, // Turn off logging
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794, // Approx A4 width in pixels at 96 DPI (210mm)
        windowWidth: 794,
      });

      console.log('Canvas created with dimensions:', canvas.width, canvas.height);

      const imgData = canvas.toDataURL('image/png');
      
      // A4 dimensions in mm
      const pdfWidth = 210;
      const pdfHeight = 297;
      
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      // Calculate height based on aspect ratio to prevent distortion if content varies
      const imgProps = pdf.getImageProperties(imgData);
      const pdfImgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      const finalHeight = Math.min(pdfImgHeight, pdfHeight);

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, finalHeight);
      
      const safeName = (data?.patient_name || data?.full_name || 'Patient').replace(/[^a-zA-Z0-9]/g, '_');
const rm = data?.medical_record_number || 'RM00000';
const dateStr = data?.recap_date || new Date().toISOString().split('T')[0];
const invoiceNumber = `INV/KFF/${dateStr}/${rm}`;
await supabase
  .from('daily_recaps')
  .update({ receipt_number: invoiceNumber })
  .eq('id', data.id);
// 🔍 CEK DULU: sudah ada invoice atau belum
const { data: existingInvoice } = await supabase
  .from('invoice_records')
  .select('id')
  .eq('daily_recap_id', data.id)
  .maybeSingle();

if (!existingInvoice) {
  // ✅ kalau belum ada → insert
  await supabase.from('invoice_records').insert([
    {
      daily_recap_id: data.id,
      patient_id: data.patient_id,
      therapist_id: data.therapist_id,
      amount: data.amount || 0,
      invoice_number: invoiceNumber,
      generated_at: new Date()
    }
  ]);
}

pdf.save(`INV_KAFFAH_${rm}_${safeName}_${dateStr}.pdf`);
      
      toast({
        title: "Download Berhasil",
        description: "Invoice berhasil disimpan sebagai PDF."
      });
    } catch (error) {
      console.error('PDF Generation Error:', error);
      toast({
        variant: "destructive",
        title: "Gagal Mengunduh",
        description: "Terjadi kesalahan saat membuat PDF."
      });
    } finally {
      setIsGenerating(false);
    }
  };
const handleSendWA = async () => {
  // 🔥 kalau sudah ada URL → langsung pakai
if (data?.invoice_url) {
  const phone =
    data?.patients?.phone ||
    data?.guest_phone ||
    "";

  if (!phone) {
    alert("Nomor tidak ada");
    return;
  }

  const formattedPhone = phone.replace(/^0/, "62");

  const message = `Halo, ini invoice terapi Anda 🙏

Silakan cek di link berikut:
${data.invoice_url}`;

  const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;

  window.open(url, "_blank");
  return;
}
  const element = componentRef.current;
  if (!element) return;

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = 210;
    const imgProps = pdf.getImageProperties(imgData);
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

    // 🔥 convert ke blob (INI KUNCI)
    const blob = pdf.output('blob');

    // 🔥 nama file
const fileName = `inv_${data.id}.pdf`;

// 🔥 upload ke supabase
const { error: uploadError } = await supabase
  .storage
  .from('invoices')
  .upload(fileName, blob, {
    contentType: 'application/pdf',
    upsert: true,
  });

if (uploadError) {
  console.error("UPLOAD ERROR:", uploadError);
  alert(uploadError.message);
  return;
}

// 🔥 ambil public URL
const { data: publicUrlData } = supabase
  .storage
  .from('invoices')
  .getPublicUrl(fileName);

const fileUrl = publicUrlData.publicUrl;
await supabase
  .from('daily_recaps')
  .update({ invoice_url: fileUrl })
  .eq('id', data.id);
// 🔥 ambil nomor pasien
const phone =
  data?.patients?.phone ||
  data?.guest_phone ||
  "";

if (!phone) {
  alert("Nomor tidak ada");
  return;
}

const formattedPhone = phone.replace(/^0/, "62");

// 🔥 buka WA dengan link
const shortLinkText = "Klik di sini untuk lihat kwitansi";

const message = `Berikut *Kwitansi Terapi* hari ini.

Terima kasih telah mempercayakan pemulihan di *Kaffah Physiotherapy*.
Semoga lekas membaik dan sehat selalu 🌿

*Salam Sehat,*
Kaffah Physiotherapy

${shortLinkText}:
${fileUrl}`;

const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;

window.open(url, "_blank");
  } catch (err) {
    console.error(err);
    alert("Gagal kirim");
  }
};
  if (!data) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[1000px] w-full max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 bg-slate-100">
        <div className="flex items-center justify-between p-4 border-b bg-white z-10 shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">Preview Invoice</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Cetak
            </Button>
            <Button size="sm" onClick={handleDownloadPDF} disabled={isGenerating || loadingSettings} className="bg-blue-600 hover:bg-blue-700">
              {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Download PDF
            </Button>
            <Button 
  size="sm" 
  onClick={handleSendWA} 
  className="bg-green-600 hover:bg-green-700 text-white"
>
  Send WA
</Button>
            <DialogClose asChild>
              <Button variant="ghost" size="icon">
                <X className="w-4 h-4" />
              </Button>
            </DialogClose>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-slate-200/50">
          <div className="shadow-2xl print:shadow-none">
             {loadingSettings ? (
               <div className="flex items-center justify-center h-[297mm] w-[210mm] bg-white">
                 <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
               </div>
             ) : (
               <InvoiceTemplate 
  ref={componentRef} 
 data={{
  ...detailData,
  ...data
}}
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