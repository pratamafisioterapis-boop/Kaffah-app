import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const formatCurrency = (value) =>
  `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(Number(value) || 0))}`;

const SOURCE_ORDER = [
  { key: 'Modal Sendiri', label: 'Modal Sendiri' },
  { key: 'Investor', label: 'Investor / Mitra' },
  { key: 'Pinjaman Bank', label: 'Pinjaman Bank' },
  { key: 'Lainnya', label: 'Lainnya' },
];

export const generateModalAwalPDF = (items = [], { clinicName = '' } = {}) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.width;
  const margin = 14;

  const sorted = [...items].sort((a, b) => {
    const diff = new Date(b.date) - new Date(a.date);
    if (diff !== 0) return diff;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const totalModal = sorted.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const bySource = {};
  sorted.forEach((i) => {
    bySource[i.source] = (bySource[i.source] || 0) + (Number(i.amount) || 0);
  });

  const fixedAssets = sorted.filter((i) => i.is_fixed_asset);
  const consumables = sorted.filter((i) => !i.is_fixed_asset);
  const totalAssetValue = fixedAssets.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const totalResaleEstimate = fixedAssets.reduce(
    (sum, i) => sum + (Number(i.estimated_resale_value) || 0) * (Number(i.quantity) || 1),
    0
  );
  const totalConsumableValue = consumables.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  // ── Header banner ──
  doc.setFillColor(6, 42, 34);
  doc.rect(0, 0, pageWidth, 38, 'F');

  doc.setTextColor(110, 231, 183);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('MANAJEMEN KEUANGAN', margin, 13);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(19);
  doc.text('Laporan Modal Awal', margin, 23);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(clinicName || 'Klinik', margin, 31);

  doc.setFontSize(8);
  doc.setTextColor(148, 197, 178);
  doc.text(
    `Dicetak: ${format(new Date(), "dd MMMM yyyy, HH:mm", { locale: localeId })}`,
    pageWidth - margin,
    13,
    { align: 'right' }
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(formatCurrency(totalModal), pageWidth - margin, 25, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 197, 178);
  doc.text('TOTAL MODAL AWAL', pageWidth - margin, 30, { align: 'right' });

  let y = 47;

  // ── Summary cards by source ──
  const cardGap = 4;
  const cardW = (pageWidth - margin * 2 - cardGap * (SOURCE_ORDER.length - 1)) / SOURCE_ORDER.length;
  SOURCE_ORDER.forEach((src, idx) => {
    const x = margin + idx * (cardW + cardGap);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, cardW, 20, 2, 2, 'FD');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(src.label, x + 3, y + 7);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(formatCurrency(bySource[src.key] || 0), x + 3, y + 15, { maxWidth: cardW - 6 });
  });

  y += 28;

  // ── Classification summary ──
  const boxW = (pageWidth - margin * 2 - 4) / 2;

  doc.setDrawColor(253, 224, 71);
  doc.setFillColor(254, 252, 232);
  doc.roundedRect(margin, y, boxW, 24, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(161, 98, 7);
  doc.text(`ASET TETAP (${fixedAssets.length} ITEM)`, margin + 4, y + 8);
  doc.setFontSize(10);
  doc.text(`Nilai Beli: ${formatCurrency(totalAssetValue)}`, margin + 4, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Estimasi Nilai Jual: ${formatCurrency(totalResaleEstimate)}`, margin + 4, y + 21);

  const x2 = margin + boxW + 4;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x2, y, boxW, 24, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`CONSUMABLE / HABIS PAKAI (${consumables.length} ITEM)`, x2 + 4, y + 8);
  doc.setFontSize(10);
  doc.text(`Nilai: ${formatCurrency(totalConsumableValue)}`, x2 + 4, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Barang habis pakai, tidak punya nilai jual kembali.', x2 + 4, y + 21);

  y += 32;

  // ── Detail table ──
  const rows = sorted.map((item) => [
    format(new Date(item.date), 'dd/MM/yyyy'),
    item.source,
    item.is_fixed_asset ? 'Aset Tetap' : 'Consumable',
    String(item.quantity ?? 1),
    item.bank_account ? item.bank_account.bank_name : '-',
    item.description || '-',
    formatCurrency(item.amount),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Tanggal', 'Sumber', 'Klasifikasi', 'Qty', 'Bank', 'Keterangan', 'Jumlah']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [6, 95, 70], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'left' },
    styles: { fontSize: 8, cellPadding: 2.6, textColor: [30, 41, 59], lineColor: [226, 232, 240], lineWidth: 0.15 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 20 },
      3: { cellWidth: 11, halign: 'center' },
      6: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2 && data.cell.raw === 'Aset Tetap') {
        data.cell.styles.textColor = [161, 98, 7];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text('Dihasilkan otomatis melalui Kaffah Physio App', margin, pageHeight - 8);
    },
  });

  // ── Footer page numbers ──
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p);
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Halaman ${p} dari ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  doc.save(`Laporan_Modal_Awal_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
};
