import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

// Palet sama dengan mouAgreementGenerator.js ("professional" navy/emas) —
// supaya semua dokumen resmi klinik (MOU, slip gaji, SP) satu keluarga visual.
const INK = [26, 30, 41];
const NAVY = [30, 41, 82];
const GOLD = [163, 130, 63];
const GOLD_SOFT = [230, 219, 189];
const MUTED = [100, 106, 122];
const DANGER = [153, 27, 27];
const DANGER_SOFT = [252, 226, 226];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 24;
const MARGIN_TOP = 22;
const MARGIN_BOTTOM = 24;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

export const WARNING_LEVEL_LABEL = {
  SP1: 'Surat Peringatan Pertama (SP-1)',
  SP2: 'Surat Peringatan Kedua (SP-2)',
  SP3: 'Surat Peringatan Ketiga / Terakhir (SP-3)',
};

const fmtDateLong = (value) => {
  if (!value) return '-';
  try {
    return format(new Date(value), 'd MMMM yyyy', { locale: idLocale });
  } catch (_e) {
    return '-';
  }
};

// Mengunduh logo klinik (URL publik dari Supabase Storage) dan mengubahnya
// jadi data URL supaya bisa ditempel ke PDF lewat doc.addImage — addImage
// tidak bisa memuat langsung dari URL lintas-origin.
const loadImageAsDataUrl = (url) => new Promise((resolve) => {
  if (!url) { resolve(null); return; }
  fetch(url)
    .then((res) => (res.ok ? res.blob() : Promise.reject(new Error('fetch failed'))))
    .then((blob) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    })
    .catch(() => resolve(null));
});

const imageFormatFromDataUrl = (dataUrl) => {
  const match = /^data:image\/(png|jpe?g|webp)/i.exec(dataUrl || '');
  if (!match) return 'PNG';
  return match[1].toUpperCase().startsWith('JPE') ? 'JPEG' : match[1].toUpperCase();
};

/**
 * Builds the "SURAT PERINGATAN" (SP) PDF an owner downloads for a therapist
 * who committed a workplace violation — one page: letterhead, violation
 * details, consequence note, and a two-party signature block.
 *
 * @param {object} letter - therapist_warning_letters row (letter_number, level,
 *   letter_date, letter_city, violation_date, violation_description, consequence_note)
 * @param {object} clinic - clinics row (name, address, phone, email, owner_full_name, owner_position)
 * @param {object} therapist - physiotherapists row (name, specialization)
 * @returns {Promise<jsPDF>}
 */
export const generateWarningLetterPDF = async (letter = {}, clinic = {}, therapist = {}) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = MARGIN_TOP;
  const clinicName = clinic.name || 'Klinik Fisioterapi';
  const levelLabel = WARNING_LEVEL_LABEL[letter.level] || WARNING_LEVEL_LABEL.SP1;
  const logoDataUrl = await loadImageAsDataUrl(clinic.logo_url);

  const ensureSpace = (needed) => {
    if (y + needed > PAGE_H - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
    }
  };

  const paragraph = (text, { size = 10.2, style = 'normal', lineH = 5.4, gapAfter = 3.5, align = 'left' } = {}) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(text, CONTENT_W);
    lines.forEach((line) => {
      ensureSpace(lineH);
      const x = align === 'left' ? MARGIN_X : PAGE_W / 2;
      doc.text(line, x, y, { align });
      y += lineH;
    });
    y += gapAfter;
  };

  const identityRow = (label, value) => {
    const labelW = 34;
    ensureSpace(5.4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(label, MARGIN_X + 4, y);
    doc.text(':', MARGIN_X + 4 + labelW, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(String(value ?? '-'), CONTENT_W - 4 - labelW - 5);
    doc.text(lines[0] || '-', MARGIN_X + 4 + labelW + 5, y);
    y += 5.4;
    for (let i = 1; i < lines.length; i += 1) {
      ensureSpace(5.4);
      doc.text(lines[i], MARGIN_X + 4 + labelW + 5, y);
      y += 5.4;
    }
  };

  // ---------- LETTERHEAD (KOP SURAT) ----------
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 4, 'F');

  const logoSize = 20;
  const headerTop = 12;
  const hasLogo = !!logoDataUrl;
  // Logo di kiri, identitas klinik rata tengah pada sisa lebar — tetap simetris
  // baik saat logo ada maupun belum diunggah.
  const textBlockX = hasLogo ? MARGIN_X + logoSize + 8 : MARGIN_X;
  const textBlockW = hasLogo ? CONTENT_W - logoSize - 8 : CONTENT_W;
  const textCenterX = textBlockX + textBlockW / 2;

  if (hasLogo) {
    try {
      doc.addImage(logoDataUrl, imageFormatFromDataUrl(logoDataUrl), MARGIN_X, headerTop, logoSize, logoSize);
    } catch (_e) { /* logo korup/tak terbaca — lanjut tanpa logo */ }
  }

  y = headerTop + 2;
  doc.setFont('times', 'bold');
  doc.setFontSize(15.5);
  doc.setTextColor(...NAVY);
  doc.text(clinicName.toUpperCase(), textCenterX, y, { align: 'center' });
  y += 5.2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text('KLINIK FISIOTERAPI', textCenterX, y, { align: 'center' });
  y += 4.2;

  const contactLine = [clinic.address, clinic.phone, clinic.email].filter(Boolean).join('  •  ');
  if (contactLine) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.1);
    doc.setTextColor(...MUTED);
    const lines = doc.splitTextToSize(contactLine, textBlockW);
    lines.forEach((line) => { doc.text(line, textCenterX, y, { align: 'center' }); y += 3.8; });
  }

  y = Math.max(y, headerTop + logoSize) + 3;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.7);
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
  y += 1.4;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.35);
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
  y += 12;

  // ---------- TITLE ----------
  doc.setFont('times', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...DANGER);
  doc.text(levelLabel.split('(')[0].trim().toUpperCase(), PAGE_W / 2, y, { align: 'center' });
  y += 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`Nomor: ${letter.letter_number || '-'}`, PAGE_W / 2, y, { align: 'center' });
  y += 10;

  // ---------- RECIPIENT ----------
  paragraph(
    `Sehubungan dengan pelaksanaan tugas dan tata tertib kerja di ${clinicName}, dengan ini manajemen menyampaikan ${levelLabel} kepada:`,
    { gapAfter: 4 }
  );
  identityRow('Nama', therapist?.name);
  identityRow('Jabatan', therapist?.specialization || 'Fisioterapis');
  y += 4;

  // ---------- VIOLATION ----------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.2);
  doc.setTextColor(...NAVY);
  ensureSpace(6);
  doc.text('Perihal Pelanggaran', MARGIN_X, y);
  y += 5;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_X, y, MARGIN_X + 40, y);
  y += 6;

  identityRow('Tanggal Kejadian', fmtDateLong(letter.violation_date));
  y += 2;
  paragraph(letter.violation_description || '-', { gapAfter: 4 });

  if (letter.consequence_note) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.2);
    doc.setTextColor(...NAVY);
    ensureSpace(6);
    doc.text('Konsekuensi / Tindak Lanjut', MARGIN_X, y);
    y += 5;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_X, y, MARGIN_X + 48, y);
    y += 6;
    paragraph(letter.consequence_note, { gapAfter: 4 });
  }

  ensureSpace(24);
  doc.setFillColor(...DANGER_SOFT);
  const noticeLines = doc.splitTextToSize(
    'Surat peringatan ini merupakan bagian dari catatan kedisiplinan karyawan. Apabila pelanggaran serupa atau '
    + 'pelanggaran lain terulang, manajemen akan mengambil tindakan lebih lanjut sesuai peraturan yang berlaku di '
    + `${clinicName}, termasuk kemungkinan pemutusan hubungan kerja.`,
    CONTENT_W - 10
  );
  const noticeH = noticeLines.length * 4.6 + 8;
  ensureSpace(noticeH);
  doc.roundedRect(MARGIN_X, y, CONTENT_W, noticeH, 2, 2, 'F');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...DANGER);
  noticeLines.forEach((line, idx) => doc.text(line, MARGIN_X + 5, y + 6 + idx * 4.6));
  y += noticeH + 8;

  paragraph(
    `Demikian ${levelLabel.toLowerCase()} ini dibuat untuk dapat menjadi perhatian dan diperbaiki sebagaimana mestinya.`,
    { gapAfter: 6 }
  );

  // ---------- SIGNATURES ----------
  ensureSpace(60);
  paragraph(`${letter.letter_city || '-'}, ${fmtDateLong(letter.letter_date)}`, { gapAfter: 6, align: 'right' });

  const sigWidth = 68;
  const leftX = MARGIN_X + 6;
  const rightX = PAGE_W - MARGIN_X - sigWidth - 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text('Pihak Yang Menerbitkan,', leftX + sigWidth / 2, y, { align: 'center' });
  doc.text('Pihak Yang Menerima,', rightX + sigWidth / 2, y, { align: 'center' });
  y += 24;

  doc.setDrawColor(...INK);
  doc.setLineWidth(0.25);
  doc.line(leftX, y, leftX + sigWidth, y);
  doc.line(rightX, y, rightX + sigWidth, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.text(`( ${clinic.owner_full_name || '-'} )`, leftX + sigWidth / 2, y, { align: 'center' });
  doc.text(`( ${therapist?.name || '-'} )`, rightX + sigWidth / 2, y, { align: 'center' });
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(clinic.owner_position || 'Pimpinan Klinik', leftX + sigWidth / 2, y, { align: 'center' });
  doc.text('Menerima & memahami isi surat ini', rightX + sigWidth / 2, y, { align: 'center' });

  // ---------- FOOTER ----------
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.3);
    doc.setTextColor(...MUTED);
    doc.text('Dokumen ini bersifat rahasia — bagian dari catatan kedisiplinan karyawan', PAGE_W / 2, PAGE_H - 10, { align: 'center' });
  }

  return doc;
};

export const warningLetterFileName = (letter = {}, therapist = {}) => {
  const safeName = (therapist?.name || 'Terapis').replace(/[^a-zA-Z0-9]+/g, '_');
  const dateStr = letter.letter_date ? format(new Date(letter.letter_date), 'yyyyMMdd') : format(new Date(), 'yyyyMMdd');
  return `${letter.level || 'SP1'}_${safeName}_${dateStr}.pdf`;
};
