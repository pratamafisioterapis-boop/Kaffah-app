import React, { useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, X, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Waits for every <img> inside the document (signature, stamp, logo) to
// actually finish loading before html2canvas rasterizes it — a fixed delay
// isn't reliable for remote Supabase Storage images on a slow/first fetch,
// and html2canvas silently captures a blank box for an unloaded <img>.
const waitForImages = (root) => {
  const imgs = Array.from(root.querySelectorAll('img'));
  return Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        const done = () => {
          img.removeEventListener('load', done);
          img.removeEventListener('error', done);
          resolve();
        };
        img.addEventListener('load', done);
        img.addEventListener('error', done);
        setTimeout(done, 8000);
      });
    })
  );
};

// Generic A4 preview / print / PDF export shell shared by clinical document
// templates (Resume Medis, Surat Keterangan). Mirrors the InvoiceModal pattern.
const ClinicalDocumentPreviewModal = ({ isOpen, onClose, title, fileName, children }) => {
  const componentRef = useRef(null);
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = async () => {
    const element = componentRef.current;
    if (!element) throw new Error('Elemen dokumen tidak ditemukan');

    await waitForImages(element);

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
    });

    const pdfWidth = 210;
    const pdfHeight = 297;
    const pdfImgH = (canvas.height * pdfWidth) / canvas.width;

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });

    if (pdfImgH <= pdfHeight) {
      // Fits on a single page — draw at its natural (unscaled) height so
      // nothing near the bottom (e.g. the signature block) gets squashed.
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, pdfImgH);
    } else {
      // Content is taller than one A4 page: slice the canvas into
      // page-sized chunks instead of squeezing everything into 297mm,
      // which previously distorted/overlapped text near the page bottom.
      const pageSlicePx = Math.floor((pdfHeight * canvas.width) / pdfWidth);
      let renderedPx = 0;
      let isFirstPage = true;

      while (renderedPx < canvas.height) {
        const sliceHeightPx = Math.min(pageSlicePx, canvas.height - renderedPx);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeightPx;
        pageCanvas
          .getContext('2d')
          .drawImage(canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

        const sliceHeightMm = (sliceHeightPx * pdfWidth) / canvas.width;
        if (!isFirstPage) pdf.addPage();
        pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, sliceHeightMm);

        renderedPx += sliceHeightPx;
        isFirstPage = false;
      }
    }

    return pdf;
  };

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    try {
      const pdf = await generatePDF();
      pdf.save(`${fileName}.pdf`);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      toast({ variant: 'destructive', title: 'Gagal Mengunduh', description: err.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    const printContent = componentRef.current;
    if (!printContent) return;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    let styleTags = '';
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => { styleTags += node.outerHTML; });

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>${title}</title>
          ${styleTags}
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
              @page { size: A4; margin: 0; }
              #doc-root { width: 210mm; min-height: 297mm; }
            }
          </style>
        </head>
        <body style="background: white; display: flex; justify-content: center;">
          <div id="doc-root">${printContent.innerHTML}</div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[1000px] w-full max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 bg-slate-100">
        <div className="flex items-center justify-between p-4 border-b bg-white z-10 shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Cetak
            </Button>
            <Button size="sm" onClick={handleDownloadPDF} disabled={isGenerating} className="bg-indigo-600 hover:bg-indigo-700">
              {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Download PDF
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" size="icon">
                <X className="w-4 h-4" />
              </Button>
            </DialogClose>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-slate-200/50">
          <div className="shadow-2xl print:shadow-none" ref={componentRef}>
            {children}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClinicalDocumentPreviewModal;
