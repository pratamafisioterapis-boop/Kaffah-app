import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const BRONZE = [156, 122, 60];
const BRONZE_SOFT = [228, 220, 196];
const CREAM = [251, 249, 243];
const INK = [34, 32, 27];
const MUTED = [163, 156, 134];
const ROW_LINE = [238, 238, 238];

const formatCurrency = (value) => `Rp ${Math.round(Number(value) || 0).toLocaleString('id-ID')}`;

// payroll_records.status hanya boleh 'draft' | 'approved' | 'paid' (lihat
// constraint payroll_records_status_check).
const STATUS_LABEL = { draft: 'Draft', approved: 'Disetujui', paid: 'Paid' };

const formatPeriodLabel = (start, end) => {
  try {
    const s = format(new Date(start), 'd MMMM yyyy', { locale: idLocale });
    const e = format(new Date(end), 'd MMMM yyyy', { locale: idLocale });
    return `${s} — ${e}`;
  } catch (_e) {
    return '-';
  }
};

/**
 * Generates a premium, modern slip gaji (payslip) PDF for a physiotherapist.
 * Ivory Minimal design: warm off-white background, bronze hairline accents,
 * serif clinic name — no solid color fill blocks.
 * @param {object} record - payroll_records row (base_salary, transport_per_day, incentive_amount, custom_commission, total_salary, payroll_period_start/end, status, salary_scheme)
 * @param {object} therapist - physiotherapist profile (name, specialization)
 * @param {object} clinic - clinic profile (name, address, phone, email)
 * @returns {jsPDF} doc
 */
export const generatePayslipPDF = (record, therapist = {}, clinic = {}) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const marginX = 16;

  // --- Outer frame ---
  doc.setDrawColor(...BRONZE_SOFT);
  doc.setLineWidth(0.4);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

  const clinicName = clinic.name || 'Klinik Fisioterapi';

  // --- Header (no fill, just type + hairline) ---
  doc.setTextColor(...BRONZE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('S L I P   G A J I', marginX, 20);

  doc.setTextColor(...INK);
  doc.setFontSize(19);
  doc.setFont('times', 'bold');
  doc.text(clinicName, marginX, 29);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  const contactLine = [clinic.address, clinic.phone].filter(Boolean).join('  •  ');
  if (contactLine) doc.text(contactLine, marginX, 35, { maxWidth: pageWidth - marginX * 2 - 55 });

  // Confidential badge (outline only, right side of header)
  const badgeW = 42;
  const badgeX = pageWidth - marginX - badgeW;
  doc.setDrawColor(...BRONZE);
  doc.setLineWidth(0.3);
  doc.rect(badgeX, 13, badgeW, 7);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRONZE);
  doc.text('CONFIDENTIAL', badgeX + badgeW / 2, 17.6, { align: 'center' });

  const periodLabel = formatPeriodLabel(record.payroll_period_start, record.payroll_period_end);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text('PERIODE', pageWidth - marginX, 25, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...INK);
  doc.text(periodLabel, pageWidth - marginX, 30, { align: 'right' });

  const docNo = `SG/${(record.id || '').toString().slice(0, 8).toUpperCase() || '00000000'}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('NO. DOKUMEN', pageWidth - marginX, 36, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...INK);
  doc.text(docNo, pageWidth - marginX, 40, { align: 'right' });

  // Header hairline
  const headerHeight = 40;
  doc.setDrawColor(...BRONZE);
  doc.setLineWidth(0.5);
  doc.line(8, 8 + headerHeight, pageWidth - 8, 8 + headerHeight);

  // --- Employee info card (soft cream fill, thin border) ---
  let y = headerHeight + 8 + 8;
  const cardH = 20;
  doc.setDrawColor(...BRONZE_SOFT);
  doc.setLineWidth(0.3);
  doc.setFillColor(...CREAM);
  doc.rect(marginX, y, pageWidth - marginX * 2, cardH, 'FD');

  const infoLabelStyle = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(...BRONZE);
  };
  const infoValueStyle = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
  };

  const cardWidth = pageWidth - marginX * 2;
  const col1X = marginX + 8;
  const col2X = marginX + cardWidth * 0.44;
  const col3X = marginX + cardWidth * 0.76;

  infoLabelStyle();
  doc.text('NAMA TERAPIS', col1X, y + 8);
  infoValueStyle();
  doc.text(therapist.name || '-', col1X, y + 14.5);

  infoLabelStyle();
  doc.text('SPESIALISASI', col2X, y + 8);
  infoValueStyle();
  doc.setFontSize(9.5);
  doc.text(therapist.specialization || 'Physiotherapist', col2X, y + 14.5);

  infoLabelStyle();
  doc.text('STATUS', col3X, y + 8);
  const statusLabel = (STATUS_LABEL[record.status] || STATUS_LABEL.paid).toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const statusW = doc.getTextWidth(statusLabel) + 7;
  doc.setDrawColor(...BRONZE);
  doc.setLineWidth(0.3);
  doc.roundedRect(col3X, y + 10.5, statusW, 6, 3, 3);
  doc.setTextColor(...BRONZE);
  doc.text(statusLabel, col3X + statusW / 2, y + 14.5, { align: 'center' });

  // --- Earnings table ---
  y += cardH + 8;

  const rows = [
    ['1', 'Gaji Pokok', formatCurrency(record.base_salary)],
    ['2', 'Uang Transport', formatCurrency(record.transport_per_day)],
    ['3', 'Jasa Insentif', formatCurrency(record.incentive_amount)],
    ['4', 'Komisi (Remunerasi)', formatCurrency(record.custom_commission)],
    ['5', 'Tips (Non-Cash)', formatCurrency(record.tips)],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['NO', 'KOMPONEN PENDAPATAN', 'JUMLAH']],
    body: rows,
    theme: 'plain',
    styles: { font: 'helvetica' },
    headStyles: {
      textColor: BRONZE,
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      lineWidth: { bottom: 0.5 },
      lineColor: BRONZE,
    },
    bodyStyles: {
      fontSize: 9.5,
      textColor: INK,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      valign: 'middle',
      lineWidth: { bottom: 0.2 },
      lineColor: ROW_LINE,
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center', textColor: MUTED },
      1: { cellWidth: 'auto', cellPadding: { top: 3.5, bottom: 3.5, left: 6, right: 6 } },
      2: { halign: 'right', cellWidth: 48, fontStyle: 'bold', cellPadding: { top: 3.5, bottom: 3.5, left: 6, right: 6 } },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === rows.length - 1) {
        data.cell.styles.lineWidth = { bottom: 0.5 };
        data.cell.styles.lineColor = BRONZE;
      }
    },
  });

  // --- Total take-home pay (no fill, just rules) ---
  let finalY = doc.lastAutoTable.finalY + 6;
  const totalBoxH = 14;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.line(marginX, finalY, pageWidth - marginX, finalY);
  doc.line(marginX, finalY + totalBoxH, pageWidth - marginX, finalY + totalBoxH);

  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL TAKE HOME PAY', marginX, finalY + totalBoxH / 2 + 1.5);

  doc.setTextColor(...BRONZE);
  doc.setFontSize(14);
  doc.text(formatCurrency(record.total_salary), pageWidth - marginX, finalY + totalBoxH / 2 + 2, { align: 'right' });

  // --- Signatures ---
  const sigY = finalY + totalBoxH + 26;
  const sigWidth = 55;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text('Mengetahui,', marginX + sigWidth / 2, sigY, { align: 'center' });
  doc.text('Manajemen / Owner', marginX + sigWidth / 2, sigY + 4.5, { align: 'center' });
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.2);
  doc.line(marginX, sigY + 20, marginX + sigWidth, sigY + 20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...INK);
  doc.text(`( ${clinicName} )`, marginX + sigWidth / 2, sigY + 25, { align: 'center' });

  const rightSigX = pageWidth - marginX - sigWidth;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text('Diterima oleh,', rightSigX + sigWidth / 2, sigY, { align: 'center' });
  doc.text('Terapis', rightSigX + sigWidth / 2, sigY + 4.5, { align: 'center' });
  doc.line(rightSigX, sigY + 20, rightSigX + sigWidth, sigY + 20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...INK);
  doc.text(`( ${therapist.name || '-'} )`, rightSigX + sigWidth / 2, sigY + 25, { align: 'center' });

  // --- Footer ---
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(
    'Dokumen ini bersifat rahasia dan hanya diperuntukkan bagi karyawan yang bersangkutan.',
    pageWidth / 2,
    pageHeight - 12,
    { align: 'center' }
  );

  return doc;
};

export const payslipFileName = (record, therapist = {}) => {
  const period = record?.payroll_period_start
    ? format(new Date(record.payroll_period_start), 'MMMyyyy', { locale: idLocale })
    : 'periode';
  const name = (therapist.name || 'terapis').replace(/[^a-zA-Z0-9]+/g, '-');
  return `Slip-Gaji-${name}-${period}.pdf`;
};
