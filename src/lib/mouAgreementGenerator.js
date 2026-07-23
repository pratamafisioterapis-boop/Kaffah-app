import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

// Palette shared with payslipGenerator.js so every "official document" the
// clinic issues reads as one consistent, professional family.
const INK = [26, 30, 41];
const NAVY = [30, 41, 82];
const GOLD = [163, 130, 63];
const GOLD_SOFT = [230, 219, 189];
const MUTED = [100, 106, 122];
const RULE = [225, 227, 232];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 22;
const MARGIN_TOP = 20;
const MARGIN_BOTTOM = 22;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const fmtMoney = (value) => `Rp ${Math.round(Number(value) || 0).toLocaleString('id-ID')}`;
const fmtDateLong = (value) => {
  if (!value) return '-';
  try {
    return format(new Date(value), 'd MMMM yyyy', { locale: idLocale });
  } catch (_e) {
    return '-';
  }
};
const fmtDateShort = (value) => {
  if (!value) return '-';
  try {
    return format(new Date(value), 'dd-MM-yyyy', { locale: idLocale });
  } catch (_e) {
    return '-';
  }
};

/**
 * Builds the "PERJANJIAN KERJASAMA KEMITRAAN FISIOTERAPIS" agreement PDF —
 * the unsigned draft an owner downloads, prints, gets signed on materai,
 * scans, then re-uploads via the MOU manager. Structure mirrors the clinic's
 * existing paper template: header identities, Pasal 1-11, signature blocks.
 *
 * @param {object} mou - therapist_mou_documents row (period_start/end, agreement_date,
 *   agreement_city, first_party, second_party, compensation, period_number)
 * @param {object} clinic - clinics row (name, address, phone, email)
 * @returns {jsPDF}
 */
export const generateMouAgreementPDF = (mou = {}, clinic = {}) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = MARGIN_TOP;
  let pageNum = 1;

  const firstParty = mou.first_party || {};
  const secondParty = mou.second_party || {};
  const comp = mou.compensation || {};
  const clinicName = clinic.name || 'Klinik Fisioterapi';

  const drawRunningHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text(clinicName.toUpperCase(), MARGIN_X, 12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text('PERJANJIAN KERJASAMA KEMITRAAN FISIOTERAPIS', PAGE_W - MARGIN_X, 12, { align: 'right' });
    doc.setDrawColor(...GOLD_SOFT);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_X, 15, PAGE_W - MARGIN_X, 15);
  };

  const newPage = () => {
    doc.addPage();
    pageNum += 1;
    drawRunningHeader();
    y = MARGIN_TOP + 6;
  };

  const ensureSpace = (needed) => {
    if (y + needed > PAGE_H - MARGIN_BOTTOM) newPage();
  };

  const paragraph = (text, { size = 10, style = 'normal', lineH = 5, indent = 0, gapAfter = 3 } = {}) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(text, CONTENT_W - indent);
    lines.forEach((line) => {
      ensureSpace(lineH);
      doc.text(line, MARGIN_X + indent, y);
      y += lineH;
    });
    y += gapAfter;
  };

  const identityRow = (label, value, indent = 4) => {
    const labelW = 46;
    ensureSpace(5.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(label, MARGIN_X + indent, y);
    doc.text(':', MARGIN_X + indent + labelW, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(String(value ?? '-'), CONTENT_W - indent - labelW - 5);
    doc.text(lines[0] || '-', MARGIN_X + indent + labelW + 5, y);
    y += 5.2;
    for (let i = 1; i < lines.length; i += 1) {
      ensureSpace(5.2);
      doc.text(lines[i], MARGIN_X + indent + labelW + 5, y);
      y += 5.2;
    }
  };

  const pasalTitle = (number, title) => {
    ensureSpace(14);
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    doc.text(`Pasal ${number}`, PAGE_W / 2, y, { align: 'center' });
    y += 5;
    doc.text(title, PAGE_W / 2, y, { align: 'center' });
    y += 3;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(PAGE_W / 2 - 12, y, PAGE_W / 2 + 12, y);
    y += 6;
  };

  const numberedItem = (number, text, indent = 4) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.7);
    const numW = 7;
    const lines = doc.splitTextToSize(text, CONTENT_W - indent - numW);
    ensureSpace(4.8 * lines.length + 1.5);
    doc.setTextColor(...INK);
    doc.text(`${number}.`, MARGIN_X + indent, y);
    lines.forEach((line, idx) => {
      doc.text(line, MARGIN_X + indent + numW, y + idx * 4.8);
    });
    y += 4.8 * lines.length + 2.5;
  };

  const subLine = (text, indent = 12) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(text, CONTENT_W - indent);
    ensureSpace(4.6 * lines.length + 1);
    lines.forEach((line, idx) => doc.text(line, MARGIN_X + indent, y + idx * 4.6));
    y += 4.6 * lines.length + 2;
  };

  // ---------- COVER / LETTERHEAD ----------
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 3, 'F');

  y = 24;
  doc.setFont('times', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...INK);
  doc.text('PERJANJIAN KERJASAMA KEMITRAAN FISIOTERAPIS', PAGE_W / 2, y, { align: 'center' });
  y += 7;
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...GOLD);
  doc.text(clinicName.toUpperCase(), PAGE_W / 2, y, { align: 'center' });
  y += 5.5;

  const contactLine = [clinic.address, clinic.phone, clinic.email].filter(Boolean).join('  •  ');
  if (contactLine) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.3);
    doc.setTextColor(...MUTED);
    const lines = doc.splitTextToSize(contactLine, CONTENT_W);
    lines.forEach((line) => { doc.text(line, PAGE_W / 2, y, { align: 'center' }); y += 4; });
  }
  y += 2;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
  y += 3;
  doc.setDrawColor(...GOLD_SOFT);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
  y += 10;

  const periodTag = mou.period_number ? `Perpanjangan Tahun ke-${mou.period_number}` : 'Perpanjangan Tahunan';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text(periodTag.toUpperCase(), PAGE_W / 2, y, { align: 'center' });
  y += 8;

  paragraph(
    `Perjanjian kerjasama ini dibuat di ${mou.agreement_city || '-'} pada tanggal ${fmtDateLong(mou.agreement_date)} `
    + `(${fmtDateShort(mou.agreement_date)}) oleh dan antara :`,
    { gapAfter: 5 }
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  doc.setTextColor(...INK);
  ensureSpace(5.5);
  doc.text('I.', MARGIN_X, y);
  y += 5.5;
  identityRow('Nama', firstParty.name);
  identityRow('Tempat, Tanggal Lahir', firstParty.birth_place || firstParty.birth_date
    ? `${firstParty.birth_place || '-'}, ${fmtDateLong(firstParty.birth_date)}`
    : '-');
  identityRow('Jabatan', firstParty.position || 'Pimpinan Klinik');
  subLine('Untuk selanjutnya disebut sebagai PIHAK PERTAMA.');
  y += 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  ensureSpace(5.5);
  doc.text('II.', MARGIN_X, y);
  y += 5.5;
  identityRow('Nama', secondParty.name);
  identityRow('Tempat, Tanggal Lahir', secondParty.birth_place || secondParty.birth_date
    ? `${secondParty.birth_place || '-'}, ${fmtDateLong(secondParty.birth_date)}`
    : '-');
  identityRow('No. STR / SIP', secondParty.license_number);
  subLine('Untuk selanjutnya disebut sebagai PIHAK KEDUA.');
  y += 3;

  paragraph(
    'Selanjutnya para pihak setuju dan sepakat mengikat diri dalam suatu Perjanjian dengan '
    + 'ketentuan-ketentuan dan syarat-syarat sebagaimana tercantum dalam pasal-pasal di bawah ini.',
    { gapAfter: 4 }
  );

  // ---------- PASAL 1 ----------
  pasalTitle(1, 'BENTUK KERJASAMA');
  paragraph(`PIHAK PERTAMA mengadakan kerjasama dengan PIHAK KEDUA dengan memberikan jasa pelayanan kesehatan sebagai berikut:`, { gapAfter: 2 });
  [
    `Melaksanakan pelayanan dan mengevaluasi kunjungan pasien di ${clinicName}.`,
    'Mengisi rekam medis pasien.',
    'Melakukan stock opname bulanan.',
    'Memberikan report kondisi klinis kepada pasien.',
    `Memberikan edukasi ke media sosial yang menyangkut tentang Fisioterapi dan tempat kerja PIHAK PERTAMA.`,
    'Menjaga kebersihan ruang Fisioterapi PIHAK PERTAMA.',
    'Menjaga nama baik ' + clinicName + ' dan memberikan citra yang baik serta ikut melaksanakan program Pelayanan Profesional, Ramah, Ikhlas, Bermutu dan Antusias (Layanan PRIMA).',
    'Berpartisipasi dalam program alih pengetahuan (transfer knowledge) di lingkungan kerja PIHAK PERTAMA.',
    'Menjamin rahasia menyangkut penyakit atau keadaan kesehatan pasien sesuai etika keprofesian, kecuali untuk kepentingan yang berwajib dengan izin tertulis PIHAK PERTAMA.',
    'Mematuhi Standard Operational Procedure (SOP) di bidang fisioterapi dan peraturan yang berlaku di lingkungan kerja PIHAK PERTAMA.',
    'Menjaga kualitas komunikasi dengan rekan sejawat.',
    'Disiplin terhadap waktu kerja termasuk melakukan absensi sesuai aturan di tempat kerja PIHAK PERTAMA.',
    'Tidak merokok di lingkungan kerja PIHAK PERTAMA.',
  ].forEach((t, i) => numberedItem(i + 1, t));

  // ---------- PASAL 2 ----------
  pasalTitle(2, 'TEMPAT DAN FASILITAS');
  [
    'PIHAK PERTAMA menyediakan tempat dan fasilitas kerja untuk PIHAK KEDUA dalam menjalankan tugasnya sebagai Fisioterapis.',
    'PIHAK KEDUA wajib bertanggung jawab untuk menggunakan sarana atau perlengkapan yang telah disediakan oleh PIHAK PERTAMA dengan sebaik-baiknya.',
  ].forEach((t, i) => numberedItem(i + 1, t));

  // ---------- PASAL 3 ----------
  pasalTitle(3, 'WAKTU KERJA DAN TATA TERTIB');
  [
    'PIHAK KEDUA bersedia dan sanggup menjalankan tugas sebagai Fisioterapis di tempat kerja PIHAK PERTAMA pada waktu yang disesuaikan dengan aturan dan ketentuan dari PIHAK PERTAMA.',
    'PIHAK KEDUA wajib mentaati waktu & jam kerja yang telah ditentukan oleh PIHAK PERTAMA.',
  ].forEach((t, i) => numberedItem(i + 1, t));

  // ---------- PASAL 4 ----------
  pasalTitle(4, 'KOMPENSASI BAGI PIHAK KEDUA');
  numberedItem(1, 'PIHAK PERTAMA akan memberikan kompensasi kepada PIHAK KEDUA berupa Gaji Pokok yang di dalamnya sudah termasuk BPJS Kesehatan dengan besaran:');
  subLine(`${fmtMoney(comp.base_salary)},- per bulan`);
  numberedItem(2, 'PIHAK PERTAMA akan memberikan Upah Makan dan Transport dengan besaran:');
  subLine(`${fmtMoney(comp.transport_per_visit)},- per kedatangan, kecuali tanggal merah/libur`);
  numberedItem(3, `PIHAK PERTAMA akan memberikan "Insentif Jasa Keprofesian" dengan besaran ${comp.professional_incentive_note || 'terlampir'}.`);
  numberedItem(4, 'PIHAK PERTAMA akan memberikan "Insentif Jasa Lainnya" apabila PIHAK KEDUA melakukan TINDAKAN FISIOTERAPI di luar jam kerja, seperti tanggal merah/hari libur, dengan besaran:');
  subLine(`${fmtMoney(comp.off_hour_incentive_per_patient)},- per pasien`);
  numberedItem(5, 'PIHAK PERTAMA akan memberikan "Remunerasi" apabila PIHAK KEDUA mencapai target yang telah ditentukan oleh PIHAK PERTAMA dengan besaran proporsional setiap bulannya.');
  numberedItem(6, `PIHAK PERTAMA akan memberikan "Komisi Cuti Tahunan" apabila PIHAK KEDUA tidak menggunakan cuti yang berhak diterima dan akan diberikan di akhir kontrak ini dengan besaran:`);
  subLine(`${fmtMoney(comp.leave_commission_per_12_days)},- per ${comp.annual_leave_days || 12} hari cuti`);

  // ---------- PASAL 5 ----------
  pasalTitle(5, 'PERSYARATAN DAN PROSEDUR');
  [
    'Dalam melaksanakan perjanjian ini, PIHAK KEDUA harus mengacu pada standar prosedur pelayanan Fisioterapis PIHAK PERTAMA dan dalam melaksanakan profesinya selalu berada dalam keadaan fisik dan mental/emosi yang baik serta memiliki kecakapan profesional sesuai dengan bidangnya.',
    'PIHAK KEDUA setuju untuk mematuhi keputusan PIHAK PERTAMA dalam menetapkan keadaan sesuai standar profesi sebagaimana dimaksud dalam ayat 1 pasal ini.',
    'Apabila terjadi kelalaian atau malpraktik yang dilakukan oleh PIHAK KEDUA karena tidak dipatuhinya standar prosedur pelayanan PIHAK PERTAMA atau karena keadaan fisik dan mental/emosi, maka PIHAK KEDUA akan memikul tanggung jawab atas risiko tersebut dan tidak melibatkan PIHAK PERTAMA secara pidana dan perdata.',
    'PIHAK KEDUA wajib memberikan salinan/copy Surat Tanda Registrasi/Surat Izin Praktik yang membuktikan kewenangan untuk melakukan pekerjaan sebagai Fisioterapis yang diterbitkan oleh instansi yang berwenang kepada PIHAK PERTAMA.',
  ].forEach((t, i) => numberedItem(i + 1, t));

  // ---------- PASAL 6 ----------
  pasalTitle(6, 'CUTI');
  numberedItem(1, `PIHAK KEDUA berhak atas ${comp.annual_leave_days || 12} (${comp.annual_leave_days || 12}) hari cuti tahunan selama masa perjanjian 12 bulan, yang dapat digunakan secara bertahap sesuai kebutuhan PIHAK KEDUA.`);
  numberedItem(2, `PIHAK KEDUA wajib mengajukan cuti kepada PIHAK PERTAMA secara tertulis minimal ${comp.leave_notice_days || 7} (${comp.leave_notice_days || 7}) hari sebelumnya, kecuali dalam kondisi sakit atau keadaan mendesak.`);
  numberedItem(3, 'Pengajuan cuti disetujui oleh PIHAK PERTAMA berdasarkan kebutuhan pelayanan, kondisi operasional, serta penilaian profesional lainnya.');
  numberedItem(4, 'PIHAK KEDUA dapat mengajukan cuti sakit dengan memberikan keterangan atau bukti medis kepada PIHAK PERTAMA.');
  numberedItem(5, `PIHAK KEDUA berhak atas ${comp.marriage_leave_days || 3} (${comp.marriage_leave_days || 3}) hari cuti menikah yang dapat digunakan sebelum, pada saat, atau setelah hari pelaksanaan pernikahan. Cuti menikah wajib diajukan minimal ${comp.marriage_notice_days || 14} (${comp.marriage_notice_days || 14}) hari sebelumnya disertai bukti rencana pernikahan.`);
  numberedItem(6, `PIHAK KEDUA berhak atas Cuti Hamil dan Melahirkan selama total ${comp.maternity_leave_months || 3} (${comp.maternity_leave_months || 3}) bulan, dengan rincian ${(comp.maternity_leave_months || 3) / 2} bulan sebelum perkiraan persalinan dan ${(comp.maternity_leave_months || 3) / 2} bulan setelah persalinan.`);
  numberedItem(7, 'Mekanisme kompensasi dan pembayaran selama cuti hamil/melahirkan mengikuti kebijakan internal PIHAK PERTAMA dan dapat diatur lebih lanjut dalam addendum apabila diperlukan.');
  numberedItem(8, 'Ketidakhadiran tanpa keterangan tertulis atau tanpa persetujuan PIHAK PERTAMA akan dianggap alpa, dan PIHAK PERTAMA berhak melakukan pemotongan Upah secara proporsional.');
  numberedItem(9, 'Bila hak cuti tahunan tidak digunakan sampai masa perjanjian berakhir, PIHAK KEDUA berhak menerima Komisi Cuti Tahunan sebagaimana tercantum pada Pasal 4 ayat (6).');

  // ---------- PASAL 7 ----------
  pasalTitle(7, 'JANGKA WAKTU PERJANJIAN KEMITRAAN');
  numberedItem(1, `Jangka waktu perjanjian ini berlaku selama 12 (dua belas) bulan terhitung mulai tanggal ${fmtDateLong(mou.period_start)} - ${fmtDateLong(mou.period_end)}.`);
  numberedItem(2, 'Dengan berakhirnya tanggal perjanjian ini maka hubungan kerja PIHAK PERTAMA dan PIHAK KEDUA dianggap selesai atau berakhir tanpa suatu kewajiban apapun dari PIHAK PERTAMA maupun PIHAK KEDUA, kecuali apabila masih terdapat kewajiban-kewajiban atau hutang piutang yang harus diselesaikan oleh para pihak.');
  numberedItem(3, `PIHAK PERTAMA dan PIHAK KEDUA dapat menyepakati untuk memutuskan Perjanjian ini sebelum berakhirnya jangka waktu Perjanjian dengan pemberitahuan tertulis ${comp.termination_notice_days || 60} (${comp.termination_notice_days || 60}) hari sebelumnya.`);

  // ---------- PASAL 8 ----------
  pasalTitle(8, 'JAMINAN KERAHASIAAN');
  [
    'PIHAK KEDUA wajib menjaga kerahasiaan yang menyangkut penyakit/keadaan kesehatan pasien sesuai dengan ketentuan hukum dan etika yang berlaku, kecuali untuk kepentingan hukum atau pihak yang berwajib dengan sepengetahuan PIHAK PERTAMA.',
    `PIHAK KEDUA wajib untuk dengan alasan apapun juga merahasiakan dalam arti yang seluas-luasnya semua informasi perihal ${clinicName}, baik yang diperolehnya secara langsung maupun tidak langsung selama perjanjian ini berlangsung maupun setelah perjanjian ini berakhir; dimana hal yang disebut rahasia adalah semata-mata berdasarkan pertimbangan dan kepentingan PIHAK PERTAMA.`,
    'Apabila PIHAK KEDUA terbukti membocorkan rahasia sebagaimana dimaksud di atas, maka PIHAK PERTAMA berhak untuk memutuskan perjanjian ini seketika tanpa kewajiban membayar ganti rugi apapun juga serta berhak mengambil tindakan yang diperlukan sehubungan dengan pelanggaran tersebut.',
  ].forEach((t, i) => numberedItem(i + 1, t));

  // ---------- PASAL 9 ----------
  pasalTitle(9, 'PEMUTUSAN PERJANJIAN KERJASAMA OLEH PIHAK PERTAMA');
  paragraph('Vide pasal 7 ayat 3, PIHAK PERTAMA dapat memutuskan Perjanjian Kerjasama ini secara sepihak seketika apabila PIHAK KEDUA melakukan kelalaian, kesalahan, atau pelanggaran lainnya yaitu:', { gapAfter: 2 });
  [
    'Pada saat Perjanjian Kerjasama diadakan memberikan keterangan palsu atau dipalsukan.',
    'Tidak dapat menunjukkan kinerja yang baik sesuai tugas yang diberikan atau tidak melakukan kewajiban yang ditetapkan dalam Perjanjian Kerjasama.',
    'Lebih dari 3 (tiga) kali mendapatkan laporan keluhan/komplain dari pasien PIHAK PERTAMA tentang pelayanan PIHAK KEDUA.',
    'Mabuk, madat, memakai obat bius atau narkotika di tempat kerja.',
    'Mencuri, menggelapkan, menipu, atau melakukan kejahatan lainnya.',
    'Menganiaya, menghina secara kasar, atau mengancam pekerja perusahaan ataupun pasien PIHAK PERTAMA atau teman sekerja.',
    'Dengan sengaja atau karena kecerobohannya merusak atau membiarkan dalam keadaan bahaya milik PIHAK PERTAMA.',
    'Dengan sengaja walaupun sudah diperingatkan membiarkan dirinya atau teman sekerjanya dalam keadaan bahaya.',
    'Membongkar rahasia Perusahaan atau pasien PIHAK PERTAMA yang seharusnya dirahasiakan.',
    'Membujuk atau menghasut teman sekerja untuk melakukan perbuatan yang bertentangan dengan peraturan perusahaan, hukum, dan/atau perbuatan asusila.',
  ].forEach((t, i) => numberedItem(i + 1, t));

  // ---------- PASAL 10 ----------
  pasalTitle(10, 'PEMUTUSAN PERJANJIAN KERJASAMA OLEH PIHAK KEDUA');
  paragraph('PIHAK KEDUA dapat memutuskan Perjanjian Kerjasama ini secara sepihak seketika apabila PIHAK PERTAMA melakukan kelalaian, kesalahan, atau pelanggaran seperti:', { gapAfter: 2 });
  [
    'Menganiaya, menghina secara kasar, atau mengancam PIHAK KEDUA atau keluarga PIHAK KEDUA.',
    'Membujuk PIHAK KEDUA atau keluarga PIHAK KEDUA melakukan sesuatu yang bertentangan dengan hukum atau kesusilaan, atau hal itu dilakukan PIHAK PERTAMA.',
    '2 (dua) kali berturut-turut tidak membayar imbalan PIHAK KEDUA pada waktunya.',
    'Tidak memenuhi syarat-syarat atau tidak melakukan kewajiban yang ditetapkan dalam Perjanjian Kemitraan.',
    'Apabila dilanjutkan hubungan kerja dapat menimbulkan bahaya bagi keselamatan jiwa atau kesehatan PIHAK KEDUA, hal mana tidak diketahui PIHAK KEDUA sewaktu Perjanjian Kerjasama diadakan.',
  ].forEach((t, i) => numberedItem(i + 1, t));

  // ---------- PASAL 11 ----------
  pasalTitle(11, 'PENUTUP');
  [
    'Bilamana ada sesuatu yang belum atau belum cukup diatur dalam perjanjian ini maka kedua belah pihak sepakat untuk memuat dalam addendum yang akan ditandatangani oleh kedua belah pihak.',
    'Perjanjian ini dibuat dalam rangkap 2 untuk masing-masing pihak, bermaterai cukup sehingga mempunyai kekuatan hukum yang sama.',
  ].forEach((t, i) => numberedItem(i + 1, t));

  // ---------- SIGNATURES ----------
  ensureSpace(60);
  y += 6;
  const sigWidth = 68;
  const leftX = MARGIN_X + 6;
  const rightX = PAGE_W - MARGIN_X - sigWidth - 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text('PIHAK PERTAMA', leftX + sigWidth / 2, y, { align: 'center' });
  doc.text('PIHAK KEDUA', rightX + sigWidth / 2, y, { align: 'center' });
  y += 24;

  doc.setDrawColor(...INK);
  doc.setLineWidth(0.25);
  doc.line(leftX, y, leftX + sigWidth, y);
  doc.line(rightX, y, rightX + sigWidth, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.text(`( ${firstParty.name || '-'} )`, leftX + sigWidth / 2, y, { align: 'center' });
  doc.text(`( ${secondParty.name || '-'} )`, rightX + sigWidth / 2, y, { align: 'center' });

  // ---------- FOOTER (all pages) ----------
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.3);
    doc.setTextColor(...MUTED);
    doc.text(
      `Dokumen ini bersifat rahasia — halaman ${p} dari ${totalPages}`,
      PAGE_W / 2,
      PAGE_H - 10,
      { align: 'center' }
    );
  }

  return doc;
};

export const mouAgreementFileName = (mou = {}, therapist = {}) => {
  const year = mou?.period_start ? format(new Date(mou.period_start), 'yyyy', { locale: idLocale }) : 'periode';
  const name = (therapist.name || 'terapis').replace(/[^a-zA-Z0-9]+/g, '-');
  return `MOU-Kemitraan-${name}-${year}.pdf`;
};
