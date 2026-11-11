// Parser "Mutasi Rekening" BSI (PDF unduhan BSINet) -> daftar uang MASUK (kredit).
//
// Pendekatan (sama dengan bsiQrisReportParser): baca posisi x/y tiap kata dari layer teks
// PDF, lalu kelompokkan per baris transaksi. Satu baris transaksi di PDF bisa terdiri dari
// 2-5 baris teks (deskripsi terpotong), jadi jangkarnya adalah baris yang memuat dua nominal
// (jumlah transaksi + saldo). Tanggal = tanggal terdekat di atas jangkar, jam = jam setelah
// tanggal itu. Teks lain dibagi ke jangkar terdekat hanya untuk mengenali jenis transaksi.
//
// Kebenaran angka dijaga dua cara: (1) total kredit hasil baca dibandingkan dengan
// "Total Kredit" di kepala PDF, (2) saldo berjalan tiap baris dicek berkesinambungan.

import { extractPagesWords } from '@/utils/bsiQrisReportParser';

const AMOUNT_RE = /^\d{1,3}(?:,\d{3})*\.\d{2}-?$/;
const DATE_RE = /^(\d{2})-(\d{2})-(\d{4})$/;
const TIME_RE = /^(\d{2})\.(\d{2})$/;
const LINE_TOL = 2.5;

const NOISE = new Set(['BANK', 'SYARIAH', 'INDONESIA', 'KAFFAH', 'PHYSIOTHERAPY', 'BIFAST', 'TRF', 'DARI']);

const toNumber = (s) => parseFloat(String(s).replace(/[,-]/g, ''));

// Terima array halaman, tiap halaman array {text,x,y} (y makin besar = makin atas, seperti pdf.js).
export const parseMutasiWords = (pages) => {
  // 1. Pecah item jadi kata, lalu susun jadi baris (atas -> bawah, kiri -> kanan).
  const lines = [];
  pages.forEach((words, pi) => {
    const tokens = [];
    words.forEach((w) => {
      String(w.text || '').split(/\s+/).filter(Boolean).forEach((t) => tokens.push({ text: t, x: w.x, y: w.y }));
    });
    tokens.sort((a, b) => b.y - a.y || a.x - b.x);
    let cur = null;
    tokens.forEach((t) => {
      if (!cur || Math.abs(cur.y - t.y) > LINE_TOL) {
        cur = { y: t.y, gy: pi * 100000 - t.y, words: [] };
        lines.push(cur);
      }
      cur.words.push(t);
    });
  });
  lines.forEach((l) => {
    l.words.sort((a, b) => a.x - b.x);
    l.text = l.words.map((w) => w.text).join(' ');
  });
  const allText = lines.map((l) => l.text).join('\n');

  // 2. Kepala dokumen.
  const period = allText.match(/Periode\s*:\s*(\d{2})\/(\d{2})\/(\d{4})\s*s\/d\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  const balances = [...allText.matchAll(/Saldo\s+riil\s+awal\s+per\s+\d{2}\/\d{2}\/\d{4}\s*:\s*([\d,]+\.\d{2})/gi)];
  const totKredit = allText.match(/Total\s+Kredit[^:]*:\s*([\d,]+\.\d{2})/i);
  const totDebet = allText.match(/Total\s+Debet[^:]*:\s*([\d,]+\.\d{2})/i);
  const acct = allText.match(/REKENING\s*:\s*(?:IDR\s*)?(\d{6,})/i);
  const meta = {
    accountNo: acct ? acct[1] : null,
    periodStart: period ? `${period[3]}-${period[2]}-${period[1]}` : null,
    periodEnd: period ? `${period[6]}-${period[5]}-${period[4]}` : null,
    openingBalance: balances[0] ? toNumber(balances[0][1]) : null,
    closingBalance: balances[1] ? toNumber(balances[1][1]) : null,
    headerTotalCredit: totKredit ? toNumber(totKredit[1]) : null,
    headerTotalDebit: totDebet ? toNumber(totDebet[1]) : null,
  };

  // 3. Jangkar baris transaksi + penanda tanggal/jam.
  const anchors = lines.filter((l) => l.words.filter((w) => AMOUNT_RE.test(w.text)).length >= 2);
  const anchorSet = new Set(anchors);
  const dateWords = [];
  const timeWords = [];
  lines.forEach((l, li) => {
    l.words.forEach((w) => {
      if (DATE_RE.test(w.text)) dateWords.push({ w, line: l, li });
      else if (TIME_RE.test(w.text)) timeWords.push({ w, line: l, li });
    });
  });
  const firstDateGy = dateWords.length ? dateWords[0].line.gy : Infinity;

  const rows = anchors.map((a) => ({ anchor: a, lines: [a] }));
  lines.forEach((l) => {
    if (anchorSet.has(l) || l.gy < firstDateGy - LINE_TOL) return;
    let best = null;
    rows.forEach((r) => {
      const d = Math.abs(r.anchor.gy - l.gy);
      if (!best || d < best.d) best = { r, d };
    });
    if (best) best.r.lines.push(l);
  });

  // 4. Bentuk transaksi.
  const warnings = [];
  const all = [];
  let prevSaldo = meta.openingBalance;
  let balanceMismatch = 0;
  rows.forEach((r, idx) => {
    r.lines.sort((a, b) => a.gy - b.gy);
    const amounts = r.anchor.words.filter((w) => AMOUNT_RE.test(w.text));
    const saldo = toNumber(amounts[amounts.length - 1].text);
    const txnTok = amounts[amounts.length - 2].text;
    const amount = toNumber(txnTok);
    const isDebit = txnTok.endsWith('-');

    if (prevSaldo != null) {
      const expected = prevSaldo + (isDebit ? -amount : amount);
      if (Math.abs(expected - saldo) > 0.5) balanceMismatch += 1;
    }
    prevSaldo = saldo;

    // tanggal = tanggal terakhir yang berada di atas / sejajar jangkar
    let dateHit = null;
    dateWords.forEach((d) => { if (d.line.gy <= r.anchor.gy + LINE_TOL) dateHit = d; });
    if (!dateHit) { warnings.push(`Baris ${idx + 1}: tanggal tidak ditemukan`); return; }
    const dm = dateHit.w.text.match(DATE_RE);
    const dateStr = `${dm[3]}-${dm[2]}-${dm[1]}`;
    const nextDate = dateWords.find((d) => d.li > dateHit.li);
    const timeHit = timeWords.find((t) => t.li >= dateHit.li && (!nextDate || t.li < nextDate.li));
    const time = timeHit ? timeHit.w.text.replace('.', ':') : null;

    const text = r.lines.map((l) => l.text).join(' ');
    all.push({ idx, dateStr, time, amount, isDebit, saldo, text });
  });

  const credits = [];
  all.forEach((t) => {
    if (t.isDebit) return;
    const qr = t.text.match(/\bQR\s+(\d{2})(\d{2})(\d{2})\s+(\S+)/);
    let type = 'other';
    let qrDateStr = null;
    let desc = '';
    if (qr) {
      type = 'qris';
      qrDateStr = `20${qr[3]}-${qr[2]}-${qr[1]}`;
      desc = `QR ${qr[1]}${qr[2]}${qr[3]} ${qr[4]}`;
    } else if (/TRF\s+Dari/i.test(t.text)) {
      type = 'transfer';
      const after = t.text.split(/TRF\s+Dari\s*-?\s*/i)[1] || '';
      const name = after.split(/\s+/)
        .filter((x) => x && !AMOUNT_RE.test(x) && !/\d/.test(x) && !NOISE.has(x.toUpperCase()))
        .slice(0, 4).join(' ');
      desc = `TRF Dari - ${name}`.trim();
      if (/\bQRIS\b/i.test(t.text)) desc = `QRIS (BSI) ${desc}`;
    } else if (/\b\d{15,}\b/.test(t.text)) {
      type = 'debit';
      desc = `Debit ${t.text.match(/\b\d{15,}\b/)[0]}`;
    } else {
      desc = t.text.replace(/\s+/g, ' ').slice(0, 60);
    }
    const ref = (t.text.match(/\bFT[0-9A-Z]{8,}/) || [])[0] || null;
    credits.push({
      id: `${t.dateStr}|${t.time || ''}|${t.amount}|${ref || t.idx}`,
      dateStr: t.dateStr,
      time: t.time,
      amount: t.amount,
      type,
      qrDateStr,
      desc,
      ref,
    });
  });

  const sumCredits = credits.reduce((s, c) => s + c.amount, 0);
  const sumDebits = all.filter((t) => t.isDebit).reduce((s, t) => s + t.amount, 0);
  const check = {
    rowCount: all.length,
    creditCount: credits.length,
    sumCredits,
    sumDebits,
    creditTotalOk: meta.headerTotalCredit == null ? null : Math.abs(meta.headerTotalCredit - sumCredits) < 1,
    debitTotalOk: meta.headerTotalDebit == null ? null : Math.abs(meta.headerTotalDebit - sumDebits) < 1,
    balanceMismatch,
  };
  return { meta, credits, check, warnings };
};

export const parseMutasiPdf = async (file) => {
  const pages = await extractPagesWords(file);
  const out = parseMutasiWords(pages);
  if (out.credits.length === 0 && out.check.rowCount === 0) {
    throw new Error('Format PDF tidak dikenali. Pastikan ini file "Mutasi Rekening" BSI (PDF dari BSINet).');
  }
  return out;
};
