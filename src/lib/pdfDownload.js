// Unduh PDF dari objek jsPDF dengan tautan unduh yang ditempel ke dokumen —
// cara yang andal di Chrome HP/PWA, berbeda dengan doc.save() yang kadang
// tidak memicu unduhan sama sekali di perangkat tertentu.
export const downloadPdfDoc = (doc, fileName) => {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};
