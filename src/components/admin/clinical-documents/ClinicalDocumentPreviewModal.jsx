import React, { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, X, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Documents are authored at a fixed A4 width (210mm ≈ 794px @96dpi) for
// print/PDF fidelity, but their height varies with content length.
const DOC_BASE_WIDTH = 794;

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
  // componentRef points at a full-resolution, off-screen clone of the
  // document — the print/PDF pipeline below (html2canvas, iframe print)
  // needs the real A4-sized DOM, not the scaled-down preview copy.
  const componentRef = useRef(null);
  const previewWrapperRef = useRef(null);
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [docHeight, setDocHeight] = useState(0);

  // Scale the visible preview to fit narrow (mobile) screens instead of
  // letting the fixed A4 width overflow and get cropped/scrolled off-screen.
  useEffect(() => {
    if (!isOpen) return;

    let wrapperObserver;
    let docObserver;
    let rafId;

    // Radix's Dialog content mounts a tick after this effect's own component
    // mounts (it's wrapped in a Presence for its enter animation), so on the
    // very first run both refs are still null here — bailing out then, like
    // a one-shot effect would, left the preview permanently stuck at its
    // initial (unscaled) size since [isOpen, children] never changes again
    // while the modal stays open. Retry across frames until Radix has
    // actually attached the nodes.
    const setUpObservers = () => {
      const wrapperNode = previewWrapperRef.current;
      const docNode = componentRef.current;
      if (!wrapperNode || !docNode) {
        rafId = requestAnimationFrame(setUpObservers);
        return;
      }

      const computeScale = () => {
        const availableWidth = wrapperNode.clientWidth;
        if (availableWidth) setPreviewScale(Math.min(1, availableWidth / DOC_BASE_WIDTH));
      };
      const computeHeight = () => setDocHeight(docNode.scrollHeight);

      computeScale();
      computeHeight();

      wrapperObserver = new ResizeObserver(computeScale);
      wrapperObserver.observe(wrapperNode);
      docObserver = new ResizeObserver(computeHeight);
      docObserver.observe(docNode);
    };
    setUpObservers();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      wrapperObserver?.disconnect();
      docObserver?.disconnect();
    };
  }, [isOpen, children]);

  const generatePDF = async () => {
    const element = componentRef.current;
    if (!element) throw new Error('Elemen dokumen tidak ditemukan');

    await waitForImages(element);

    // element sits inside a scrollable modal (overflow-y-auto, max-h-[90vh]),
    // so without an explicit height/windowHeight html2canvas falls back to
    // the modal's visible viewport and silently crops everything below the
    // fold (e.g. the REKOMENDASI section and signature block).
    const fullHeight = element.scrollHeight;
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
      height: fullHeight,
      windowHeight: fullHeight,
      scrollX: 0,
      scrollY: 0,
    });

    const pdfWidth = 210;
    const pdfHeight = 297;
    const pdfImgH = (canvas.height * pdfWidth) / canvas.width;

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });

    if (pdfImgH <= pdfHeight) {
      // Fits on a single page — draw at its natural (unscaled) height so
      // nothing near the bottom (e.g. the signature block) gets squashed.
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, pdfImgH);
    } else if (pdfImgH <= pdfHeight * 1.06) {
      // Only a hair over one page (a few mm) — slicing here would cut a
      // page break straight through a line of text (e.g. the signature
      // name), which reads as corrupted/duplicated content. Scale the
      // whole document down slightly instead so it stays a single page.
      const scaledWidth = (pdfWidth * pdfHeight) / pdfImgH;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pdfWidth - scaledWidth) / 2, 0, scaledWidth, pdfHeight);
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
              html, body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; height: auto; }
              @page { size: A4; margin: 0; }
              /* 1px under 297mm: at min-height:297mm exactly, Chromium's
                 mm-to-px rounding tips the box a hair past one page and
                 prints a blank second page. */
              #doc-root { width: 210mm; min-height: calc(297mm - 1px); box-sizing: border-box; }
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
      <DialogContent
        hideClose
        className="max-w-[1000px] w-full max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 bg-slate-100"
      >
        <div className="flex items-center justify-between gap-2 p-3 sm:p-4 border-b bg-white z-10 shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 truncate min-w-0 flex-1">{title}</h2>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Cetak</span>
            </Button>
            <Button size="sm" onClick={handleDownloadPDF} disabled={isGenerating} className="bg-indigo-600 hover:bg-indigo-700">
              {isGenerating ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <Download className="w-4 h-4 sm:mr-2" />}
              <span className="hidden sm:inline">Download PDF</span>
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" size="icon">
                <X className="w-4 h-4" />
              </Button>
            </DialogClose>
          </div>
        </div>

        {/* Scaled preview — shrinks the fixed A4-width document to fit narrow
            (mobile) screens instead of cropping/scrolling it off-screen. */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-8 flex justify-center bg-slate-200/50">
          <div ref={previewWrapperRef} className="w-full flex justify-center">
            <div
              className="shadow-2xl print:shadow-none overflow-hidden shrink-0"
              style={{ width: DOC_BASE_WIDTH * previewScale, height: docHeight * previewScale || undefined }}
            >
              <div style={{ width: DOC_BASE_WIDTH, transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                {children}
              </div>
            </div>
          </div>
        </div>

        {/* Full-resolution off-screen clone — the actual target for print
            and PDF export, kept separate so the preview's scale transform
            above never gets baked into the rasterized output. */}
        <div style={{ position: 'fixed', top: 0, left: '-9999px', pointerEvents: 'none' }} aria-hidden="true">
          <div ref={componentRef}>
            {children}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClinicalDocumentPreviewModal;
