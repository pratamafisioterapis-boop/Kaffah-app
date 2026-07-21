import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Renders the PDF onto <canvas> via pdf.js instead of <iframe src={blobUrl}>.
// Mobile Chrome's embedded PDF viewer frequently refuses to render blob:
// URLs inside an iframe and shows a generic "open externally" file card
// instead — rendering to canvas ourselves sidesteps that entirely.
const PdfPreviewModal = ({ open, onClose, url, title = 'Preview Dokumen' }) => {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !url) return undefined;

    let cancelled = false;
    let pdfDoc = null;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        pdfDoc = await pdfjsLib.getDocument(url).promise;
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = '';
        const containerWidth = containerRef.current.clientWidth || 800;

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum += 1) {
          if (cancelled) return;
          const page = await pdfDoc.getPage(pageNum);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = containerWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = 'shadow-sm mx-auto block';
          canvas.style.marginBottom = '12px';
          containerRef.current.appendChild(canvas);

          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Gagal memuat pratinjau PDF.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      pdfDoc?.destroy();
    };
  }, [open, url]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] h-[85vh] p-0 flex flex-col gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-3 border-b border-slate-200 shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-100 p-4">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          )}
          {error && <p className="text-center text-sm text-red-600 py-10">{error}</p>}
          <div ref={containerRef} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PdfPreviewModal;
