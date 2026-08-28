import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const BRONZE = [156, 122, 60];
const BRONZE_SOFT = [228, 220, 196];
const CREAM = [251, 249, 243];
const INK = [34, 32, 27];
const MUTED = [163, 156, 134];
const GREEN = [21, 128, 61];
const RED = [185, 28, 28];
const ROW_LINE = [238, 238, 238];

const MARGIN_X = 16;

const formatPeriodLabel = (start, end) => {
  try {
    const s = format(new Date(start), 'd MMMM yyyy', { locale: idLocale });
    const e = format(new Date(end), 'd MMMM yyyy', { locale: idLocale });
    return `${s} — ${e}`;
  } catch (_e) {
    return '-';
  }
};

const formatDate = (value, fallback = '-') => {
  if (!value) return fallback;
  try {
    return format(new Date(value), 'd MMM yyyy', { locale: idLocale });
  } catch (_e) {
    return fallback;
  }
};

const sectionTitle = (doc, y, title) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...BRONZE);
  doc.text(title.toUpperCase(), MARGIN_X, y);
  doc.setDrawColor(...BRONZE_SOFT);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_X, y + 2, doc.internal.pageSize.width - MARGIN_X, y + 2);
  return y + 8;
};

const ensureSpace = (doc, y, needed) => {
  const pageHeight = doc.internal.pageSize.height;
  if (y + needed > pageHeight - 20) {
    doc.addPage();
    return 20;
  }
  return y;
};

/**
 * Generates the "Laporan Evaluasi & Kinerja Bulanan Terapis" PDF.
 * @param {object} data - hasil getTherapistMonthlyReportData()
 * @param {string} notes - catatan kualitatif dari owner (No. 8)
 */
export const generateTherapistMonthlyReportPDF = (data, notes = '') => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.width;
  const { therapist = {}, clinic = {}, period, summary, target, soap, kpi, attendance, warningLetters = [] } = data;

  doc.setDrawColor(...BRONZE_SOFT);
  doc.setLineWidth(0.4);
  doc.rect(8, 8, pageWidth - 16, doc.internal.pageSize.height - 16);

  const clinicName = clinic?.name || 'Klinik Fisioterapi';

  doc.setTextColor(...BRONZE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('L A P O R A N   E V A L U A S I   B U L A N A N', MARGIN_X, 20);

  doc.setTextColor(...INK);
  doc.setFontSize(18);
  doc.setFont('times', 'bold');
  doc.text(clinicName, MARGIN_X, 29);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  const periodLabel = formatPeriodLabel(period.startDate, period.endDate);
  doc.text(`Periode: ${periodLabel}`, MARGIN_X, 35);

  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('DICETAK', pageWidth - MARGIN_X, 25, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...INK);
  doc.text(format(new Date(), 'd MMM yyyy', { locale: idLocale }), pageWidth - MARGIN_X, 30, { align: 'right' });

  const headerHeight = 40;
  doc.setDrawColor(...BRONZE);
  doc.setLineWidth(0.5);
  doc.line(8, 8 + headerHeight, pageWidth - 8, 8 + headerHeight);

  // Info card terapis
  let y = headerHeight + 8 + 8;
  const cardH = 18;
  doc.setDrawColor(...BRONZE_SOFT);
  doc.setLineWidth(0.3);
  doc.setFillColor(...CREAM);
  doc.rect(MARGIN_X, y, pageWidth - MARGIN_X * 2, cardH, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...BRONZE);
  doc.text('NAMA TERAPIS', MARGIN_X + 8, y + 7);
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(therapist?.name || '-', MARGIN_X + 8, y + 13.5);

  const col2X = MARGIN_X + (pageWidth - MARGIN_X * 2) * 0.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...BRONZE);
  doc.text('SPESIALISASI', col2X, y + 7);
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text(therapist?.specialization || 'Physiotherapist', col2X, y + 13.5);

  y += cardH + 10;

  // ── Section 1: Ringkasan Aktivitas ──
  y = sectionTitle(doc, y, '1. Ringkasan Aktivitas');

  const statBoxW = (pageWidth - MARGIN_X * 2 - 8) / 2;
  doc.setFillColor(...CREAM);
  doc.setDrawColor(...BRONZE_SOFT);
  doc.rect(MARGIN_X, y, statBoxW, 16, 'FD');
  doc.rect(MARGIN_X + statBoxW + 8, y, statBoxW, 16, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...BRONZE);
  doc.text(String(summary.totalVisits), MARGIN_X + 6, y + 10);
  doc.text(String(summary.totalUniquePatients), MARGIN_X + statBoxW + 14, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('Total Kunjungan', MARGIN_X + 6, y + 14.5);
  doc.text('Pasien Ditangani', MARGIN_X + statBoxW + 14, y + 14.5);
  y += 16 + 6;

  if (summary.typeBreakdown.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_X, right: MARGIN_X },
      head: [['Tipe Pasien', 'Jumlah Kunjungan', '%']],
      body: summary.typeBreakdown.map(([label, count]) => [
        label,
        String(count),
        `${summary.totalVisits > 0 ? Math.round((count / summary.totalVisits) * 100) : 0}%`,
      ]),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 8.5 },
      headStyles: { textColor: BRONZE, fontStyle: 'bold', lineWidth: { bottom: 0.4 }, lineColor: BRONZE },
      bodyStyles: { textColor: INK, lineWidth: { bottom: 0.2 }, lineColor: ROW_LINE },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  y = ensureSpace(doc, y, 30);
  if (summary.topDiagnoses.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text('Diagnosa Terbanyak Ditangani', MARGIN_X, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_X, right: MARGIN_X },
      head: [['Diagnosa', 'Jumlah Kasus']],
      body: summary.topDiagnoses.map(([label, count]) => [label, String(count)]),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 8.5 },
      headStyles: { textColor: BRONZE, fontStyle: 'bold', lineWidth: { bottom: 0.4 }, lineColor: BRONZE },
      bodyStyles: { textColor: INK, lineWidth: { bottom: 0.2 }, lineColor: ROW_LINE },
      columnStyles: { 1: { halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  y = ensureSpace(doc, y, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(
    `Pasien Recurring (kembali ke terapis ini): ${summary.recurringCount} dari ${summary.totalUniquePatients} pasien unik (${summary.recurringPct}%)`,
    MARGIN_X, y
  );
  y += 5.5;
  doc.text(`Paket Baru Terjual (pasien yang mulai paket lewat terapis ini): ${summary.newPackagesCount}`, MARGIN_X, y);
  y += 10;

  // ── Section 2: Pencapaian Target ──
  y = ensureSpace(doc, y, 40);
  y = sectionTitle(doc, y, '2. Pencapaian Target');

  if (target) {
    const achieved = target.status === 'TERCAPAI';
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_X, right: MARGIN_X },
      head: [['Target Kunjungan', 'Realisasi', 'Pencapaian', 'Status']],
      body: [[
        String(target.target_visits),
        String(target.actual_visits),
        `${target.achievement_percentage}%`,
        target.status,
      ]],
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 9 },
      headStyles: { textColor: BRONZE, fontStyle: 'bold', lineWidth: { bottom: 0.4 }, lineColor: BRONZE },
      bodyStyles: { textColor: INK, lineWidth: { bottom: 0.2 }, lineColor: ROW_LINE, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 3) {
          d.cell.styles.textColor = achieved ? GREEN : RED;
        }
      },
    });
    y = doc.lastAutoTable.finalY + 6;

    if (!achieved) {
      y = ensureSpace(doc, y, 14);
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(...RED);
      doc.setLineWidth(0.3);
      doc.rect(MARGIN_X, y, pageWidth - MARGIN_X * 2, 10, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...RED);
      doc.text('⚠ Target kunjungan periode ini belum tercapai.', MARGIN_X + 4, y + 6.5);
      y += 16;
    } else {
      y += 4;
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text('Belum ada target yang ditetapkan untuk periode ini.', MARGIN_X, y);
    y += 10;
  }

  // ── Section 3: Kepatuhan & Kecepatan Pengisian SOAP ──
  y = ensureSpace(doc, y, 45);
  y = sectionTitle(doc, y, '3. Kepatuhan Dokumentasi SOAP');

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN_X, right: MARGIN_X },
    head: [['SOAP Terisi', 'SOAP Belum Terisi']],
    body: [[String(soap.filledCount), String(soap.unfilledCount)]],
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9 },
    headStyles: { textColor: BRONZE, fontStyle: 'bold', lineWidth: { bottom: 0.4 }, lineColor: BRONZE },
    bodyStyles: { textColor: INK, lineWidth: { bottom: 0.2 }, lineColor: ROW_LINE, fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'center' }, 1: { halign: 'center' } },
  });
  y = doc.lastAutoTable.finalY + 6;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN_X, right: MARGIN_X },
    head: [['Kecepatan Pengisian SOAP', 'Jumlah Sesi']],
    body: soap.delayBuckets.map((b) => [b.label, String(b.count)]),
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8.5 },
    headStyles: { textColor: BRONZE, fontStyle: 'bold', lineWidth: { bottom: 0.4 }, lineColor: BRONZE },
    bodyStyles: { textColor: INK, lineWidth: { bottom: 0.2 }, lineColor: ROW_LINE },
    columnStyles: { 1: { halign: 'right' } },
  });
  y = doc.lastAutoTable.finalY + 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const avgLabel = soap.avgDelayHours !== null ? `${soap.avgDelayHours} jam` : '-';
  doc.text(`Rata-rata waktu pengisian: ${avgLabel}`, MARGIN_X, y);
  y += 4.5;
  if (soap.noTimeDataCount > 0) {
    doc.text(
      `${soap.noTimeDataCount} sesi tidak dapat dihitung kecepatan pengisiannya karena data jam tidak tersedia.`,
      MARGIN_X, y, { maxWidth: pageWidth - MARGIN_X * 2 }
    );
    y += 4.5;
  }
  y += 3;

  // ── Perbandingan kecepatan pengisian SOAP dengan bulan sebelumnya ──
  const cmp = soap.comparison;
  if (cmp) {
    y = ensureSpace(doc, y, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text('Perbandingan Kecepatan Pengisian SOAP dengan Bulan Sebelumnya', MARGIN_X, y);
    y += 4;

    const currentPctLabel = soap.within24Pct !== null ? `${soap.within24Pct}%` : '-';
    const prevPctLabel = cmp.hasPreviousData && cmp.previousWithin24Pct !== null ? `${cmp.previousWithin24Pct}%` : 'Tidak ada data';
    const currentAvgLabel2 = soap.avgDelayHours !== null ? `${soap.avgDelayHours} jam` : '-';
    const prevAvgLabel = cmp.hasPreviousData && cmp.previousAvgDelayHours !== null ? `${cmp.previousAvgDelayHours} jam` : '-';

    let deltaLabel = '-';
    if (soap.within24Pct !== null && cmp.hasPreviousData && cmp.previousWithin24Pct !== null) {
      const delta = Math.round((soap.within24Pct - cmp.previousWithin24Pct) * 10) / 10;
      deltaLabel = delta > 0 ? `Membaik +${delta}%` : delta < 0 ? `Menurun ${delta}%` : 'Tetap';
    }

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_X, right: MARGIN_X },
      head: [['Periode', '% Sesi < 24 Jam', 'Rata-rata Waktu Pengisian']],
      body: [
        ['Bulan Ini', currentPctLabel, currentAvgLabel2],
        [`Bulan Sebelumnya (${formatPeriodLabel(cmp.previousPeriod.startDate, cmp.previousPeriod.endDate)})`, prevPctLabel, prevAvgLabel],
      ],
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 8 },
      headStyles: { textColor: BRONZE, fontStyle: 'bold', lineWidth: { bottom: 0.4 }, lineColor: BRONZE },
      bodyStyles: { textColor: INK, lineWidth: { bottom: 0.2 }, lineColor: ROW_LINE },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
    });
    y = doc.lastAutoTable.finalY + 4;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Perubahan % sesi < 24 jam dibanding bulan sebelumnya: ${deltaLabel}`, MARGIN_X, y);
    y += 7;

    // Catatan otomatis kalau target pengisian < 24 jam belum tercapai
    const soapTargetMet = soap.within24Pct !== null && soap.within24Pct >= 100;
    if (!soapTargetMet) {
      y = ensureSpace(doc, y, 18);
      const warnText = `⚠ Kecepatan pengisian SOAP belum mencapai target < 24 jam (baru ${currentPctLabel} sesi yang terisi dalam < 24 jam). Terapis diharapkan meningkatkan kecepatan pengerjaan dokumentasi SOAP agar seluruh sesi terisi dalam waktu kurang dari 24 jam.`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      const warnLines = doc.splitTextToSize(warnText, pageWidth - MARGIN_X * 2 - 8);
      const warnBoxH = Math.max(10, warnLines.length * 4.2 + 5);
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(...RED);
      doc.setLineWidth(0.3);
      doc.rect(MARGIN_X, y, pageWidth - MARGIN_X * 2, warnBoxH, 'FD');
      doc.setTextColor(...RED);
      doc.text(warnLines, MARGIN_X + 4, y + 5.5);
      y += warnBoxH + 6;
    }
  }
  y += 3;

  // ── Section 4: Kehadiran ──
  y = ensureSpace(doc, y, 30);
  y = sectionTitle(doc, y, '4. Kehadiran');

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN_X, right: MARGIN_X },
    head: [['Hari Tercatat Hadir', 'Jumlah Keterlambatan', 'Rata-rata Telat']],
    body: [[
      String(attendance.totalRecords),
      String(attendance.lateCount),
      attendance.lateCount > 0 ? `${attendance.avgLateMinutes} menit` : '-',
    ]],
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9 },
    headStyles: { textColor: BRONZE, fontStyle: 'bold', lineWidth: { bottom: 0.4 }, lineColor: BRONZE },
    bodyStyles: { textColor: INK, lineWidth: { bottom: 0.2 }, lineColor: ROW_LINE, fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'center' }, 1: { halign: 'center' }, 2: { halign: 'center' } },
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Section 5: Evaluasi KPI (hanya kalau target tercapai) ──
  if (kpi && kpi.length > 0) {
    y = ensureSpace(doc, y, 40);
    y = sectionTitle(doc, y, '5. Evaluasi KPI / Remunerasi');
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_X, right: MARGIN_X },
      head: [['Kriteria', 'Target', 'Realisasi', 'Bobot']],
      body: kpi.map((k) => [
        k.name,
        `${k.targetValue ?? '-'} ${k.unit || ''}`.trim(),
        k.realizationValue !== null ? `${k.realizationValue} ${k.unit || ''}`.trim() : '-',
        `${k.weightPercent ?? '-'}%`,
      ]),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 8.5 },
      headStyles: { textColor: BRONZE, fontStyle: 'bold', lineWidth: { bottom: 0.4 }, lineColor: BRONZE },
      bodyStyles: { textColor: INK, lineWidth: { bottom: 0.2 }, lineColor: ROW_LINE },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' } },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // ── Section 6: Catatan Kedisiplinan (hanya kalau ada SP di periode ini) ──
  if (warningLetters.length > 0) {
    y = ensureSpace(doc, y, 40);
    y = sectionTitle(doc, y, '6. Catatan Kedisiplinan');
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_X, right: MARGIN_X },
      head: [['No. Surat', 'Level', 'Tanggal Pelanggaran', 'Keterangan']],
      body: warningLetters.map((w) => [
        w.letter_number || '-',
        w.level || '-',
        formatDate(w.violation_date),
        w.violation_description || '-',
      ]),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 8 },
      headStyles: { textColor: RED, fontStyle: 'bold', lineWidth: { bottom: 0.4 }, lineColor: RED },
      bodyStyles: { textColor: INK, lineWidth: { bottom: 0.2 }, lineColor: ROW_LINE },
      columnStyles: { 3: { cellWidth: 60 } },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // ── Section 7: Catatan & Rekomendasi Pengembangan ──
  y = ensureSpace(doc, y, 40);
  y = sectionTitle(doc, y, '7. Catatan & Rekomendasi Pengembangan');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  const notesText = notes && notes.trim() ? notes.trim() : '-';
  const notesLines = doc.splitTextToSize(notesText, pageWidth - MARGIN_X * 2 - 8);
  doc.setDrawColor(...BRONZE_SOFT);
  doc.setFillColor(...CREAM);
  const notesBoxH = Math.max(20, notesLines.length * 4.6 + 8);
  y = ensureSpace(doc, y, notesBoxH + 4);
  doc.rect(MARGIN_X, y, pageWidth - MARGIN_X * 2, notesBoxH, 'FD');
  doc.text(notesLines, MARGIN_X + 4, y + 7);
  y += notesBoxH + 16;

  // ── Signatures ──
  y = ensureSpace(doc, y, 40);
  const sigWidth = 55;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text('Mengetahui,', MARGIN_X + sigWidth / 2, y, { align: 'center' });
  doc.text('Manajemen / Owner', MARGIN_X + sigWidth / 2, y + 4.5, { align: 'center' });
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_X, y + 20, MARGIN_X + sigWidth, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...INK);
  doc.text(`( ${clinicName} )`, MARGIN_X + sigWidth / 2, y + 25, { align: 'center' });

  const rightSigX = pageWidth - MARGIN_X - sigWidth;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text('Diterima oleh,', rightSigX + sigWidth / 2, y, { align: 'center' });
  doc.text('Terapis', rightSigX + sigWidth / 2, y + 4.5, { align: 'center' });
  doc.line(rightSigX, y + 20, rightSigX + sigWidth, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...INK);
  doc.text(`( ${therapist?.name || '-'} )`, rightSigX + sigWidth / 2, y + 25, { align: 'center' });

  const pageHeight = doc.internal.pageSize.height;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(
    'Dokumen ini bersifat rahasia dan hanya diperuntukkan bagi terapis yang bersangkutan.',
    pageWidth / 2,
    pageHeight - 12,
    { align: 'center' }
  );

  return doc;
};

export const therapistMonthlyReportFileName = (data) => {
  const period = data?.period?.startDate
    ? format(new Date(data.period.startDate), 'MMMyyyy', { locale: idLocale })
    : 'periode';
  const name = (data?.therapist?.name || 'terapis').replace(/[^a-zA-Z0-9]+/g, '-');
  return `Laporan-Evaluasi-${name}-${period}.pdf`;
};
