// Parser "Laporan Transaksi" QRIS dari BSI Merchant (PDF).
//
// Pendekatan: baca posisi x/y tiap kata dari layer teks PDF (pdf.js), kelompokkan
// per baris transaksi berdasarkan nomor urut di kolom paling kiri, lalu petakan
// tiap kata ke kolom berdasarkan posisi x header. Nama pelanggan / issuer / no. ref
// yang terpotong ke baris berikutnya tetap tergabung ke transaksi yang benar.

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7,
  agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
};

const AMOUNT_RE = /^\d{1,3}(?:\.\d{3})*,\d{2}$/;

// "200.000,00" -> 200000
export const parseIdAmount = (str) => {
  if (!str) return 0;
  const n = parseFloat(String(str).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export async function ensurePdfJs() {
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  return window.pdfjsLib;
}

export async function extractPagesWords(file) {
  const pdfjsLib = await ensurePdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .filter((it) => it.str && it.str.trim().length > 0)
        .map((it) => ({ text: it.str.trim(), x: it.transform[4], y: it.transform[5] }))
    );
  }
  return pages;
}

const pad2 = (n) => String(n).padStart(2, '0');

// Parse "03 Nov 2026" + "19:44" -> { dateStr: '2026-11-03', timeStr: '19:44' }
const parseDateTime = (dateText, timeText) => {
  const m = (dateText || '').match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  const t = (timeText || '').match(/(\d{1,2}):(\d{2})/);
  return {
    dateStr: `${m[3]}-${pad2(month)}-${pad2(m[1])}`,
    timeStr: t ? `${pad2(t[1])}:${t[2]}` : null,
  };
};

// Terima hasil extractPagesWords (array halaman, tiap halaman array {text,x,y}).
export const parseQrisReportWords = (pages) => {
  const allText = pages.flat().map((w) => w.text).join(' ');

  const meta = {
    accountNo: (allText.match(/NO\.?\s*REKENING\s*:\s*(\d+)/i) || [])[1] || null,
    mid: (allText.match(/\bMID\s*:\s*(\d+)/i) || [])[1] || null,
    mpan: (allText.match(/\bMPAN\s*:\s*(\d+)/i) || [])[1] || null,
    merchantName: /KAFFAH\s+PHYSIOTHERAPY/i.test(allText) ? 'KAFFAH PHYSIOTHERAPY' : null,
  };
  const periodMatch = allText.match(
    /PERIODE\s+LAPORAN\s*:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})\s*-\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i
  );
  meta.periodStart = periodMatch ? parseDateTime(periodMatch[1])?.dateStr : null;
  meta.periodEnd = periodMatch ? parseDateTime(periodMatch[2])?.dateStr : null;

  if (!/LAPORAN\s+TRANSAKSI/i.test(allText) || !/Nominal\s+Transaksi/i.test(allText)) {
    throw new Error('Format PDF tidak dikenali. Pastikan ini "Laporan Transaksi" QRIS dari BSI Merchant.');
  }

  const transactions = [];
  let colIssuerX = null;
  let colNameX = null;
  let colRefX = null;
  let colAmountX = null;

  for (const words of pages) {
    // Posisi kolom dari baris header (diwariskan ke halaman berikutnya bila header tidak diulang).
    const hIssuer = words.find((w) => /^Nama Issuer$/i.test(w.text));
    const hName = words.find((w) => /^Nama Pelanggan$/i.test(w.text));
    const hRef = words.find((w) => /^No\.?\s*Reff/i.test(w.text));
    const hAmount = words.find((w) => /^Nominal Transaksi/i.test(w.text));
    if (hIssuer) colIssuerX = hIssuer.x;
    if (hName) colNameX = hName.x;
    if (hRef) colRefX = hRef.x;
    if (hAmount) colAmountX = hAmount.x;
    if (colIssuerX == null || colNameX == null || colRefX == null || colAmountX == null) continue;

    const headerY = (hIssuer || hName || hRef || { y: Infinity }).y;
    // Jangkar baris: nomor urut di kolom paling kiri, di bawah header.
    const anchors = words
      .filter((w) => w.x < colIssuerX - 40 && /^\d+$/.test(w.text) && w.y < headerY - 5)
      .sort((a, b) => b.y - a.y);
    if (!anchors.length) continue;

    const rows = anchors.map((a) => ({ anchorY: a.y, words: [] }));
    for (const w of words) {
      if (w.y >= headerY - 5) continue;
      // Baris pemilik = jangkar terendah yang masih >= (y kata - 8).
      const owners = rows.filter((r) => w.y <= r.anchorY + 8 && w.y > r.anchorY - 40);
      if (!owners.length) continue;
      owners.sort((a, b) => a.anchorY - b.anchorY);
      owners[0].words.push(w);
    }

    for (const row of rows) {
      const ws = row.words.sort((a, b) => b.y - a.y || a.x - b.x);
      const dateWord = ws.find((w) => /^\d{1,2}\s+[A-Za-z]{3}/.test(w.text) && w.x < colIssuerX);
      const timeWord = ws.find((w) => /^\d{1,2}:\d{2}$/.test(w.text) && w.x < colIssuerX);
      const dt = parseDateTime(dateWord?.text, timeWord?.text);

      const issuer = ws
        .filter((w) => w.x >= colIssuerX - 3 && w.x < colNameX - 3)
        .map((w) => w.text).join(' ');
      const customer = ws
        .filter((w) => w.x >= colNameX - 3 && w.x < colRefX - 3)
        .map((w) => w.text).join(' ');
      const refParts = ws
        .filter((w) => w.x >= colRefX - 3 && w.x < colAmountX - 5)
        .map((w) => w.text);
      const amountWords = ws
        .filter((w) => w.x >= colAmountX - 5 && AMOUNT_RE.test(w.text))
        .sort((a, b) => a.x - b.x);

      const rrnPart = refParts.find((p) => /^\d{12}$/.test(p));
      const refNo = refParts.filter((p) => p !== rrnPart).join('');
      if (!dt || !amountWords.length) continue;

      transactions.push({
        dateStr: dt.dateStr,
        timeStr: dt.timeStr,
        issuer,
        customerName: customer,
        refNo: refNo || null,
        rrn: rrnPart || null,
        amount: parseIdAmount(amountWords[0]?.text),
        mdr: parseIdAmount(amountWords[1]?.text),
        netAmount: parseIdAmount(amountWords[2]?.text ?? amountWords[0]?.text),
      });
    }
  }

  // Ringkasan dari laporan (untuk validasi hasil parse).
  const sumMatch = allText.match(
    /Jumlah Transaksi.*?Total Nominal Diterima \(Rp\)\s+(\d+)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})/i
  );
  const summary = sumMatch
    ? { count: parseInt(sumMatch[1], 10), totalAmount: parseIdAmount(sumMatch[2]), totalNet: parseIdAmount(sumMatch[3]) }
    : null;

  transactions.sort((a, b) => `${a.dateStr} ${a.timeStr}`.localeCompare(`${b.dateStr} ${b.timeStr}`));
  return { meta, summary, transactions };
};

export const parseQrisReportPdf = async (file) => {
  const pages = await extractPagesWords(file);
  return parseQrisReportWords(pages);
};
