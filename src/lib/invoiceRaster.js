import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Rasterisasi elemen invoice A4 (794px) - sama dengan yang dipakai InvoiceModal
// supaya hasil cetak / PDF identik dengan pratinjau.
export const rasterizeInvoice = async (element) => {
  if (!element) throw new Error('Element invoice tidak ditemukan');
  await new Promise((resolve) => setTimeout(resolve, 400));
  return html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    allowTaint: true,
    backgroundColor: '#ffffff',
    width: 794,
    windowWidth: 794,
  });
};

export const canvasToPdf = (canvas) => {
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
  const imgData = canvas.toDataURL('image/png');
  const imgProps = pdf.getImageProperties(imgData);
  const height = Math.min((imgProps.height * 210) / imgProps.width, 297);
  pdf.addImage(imgData, 'PNG', 0, 0, 210, height);
  return pdf;
};

// Buka dialog cetak untuk gambar invoice. `printWin` adalah tab yang dibuka
// sinkron dari klik (hindari popup blocker); jika diblokir, pakai iframe.
export const printInvoiceCanvas = async (canvas, title, printWin) => {
  const imgData = canvas.toDataURL('image/png');
  const safeTitle = String(title || 'Invoice').replace(/[<>&"]/g, '');
  const html = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${safeTitle}</title>
        <style>
          @page { size: A4; margin: 0; }
          html, body { margin: 0; padding: 0; background: #fff; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          img { display: block; width: 100%; max-width: 210mm; height: auto; margin: 0 auto; }
          @media print { img { width: 210mm; max-width: none; height: 297mm; } }
        </style>
      </head>
      <body>
        <img id="inv" src="${imgData}" />
        <script>
          (function () {
            var img = document.getElementById('inv');
            function go() { setTimeout(function () { window.focus(); window.print(); }, 200); }
            if (img.complete) go(); else img.onload = go;
          })();
        <\/script>
      </body>
    </html>`;

  if (printWin && !printWin.closed) {
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html.replace(/<script>[\s\S]*?<\/script>/, ''));
  doc.close();
  const img = doc.getElementById('inv');
  if (img && !img.complete) {
    await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
  iframe.contentWindow.focus();
  iframe.contentWindow.print();
  setTimeout(() => iframe.remove(), 60000);
};
