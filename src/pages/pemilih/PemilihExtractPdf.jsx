import React, { useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, FileUp, Search, AlertTriangle, CheckCircle2, FileText, X } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const CONCURRENCY = 3;
// Halaman rekap KPU tabelnya besar; transkripsi satu halaman bisa lewat dari
// satu menit. Batas 60 detik sebelumnya bikin halaman yang sebenarnya berhasil
// ikut ditandai gagal.
const INVOKE_TIMEOUT_MS = 150000;

// Target sisi terpanjang ~1500px — cukup tajam untuk baca angka, tapi tetap
// di bawah batas resolusi yang dipakai Claude vision (di atas itu gambar
// cuma di-downscale ulang di sisi server, jadi kirim lebih besar tidak
// menambah ketajaman, hanya menambah ukuran payload & waktu proses).
// Skala dihitung dari ukuran halaman asli (bukan angka tetap) karena PDF
// hasil scan/olahan tool lain kadang punya MediaBox yang jauh lebih besar
// dari A4 — skala tetap bisa menghasilkan gambar raksasa yang bikin OCR
// lambat/gagal (timeout ~40an detik, lalu 502 dari Anthropic).
const TARGET_MAX_DIMENSION = 1500;

const withTimeout = (promise, ms, message) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
]);

// supabase-js hanya kasih pesan generik ("Edge Function returned a non-2xx
// status code") untuk FunctionsHttpError — pesan asli dari edge function
// (mis. error dari Anthropic API) ada di body response, harus dibaca manual.
const describeFunctionError = async (error) => {
  try {
    if (error?.context?.json) {
      const body = await error.context.json();
      if (body?.error) return body.error;
    }
  } catch (_e) { /* body bukan JSON atau sudah kebaca, pakai pesan default */ }
  return error?.message || 'Gagal memanggil server OCR';
};

const renderPageToBase64 = async (pdf, pageNumber, rotate) => {
  const page = await pdf.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const longestSide = Math.max(baseViewport.width, baseViewport.height);
  const scale = Math.min(3, Math.max(0.5, TARGET_MAX_DIMENSION / longestSide));
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  let finalCanvas = canvas;
  if (rotate) {
    const rotated = document.createElement('canvas');
    rotated.width = canvas.height;
    rotated.height = canvas.width;
    const rctx = rotated.getContext('2d');
    rctx.translate(rotated.width / 2, rotated.height / 2);
    rctx.rotate(-Math.PI / 2);
    rctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    finalCanvas = rotated;
  }

  // JPEG jauh lebih kecil dari PNG untuk halaman seperti ini (garis tabel +
  // teks di atas latar putih), yang paling menentukan cepat/lambatnya OCR.
  const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.88);
  return dataUrl.split(',')[1];
};

const normalize = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

const PemilihExtractPdf = () => {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const cancelRef = useRef(false);

  const [file, setFile] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [pageFrom, setPageFrom] = useState(1);
  const [pageTo, setPageTo] = useState(1);
  const [rotate, setRotate] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [pageResults, setPageResults] = useState([]); // [{pageNumber, is_vote_table, column_headers, rows, sheet_info, error}]
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPageResults([]);
    setSelectedKey(null);
    try {
      const buf = await f.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      setNumPages(pdf.numPages);
      setPageFrom(1);
      setPageTo(pdf.numPages);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal membaca PDF', description: err.message });
    }
  };

  const handleCancel = () => { cancelRef.current = true; };

  const handleProcess = async () => {
    if (!file) return;
    const from = Math.max(1, Math.min(pageFrom, numPages));
    const to = Math.max(from, Math.min(pageTo, numPages));
    const pageNumbers = [];
    for (let i = from; i <= to; i++) pageNumbers.push(i);

    setProcessing(true);
    cancelRef.current = false;
    setPageResults([]);
    setProgress({ done: 0, total: pageNumbers.length });

    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

    const results = [];
    let cursor = 0;

    const worker = async () => {
      while (cursor < pageNumbers.length) {
        if (cancelRef.current) return;
        const idx = cursor++;
        const pageNumber = pageNumbers[idx];
        let lastError = null;
        let ok = false;
        for (let attempt = 0; attempt < 2 && !ok; attempt++) {
          try {
            const image_base64 = await renderPageToBase64(pdf, pageNumber, rotate);
            if (cancelRef.current) return;
            const { data, error } = await withTimeout(
              supabase.functions.invoke('pemilih-ocr-suara-pdf', {
                body: { image_base64, media_type: 'image/jpeg' },
              }),
              INVOKE_TIMEOUT_MS,
              `Waktu tunggu server OCR habis (${INVOKE_TIMEOUT_MS / 1000}s)`
            );
            if (error) throw new Error(await describeFunctionError(error));
            if (data?.error) throw new Error(data.error);
            results.push({ pageNumber, ...(data?.data || { is_vote_table: false, rows: [], column_headers: [] }) });
            ok = true;
          } catch (err) {
            lastError = err.message;
          }
        }
        if (!ok) {
          results.push({ pageNumber, is_vote_table: false, rows: [], column_headers: [], error: lastError });
        }
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    results.sort((a, b) => a.pageNumber - b.pageNumber);
    setPageResults(results);
    setProcessing(false);
    if (cancelRef.current) {
      toast({ title: 'Ekstraksi dibatalkan' });
    } else {
      const tableCount = results.filter((r) => r.is_vote_table).length;
      toast({ title: 'Ekstraksi selesai', description: `${tableCount} dari ${results.length} halaman memuat tabel suara.` });
    }
  };

  const matches = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    const groups = new Map();
    for (const page of pageResults) {
      if (!page.is_vote_table) continue;
      for (const row of page.rows || []) {
        const candidateName = row.candidate_name || '';
        const partyName = row.party_name || '';
        const haystack = normalize(row.is_party_row ? partyName : `${candidateName} ${partyName}`);
        if (!haystack.includes(q)) continue;
        const key = row.is_party_row
          ? `party::${normalize(partyName)}`
          : `cand::${normalize(candidateName)}::${normalize(partyName)}`;
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            label: row.is_party_row ? partyName : candidateName,
            party: partyName,
            candidateNumber: row.candidate_number,
            isPartyRow: !!row.is_party_row,
            entries: [],
          });
        }
        groups.get(key).entries.push({
          pageNumber: page.pageNumber,
          sheetInfo: page.sheet_info,
          columnHeaders: page.column_headers || [],
          values: row.values || [],
          total: row.total,
        });
      }
    }
    return Array.from(groups.values());
  }, [query, pageResults]);

  const selected = useMemo(() => {
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];
    return matches.find((m) => m.key === selectedKey) || null;
  }, [matches, selectedKey]);

  const aggregated = useMemo(() => {
    if (!selected) return null;
    const entriesSorted = [...selected.entries].sort((a, b) => a.pageNumber - b.pageNumber);
    const columns = [];
    let sum = 0;
    let hasNull = false;
    entriesSorted.forEach((entry) => {
      const headers = entry.columnHeaders;
      const values = entry.values;
      // kolom terakhir biasanya "JUMLAH PINDAHAN"/"JUMLAH AKHIR" (total berjalan), jangan dihitung dobel
      const lastIsTotal = headers.length > 0 && /jumlah/i.test(headers[headers.length - 1] || '');
      const tpsCount = lastIsTotal ? headers.length - 1 : headers.length;
      for (let i = 0; i < tpsCount; i++) {
        const val = values[i];
        if (val === null || val === undefined) hasNull = true;
        else sum += Number(val) || 0;
        columns.push({ header: headers[i], value: val, pageNumber: entry.pageNumber });
      }
    });
    const lastEntry = entriesSorted[entriesSorted.length - 1];
    const lastTotal = lastEntry ? lastEntry.total : null;
    const mismatch = lastTotal !== null && lastTotal !== undefined && !hasNull && Number(lastTotal) !== sum;
    return { columns, sum, lastTotal, mismatch, hasNull, pages: entriesSorted.map((e) => e.pageNumber) };
  }, [selected]);

  return (
    <div>
      <h1 className="p-page-title">Ekstrak Data dari PDF</h1>
      <p className="p-page-subtitle">
        Upload dokumen resmi (mis. Sertifikat Rekapitulasi Model DAA1/DA1/DB1), lalu cari nama calon atau partai untuk melihat rincian perolehan suara per TPS.
      </p>

      <div className="p-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="p-btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={processing}>
            <FileUp size={15} /> {file ? 'Ganti File PDF' : 'Pilih File PDF'}
          </button>
          <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFile} style={{ display: 'none' }} />
          {file && (
            <span style={{ fontSize: 12.5, color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FileText size={14} /> {file.name} — {numPages} halaman
            </span>
          )}
        </div>

        {file && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 16 }}>
            <div>
              <label className="p-label">Halaman awal</label>
              <input
                type="number" className="p-input" style={{ width: 100 }}
                min={1} max={numPages} value={pageFrom}
                onChange={(e) => setPageFrom(Number(e.target.value) || 1)} disabled={processing}
              />
            </div>
            <div>
              <label className="p-label">Halaman akhir</label>
              <input
                type="number" className="p-input" style={{ width: 100 }}
                min={1} max={numPages} value={pageTo}
                onChange={(e) => setPageTo(Number(e.target.value) || numPages)} disabled={processing}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#4b5563', marginBottom: 10 }}>
              <input type="checkbox" checked={rotate} onChange={(e) => setRotate(e.target.checked)} disabled={processing} />
              Putar halaman 90° (untuk dokumen KPU/Sidalih yang isinya landscape di kertas portrait)
            </label>
            {!processing ? (
              <button className="p-btn-primary" onClick={handleProcess}>
                <Search size={15} /> Mulai Ekstrak
              </button>
            ) : (
              <button className="p-btn-ghost" onClick={handleCancel} style={{ color: '#dc2626' }}>
                <X size={15} /> Batalkan
              </button>
            )}
          </div>
        )}

        {processing && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#6b7280', marginBottom: 6 }}>
              <Loader2 className="animate-spin" size={14} />
              Memproses halaman {progress.done} dari {progress.total}...
            </div>
            <div style={{ height: 6, borderRadius: 4, background: '#f1f2f4', overflow: 'hidden' }}>
              <div style={{
                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                height: '100%', background: 'linear-gradient(90deg, #ef4444, #dc2626)', transition: 'width 0.2s',
              }} />
            </div>
          </div>
        )}

        {!processing && pageResults.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
              {pageResults.filter((r) => r.is_vote_table).length} dari {pageResults.length} halaman terbaca sebagai tabel suara.
              {pageResults.some((r) => r.error) && ` ${pageResults.filter((r) => r.error).length} halaman gagal diproses.`}
            </p>
            {pageResults.some((r) => r.error) && (
              <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca' }}>
                {[...new Set(pageResults.filter((r) => r.error).map((r) => r.error))].map((msg, i) => (
                  <p key={i} style={{ margin: i ? '6px 0 0' : 0, fontSize: 11.5, color: '#991b1b' }}>
                    Halaman {pageResults.filter((r) => r.error === msg).map((r) => r.pageNumber).join(', ')}: {msg}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {pageResults.length > 0 && !processing && (
        <div className="p-card" style={{ padding: 20 }}>
          <label className="p-label">Cari nama calon atau partai</label>
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#9ca3af' }} />
            <input
              className="p-input" style={{ paddingLeft: 36 }}
              placeholder="Misal: Japar Sidik"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedKey(null); }}
            />
          </div>

          {query && matches.length === 0 && (
            <p style={{ color: '#9ca3af', fontSize: 13 }}>Tidak ditemukan pada halaman yang sudah diproses.</p>
          )}

          {matches.length > 1 && !selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {matches.map((m) => (
                <button
                  key={m.key}
                  className="p-btn-ghost"
                  style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={() => setSelectedKey(m.key)}
                >
                  <span style={{ fontWeight: 700 }}>{m.label}</span>
                  <span style={{ color: '#9ca3af', marginLeft: 8 }}>{m.party}</span>
                </button>
              ))}
            </div>
          )}

          {selected && aggregated && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 15.5, fontWeight: 700, color: '#1a1d29' }}>
                    {selected.candidateNumber ? `${selected.candidateNumber}. ` : ''}{selected.label}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 2 }}>{selected.party}</div>
                </div>
                {matches.length > 1 && (
                  <button className="p-btn-ghost" style={{ fontSize: 12 }} onClick={() => setSelectedKey(null)}>
                    ← Pilih calon lain
                  </button>
                )}
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, marginBottom: 16,
                background: aggregated.mismatch ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${aggregated.mismatch ? '#fecaca' : '#bbf7d0'}`,
              }}>
                {aggregated.mismatch ? <AlertTriangle size={18} color="#dc2626" /> : <CheckCircle2 size={18} color="#16a34a" />}
                <div style={{ fontSize: 12.5, color: aggregated.mismatch ? '#991b1b' : '#166534' }}>
                  {aggregated.mismatch ? (
                    <>Peringatan: total dari OCR (<b>{aggregated.lastTotal}</b>) tidak cocok dengan jumlah semua kolom TPS (<b>{aggregated.sum}</b>). Periksa ulang halaman asli sebelum memakai data ini.</>
                  ) : aggregated.hasNull ? (
                    <>Ada beberapa sel yang tidak terbaca jelas (ditandai "?"). Periksa halaman asli untuk sel tersebut.</>
                  ) : (
                    <>Jumlah semua kolom TPS ({aggregated.sum}) cocok dengan total tercetak di dokumen ({aggregated.lastTotal}).</>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: 10, fontSize: 26, fontWeight: 800, color: '#1a1d29' }}>
                Total: {aggregated.sum.toLocaleString('id-ID')} suara
              </div>

              <div className="p-table-wrap">
                <table className="p-table">
                  <thead>
                    <tr>
                      {aggregated.columns.map((c, i) => <th key={i} style={{ textAlign: 'right' }}>{c.header}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {aggregated.columns.map((c, i) => (
                        <td key={i} style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          {c.value === null || c.value === undefined ? '?' : c.value}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>
                Sumber: halaman {aggregated.pages.join(', ')} dari dokumen yang diupload.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PemilihExtractPdf;
