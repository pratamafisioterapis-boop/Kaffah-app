import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { BUSINESS } from '@/lib/businessInfo';
import { mergeLists } from '@/lib/educationMerge';
import { collectGlossary, findGlossaryEntry, explainTestResult } from '@/lib/soapGlossary';

// PDF "Laporan Terapi" untuk pasien klinik Kaffah. Berisi isi SOAP yang sudah dibuat terapis,
// ditata agar mudah dibaca orang awam: istilah medis tetap dipakai, tetapi diberi arti sederhana
// (kolom penjelasan hasil tes, penjelasan tiap tindakan, dan kamus istilah di akhir dokumen).

const NAVY = [4, 70, 135];
const TEAL = [0, 169, 232];
const TEAL_SOFT = [224, 243, 252];
const MINT = [125, 211, 252];
const INK = [30, 41, 59];
const MUTED = [100, 116, 139];
const LINE = [226, 232, 240];
const ZEBRA = [247, 250, 252];
const GREEN = [21, 128, 61];
const AMBER = [180, 83, 9];
const RED = [185, 28, 28];
const RED_SOFT = [254, 242, 242];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;
const TOP = 30;
const BOTTOM = PAGE_H - 20;
const PT = 0.3528;

// jsPDF memakai font standar (WinAnsi): buang karakter di luar Latin-1 dan rapikan tanda baca.
const clean = (s) =>
  String(s ?? '')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[•●▪·]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\(\.{3,}\)/g, '-')
    .replace(/[^\n\t\x20-\x7E¡-ÿ]/g, '');

const lineHeight = (size) => size * PT * 1.4;

// ── Parser teks SOAP (hasil template/ketikan terapis) menjadi blok terstruktur ──
export const parseClinicalText = (text) => {
  const lines = clean(text).split('\n').map((l) => l.trim()).filter((l) => l && !/^@@/.test(l));
  const isBullet = (l) => /^(-|\*)\s+\S/.test(l);
  const isKv = (l) => {
    const m = l.match(/^([^:]{2,60}?)\s*:\s+(\S.*)$/);
    return !!m && m[1].trim().split(/\s+/).length <= 7 && !/^(-|\*|\d+[.)])\s/.test(l);
  };
  const blocks = [];
  lines.forEach((line, i) => {
    const next = lines[i + 1];
    if (isBullet(line)) {
      blocks.push({ type: 'bullet', text: line.replace(/^(-|\*)\s+/, '') });
      return;
    }
    const num = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (num) {
      blocks.push({ type: 'num', n: num[1], text: num[2] });
      return;
    }
    if (/^[^:]{2,60}:$/.test(line)) {
      blocks.push({ type: 'heading', text: line.replace(/:$/, '') });
      return;
    }
    if (isKv(line)) {
      const m = line.match(/^([^:]{2,60}?)\s*:\s+(\S.*)$/);
      blocks.push({ type: 'kv', label: m[1].trim(), value: m[2].trim() });
      return;
    }
    const words = line.split(/\s+/).length;
    const looksLikeTitle = words <= 5 && line.length <= 40 && !/[.!?,;]$/.test(line);
    if (looksLikeTitle && next && (isBullet(next) || isKv(next))) {
      blocks.push({ type: 'heading', text: line });
      return;
    }
    blocks.push({ type: 'para', text: line });
  });
  return blocks;
};

const formatVisitDate = (value) => {
  if (!value) return '-';
  try {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T00:00:00`) : new Date(value);
    return format(d, 'd MMMM yyyy', { locale: idLocale });
  } catch (_e) {
    return '-';
  }
};

const safeFileName = (s) => clean(s).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Pasien';

// ── Pembantu gambar halaman ──
class Layout {
  constructor(doc) {
    this.doc = doc;
    this.y = TOP;
  }

  ensure(h) {
    if (this.y + h > BOTTOM) {
      this.doc.addPage();
      this.y = TOP;
    }
  }

  gap(h) {
    this.y += h;
  }

  text(str, x, size, { bold = false, color = INK, align = 'left', italic = false } = {}) {
    const { doc } = this;
    doc.setFont('helvetica', bold ? (italic ? 'bolditalic' : 'bold') : (italic ? 'italic' : 'normal'));
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(str, x, this.y + size * PT * 0.85, { align });
  }

  para(str, { size = 10, bold = false, color = INK, indent = 0, italic = false, after = 1.6 } = {}) {
    const { doc } = this;
    doc.setFont('helvetica', bold ? 'bold' : (italic ? 'italic' : 'normal'));
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(clean(str), CONTENT_W - indent);
    lines.forEach((l) => {
      this.ensure(lineHeight(size));
      this.text(l, MARGIN + indent, size, { bold, color, italic });
      this.y += lineHeight(size);
    });
    this.y += after;
  }

  bullet(str, { size = 10, indent = 0, color = INK } = {}) {
    const { doc } = this;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    const textX = MARGIN + indent + 5;
    const lines = doc.splitTextToSize(clean(str), CONTENT_W - indent - 5);
    lines.forEach((l, i) => {
      this.ensure(lineHeight(size));
      if (i === 0) {
        doc.setFillColor(...TEAL);
        doc.circle(MARGIN + indent + 1.4, this.y + size * PT * 0.55, 0.8, 'F');
      }
      this.text(l, textX, size, { color });
      this.y += lineHeight(size);
    });
    this.y += 1.2;
  }

  numbered(n, str, { size = 10 } = {}) {
    const { doc } = this;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(clean(str), CONTENT_W - 8);
    lines.forEach((l, i) => {
      this.ensure(lineHeight(size));
      if (i === 0) this.text(`${n}.`, MARGIN, size, { bold: true, color: TEAL });
      this.text(l, MARGIN + 8, size);
      this.y += lineHeight(size);
    });
    this.y += 1.2;
  }

  section(title, hint) {
    this.ensure(22);
    this.gap(3);
    const { doc } = this;
    doc.setFillColor(...TEAL);
    doc.roundedRect(MARGIN, this.y, 2.2, 7, 1, 1, 'F');
    this.text(clean(title), MARGIN + 5, 13, { bold: true, color: NAVY });
    this.y += 8;
    if (hint) {
      this.text(clean(hint), MARGIN + 5, 8.5, { color: MUTED, italic: true });
      this.y += 5;
    }
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, this.y, PAGE_W - MARGIN, this.y);
    this.y += 4;
  }

  subheading(title) {
    this.ensure(12);
    this.gap(1.5);
    this.text(clean(title), MARGIN, 10.5, { bold: true, color: TEAL });
    this.y += lineHeight(10.5) + 0.8;
  }

  // Tabel pemeriksaan: Pemeriksaan | Hasil | Penjelasan. Kolom penjelasan hanya muncul bila ada isinya.
  kvTable(rows) {
    const { doc } = this;
    const hasExplain = rows.some((r) => r.explain);
    const colA = hasExplain ? 58 : 80;
    const colB = hasExplain ? 36 : CONTENT_W - colA;
    const colC = CONTENT_W - colA - colB;
    const size = 9;
    rows.forEach((row, i) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(size);
      const aLines = doc.splitTextToSize(row.label, colA - 4);
      const bLines = doc.splitTextToSize(row.value, colB - 4);
      const cLines = hasExplain && row.explain ? doc.splitTextToSize(row.explain, colC - 4) : [];
      const n = Math.max(aLines.length, bLines.length, cLines.length, 1);
      const h = n * lineHeight(size) + 3;
      this.ensure(h);
      if (i % 2 === 0) {
        doc.setFillColor(...ZEBRA);
        doc.rect(MARGIN, this.y, CONTENT_W, h, 'F');
      }
      const save = this.y;
      this.y += 1.5;
      const draw = (lines, x, opts) => {
        lines.forEach((l, k) => {
          this.text(l, x, size, opts);
          this.y += lineHeight(size);
        });
        this.y = save + 1.5;
      };
      draw(aLines, MARGIN + 2, { bold: true, color: INK });
      const result = /^\s*positif/i.test(row.value) ? AMBER : /^\s*negatif/i.test(row.value) ? GREEN : INK;
      draw(bLines, MARGIN + colA + 2, { bold: result !== INK, color: result });
      if (cLines.length) draw(cLines, MARGIN + colA + colB + 2, { color: MUTED });
      this.y = save + h;
    });
    this.y += 2;
  }

  callout(title, items, { color = RED, bg = RED_SOFT } = {}) {
    const { doc } = this;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const wrapped = items.map((it) => doc.splitTextToSize(clean(it), CONTENT_W - 14));
    const bodyH = wrapped.reduce((s, l) => s + l.length * lineHeight(9.5) + 1, 0);
    const h = 11 + bodyH + 3;
    this.ensure(Math.min(h, 60));
    doc.setFillColor(...bg);
    doc.setDrawColor(...color);
    doc.setLineWidth(0.4);
    doc.roundedRect(MARGIN, this.y, CONTENT_W, h, 2, 2, 'FD');
    const top = this.y;
    this.y += 3.5;
    this.text(clean(title), MARGIN + 5, 10.5, { bold: true, color });
    this.y += lineHeight(10.5) + 1.5;
    wrapped.forEach((lines) => {
      lines.forEach((l, i) => {
        if (i === 0) {
          doc.setFillColor(...color);
          doc.circle(MARGIN + 6.2, this.y + 9.5 * PT * 0.55, 0.8, 'F');
        }
        this.text(l, MARGIN + 9, 9.5, { color: INK });
        this.y += lineHeight(9.5);
      });
      this.y += 1;
    });
    this.y = top + h + 3;
  }
}

const drawLogo = (doc, logo, x, y, size) => {
  if (!logo) return;
  try {
    doc.addImage(logo, /^data:image\/png/i.test(logo) ? 'PNG' : 'JPEG', x, y, size, size);
  } catch (_e) {
    /* logo opsional */
  }
};

// Kotak-kotak kecil khas logo Kaffah sebagai hiasan.
const drawSquares = (doc, x, y, color = TEAL) => {
  doc.setFillColor(...color);
  [[0, 0, 4], [6, 4, 3], [2, 9, 3.4], [9, 11, 2.4], [14, 6, 2]].forEach(([dx, dy, s]) => doc.rect(x + dx, y + dy, s, s, 'F'));
};

const drawCover = (doc, { patientName, visitDate, diagnosisText, logo }) => {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  // Bagian atas: logo (sudah memuat nama klinik)
  drawLogo(doc, logo, MARGIN - 3, 14, 38);

  // Judul
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(38);
  doc.setTextColor(...NAVY);
  doc.text('Physiotherapy', MARGIN, 84);
  doc.text('Treatment Update', MARGIN, 99);
  doc.setFillColor(...TEAL);
  doc.roundedRect(MARGIN, 105, 28, 1.6, 0.8, 0.8, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...MUTED);
  doc.text('Laporan perkembangan terapi Anda', MARGIN, 117);

  // Kartu informasi (label biru tua | isi biru muda)
  const cards = [
    ['Nama Pasien', patientName],
    ['Tanggal', visitDate],
    ['Diagnosis Klinis', diagnosisText],
  ];
  let y = 134;
  doc.setFont('helvetica', 'normal');
  cards.forEach(([label, value]) => {
    doc.setFontSize(12);
    const lines = doc.splitTextToSize(clean(value) || '-', 108);
    const h = Math.max(15, lines.length * 6 + 6);
    doc.setFillColor(...NAVY);
    doc.roundedRect(MARGIN, y, 52, h, 2, 2, 'F');
    doc.setFillColor(...TEAL_SOFT);
    doc.roundedRect(MARGIN + 50, y, CONTENT_W - 50, h, 2, 2, 'F');
    doc.setFillColor(...NAVY);
    doc.rect(MARGIN + 48, y, 4, h, 'F');
    doc.setFillColor(...TEAL_SOFT);
    doc.rect(MARGIN + 50, y, 2, h, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(255, 255, 255);
    doc.text(label, MARGIN + 6, y + h / 2 + 1.6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text(lines, MARGIN + 58, y + h / 2 - ((lines.length - 1) * 6) / 2 + 1.6);
    y += h + 5;
  });

  // Pita bawah
  doc.setFillColor(...NAVY);
  doc.rect(0, 238, PAGE_W, PAGE_H - 238, 'F');
  doc.setFillColor(...TEAL);
  doc.rect(0, 238, PAGE_W, 2.5, 'F');
  drawSquares(doc, PAGE_W - 40, 252, TEAL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('Pulih bersama, bergerak lebih baik.', MARGIN, 256);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(186, 230, 253);
  doc.text(
    doc.splitTextToSize('Dokumen ini merangkum hasil pemeriksaan, tindakan, dan saran dari fisioterapis Anda.', 110),
    MARGIN,
    264
  );
  doc.setFontSize(9);
  doc.text(`${BUSINESS.url.replace('https://', '')}  |  WhatsApp ${BUSINESS.whatsappDisplay}`, MARGIN, 280);
};

const drawBackCover = (doc, logo) => {
  doc.addPage();
  const cx = PAGE_W / 2;

  // Pita atas
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 10, 'F');
  doc.setFillColor(...TEAL);
  doc.rect(0, 10, PAGE_W, 2, 'F');

  // Logo di atas latar putih (tanpa kotak) agar proporsional dan menyatu
  drawLogo(doc, logo, cx - 20, 28, 40);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(25);
  doc.setTextColor(...NAVY);
  doc.text('Jadwalkan Kontrol Berikutnya', cx, 88, { align: 'center' });
  doc.setFillColor(...TEAL);
  doc.roundedRect(cx - 14, 93, 28, 1.6, 0.8, 0.8, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...MUTED);
  doc.text(
    doc.splitTextToSize('Terapi yang rutin dan terukur membantu pemulihan Anda lebih cepat dan hasilnya lebih bertahan lama.', 130),
    cx,
    104,
    { align: 'center' }
  );

  // Kartu kontak
  const rows = [
    ['Alamat', [BUSINESS.addressDisplay]],
    ['Jam Operasional', BUSINESS.hoursDisplay.map((h) => `${h.days}: ${h.hours} WITA`)],
    ['WhatsApp', [BUSINESS.whatsappDisplay]],
    ['Instagram', [`@${BUSINESS.instagramUrl.split('/').filter(Boolean).pop()}`]],
    ['Email', [BUSINESS.email]],
    ['Website', [BUSINESS.url.replace('https://', '')]],
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const laid = rows.map(([label, lines]) => {
    const wrapped = lines.flatMap((l) => doc.splitTextToSize(clean(l), CONTENT_W - 62));
    return { label, wrapped, h: Math.max(wrapped.length * 5.2, 5.2) + 6 };
  });
  const cardH = laid.reduce((sum, r) => sum + r.h, 0) + 8;
  const cardY = 128;
  doc.setFillColor(...TEAL_SOFT);
  doc.roundedRect(MARGIN, cardY, CONTENT_W, cardH, 3, 3, 'F');
  let y = cardY + 6;
  laid.forEach((r) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    doc.text(r.label, MARGIN + 8, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...INK);
    doc.text(r.wrapped, MARGIN + 54, y + 4);
    y += r.h;
  });

  // Pita bawah
  doc.setFillColor(...NAVY);
  doc.rect(0, PAGE_H - 22, PAGE_W, 22, 'F');
  doc.setFillColor(...TEAL);
  doc.rect(0, PAGE_H - 22, PAGE_W, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('Pulih bersama, bergerak lebih baik.', cx, PAGE_H - 10, { align: 'center' });
};

const drawPageChrome = (doc, logo, pageNo, totalPages) => {
  doc.setPage(pageNo + 1); // halaman isi dimulai setelah sampul
  drawLogo(doc, logo, MARGIN, 4, 17);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Laporan Terapi Pasien', PAGE_W - MARGIN, 14, { align: 'right' });
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, 22, PAGE_W - MARGIN, 22);

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, PAGE_H - 14, PAGE_W - MARGIN, PAGE_H - 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('Dokumen ini ringkasan terapi dan tidak menggantikan pemeriksaan dokter.', MARGIN, PAGE_H - 9.5);
  doc.text(`Halaman ${pageNo} dari ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 9.5, { align: 'right' });
};

const renderBlocks = (L, blocks, { explainTests = false } = {}) => {
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === 'kv') {
      const rows = [];
      while (i < blocks.length && blocks[i].type === 'kv') {
        const kv = blocks[i];
        const entry = explainTests ? findGlossaryEntry(kv.label) : null;
        const explain = entry?.test
          ? [entry.lay, explainTestResult(kv.value)].filter(Boolean).join(' ')
          : entry?.lay || explainTestResult(kv.value);
        rows.push({ label: kv.label, value: kv.value, explain });
        i += 1;
      }
      L.kvTable(rows);
      continue;
    }
    if (b.type === 'heading') L.subheading(b.text);
    else if (b.type === 'bullet') L.bullet(b.text);
    else if (b.type === 'num') L.numbered(b.n, b.text);
    else L.para(b.text);
    i += 1;
  }
};

const planItemRow = (L, name, dose, lay) => {
  const { doc } = L;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const layLines = lay ? doc.splitTextToSize(clean(lay), CONTENT_W - 14) : [];
  const h = 7 + layLines.length * lineHeight(9.5) + (dose ? 0 : -1);
  L.ensure(h + 3);
  doc.setFillColor(...TEAL_SOFT);
  doc.roundedRect(MARGIN, L.y, CONTENT_W, h + 1.5, 1.8, 1.8, 'F');
  doc.setFillColor(...TEAL);
  doc.roundedRect(MARGIN, L.y, 2, h + 1.5, 1, 1, 'F');
  const top = L.y;
  L.y += 2;
  const title = dose ? `${clean(name)}  (${clean(dose)})` : clean(name);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  const titleLines = doc.splitTextToSize(title, CONTENT_W - 12);
  L.text(titleLines[0], MARGIN + 6, 10.5, { bold: true, color: NAVY });
  L.y += lineHeight(10.5);
  layLines.forEach((l) => {
    L.text(l, MARGIN + 6, 9.5, { color: INK });
    L.y += lineHeight(9.5);
  });
  L.y = top + h + 1.5 + 2.5;
};

/**
 * data: {
 *   patient: { full_name, medical_record_number },
 *   visitDate: 'yyyy-MM-dd',
 *   therapistName,
 *   diagnoses: [label],
 *   record: { subjective, objective, assessment, plan, plan_data, education },
 *   exercises: { [id]: { n, h, d, p, c } },   // dari plan_exercises
 *   education: { [kunci diagnosa]: { name, what, cause, recovery, do, avoid, red } },
 *   logo: dataURL PNG (opsional)
 * }
 */
export const generateSoapPatientPDF = (data) => {
  const { patient, visitDate, therapistName, diagnoses = [], record = {}, exercises = {}, education = {}, logo } = data;
  const doc = new jsPDF('p', 'mm', 'a4');
  const patientName = clean(patient?.full_name || 'Pasien');
  const dateLabel = formatVisitDate(visitDate);
  const diagnosisText = diagnoses.length ? diagnoses.join(', ') : '-';
  const eduList = Object.values(education || {}).filter(Boolean);

  drawCover(doc, { patientName, visitDate: dateLabel, diagnosisText, logo });

  doc.addPage();
  const L = new Layout(doc);

  // ── Identitas ──
  const half = CONTENT_W / 2;
  const idRows = [
    ['Nama Pasien', patientName],
    ['No. Rekam Medis', clean(patient?.medical_record_number || '-')],
    ['Tanggal Kunjungan', dateLabel],
    ['Fisioterapis', clean(therapistName || '-')],
  ];
  doc.setFillColor(...ZEBRA);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, L.y, CONTENT_W, 26, 2, 2, 'FD');
  idRows.forEach(([label, value], i) => {
    const x = MARGIN + 5 + (i % 2) * half;
    const y = L.y + 4 + Math.floor(i / 2) * 11;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label, x, y + 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(value, half - 8)[0], x, y + 7);
  });
  L.y += 31;

  // ── Diagnosis ──
  if (diagnoses.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(clean(diagnoses.join('\n')), CONTENT_W - 12);
    const h = 11 + lines.length * lineHeight(11);
    L.ensure(h);
    const top = L.y;
    doc.setFillColor(...NAVY);
    doc.roundedRect(MARGIN, top, CONTENT_W, h, 2, 2, 'F');
    L.y += 3;
    L.text('DIAGNOSIS KLINIS', MARGIN + 6, 7.5, { bold: true, color: MINT });
    L.y += 5;
    lines.forEach((l) => {
      L.text(l, MARGIN + 6, 11, { bold: true, color: [255, 255, 255] });
      L.y += lineHeight(11);
    });
    L.y = top + h + 3;
  }

  return finalizeDoc({ doc, L, record, exercises, eduList, diagnoses, logo, patientName, visitDate });
};

const finalizeDoc = ({ doc, L, record, exercises, eduList, diagnoses, logo, patientName, visitDate }) => {
  // ── Keluhan (Subjective) ──
  const subjective = parseClinicalText(record.subjective);
  if (subjective.length) {
    L.section('Keluhan Anda', 'Anamnesis - hasil wawancara dengan terapis');
    renderBlocks(L, subjective);
  }

  // ── Pemeriksaan (Objective) ──
  const objective = parseClinicalText(record.objective);
  if (objective.length) {
    L.section('Hasil Pemeriksaan', 'Objective - temuan terapis saat memeriksa Anda');
    renderBlocks(L, objective, { explainTests: true });
  }

  // ── Tindakan (Plan) ──
  const planData = record.plan_data || null;
  const planItems = [];
  const glossaryTexts = [];
  if (planData) {
    const doseOf = (name) => (planData.dose?.[name] || '').trim();
    (planData.epa || []).forEach((name) => planItems.push({ name, dose: doseOf(name), lay: findGlossaryEntry(name)?.lay || '' }));
    (planData.manual || []).forEach((name) => planItems.push({ name, dose: doseOf(name), lay: findGlossaryEntry(name)?.lay || '' }));
  }
  const exerciseIds = Object.keys(planData?.exercises || {}).filter((id) => planData.exercises[id] && exercises[id]);
  if (planItems.length || exerciseIds.length || record.plan) {
    L.section('Tindakan Terapi Hari Ini', 'Plan - yang dilakukan dan dianjurkan terapis');
    if (planItems.length) {
      L.subheading('Terapi di klinik');
      planItems.forEach((it) => { planItemRow(L, it.name, it.dose, it.lay); glossaryTexts.push(it.name); });
    }
    if (exerciseIds.length) {
      L.subheading('Latihan yang diajarkan');
      exerciseIds.forEach((id) => {
        const ex = exercises[id];
        const dose = (planData.exDose?.[id] || '').trim() || ex.d || '';
        const lay = [ex.h && `Cara: ${ex.h}`, ex.c && `Perhatian: ${ex.c}`].filter(Boolean).join(' ');
        planItemRow(L, ex.n, dose, lay);
        glossaryTexts.push(ex.n, ex.h);
      });
    }
    if (planData?.notes?.trim()) {
      L.subheading('Catatan terapis');
      L.para(planData.notes);
    }
    // Rekam medis lama tanpa checklist: tampilkan teks Plan apa adanya.
    if (!planData && record.plan) renderBlocks(L, parseClinicalText(record.plan));
  }

  // ── Saran & rekomendasi (Edukasi) ──
  const educationBlocks = parseClinicalText(record.education);
  const doList = mergeLists(eduList.map((e) => e.do || []));
  const avoidList = mergeLists(eduList.map((e) => e.avoid || []));
  if (educationBlocks.length) {
    L.section('Saran dan Rekomendasi', 'Yang perlu Anda lakukan di rumah');
    renderBlocks(L, educationBlocks);
  } else if (doList.length || avoidList.length) {
    L.section('Saran dan Rekomendasi', 'Yang perlu Anda lakukan di rumah');
    if (doList.length) { L.subheading('Yang perlu dilakukan'); doList.forEach((t) => L.bullet(t)); }
    if (avoidList.length) { L.subheading('Yang sebaiknya dihindari'); avoidList.forEach((t) => L.bullet(t)); }
  }

  // ── Tanda bahaya ──
  const redList = mergeLists(eduList.map((e) => e.red || []));
  if (redList.length) {
    L.gap(2);
    L.callout('Segera hubungi kami atau dokter bila:', redList);
  }

  // ── Kamus istilah ──
  const terms = collectGlossary([
    record.subjective, record.objective, record.assessment, record.plan, record.education,
    diagnoses.join('\n'), glossaryTexts.join('\n'),
  ]).slice(0, 28);
  if (terms.length) {
    L.section('Kamus Istilah', 'Arti istilah medis yang muncul pada laporan ini');
    terms.forEach((g) => {
      const { doc } = L;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const lines = doc.splitTextToSize(clean(g.lay), CONTENT_W - 62);
      const h = Math.max(lines.length * lineHeight(9.5), lineHeight(9.5)) + 2;
      L.ensure(h);
      L.text(clean(g.term), MARGIN, 9.5, { bold: true, color: NAVY });
      const save = L.y;
      lines.forEach((l) => { L.text(l, MARGIN + 60, 9.5, { color: INK }); L.y += lineHeight(9.5); });
      L.y = save + h;
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, L.y - 1, PAGE_W - MARGIN, L.y - 1);
    });
  }

  L.gap(4);
  L.para('Setiap orang memiliki respons pemulihan yang berbeda. Bila ada keluhan baru, nyeri bertambah, atau Anda ragu dengan anjuran di atas, silakan hubungi kami.', { size: 9, color: MUTED, italic: true });

  const contentPages = doc.getNumberOfPages() - 1;
  drawBackCover(doc, logo);
  for (let p = 1; p <= contentPages; p += 1) drawPageChrome(doc, logo, p, contentPages);

  const stamp = /^\d{4}-\d{2}-\d{2}$/.test(String(visitDate)) ? String(visitDate).replace(/-/g, '') : format(new Date(), 'yyyyMMdd');
  return {
    blob: doc.output('blob'),
    fileName: `Laporan_Terapi_${safeFileName(patientName)}_${stamp}.pdf`,
  };
};
