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
 * Kotak peringatan dengan ikon seru vektor (bukan karakter unicode ⚠) supaya
 * pengukuran lebar teks oleh font standar jsPDF akurat & tidak meluber dari kotak.
 */
const drawWarningBox = (doc, x, y, width, text, opts = {}) => {
  const { fontSize = 8, color = RED, bg = [254, 242, 242] } = opts;
  const iconSize = 6;
  const paddingX = 4;
  const paddingY = 4;
  const textX = x + paddingX + iconSize + 3;
  const textWidth = width - paddingX * 2 - iconSize - 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, textWidth);
  const lineHeight = fontSize * 0.525;
  const textBlockH = lines.length * lineHeight;
  const boxH = Math.max(iconSize + paddingY * 2, textBlockH + paddingY * 2);

  doc.setFillColor(...bg);
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, boxH, 1.5, 1.5, 'FD');

  const iconCx = x + paddingX + iconSize / 2;
  const iconCy = y + boxH / 2;
  doc.setFillColor(...color);
  doc.circle(iconCx, iconCy, iconSize / 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(iconSize * 1.6);
  doc.setTextColor(255, 255, 255);
  doc.text('!', iconCx, iconCy + iconSize * 0.32, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  doc.text(lines, textX, y + (boxH - textBlockH) / 2 + lineHeight * 0.75);

  return y + boxH;
};

/**
 * Daftar bar horizontal (label - bar - nilai). Dipakai untuk breakdown tipe
 * pasien & distribusi kecepatan pengisian SOAP supaya lebih mudah dibaca
 * secara visual dibanding tabel angka polos.
 */
const drawHBarList = (doc, x, y, width, items, opts = {}) => {
  const { barHeight = 4.2, gap = 3.6, labelWidth = 46, valueColW = 18, fontSize = 7.5, maxValue, valueFormatter = (v) => String(v) } = opts;
  const max = maxValue ?? Math.max(...items.map((i) => i.value), 1);
  const barAreaW = width - labelWidth - valueColW;
  let cy = y;

  items.forEach((item) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(...INK);
    const labelLines = doc.splitTextToSize(item.label, labelWidth - 2);
    doc.text(labelLines[0], x, cy + barHeight - 0.7);

    doc.setFillColor(...BRONZE_SOFT);
    doc.rect(x + labelWidth, cy, barAreaW, barHeight, 'F');
    const w = max > 0 && item.value > 0 ? Math.max((item.value / max) * barAreaW, 1.2) : 0;
    if (w > 0) {
      doc.setFillColor(...(item.color || BRONZE));
      doc.rect(x + labelWidth, cy, w, barHeight, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);
    doc.setTextColor(...INK);
    doc.text(valueFormatter(item.value), x + labelWidth + barAreaW + 2, cy + barHeight - 0.7);

    cy += barHeight + gap;
  });

  return cy - gap;
};

/**
 * Bar chart vertikal (mis. kunjungan per hari) dengan bar tertinggi disorot warna aksen.
 */
const drawVBarChart = (doc, x, y, width, chartHeight, items, opts = {}) => {
  const { fontSize = 7.5, barColor = BRONZE, highlightColor = BRONZE, trackColor = BRONZE_SOFT } = opts;
  const max = Math.max(...items.map((i) => i.value), 1);
  const gap = 2.5;
  const barW = (width - gap * (items.length - 1)) / items.length;
  const valueH = 5;
  const labelH = 6;
  const maxBarH = chartHeight - valueH - labelH;

  items.forEach((item, i) => {
    const bx = x + i * (barW + gap);
    const barH = max > 0 ? (item.value / max) * maxBarH : 0;
    const by = y + valueH + (maxBarH - barH);

    doc.setFillColor(...trackColor);
    doc.rect(bx, y + valueH, barW, maxBarH, 'F');

    const isMax = item.value === max && item.value > 0;
    if (barH > 0) {
      doc.setFillColor(...(isMax ? highlightColor : barColor));
      doc.rect(bx, by, barW, barH, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);
    doc.setTextColor(...(isMax ? highlightColor : MUTED));
    doc.text(String(item.value), bx + barW / 2, y + valueH - 1.2, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(...INK);
    doc.text(item.label, bx + barW / 2, y + valueH + maxBarH + 5, { align: 'center' });
  });

  return y + chartHeight;
};

/**
 * Progress bar pil (rounded) untuk menampilkan persentase pencapaian secara visual.
 */
const drawProgressBar = (doc, x, y, width, height, pct, opts = {}) => {
  const { trackColor = BRONZE_SOFT, fillColor } = opts;
  const clamped = Math.max(0, Math.min(100, pct));
  const color = fillColor || (clamped >= 100 ? GREEN : clamped >= 70 ? BRONZE : RED);
  const r = height / 2;
  doc.setFillColor(...trackColor);
  doc.roundedRect(x, y, width, height, r, r, 'F');
  const fillW = (clamped / 100) * width;
  if (fillW > 0.5) {
    doc.setFillColor(...color);
    doc.roundedRect(x, y, Math.max(fillW, height), height, r, r, 'F');
  }
  return color;
};

/**
 * Generates the "Laporan Evaluasi & Kinerja Bulanan Terapis" PDF.
 * @param {object} data - hasil getTherapistMonthlyReportData()
 * @param {string} notes - catatan kualitatif dari owner (No. 8)
 */
export const generateTherapistMonthlyReportPDF = (data, notes = '') => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.width;
  const { therapist = {}, clinic = {}, period, summary, target, soap, kpi, warningLetters = [] } = data;

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
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text('Tipe Pasien', MARGIN_X, y);
    y += 4;
    y = ensureSpace(doc, y, summary.typeBreakdown.length * 7.8 + 4);
    y = drawHBarList(
      doc, MARGIN_X, y, pageWidth - MARGIN_X * 2,
      summary.typeBreakdown.map(([label, count]) => ({
        label,
        value: count,
        color: BRONZE,
      })),
      {
        valueFormatter: (v) => `${v} (${summary.totalVisits > 0 ? Math.round((v / summary.totalVisits) * 100) : 0}%)`,
        labelWidth: 40,
        valueColW: 26,
      }
    );
    y += 8;
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
  y += 8;

  // ── Perbandingan kunjungan & pasien dengan bulan sebelumnya ──
  const visitCmp = summary.comparison;
  if (visitCmp) {
    y = ensureSpace(doc, y, 26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text('Perbandingan Kunjungan dengan Bulan Sebelumnya', MARGIN_X, y);
    y += 4;

    const visitDelta = summary.totalVisits - visitCmp.previousTotalVisits;
    const patientDelta = summary.totalUniquePatients - visitCmp.previousTotalUniquePatients;
    const deltaText = (v) => (v > 0 ? `Naik ${v}` : v < 0 ? `Turun ${Math.abs(v)}` : 'Tetap');

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_X, right: MARGIN_X },
      head: [['Periode', 'Total Kunjungan', 'Pasien Ditangani']],
      body: [
        ['Bulan Ini', String(summary.totalVisits), String(summary.totalUniquePatients)],
        [`Bulan Sebelumnya (${formatPeriodLabel(visitCmp.previousPeriod.startDate, visitCmp.previousPeriod.endDate)})`, String(visitCmp.previousTotalVisits), String(visitCmp.previousTotalUniquePatients)],
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
    doc.text(`Kunjungan: ${deltaText(visitDelta)} · Pasien Ditangani: ${deltaText(patientDelta)}`, MARGIN_X, y);
    y += 10;
  }

  // ── Pola hari kunjungan (padat vs sepi) ──
  const schedulePattern = summary.schedulePattern;
  if (schedulePattern && schedulePattern.byDay.some((d) => d.count > 0)) {
    y = ensureSpace(doc, y, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text('Pola Hari Kunjungan', MARGIN_X, y);
    y += 4;

    y = drawVBarChart(
      doc, MARGIN_X, y, pageWidth - MARGIN_X * 2, 32,
      schedulePattern.byDay.map((d) => ({ label: d.day, value: d.count }))
    );
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    if (schedulePattern.busiestDay) {
      doc.text(
        `Hari paling padat: ${schedulePattern.busiestDay.day} (${schedulePattern.busiestDay.count} kunjungan).`,
        MARGIN_X, y
      );
      y += 5;
    }
    if (schedulePattern.quietestDay) {
      doc.text(
        `Hari paling sepi: ${schedulePattern.quietestDay.day} (${schedulePattern.quietestDay.count} kunjungan).`,
        MARGIN_X, y
      );
      y += 5;
    }
    y += 4;
  }

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

    y = ensureSpace(doc, y, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text('Pencapaian Target', MARGIN_X, y);
    y += 3;
    drawProgressBar(doc, MARGIN_X, y, pageWidth - MARGIN_X * 2, 5, target.achievement_percentage, {
      fillColor: achieved ? GREEN : RED,
    });
    y += 10;

    if (!achieved) {
      y = ensureSpace(doc, y, 14);
      y = drawWarningBox(doc, MARGIN_X, y, pageWidth - MARGIN_X * 2, 'Target kunjungan periode ini belum tercapai.', { fontSize: 8.5 });
      y += 6;
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

  const soapStatBoxW = (pageWidth - MARGIN_X * 2 - 8) / 2;
  doc.setFillColor(...CREAM);
  doc.setDrawColor(...BRONZE_SOFT);
  doc.rect(MARGIN_X, y, soapStatBoxW, 15, 'FD');
  doc.rect(MARGIN_X + soapStatBoxW + 8, y, soapStatBoxW, 15, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...GREEN);
  doc.text(String(soap.filledCount), MARGIN_X + 6, y + 9.5);
  doc.setTextColor(soap.unfilledCount > 0 ? RED[0] : INK[0], soap.unfilledCount > 0 ? RED[1] : INK[1], soap.unfilledCount > 0 ? RED[2] : INK[2]);
  doc.text(String(soap.unfilledCount), MARGIN_X + soapStatBoxW + 14, y + 9.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text('SOAP Terisi', MARGIN_X + 6, y + 13.5);
  doc.text('SOAP Belum Terisi', MARGIN_X + soapStatBoxW + 14, y + 13.5);
  y += 15 + 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  doc.text('Distribusi Kecepatan Pengisian SOAP', MARGIN_X, y);
  y += 4;
  const bucketColors = { '< 24 Jam': GREEN, '24 – 48 Jam': [180, 140, 40], '48 – 72 Jam': [200, 110, 40], '> 72 Jam': RED };
  y = drawHBarList(
    doc, MARGIN_X, y, pageWidth - MARGIN_X * 2,
    soap.delayBuckets.map((b) => ({ label: b.label, value: b.count, color: bucketColors[b.label] || BRONZE })),
  );
  y += 5;

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
      y = ensureSpace(doc, y, 20);
      const warnText = `Kecepatan pengisian SOAP belum mencapai target < 24 jam (baru ${currentPctLabel} sesi yang terisi dalam < 24 jam). Terapis diharapkan meningkatkan kecepatan pengerjaan dokumentasi SOAP agar seluruh sesi terisi dalam waktu kurang dari 24 jam.`;
      y = drawWarningBox(doc, MARGIN_X, y, pageWidth - MARGIN_X * 2, warnText);
      y += 6;
    }
  }
  y += 3;

  // ── Section 4: Evaluasi KPI (hanya kalau target tercapai) ──
  if (kpi && kpi.length > 0) {
    y = ensureSpace(doc, y, 40);
    y = sectionTitle(doc, y, '4. Evaluasi KPI / Remunerasi');
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

  // ── Section 5: Catatan Kedisiplinan (hanya kalau ada SP di periode ini) ──
  if (warningLetters.length > 0) {
    y = ensureSpace(doc, y, 40);
    y = sectionTitle(doc, y, '5. Catatan Kedisiplinan');
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

  // ── Section 6: Catatan & Rekomendasi Pengembangan ──
  y = ensureSpace(doc, y, 40);
  y = sectionTitle(doc, y, '6. Catatan & Rekomendasi Pengembangan');
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
