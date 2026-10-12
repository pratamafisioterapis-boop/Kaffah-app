import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { stripSignatureBackground } from '@/lib/signatureImage';

// Palet mengikuti logo Kaffah (biru langit + biru tua).
const INK = [26, 30, 41];
const NAVY = [11, 76, 140];
const GOLD = [0, 169, 233];
const LOGO_URL = '/kaffah-logo-kop.png';
const LOGO_RATIO = 700 / 663;
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
  const logo = (await loadImage(LOGO_URL)) || (await loadImage(clinic.logo_url));

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

  // Kop surat: logo di kiri, identitas klinik rata tengah, garis ganda biru.
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 4, 'F');
  const logoH = 17;
  const logoW = logoH * LOGO_RATIO;
  const top = 9;
  const tx = logo ? MX + logoW + 5 : MX;
  const tw = logo ? CW - logoW - 5 : CW;
  const cx = tx + tw / 2;
  if (logo) {
    try { doc.addImage(logo, imgFormat(logo), MX, top, logoW, logoH); } catch (_e) { /* tanpa logo */ }
  }
  // Nama + kontak ditengahkan secara vertikal terhadap logo.
  const contact = [clinic.address, clinic.phone, clinic.email].filter(Boolean).join('  •  ');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const contactLines = contact ? doc.splitTextToSize(contact, tw) : [];
  const blockH = 6 + (contactLines.length ? 1.5 + contactLines.length * 3.6 : 0);
  y = top + (logoH - blockH) / 2 + 5;
  doc.setFont('times', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text('KAFFAH PHYSIOTHERAPY', cx, y, { align: 'center' });
  y += 6.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  contactLines.forEach((l) => { doc.text(l, cx, y, { align: 'center' }); y += 3.6; });
  y = top + logoH + 3;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.line(MX, y, PAGE_W - MX, y);
  y += 1.3;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.35);
  doc.line(MX, y, PAGE_W - MX, y);
  y += 10;

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

  // Tanda tangan: stempel klinik (jika ada) dibubuhkan di sisi kiri garis tanda tangan.
  const stamp = await loadImage(clinic.stamp_url);
  // Tanda tangan digital penandatangan (dari data terapis), latar dibersihkan
  // seperti di invoice supaya tidak ada kotak di belakangnya.
  let signature = null;
  if (decree.signature_url) {
    const cleaned = await stripSignatureBackground(decree.signature_url).catch(() => null);
    signature = await loadImage(cleaned || decree.signature_url);
  }
  ensure(60);
  text(`Ditetapkan di ${decree.letter_city || '-'}`, { align: 'right', gap: 0 });
  text(`pada tanggal ${fmtLong(decree.decree_date)}`, { align: 'right', gap: 5 });
  const sw = 72;
  const sx = PAGE_W - MX - sw;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text(decree.signer_position || clinic.owner_position || 'Pimpinan Klinik', sx + sw / 2, y, { align: 'center' });
  y += 24;
  if (signature) {
    try {
      const props = doc.getImageProperties(signature);
      const h = Math.min(22, (props.height / props.width) * 48);
      const w = (props.width / props.height) * h;
      doc.addImage(signature, imgFormat(signature), sx + (sw - w) / 2, y - h - 0.5, w, h);
    } catch (_e) { /* tanpa tanda tangan */ }
  }
  if (stamp) {
    try { doc.addImage(stamp, imgFormat(stamp), sx - 9, y - 24, 24, 24); } catch (_e) { /* tanpa stempel */ }
  }
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.25);
  doc.line(sx, y, sx + sw, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text(decree.signer_name || clinic.owner_full_name || '-', sx + sw / 2, y, { align: 'center' });

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
