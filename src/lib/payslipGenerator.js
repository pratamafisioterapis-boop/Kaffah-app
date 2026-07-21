import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const NAVY = [17, 24, 46];
const NAVY_SOFT = [30, 41, 71];
const GOLD = [191, 155, 78];
const GOLD_SOFT = [232, 214, 166];
const INK = [30, 32, 38];
const MUTED = [120, 124, 134];

const formatCurrency = (value) => `Rp ${Math.round(Number(value) || 0).toLocaleString('id-ID')}`;

// payroll_records.status hanya boleh 'draft' | 'approved' | 'paid' (lihat
// constraint payroll_records_status_check).
const STATUS_LABEL = { draft: 'Draft', approved: 'Disetujui', paid: 'Dibayar' };

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

  // --- Outer premium border frame ---
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.rect(6, 6, pageWidth - 12, pageHeight - 12);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.15);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

  // --- Header band ---
  const headerHeight = 40;
  doc.setFillColor(...NAVY);
  doc.rect(8, 8, pageWidth - 16, headerHeight, 'F');
  doc.setFillColor(...NAVY_SOFT);
  doc.rect(8, 8 + headerHeight - 1.2, pageWidth - 16, 1.2, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(8, 8 + headerHeight, pageWidth - 8, 8 + headerHeight);

  const clinicName = clinic.name || 'Klinik Fisioterapi';

  doc.setTextColor(...GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('S L I P   G A J I', marginX, 20);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text(clinicName.toUpperCase(), marginX, 29);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(210, 214, 224);
  const contactLine = [clinic.address, clinic.phone].filter(Boolean).join('  •  ');
  if (contactLine) doc.text(contactLine, marginX, 35, { maxWidth: pageWidth - marginX * 2 - 55 });

  // Confidential badge (right side of header)
  const badgeW = 42;
  const badgeX = pageWidth - 8 - badgeW - 4;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.rect(badgeX, 13, badgeW, 8);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('CONFIDENTIAL', badgeX + badgeW / 2, 18, { align: 'center' });

  const periodLabel = formatPeriodLabel(record.payroll_period_start, record.payroll_period_end);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(210, 214, 224);
  doc.text('PERIODE', badgeX + badgeW, 25, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(periodLabel, badgeX + badgeW, 30, { align: 'right' });

  const docNo = `SG/${(record.id || '').toString().slice(0, 8).toUpperCase() || '00000000'}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(210, 214, 224);
  doc.text('NO. DOKUMEN', badgeX + badgeW, 36, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(docNo, badgeX + badgeW, 40, { align: 'right' });

  // --- Employee info card ---
  let y = headerHeight + 8 + 8;
  const cardH = 20;
  doc.setDrawColor(220, 220, 224);
  doc.setFillColor(250, 249, 246);
  doc.roundedRect(marginX, y, pageWidth - marginX * 2, cardH, 2, 2, 'FD');
  doc.setDrawColor(...GOLD_SOFT);
  doc.setLineWidth(0.3);
  doc.line(marginX, y, marginX, y + cardH);
  doc.setFillColor(...GOLD);
  doc.rect(marginX, y, 1.2, cardH, 'F');

  const infoLabelStyle = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(...MUTED);
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
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...GOLD);
  doc.text((STATUS_LABEL[record.status] || STATUS_LABEL.paid).toUpperCase(), col3X, y + 14.5);

  // --- Earnings table ---
  y += cardH + 8;

  const rows = [
    ['1', 'Gaji Pokok', formatCurrency(record.base_salary)],
    ['2', 'Uang Transport', formatCurrency(record.transport_per_day)],
    ['3', 'Jasa Insentif', formatCurrency(record.incentive_amount)],
    ['4', 'Komisi (Remunerasi)', formatCurrency(record.custom_commission)],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['NO', 'KOMPONEN PENDAPATAN', 'JUMLAH']],
    body: rows,
    theme: 'plain',
    styles: { font: 'helvetica' },
    headStyles: {
      fillColor: NAVY,
      textColor: GOLD,
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
    },
    bodyStyles: {
      fontSize: 9.5,
      textColor: INK,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: [250, 249, 246] },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center', textColor: MUTED },
      1: { cellWidth: 'auto', cellPadding: { top: 3.5, bottom: 3.5, left: 6, right: 6 } },
      2: { halign: 'right', cellWidth: 48, fontStyle: 'bold', cellPadding: { top: 3.5, bottom: 3.5, left: 6, right: 6 } },
    },
    didDrawPage: (data) => {
      doc.setDrawColor(...GOLD_SOFT);
      doc.setLineWidth(0.2);
      doc.line(marginX, data.cursor.y, pageWidth - marginX, data.cursor.y);
    },
  });

  // --- Total take-home pay ---
  let finalY = doc.lastAutoTable.finalY + 6;
  const totalBoxH = 16;
  doc.setFillColor(...NAVY);
  doc.rect(marginX, finalY, pageWidth - marginX * 2, totalBoxH, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.rect(marginX, finalY, pageWidth - marginX * 2, totalBoxH);

  doc.setTextColor(...GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL TAKE HOME PAY', marginX + 6, finalY + totalBoxH / 2 + 1.5);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text(formatCurrency(record.total_salary), pageWidth - marginX - 6, finalY + totalBoxH / 2 + 2, { align: 'right' });

  // --- Signatures ---
  const sigY = finalY + totalBoxH + 26;
  const sigWidth = 55;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text('Mengetahui,', marginX + sigWidth / 2, sigY, { align: 'center' });
  doc.text('Manajemen / Owner', marginX + sigWidth / 2, sigY + 4.5, { align: 'center' });
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.2);
  doc.line(marginX, sigY + 20, marginX + sigWidth, sigY + 20);
  doc.setFont('helvetica', 'bold');
  doc.text(`( ${clinicName} )`, marginX + sigWidth / 2, sigY + 25, { align: 'center' });

  const rightSigX = pageWidth - marginX - sigWidth;
  doc.setFont('helvetica', 'normal');
  doc.text('Diterima oleh,', rightSigX + sigWidth / 2, sigY, { align: 'center' });
  doc.text('Terapis', rightSigX + sigWidth / 2, sigY + 4.5, { align: 'center' });
  doc.line(rightSigX, sigY + 20, rightSigX + sigWidth, sigY + 20);
  doc.setFont('helvetica', 'bold');
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
