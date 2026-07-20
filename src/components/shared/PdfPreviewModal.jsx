import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Renders the PDF inline via an iframe instead of window.open(blobUrl), which
// mobile browsers often hand off to a downloader instead of previewing.
const PdfPreviewModal = ({ open, onClose, url, title = 'Preview Dokumen' }) => {
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
        <div className="flex-1 min-h-0">
          {url && <iframe src={url} title={title} className="w-full h-full border-0" />}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PdfPreviewModal;
