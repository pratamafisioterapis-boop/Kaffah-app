import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

// Palet & kop sama dengan warningLetterGenerator.js supaya dokumen resmi
// klinik (SP, MOU, SK) satu keluarga visual.
const INK = [26, 30, 41];
const NAVY = [30, 41, 82];
const GOLD = [163, 130, 63];
const MUTED = [100, 106, 122];
const PAGE_W = 210;
const PAGE_H = 297;
const MX = 24;
const MTOP = 22;
const MBOTTOM = 24;
const CW = PAGE_W - MX * 2;

const fmtLong = (v) => {
  try { return format(new Date(v), 'd MMMM yyyy', { locale: idLocale }); } catch (_e) { return '-'; }
};

const loadImage = (url) => new Promise((resolve) => {
  if (!url) { resolve(null); return; }
  fetch(url)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('x'))))
    .then((b) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(typeof fr.result === 'string' ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(b);
    })
    .catch(() => resolve(null));
});

const imgFormat = (d) => {
  const m = /^data:image\/(png|jpe?g|webp)/i.exec(d || '');
  if (!m) return 'PNG';
  return m[1].toUpperCase().startsWith('JPE') ? 'JPEG' : m[1].toUpperCase();
};

/**
 * PDF "SURAT KEPUTUSAN PIMPINAN": kop surat, nomor, judul (TENTANG ...),
 * MENIMBANG, MEMUTUSKAN/MENETAPKAN, penutup, dan tanda tangan pimpinan.
 */
export const generateDecreePDF = async (decree = {}, clinic = {}) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = MTOP;
  const clinicName = clinic.name || 'Klinik Fisioterapi';
  const logo = await loadImage(clinic.logo_url || '/clinara-logo.png');

  const ensure = (h) => { if (y + h > PAGE_H - MBOTTOM) { doc.addPage(); y = MTOP; } };

  const text = (str, { x = MX, w = CW, size = 10.2, style = 'normal', lineH = 5.4, gap = 3, align = 'left', color = INK } = {}) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.splitTextToSize(String(str || ''), w).forEach((line) => {
      ensure(lineH);
      doc.text(line, align === 'center' ? PAGE_W / 2 : align === 'right' ? PAGE_W - MX : x, y, { align });
      y += lineH;
    });
    y += gap;
  };

  const hang = (label, str) => {
    const indent = 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.2);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(String(str || ''), CW - indent - 4);
    lines.forEach((line, i) => {
      ensure(5.4);
      if (i === 0) doc.text(label, MX + 4, y);
      doc.text(line, MX + 4 + indent, y);
      y += 5.4;
    });
    y += 1.6;
  };

  // Kop
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 4, 'F');
  const logoSize = 20;
  const top = 12;
  const tx = logo ? MX + logoSize + 8 : MX;
  const tw = logo ? CW - logoSize - 8 : CW;
  const cx = tx + tw / 2;
  if (logo) {
    try { doc.addImage(logo, imgFormat(logo), MX, top, logoSize, logoSize); } catch (_e) { /* tanpa logo */ }
  }
  y = top + 2;
  doc.setFont('times', 'bold');
  doc.setFontSize(15.5);
  doc.setTextColor(...NAVY);
  doc.text(clinicName.toUpperCase(), cx, y, { align: 'center' });
  y += 5.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text('KLINIK FISIOTERAPI', cx, y, { align: 'center' });
  y += 4.2;
  const contact = [clinic.address, clinic.phone, clinic.email].filter(Boolean).join('  •  ');
  if (contact) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.1);
    doc.setTextColor(...MUTED);
    doc.splitTextToSize(contact, tw).forEach((l) => { doc.text(l, cx, y, { align: 'center' }); y += 3.8; });
  }
  y = Math.max(y, top + logoSize) + 3;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.7);
  doc.line(MX, y, PAGE_W - MX, y);
  y += 1.4;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.35);
  doc.line(MX, y, PAGE_W - MX, y);
  y += 11;

  // Judul
  doc.setFont('times', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text('SURAT KEPUTUSAN PIMPINAN', PAGE_W / 2, y, { align: 'center' });
  y += 6.5;
  text(`Nomor: ${decree.decree_number || '-'}`, { align: 'center', color: MUTED, gap: 5 });
  text('TENTANG', { align: 'center', style: 'bold', size: 10.5, gap: 1 });
  text(String(decree.title || '').toUpperCase(), { align: 'center', style: 'bold', size: 11.5, color: NAVY, gap: 7 });

  const section = (label) => {
    ensure(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.2);
    doc.setTextColor(...NAVY);
    doc.text(label, MX, y);
    y += 7;
  };

  const considerations = (decree.considerations || []).filter((c) => c && c.trim());
  if (considerations.length) {
    section('MENIMBANG:');
    considerations.forEach((c, i) => hang(`${String.fromCharCode(97 + i)}.`, c));
    y += 3;
  }

  section('MEMUTUSKAN, MENETAPKAN:');
  (decree.decisions || []).filter((d) => d && (d.heading || d.text)).forEach((d) => {
    ensure(14);
    text(d.heading, { style: 'bold', gap: 1, color: NAVY });
    text(d.text, { gap: 4, x: MX + 4, w: CW - 4 });
  });

  if (decree.closing && decree.closing.trim()) {
    y += 2;
    text(decree.closing, { gap: 6, style: 'italic' });
  }

  // Tanda tangan
  ensure(56);
  text(`Ditetapkan di ${decree.letter_city || '-'}`, { align: 'right', gap: 0 });
  text(`pada tanggal ${fmtLong(decree.decree_date)}`, { align: 'right', gap: 5 });
  const sw = 72;
  const sx = PAGE_W - MX - sw;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text(clinic.owner_position || 'Pimpinan Klinik', sx + sw / 2, y, { align: 'center' });
  y += 24;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.25);
  doc.line(sx, y, sx + sw, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text(`( ${clinic.owner_full_name || '-'} )`, sx + sw / 2, y, { align: 'center' });

  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.3);
    doc.setTextColor(...MUTED);
    doc.text(`${clinicName} — Surat Keputusan Pimpinan No. ${decree.decree_number || '-'}  •  Hal. ${p}/${pages}`, PAGE_W / 2, PAGE_H - 10, { align: 'center' });
  }
  return doc;
};

export const decreeFileName = (decree = {}) => {
  const num = String(decree.decree_number || 'SK').replace(/[^a-zA-Z0-9]+/g, '_');
  return `SK_${num}.pdf`;
};
