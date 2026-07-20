// src/utils/insentifDokterParser.js
//
// Parser untuk PDF "Perincian Insentif Dokter" (2 format berbeda dari sistem IHC)
// dan konversi ke Excel (.xlsx) dengan data PERSIS sama seperti di PDF.
//
// FORMAT A ("PWTT/PWT" / Pasien Jaminan - Rawat Jalan/Inap):
//   Kolom: No, No Reg, Nama Pasien, Deskripsi, Tanggal, Qty, Jasa Medis, Jaminan, Pribadi
//   Contoh header PDF: "PERINCIAN INSENTIF DOKTER PRAKTEK SWASTA PASIEN JAMINAN ( PWTT/PWT )"
//
// FORMAT B ("BPJS INDIVIDU"):
//   Kolom: No, No Reg, Nama Pasien, Tanggal, Desc Transaksi, Nilai Bill, Nilai Inacbg,
//          Koef, Qty, Jasa Medis (Tarif), Jasa Medis (Diterima), Total
//   Contoh header PDF: "PERINCIAN INSENTIF JASA DOKTER BPJS INDIVIDU (Rawat Jalan)"
//
// Pendekatan: baca posisi x/y setiap kata dari layer teks PDF (pdf.js), kelompokkan
// per baris berdasarkan y, lalu petakan tiap kata ke kolom berdasarkan posisi x
// (bukan menebak dari kata kunci) â€” supaya hasilnya presisi sama seperti tabel asli.

import * as XLSX from 'xlsx';

// â”€â”€ Loader pdf.js (pola sama seperti BSIMutasiReconciliation.jsx) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function ensurePdfJs() {
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

// â”€â”€ Ambil semua kata + posisi (x, y) per halaman â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function extractPagesWords(file) {
  const pdfjsLib = await ensurePdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const words = content.items
      .filter((it) => it.str && it.str.trim().length > 0)
      .map((it) => ({
        text: it.str.trim(),
        x: it.transform[4],
        y: it.transform[5],
      }));
    pages.push(words);
  }
  return pages;
}

// â”€â”€ Kelompokkan kata jadi baris berdasarkan y (toleransi kecil) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function clusterLines(words, yTol = 3) {
  // pdf.js: y makin besar = makin ke atas halaman â†’ urutkan descending
  const sorted = [...words].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  let cur = [];
  let curY = null;
  for (const w of sorted) {
    if (curY === null || Math.abs(w.y - curY) <= yTol) {
      cur.push(w);
      if (curY === null) curY = w.y;
    } else {
      lines.push(cur);
      cur = [w];
      curY = w.y;
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

// â”€â”€ Fallback tangguh: cari angka "JUMLAH PENDAPATAN ... PPH <angka>" â”€â”€â”€â”€â”€â”€â”€
// Tidak bergantung pengelompokan baris (kadang PDF memisah baris teks dan
// baris angka totalnya sedikit berbeda tinggi saat dirender oleh pdf.js).
function findJumlahBersihFallback(pages) {
  for (const pageWords of pages) {
    const sorted = [...pageWords].sort((a, b) => b.y - a.y || a.x - b.x);
    const idx = sorted.findIndex((w) => w.text.toUpperCase() === 'PPH');
    if (idx === -1) continue;
    for (let i = idx + 1; i < sorted.length && i < idx + 6; i++) {
      const t = sorted[i].text.replace(/[^\d.]/g, '');
      if (t.length >= 3 && /^\d[\d.]*$/.test(t)) return t;
    }
  }
  return null;
}

function bucketOf(x, bounds) {
  let name = bounds[0][1];
  for (const [start, nm] of bounds) {
    if (x >= start) name = nm;
    else break;
  }
  return name;
}

function lineToCols(line, bounds) {
  const cols = {};
  const sortedLine = [...line].sort((a, b) => a.x - b.x);
  for (const w of sortedLine) {
    const b = bucketOf(w.x, bounds);
    if (!cols[b]) cols[b] = [];
    cols[b].push(w.text);
  }
  const out = {};
  for (const k in cols) out[k] = cols[k].join(' ');
  return out;
}

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;
const REG_RE = /^R?\d{6,}$/;

// â”€â”€ Deteksi format dari teks halaman pertama â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function detectFormat(firstPageWords) {
  const text = firstPageWords.map((w) => w.text).join(' ').toUpperCase();
  if (text.includes('BPJS INDIVIDU')) return 'B';
  if (text.includes('PASIEN JAMINAN') || text.includes('STATUS PASIEN')) return 'A';
  return null;
}

// â”€â”€ FORMAT A: PWTT/PWT Pasien Jaminan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PENTING: posisi kolom TIDAK di-hardcode, karena beda file PDF (beda ukuran
// halaman / template) punya koordinat piksel yang beda, dan jumlah sub-kolom
// TIPE PASIEN bisa 2 (JAMINAN, PRIBADI) atau 4 (PERTAMINA, PERTAMEDIKA,
// JAMINAN, PRIBADI). Jadi kita deteksi batas kolom langsung dari baris header
// tiap file, lalu hitung batasnya dengan bobot K supaya teks kolom (Nama/
// Deskripsi) yang panjang tidak kepotong, sementara kolom angka (kanan-rata)
// tetap terbaca benar.
const SUB_HEADER_TOKENS = ['PERTAMINA', 'PERTAMEDIKA', 'JAMINAN', 'PRIBADI'];
const BOUNDS_A_FALLBACK = [
  [0, 'no'], [46, 'noreg'], [100, 'nama'], [240, 'desk'],
  [400, 'tanggal'], [465, 'qty'], [495, 'jasamedis'],
  [580, 'jaminan'], [690, 'pribadi'],
];

// Klasifikasi 1 token header kolom pertama (No/No Reg/Nama/Deskripsi/Tanggal/Qty/Jasa Medis).
// Pakai pencocokan "berisi kata" (bukan sama persis) karena pdf.js kadang
// menggabungkan label 2 kata ("No Reg", "Nama Pasien", "Jasa Medis") jadi 1 token,
// tapi kadang juga memisahnya â€” jadi harus tahan terhadap keduanya.
function classifyHeaderToken(t) {
  if (t === 'No') return 'no';
  if (t === 'Qty') return 'qty';
  if (/\bReg\b/.test(t)) return 'noreg';
  if (t.includes('Nama')) return 'nama';
  if (t.includes('Deskripsi')) return 'desk';
  if (t.includes('Tanggal')) return 'tanggal';
  if (t.includes('Jasa')) return 'jasamedis';
  return null;
}

// Bobot batas kolom beda-beda tergantung jenis kolom:
// - Kolom teks/struktural (no, noreg, nama, desk, tanggal, qty): datanya biasanya
//   mulai SEBELUM posisi header sendiri â†’ butuh K kecil (batas digeser ke kiri).
// - Kolom angka uang rata-kanan (jasamedis, pertamina, pertamedika, jaminan,
//   pribadi): datanya mulai SESUDAH posisi header sendiri â†’ butuh K besar/1
//   (batas = posisi header kolom itu sendiri) supaya tidak "kemakan" kolom
//   angka sebelumnya yang sama-sama bergeser ke kanan.
const MONEY_KEYS = new Set(['jasamedis', 'pertamina', 'pertamedika', 'jaminan', 'pribadi']);
function boundaryWeightFor(key) {
  return MONEY_KEYS.has(key) ? 1.0 : 0.4;
}

function detectFormatABounds(pages) {
  for (const pageWords of pages.slice(0, 3)) {
    const lines = clusterLines(pageWords);
    let anchors = [];
    let foundHeader1 = false;
    let foundHeader2 = false;

    for (const line of lines) {
      const sorted = [...line].sort((a, b) => a.x - b.x);

      if (!foundHeader1) {
        const classified = sorted
          .map((w) => ({ key: classifyHeaderToken(w.text), x0: w.x }))
          .filter((c) => c.key);
        const keys = classified.map((c) => c.key);
        if (keys.includes('nama') && keys.includes('desk') && keys.includes('tanggal') && keys.includes('qty')) {
          anchors.push(...classified);
          foundHeader1 = true;
          continue;
        }
      }

      const texts = sorted.map((w) => w.text);
      const foundSub = SUB_HEADER_TOKENS.filter((c) => texts.includes(c));
      if (!foundHeader2 && foundSub.length >= 2) {
        for (const c of SUB_HEADER_TOKENS) {
          const idx = sorted.findIndex((w) => w.text === c);
          if (idx >= 0) anchors.push({ key: c.toLowerCase(), x0: sorted[idx].x });
        }
        foundHeader2 = true;
      }
      if (foundHeader1 && foundHeader2) break;
    }

    if (foundHeader1 && foundHeader2 && anchors.length >= 6) {
      anchors.sort((a, b) => a.x0 - b.x0);
      const seen = new Set();
      anchors = anchors.filter((a) => {
        if (seen.has(a.key)) return false;
        seen.add(a.key);
        return true;
      });
      const bounds = [[0, anchors[0].key]];
      for (let i = 1; i < anchors.length; i++) {
        const prev = anchors[i - 1].x0;
        const cur = anchors[i].x0;
        const K = boundaryWeightFor(anchors[i].key);
        bounds.push([prev + K * (cur - prev), anchors[i].key]);
      }
      // Urutan sub-kolom TIPE PASIEN (dari kiri ke kanan) sesuai yang ditemukan
      // di header utama â€” dipakai untuk membaca kotak ringkasan TIPE/KONSUL/dst
      // di footer, karena kotak itu punya posisi kolom SENDIRI yang berbeda dari
      // tabel data utama (bukan lanjutan tabel, jadi tidak bisa pakai `bounds`).
      const subColOrder = anchors
        .filter((a) => MONEY_KEYS.has(a.key) && a.key !== 'jasamedis')
        .map((a) => a.key);
      return { bounds, subColOrder };
    }
  }
  return null;
}

const FOOTER_MARKERS_A = ['TIPE', 'KONSUL', 'VISITE', 'TINDAKAN', 'TOTAL', 'JUMLAH'];
const SUB_COL_KEYS = ['pertamina', 'pertamedika', 'jaminan', 'pribadi'];

function parseFormatA(pages) {
  const detected = detectFormatABounds(pages);
  const bounds = detected ? detected.bounds : BOUNDS_A_FALLBACK;
  const subColOrder = detected ? detected.subColOrder : ['jaminan', 'pribadi'];
  const rows = [];
  let cur = null;
  const summary = {};
  let footerStarted = false;

  for (const pageWords of pages) {
    const lines = clusterLines(pageWords);
    for (const line of lines) {
      const sortedLine = [...line].sort((a, b) => a.x - b.x);
      const lineText = sortedLine.map((w) => w.text).join(' ');

      if (
        lineText.startsWith('Hal ') || lineText.startsWith('PERINCIAN') ||
        lineText.startsWith('Periode') || lineText.startsWith('TIPE PASIEN') ||
        lineText.startsWith('STATUS PASIEN') || lineText.startsWith('No No Reg') ||
        lineText.startsWith('No Reg Nama')
      ) continue;

      const firstWord = sortedLine[0]?.text || '';
      const lineTextUpper = lineText.trim().toUpperCase();
      const isFooterLine = FOOTER_MARKERS_A.some((m) => firstWord === m || lineTextUpper.startsWith(m));
      if (isFooterLine) {
        footerStarted = true;
        const rowType = lineTextUpper.split(/\s+/)[0];
        if (['KONSUL', 'VISITE', 'TINDAKAN', 'TOTAL'].includes(rowType)) {
          // Kotak ringkasan TIPE/KONSUL/dst di footer punya posisi kolom SENDIRI
          // (bukan lanjutan tabel data utama), jadi dibaca berdasarkan URUTAN
          // angka pada baris itu (sesuai urutan sub-kolom di header), bukan
          // posisi piksel `bounds` punya tabel data.
          const toks = lineText.trim().split(/\s+/).slice(1);
          const entry = {};
          subColOrder.forEach((key, i) => { entry[key] = toks[i] || ''; });
          summary[rowType.toLowerCase()] = entry;
        } else if (rowType === 'JUMLAH') {
          const toks = lineText.trim().split(/\s+/);
          summary.jumlahBersih = toks[toks.length - 1];
        }
        continue;
      }
      if (footerStarted) continue;

      const cols = lineToCols(line, bounds);
      const noreg = (cols.noreg || '').trim();
      const isNewRow = REG_RE.test(noreg);

      if (isNewRow) {
        if (cur) rows.push(cur);
        cur = {
          no: String(rows.length + 1),
          noReg: noreg,
          namaPasien: (cols.nama || '').trim(),
          deskripsi: (cols.desk || '').trim(),
          tanggal: (cols.tanggal || '').trim(),
          qty: (cols.qty || '').trim(),
          jasaMedis: (cols.jasamedis || '').trim(),
          pertamina: (cols.pertamina || '').trim(),
          pertamedika: (cols.pertamedika || '').trim(),
          jaminan: (cols.jaminan || '').trim(),
          pribadi: (cols.pribadi || '').trim(),
        };
      } else {
        if (!cur) continue;
        // Jaring pengaman: baris "lanjutan" (No Reg tidak valid di kolom itu)
        // seharusnya cuma teks Deskripsi/Nama yang meluber ke baris ke-2, jadi
        // kolom uangnya kosong. Kalau ternyata baris ini justru punya nilai
        // Jasa Medis SENDIRI padahal baris yang sedang diproses (`cur`) SUDAH
        // punya nilai Jasa Medis, berarti ini transaksi lain (deskripsi lain,
        // tanggal & pasien sama) yang salah terdeteksi sebagai lanjutan —
        // pisahkan jadi baris baru supaya nilainya tidak hilang/tertimpa.
        const jasaMedisBaru = (cols.jasamedis || '').trim();
        if (jasaMedisBaru && cur.jasaMedis) {
          rows.push(cur);
          cur = {
            no: String(rows.length + 1),
            noReg: cur.noReg,
            namaPasien: cur.namaPasien,
            deskripsi: (cols.desk || '').trim(),
            tanggal: cur.tanggal,
            qty: (cols.qty || '').trim(),
            jasaMedis: jasaMedisBaru,
            pertamina: (cols.pertamina || '').trim(),
            pertamedika: (cols.pertamedika || '').trim(),
            jaminan: (cols.jaminan || '').trim(),
            pribadi: (cols.pribadi || '').trim(),
          };
          continue;
        }
        if (cols.desk) cur.deskripsi += ' ' + cols.desk.trim();
        if (cols.nama) cur.namaPasien += ' ' + cols.nama.trim();
        if (cols.tanggal && !cur.tanggal) cur.tanggal = cols.tanggal.trim();
        if (cols.qty && !cur.qty) cur.qty = cols.qty.trim();
        if (jasaMedisBaru && !cur.jasaMedis) cur.jasaMedis = jasaMedisBaru;
        if (cols.pertamina && !cur.pertamina) cur.pertamina = cols.pertamina.trim();
        if (cols.pertamedika && !cur.pertamedika) cur.pertamedika = cols.pertamedika.trim();
        if (cols.jaminan && !cur.jaminan) cur.jaminan = cols.jaminan.trim();
        if (cols.pribadi && !cur.pribadi) cur.pribadi = cols.pribadi.trim();
      }
    }
  }
  if (cur) rows.push(cur);

  return { rows, summary };
}

// â”€â”€ FORMAT B: BPJS Individu â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// PENTING: posisi kolom di-deteksi dari baris header tiap file (sama seperti
// Format A) alih-alih di-hardcode. Nilai piksel yang di-hardcode sebelumnya
// terbukti TIDAK cocok untuk sebagian file BPJS nyata (kolom "Dokter"/teks
// header lain ikut kebaca sebagai bagian dari Desc Transaksi), yang bikin
// deskripsi tercampur nama dokter dan bikin pencocokan "hari yang sama"
// jadi salah. BOUNDS_B di bawah cuma dipakai sebagai fallback kalau header
// gagal terdeteksi.
const BOUNDS_B = [
  [0, 'no'], [30, 'noreg'], [80, 'nama'], [210, 'tanggal'], [255, 'desc'],
  [420, 'nilaibill'], [470, 'nilaiinacbg'], [515, 'koef'], [550, 'qty'],
  [580, 'tarif'], [630, 'diterima'], [700, 'total'],
];

function classifyHeaderTokenB(t) {
  if (t === 'No') return 'no';
  if (t === 'Qty' || t === 'Koef') return t.toLowerCase();
  if (/Reg/i.test(t)) return 'noreg';
  if (/Nama/i.test(t)) return 'nama';
  if (/Dokter/i.test(t)) return 'dokter';
  if (/Tanggal/i.test(t)) return 'tanggal';
  if (/Desc|Transaksi/i.test(t)) return 'desc';
  if (/Inacbg/i.test(t)) return 'nilaiinacbg';
  if (/Bill/i.test(t)) return 'nilaibill';
  if (/Tarif/i.test(t)) return 'tarif';
  if (/Diterima/i.test(t)) return 'diterima';
  if (/Total/i.test(t)) return 'total';
  return null;
}

// Kolom teks/struktural butuh batas digeser ke kiri (K kecil) supaya nama/
// deskripsi yang meluber tidak "kemakan" ke kolom berikutnya; kolom angka
// rata-kanan butuh batas = posisi header itu sendiri (K=1) seperti di Format A.
const MONEY_KEYS_B = new Set(['nilaibill', 'nilaiinacbg', 'koef', 'qty', 'tarif', 'diterima', 'total']);
function boundaryWeightForB(key) {
  return MONEY_KEYS_B.has(key) ? 1.0 : 0.4;
}

function detectFormatBBounds(pages) {
  for (const pageWords of pages.slice(0, 3)) {
    const lines = clusterLines(pageWords);
    for (const line of lines) {
      const sorted = [...line].sort((a, b) => a.x - b.x);
      const classified = sorted
        .map((w) => ({ key: classifyHeaderTokenB(w.text), x0: w.x }))
        .filter((c) => c.key);
      const keys = new Set(classified.map((c) => c.key));
      const requiredKeys = ['noreg', 'nama', 'tanggal', 'desc'];
      if (!requiredKeys.every((k) => keys.has(k))) continue;
      // Butuh minimal beberapa anchor kolom angka juga di baris yang sama,
      // supaya bukan cuma header kolom teks yang ke-deteksi (kalau kolom
      // angka labelnya ternyata di baris terpisah, batas mereka tidak akan
      // akurat â€” lebih aman fallback ke BOUNDS_B daripada memaksakan).
      const moneyAnchors = classified.filter((c) => MONEY_KEYS_B.has(c.key));
      if (moneyAnchors.length < 3) continue;

      let anchors = [...classified];
      anchors.sort((a, b) => a.x0 - b.x0);
      const seen = new Set();
      anchors = anchors.filter((a) => {
        if (seen.has(a.key)) return false;
        seen.add(a.key);
        return true;
      });
      const bounds = [[0, anchors[0].key]];
      for (let i = 1; i < anchors.length; i++) {
        const prev = anchors[i - 1].x0;
        const curX = anchors[i].x0;
        const K = boundaryWeightForB(anchors[i].key);
        bounds.push([prev + K * (curX - prev), anchors[i].key]);
      }
      return bounds;
    }
  }
  return null;
}

function parseFormatB(pages) {
  const bounds = detectFormatBBounds(pages) || BOUNDS_B;
  const rows = [];
  let cur = null;
  const summary = {};
  let footerStarted = false;

  for (const pageWords of pages) {
    const lines = clusterLines(pageWords);
    for (const line of lines) {
      const sortedLine = [...line].sort((a, b) => a.x - b.x);
      const lineText = sortedLine.map((w) => w.text).join(' ');
      const firstWord = sortedLine[0]?.text || '';

      if (
        lineText.startsWith('Page ') || lineText.startsWith('Hal ') ||
        lineText.startsWith('PERINCIAN') || lineText.startsWith('STATUS PASIEN') ||
        lineText.startsWith('Periode') || lineText.startsWith('Faktor Jasa Medis') ||
        lineText.startsWith('No Reg No Nama') || lineText.startsWith('No No Reg') ||
        DATE_RE.test(lineText.trim())
      ) continue;

      if (lineText.trim().toUpperCase().startsWith('JUMLAH')) {
        footerStarted = true;
        const toks = lineText.trim().split(/\s+/);
        summary.jumlahBersih = toks[toks.length - 1];
        continue;
      }
      if (footerStarted) continue;

      const cols = lineToCols(line, bounds);
      const tanggal = (cols.tanggal || '').trim();
      const isNewRow = DATE_RE.test(tanggal);

      if (isNewRow) {
        if (cur) rows.push(cur);
        cur = {
          no: String(rows.length + 1),
          noReg: (cols.noreg || '').trim(),
          namaPasien: (cols.nama || '').trim(),
          tanggal,
          descTransaksi: (cols.desc || '').trim(),
          nilaiBill: (cols.nilaibill || '').trim(),
          nilaiInacbg: (cols.nilaiinacbg || '').trim(),
          koef: (cols.koef || '').trim(),
          qty: (cols.qty || '').trim(),
          jasaMedisTarif: (cols.tarif || '').trim(),
          jasaMedisDiterima: (cols.diterima || '').trim(),
          total: (cols.total || '').trim(),
        };
      } else {
        if (!cur) continue;
        // Jaring pengaman: baris lanjutan (bukan awal transaksi baru menurut
        // kolom Tanggal) seharusnya cuma Nama/Desc yang meluber ke baris
        // ke-2, jadi kolom Total-nya kosong. Kalau baris ini justru punya
        // nilai Total SENDIRI padahal `cur` sudah punya Total, berarti ini
        // transaksi lain (deskripsi lain, tanggal & pasien sama) yang salah
        // terdeteksi sebagai lanjutan — pisahkan jadi baris baru.
        const totalBaru = (cols.total || '').trim();
        if (totalBaru && cur.total) {
          rows.push(cur);
          cur = {
            no: String(rows.length + 1),
            noReg: cur.noReg,
            namaPasien: cur.namaPasien,
            tanggal: cur.tanggal,
            descTransaksi: (cols.desc || '').trim(),
            nilaiBill: (cols.nilaibill || '').trim(),
            nilaiInacbg: (cols.nilaiinacbg || '').trim(),
            koef: (cols.koef || '').trim(),
            qty: (cols.qty || '').trim(),
            jasaMedisTarif: (cols.tarif || '').trim(),
            jasaMedisDiterima: (cols.diterima || '').trim(),
            total: totalBaru,
          };
          continue;
        }
        if (cols.nama) cur.namaPasien += ' ' + cols.nama.trim();
        if (cols.desc) cur.descTransaksi += ' ' + cols.desc.trim();
        if (cols.nilaibill && !cur.nilaiBill) cur.nilaiBill = cols.nilaibill.trim();
        if (cols.nilaiinacbg && !cur.nilaiInacbg) cur.nilaiInacbg = cols.nilaiinacbg.trim();
        if (cols.koef && !cur.koef) cur.koef = cols.koef.trim();
        if (cols.qty && !cur.qty) cur.qty = cols.qty.trim();
        if (cols.tarif && !cur.jasaMedisTarif) cur.jasaMedisTarif = cols.tarif.trim();
        if (cols.diterima && !cur.jasaMedisDiterima) cur.jasaMedisDiterima = cols.diterima.trim();
        if (totalBaru && !cur.total) cur.total = totalBaru;
      }
    }
  }
  if (cur) rows.push(cur);

  return { rows, summary };
}

// â”€â”€ Helper angka format Indonesia "1.234.567" â†’ number â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function toNumber(str) {
  if (!str) return 0;
  const n = parseFloat(String(str).replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

// Bangun laporan rekap terpisah per jenis asuransi dari hasil parsing.
// BPJS: nilainya ada di kolom TOTAL, direkap per Desc Transaksi.
// Jaminan (PWTT/PWT): nilainya ada di sub-kolom TIPE PASIEN (Pertamina/
// Pertamedika/Jaminan/Pribadi) - masing-masing direkap terpisah per
// Deskripsi, hanya menghitung baris yang punya nilai (>0) di sub-kolom itu.
const JAMINAN_SUBTYPE_LABELS = {
  pertamina: 'Pertamina',
  pertamedika: 'Pertamedika',
  jaminan: 'Jaminan',
  pribadi: 'Pribadi',
};

export function buildInsentifDokterReport(results) {
  const bpjsRows = [];
  const jaminanRows = [];
  (results || []).forEach((res) => {
    if (res.format === 'B') bpjsRows.push(...res.rows);
    else if (res.format === 'A') jaminanRows.push(...res.rows);
  });

  // BPJS: baris "KONSUL DOKTER" menandai bahwa pasien tsb kontrol/periksa ke
  // dokter pada tanggal itu. Untuk deskripsi lain (tindakan dsb), nominalnya
  // dipisah jadi 2 kelompok: terjadi di hari yang SAMA dengan Konsul Dokter
  // pasien itu, vs terjadi di hari pasien itu TIDAK konsul dokter.
  const KONSUL_RE = /KONSUL/i;
  const konsulDays = new Set();
  bpjsRows.forEach((r) => {
    if (KONSUL_RE.test(r.descTransaksi || '')) {
      konsulDays.add(`${r.noReg}|${r.tanggal}`);
    }
  });

  const bpjsByDesc = {};
  bpjsRows.forEach((r) => {
    const key = (r.descTransaksi || '(Tanpa Deskripsi)').trim();
    const val = toNumber(r.total);
    const isKonsul = KONSUL_RE.test(r.descTransaksi || '');
    const sameDayHasKonsul = konsulDays.has(`${r.noReg}|${r.tanggal}`);

    if (!bpjsByDesc[key]) {
      bpjsByDesc[key] = {
        deskripsi: key,
        isKonsul,
        count: 0,
        total: 0,
        denganKonsulDokter: { count: 0, total: 0 },
        tanpaKonsulDokter: { count: 0, total: 0 },
      };
    }
    const entry = bpjsByDesc[key];
    entry.count += 1;
    entry.total += val;
    const bucket = (isKonsul || sameDayHasKonsul) ? entry.denganKonsulDokter : entry.tanpaKonsulDokter;
    bucket.count += 1;
    bucket.total += val;
  });
  const bpjsByDeskripsi = Object.values(bpjsByDesc).sort((a, b) => b.total - a.total);
  const bpjs = {
    count: bpjsRows.length,
    total: bpjsByDeskripsi.reduce((s, r) => s + r.total, 0),
    byDeskripsi: bpjsByDeskripsi,
  };

  const jaminan = {};
  Object.keys(JAMINAN_SUBTYPE_LABELS).forEach((key) => {
    const byDesc = {};
    jaminanRows.forEach((r) => {
      const val = toNumber(r[key]);
      if (!val) return;
      const deskKey = (r.deskripsi || '(Tanpa Deskripsi)').trim();
      if (!byDesc[deskKey]) byDesc[deskKey] = { deskripsi: deskKey, count: 0, total: 0 };
      byDesc[deskKey].count += 1;
      byDesc[deskKey].total += val;
    });
    const byDeskripsi = Object.values(byDesc).sort((a, b) => b.total - a.total);
    jaminan[key] = {
      label: JAMINAN_SUBTYPE_LABELS[key],
      count: byDeskripsi.reduce((s, r) => s + r.count, 0),
      total: byDeskripsi.reduce((s, r) => s + r.total, 0),
      byDeskripsi,
    };
  });

  return { bpjs, jaminan };
}

// â”€â”€ Fungsi utama: parse 1 file PDF â†’ { format, rows, summary, verification, meta } â”€
export async function parseInsentifDokterPdf(file) {
  const pages = await extractPagesWords(file);
  if (!pages.length) throw new Error('PDF kosong atau tidak terbaca.');

  const format = detectFormat(pages[0]);
  if (!format) {
    throw new Error(
      'Format PDF tidak dikenali. Pastikan file adalah PDF "Perincian Insentif Dokter" ' +
      'dari sistem IHC (format PWTT/PWT atau BPJS Individu).'
    );
  }

  const parsed = format === 'A' ? parseFormatA(pages) : parseFormatB(pages);

  // Format A: baris "TOTAL" (dari tabel KONSUL/VISITE/TINDAKAN/TOTAL) terbukti
  // selalu terbaca akurat, dan nilainya SAMA dengan "JUMLAH PENDAPATAN...PPH".
  // Pakai ini sebagai sumber utama karena posisi baris PPH kadang tidak stabil
  // saat dirender pdf.js (suka kepisah baris dari angkanya).
  if (format === 'A') {
    const t = parsed.summary.total || {};
    const totalFromTable = SUB_COL_KEYS.reduce((s, k) => s + toNumber(t[k]), 0);
    if (totalFromTable > 0) {
      parsed.summary.jumlahBersih = String(totalFromTable);
    }
  }

  // Jaring pengaman terakhir: kalau masih kosong, cari lewat kata "PPH" langsung.
  if (!parsed.summary.jumlahBersih || toNumber(parsed.summary.jumlahBersih) === 0) {
    const fallback = findJumlahBersihFallback(pages);
    if (fallback) parsed.summary.jumlahBersih = fallback;
  }

  // Verifikasi: total hasil parsing harus sama dengan total yang tercetak di PDF
  const calcTotal = format === 'A'
    ? parsed.rows.reduce((s, r) => s + SUB_COL_KEYS.reduce((s2, k) => s2 + toNumber(r[k]), 0), 0)
    : parsed.rows.reduce((s, r) => s + toNumber(r.total), 0);
  const printedTotal = toNumber(parsed.summary.jumlahBersih);
  const selisihAbs = Math.abs(calcTotal - printedTotal);
  // Toleransi kecil: PDF sumber (terutama laporan BPJS) kadang punya selisih
  // pembulatan beberapa ratus rupiah antara jumlah baris vs grand total yang
  // dicetak sendiri oleh sistem asalnya â€” ini bukan kesalahan ekstraksi.
  const ROUNDING_TOLERANCE = 1000; // Rp
  const isVerified = printedTotal > 0 && selisihAbs < 1;
  const isMinorRounding = printedTotal > 0 && selisihAbs >= 1 && selisihAbs <= ROUNDING_TOLERANCE;

  return {
    format,
    fileName: file.name,
    rows: parsed.rows,
    summary: parsed.summary,
    verification: {
      calcTotal,
      printedTotal,
      isVerified,
      isMinorRounding,
      selisih: calcTotal - printedTotal,
    },
  };
}

// â”€â”€ Generate file Excel dari hasil parsing (1 atau lebih file) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function generateInsentifDokterExcel(results, periodeLabel = '') {
  const workbook = XLSX.utils.book_new();

  results.forEach((res, idx) => {
    const sheetName = `${idx + 1}_${res.format}_${res.fileName}`.slice(0, 31).replace(/[\\/*?[\]:]/g, '_');

    let aoa = [];
    if (res.format === 'A') {
      const hasSubCols = res.rows.some((r) => r.pertamina || r.pertamedika);
      aoa.push(['PERINCIAN INSENTIF DOKTER PRAKTEK SWASTA PASIEN JAMINAN ( PWTT/PWT )']);
      if (periodeLabel) aoa.push([`Periode: ${periodeLabel}`]);
      aoa.push([`File asal: ${res.fileName}`]);
      aoa.push([]);
      const headerA = ['No', 'No Reg', 'Nama Pasien', 'Deskripsi', 'Tanggal', 'Qty', 'Jasa Medis'];
      if (hasSubCols) headerA.push('Pertamina', 'Pertamedika');
      headerA.push('Jaminan', 'Pribadi');
      aoa.push(headerA);
      res.rows.forEach((r) => {
        const row = [
          r.no, r.noReg, r.namaPasien, r.deskripsi, r.tanggal,
          r.qty, toNumber(r.jasaMedis),
        ];
        if (hasSubCols) row.push(toNumber(r.pertamina), toNumber(r.pertamedika));
        row.push(toNumber(r.jaminan), toNumber(r.pribadi));
        aoa.push(row);
      });
      aoa.push([]);
      const pad = new Array(headerA.length - 3).fill('');
      const summaryHeader = hasSubCols
        ? ['TIPE', 'PERTAMINA', 'PERTAMEDIKA', 'JAMINAN', 'PRIBADI']
        : ['TIPE', 'JAMINAN', 'PRIBADI'];
      aoa.push([...pad, ...summaryHeader]);
      const summaryRow = (label) => {
        const t = res.summary[label.toLowerCase()] || {};
        const vals = hasSubCols
          ? [toNumber(t.pertamina), toNumber(t.pertamedika), toNumber(t.jaminan), toNumber(t.pribadi)]
          : [toNumber(t.jaminan), toNumber(t.pribadi)];
        return [...pad, label, ...vals];
      };
      if (res.summary.konsul) aoa.push(summaryRow('KONSUL'));
      if (res.summary.visite) aoa.push(summaryRow('VISITE'));
      if (res.summary.tindakan) aoa.push(summaryRow('TINDAKAN'));
      if (res.summary.total) aoa.push(summaryRow('TOTAL'));
      aoa.push([]);
      aoa.push(['JUMLAH PENDAPATAN BERSIH DOKTER SBLM PPH', ...new Array(headerA.length - 2).fill(''), toNumber(res.summary.jumlahBersih)]);
    } else {
      aoa.push(['PERINCIAN INSENTIF JASA DOKTER BPJS INDIVIDU (Rawat Jalan)']);
      if (periodeLabel) aoa.push([`Periode: ${periodeLabel}`]);
      aoa.push([`File asal: ${res.fileName}`]);
      aoa.push([]);
      aoa.push([
        'No', 'No Reg', 'Nama Pasien', 'Tanggal', 'Desc Transaksi',
        'Nilai Bill', 'Nilai Inacbg', 'Koef', 'Qty',
        'Jasa Medis (Tarif)', 'Jasa Medis (Diterima)', 'Total',
      ]);
      res.rows.forEach((r) => {
        aoa.push([
          r.no, r.noReg, r.namaPasien, r.tanggal, r.descTransaksi,
          toNumber(r.nilaiBill), toNumber(r.nilaiInacbg), r.koef, r.qty,
          toNumber(r.jasaMedisTarif), toNumber(r.jasaMedisDiterima), toNumber(r.total),
        ]);
      });
      aoa.push([]);
      aoa.push(['JUMLAH PENDAPATAN BERSIH DOKTER SBLM PPH', '', '', '', '', '', '', '', '', '', '', toNumber(res.summary.jumlahBersih)]);
    }

    aoa.push([]);
    aoa.push(['--- VERIFIKASI OTOMATIS ---']);
    aoa.push(['Total hasil ekstraksi (dihitung ulang)', res.verification.calcTotal]);
    aoa.push(['Total tercetak di PDF', res.verification.printedTotal]);
    aoa.push(['Status', res.verification.isVerified ? 'COCOK âœ“' : 'TIDAK COCOK - MOHON PERIKSA MANUAL âš ï¸']);
    if (!res.verification.isVerified) {
      aoa.push(['Selisih', res.verification.selisih]);
    }

    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  });

  const fileName = `Insentif_Dokter_${periodeLabel ? periodeLabel.replace(/\s+/g, '_') + '_' : ''}${Date.now()}.xlsx`;
  XLSX.writeFile(workbook, fileName);
  return fileName;
}