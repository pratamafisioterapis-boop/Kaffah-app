import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const formatCurrency = (value) =>
  `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(Number(value) || 0))}`;

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date)) return '-';
  return format(date, 'dd/MM/yyyy');
};

const GREEN_HEAD = [6, 95, 70];
const RED_HEAD = [190, 24, 24];
const BORDER = [226, 232, 240];
const LIGHT_FILL = [248, 250, 252];
const BODY_TEXT = [30, 41, 59];
const MUTED = [100, 116, 139];

// Setiap section hanya digambar kalau datanya tidak kosong, supaya PDF tidak
// menampilkan tabel kosong (header + "Tidak ada data") yang tidak enak dibaca
// saat dipresentasikan.
const drawSection = (doc, { title, rows, columns, subtotal, theme, startY, margin, pageWidth }) => {
  if (!rows.length) return startY;

  let y = startY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...(theme === 'green' ? GREEN_HEAD : RED_HEAD));
  doc.text(title, margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(`${rows.length} entri`, pageWidth - margin, y, { align: 'right' });

  autoTable(doc, {
    startY: y + 3,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => c.render(row))),
    theme: 'grid',
    headStyles: {
      fillColor: theme === 'green' ? GREEN_HEAD : RED_HEAD,
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    styles: { fontSize: 8, cellPadding: 2.4, textColor: BODY_TEXT, lineColor: BORDER, lineWidth: 0.15 },
    alternateRowStyles: { fillColor: LIGHT_FILL },
    columnStyles: {
      [columns.length - 1]: {
        halign: 'right',
        fontStyle: 'bold',
        textColor: theme === 'green' ? [5, 150, 105] : [190, 24, 24],
      },
    },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...(theme === 'green' ? GREEN_HEAD : RED_HEAD));
  doc.text(`Subtotal ${title}: ${formatCurrency(subtotal)}`, pageWidth - margin, y, { align: 'right' });

  return y + 9;
};

const amountCol = (header = 'Jumlah') => ({ header, render: (row) => formatCurrency(row.amount) });

export const generateAccountingReportPDF = (data, { dateRange, clinicName = '', totals } = {}) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.width;
  const margin = 14;

  const { totalIncome, totalExpenses, netProfit, subTotalOwnerInc, subTotalAdminInc, subTotalPatientInc, subTotalOwnerExp, subTotalAdminExp } = totals;

  // ── Header banner ──
  doc.setFillColor(6, 42, 34);
  doc.rect(0, 0, pageWidth, 38, 'F');

  doc.setTextColor(110, 231, 183);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('LAPORAN KEUANGAN', margin, 13);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(19);
  doc.text('Laporan Akuntansi Lengkap', margin, 23);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `${clinicName || 'Klinik'} · Periode ${formatDate(dateRange?.startDate)} - ${formatDate(dateRange?.endDate)}`,
    margin,
    31
  );

  doc.setFontSize(8);
  doc.setTextColor(148, 197, 178);
  doc.text(
    `Dicetak: ${format(new Date(), 'dd MMMM yyyy, HH:mm', { locale: localeId })}`,
    pageWidth - margin,
    13,
    { align: 'right' }
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(netProfit >= 0 ? 110 : 252, netProfit >= 0 ? 231 : 165, netProfit >= 0 ? 183 : 165);
  doc.text(formatCurrency(netProfit), pageWidth - margin, 25, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 197, 178);
  doc.text('NET PROFIT', pageWidth - margin, 30, { align: 'right' });

  let y = 47;

  // ── Summary cards ──
  const cards = [
    { label: 'Total Pemasukan', value: totalIncome, color: [5, 150, 105] },
    { label: 'Total Pengeluaran', value: totalExpenses, color: [190, 24, 24] },
    { label: 'Net Profit', value: netProfit, color: netProfit >= 0 ? [5, 150, 105] : [190, 24, 24] },
  ];
  const cardGap = 4;
  const cardW = (pageWidth - margin * 2 - cardGap * (cards.length - 1)) / cards.length;
  cards.forEach((card, idx) => {
    const x = margin + idx * (cardW + cardGap);
    doc.setDrawColor(...BORDER);
    doc.setFillColor(...LIGHT_FILL);
    doc.roundedRect(x, y, cardW, 20, 2, 2, 'FD');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(card.label, x + 3, y + 7);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...card.color);
    doc.text(formatCurrency(card.value), x + 3, y + 15, { maxWidth: cardW - 6 });
  });

  y += 30;

  const bankCol = { header: 'Bank', render: (row) => row.bank_accounts?.bank_name || '-' };
  const incomeColumns = [
    { header: 'Tanggal', render: (row) => formatDate(row.date || row.transaction_date) },
    { header: 'Kategori', render: (row) => row.category || '-' },
    { header: 'Deskripsi', render: (row) => row.description || '-' },
    bankCol,
    amountCol(),
  ];
  const expenseColumns = incomeColumns;
  const patientColumns = [
    { header: 'Tanggal', render: (row) => formatDate(row.date) },
    { header: 'Pasien', render: (row) => row.patient_name || '-' },
    { header: 'Paket', render: (row) => row.package_name || '-' },
    amountCol(),
  ];

  let hasIncomeContent = false;
  [
    { title: 'Pemasukan Owner', rows: data.ownerIncome, columns: incomeColumns, subtotal: subTotalOwnerInc },
    { title: 'Pemasukan Admin', rows: data.adminIncome, columns: incomeColumns, subtotal: subTotalAdminInc },
    { title: 'Pendapatan Pasien (Paket/Visit)', rows: data.patientIncome, columns: patientColumns, subtotal: subTotalPatientInc },
  ].forEach((section) => {
    if (!section.rows.length) return;
    hasIncomeContent = true;
    y = drawSection(doc, { ...section, theme: 'green', startY: y, margin, pageWidth });
  });

  if (!hasIncomeContent) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text('Tidak ada pemasukan pada periode ini.', margin, y);
    y += 10;
  }

  const expenseSections = [
    { title: 'Pengeluaran Owner', rows: data.ownerExpenses, columns: expenseColumns, subtotal: subTotalOwnerExp },
    { title: 'Pengeluaran Admin', rows: data.adminExpenses, columns: expenseColumns, subtotal: subTotalAdminExp },
  ];
  const hasExpenseContent = expenseSections.some((s) => s.rows.length > 0);

  if (hasExpenseContent) {
    doc.addPage();
    y = 20;
    expenseSections.forEach((section) => {
      if (!section.rows.length) return;
      y = drawSection(doc, { ...section, theme: 'red', startY: y, margin, pageWidth });
    });
  }

  // ── Footer page numbers ──
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p);
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text('Dihasilkan otomatis melalui Kaffah Physio App', margin, pageHeight - 8);
    doc.text(`Halaman ${p} dari ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  doc.save(`laporan_akuntansi_${dateRange?.startDate}_${dateRange?.endDate}.pdf`);
};
