import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
// eslint-disable-next-line import/no-unresolved
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { supabase } from '@/lib/customSupabaseClient';
import { ArrowLeft, Download, Eye, Loader2, AlertTriangle } from 'lucide-react';

// Gerak masuk halaman pilihan: lingkaran muncul membesar, teks naik, lembar putih bergeser dari bawah,
// lalu tombol menyusul. Dimatikan otomatis bila perangkat meminta "kurangi animasi".
const INTRO_CSS = `
.kw-intro .kw-badge{animation:kw-pop .7s cubic-bezier(.34,1.56,.64,1) both}
.kw-intro .kw-eyebrow{animation:kw-rise .5s cubic-bezier(.22,1,.36,1) .35s both}
.kw-intro .kw-title{animation:kw-rise .55s cubic-bezier(.22,1,.36,1) .45s both}
.kw-intro .kw-sheet{animation:kw-sheet .7s cubic-bezier(.22,1,.36,1) .3s both}
.kw-intro .kw-item{animation:kw-rise .5s cubic-bezier(.22,1,.36,1) both}
.kw-intro .kw-item:nth-child(1){animation-delay:.1s}
.kw-intro .kw-item:nth-child(2){animation-delay:.2s}
.kw-intro .kw-item:nth-child(3){animation-delay:.3s}
@keyframes kw-pop{from{transform:scale(.55);opacity:0}to{transform:none;opacity:1}}
@keyframes kw-rise{from{transform:translateY(14px);opacity:0}to{transform:none;opacity:1}}
@keyframes kw-sheet{from{transform:translateY(100%)}to{transform:none}}
@media (prefers-reduced-motion:reduce){.kw-intro *{animation:none!important}}
`;

const InvoiceViewPage = () => {
  const { recapId } = useParams();
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [invoiceUrl, setInvoiceUrl] = useState(null);
  const [clinicName, setClinicName] = useState('');
  const [view, setView] = useState('choose'); // choose | preview
  const [preview, setPreview] = useState('idle'); // idle | loading | ready | failed
  const [downloading, setDownloading] = useState(false);
  const introPlayed = useRef(false); // gerak masuk hanya di kunjungan pertama, bukan saat Kembali dari pratinjau
  const pagesRef = useRef(null);
  const blobRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    // Kirim Manual membuka WhatsApp lebih dulu sementara PDF masih diunggah, jadi bila link dibuka
    // sangat cepat, coba ulang beberapa kali (maks ~15 detik) sebelum menyatakan tidak ditemukan.
    const fetchInvoice = async () => {
      let data = null;
      let error = null;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        ({ data, error } = await supabase
          .rpc('get_public_invoice_url', { p_recap_id: recapId })
          .maybeSingle());
        if (cancelled) return;
        if (data?.invoice_url) break;
        if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 3000));
        if (cancelled) return;
      }

      if (error || !data?.invoice_url) {
        setStatus('error');
        return;
      }

      setInvoiceUrl(data.invoice_url);
      setClinicName(data.clinic_name || '');
      setStatus('ready');
    };

    if (recapId) fetchInvoice();
    else setStatus('error');

    return () => { cancelled = true; };
  }, [recapId]);

  const loadBlob = async () => {
    if (blobRef.current) return blobRef.current;
    const res = await fetch(invoiceUrl);
    if (!res.ok) throw new Error('fetch');
    blobRef.current = new Blob([await res.arrayBuffer()], { type: 'application/pdf' });
    return blobRef.current;
  };

  // Pratinjau hanya dimuat saat pasien memilihnya: PDF digambar ke canvas lewat pdf.js
  // (viewer PDF bawaan browser ponsel sering gagal di dalam halaman).
  useEffect(() => {
    if (view !== 'preview' || !invoiceUrl) return undefined;
    let cancelled = false;
    let pdfDoc = null;
    setPreview('loading');

    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const blob = await loadBlob();
        if (cancelled) return;
        pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        if (cancelled || !pagesRef.current) return;

        const container = pagesRef.current;
        container.innerHTML = '';
        const width = container.clientWidth || 360;
        const ratio = window.devicePixelRatio || 1;

        for (let n = 1; n <= pdfDoc.numPages; n += 1) {
          if (cancelled) return;
          const page = await pdfDoc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: width / base.width });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width * ratio);
          canvas.height = Math.floor(viewport.height * ratio);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          canvas.className = 'block bg-white';
          if (n > 1) canvas.style.marginTop = '8px';
          container.appendChild(canvas);
          await page.render({
            canvasContext: canvas.getContext('2d'),
            viewport,
            transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
          }).promise;
        }
        if (!cancelled) setPreview('ready');
      } catch {
        if (!cancelled) setPreview('failed');
      }
    })();

    return () => {
      cancelled = true;
      pdfDoc?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, invoiceUrl]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await loadBlob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = 'Kwitansi-Kaffah-Physiotherapy.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10000);
    } catch {
      window.open(invoiceUrl, '_blank', 'noopener,noreferrer'); // cadangan bila unduhan langsung gagal
    } finally {
      setDownloading(false);
    }
  };

  // Semua ukuran memakai em dari ukuran dasar yang mengikuti lebar layar, supaya tampilan tetap
  // proporsional (dan memenuhi layar) di HP dengan lebar layout berbeda, mis. 360px atau 720px.
  const baseSize = { fontSize: 'clamp(15px, 4vw, 30px)' };
  const btn = 'flex w-full items-center justify-center gap-[0.6em] rounded-[0.9em] min-h-[3.5em] px-[1em] text-[1.05em] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a3d70] disabled:opacity-60';
  const btnNavy = `${btn} bg-[#0a3d70] text-white active:bg-[#072c52]`;
  const btnSoft = `${btn} bg-[#e6f1f9] text-[#0a3d70] active:bg-[#d4e6f3]`;
  const icon = 'w-[1.25em] h-[1.25em] shrink-0';
  const downloadLabel = downloading ? 'Menyiapkan…' : 'Unduh PDF';

  // Mode pratinjau: hanya dokumen, tanpa header.
  if (status === 'ready' && view === 'preview') {
    return (
      <main className="min-h-[100dvh] bg-[#e4ecf2]" style={baseSize}>
        <div className="mx-auto max-w-[48em] px-[0.5em] pt-[0.5em] pb-[7em]">
          {preview === 'loading' && (
            <div className="flex items-center justify-center gap-[0.75em] py-[6em] text-slate-600" role="status">
              <Loader2 className={`${icon} animate-spin`} />
              <p>Memuat pratinjau…</p>
            </div>
          )}
          {preview === 'failed' && (
            <p className="px-[0.75em] py-[4em] text-center leading-relaxed text-slate-600">
              Pratinjau tidak dapat ditampilkan di perangkat ini. Silakan unduh kwitansi.
            </p>
          )}
          <div ref={pagesRef} className={preview === 'failed' ? 'hidden' : ''} />
        </div>
        <div className="fixed inset-x-0 bottom-0 bg-[#0a3d70] px-[1em] pt-[0.75em] pb-[max(0.75em,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-[48em] gap-[0.75em]">
            <button type="button" onClick={() => setView('choose')} className={`${btn} bg-white/15 text-white active:bg-white/25`}>
              <ArrowLeft className={icon} />
              Kembali
            </button>
            <button type="button" onClick={handleDownload} disabled={downloading} className={`${btn} bg-white text-[#0a3d70] active:bg-slate-200`}>
              <Download className={icon} />
              {downloadLabel}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`min-h-[100dvh] bg-[#0a3d70] text-white flex flex-col overflow-hidden ${introPlayed.current ? '' : 'kw-intro'}`}
      style={baseSize}
    >
      <style>{INTRO_CSS}</style>
      <section className="flex-1 flex flex-col items-center justify-center gap-[0.9em] px-[1.5em] pt-[2em] pb-[1em] text-center">
        <div className="kw-badge grid aspect-square w-[48%] max-w-[13em] place-items-center rounded-full bg-white ring-[0.6em] ring-white/10">
          <img src="/kaffah-logo.png" alt="Kaffah Physiotherapy" className="w-[66%] h-auto" />
        </div>
        <p className="kw-eyebrow mt-[0.5em] text-[0.78em] font-medium uppercase tracking-[0.16em] text-[#9fd5f3]">
          {clinicName || 'Kaffah Physiotherapy'}
        </p>
        <h1 className="kw-title text-[2.1em] font-bold leading-tight tracking-tight">Kwitansi terapi</h1>
      </section>

      <section className="kw-sheet rounded-t-[1.7em] bg-white px-[1em] pt-[1.5em] pb-[max(1.5em,env(safe-area-inset-bottom))] text-slate-800">
        <div className="mx-auto w-full max-w-[30em]">
          {status === 'loading' && (
            <div className="flex items-center justify-center gap-[0.75em] py-[2em] text-slate-600" role="status">
              <Loader2 className={`${icon} animate-spin`} />
              <p>Menyiapkan kwitansi Anda…</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-start gap-[0.75em] py-[1em] text-slate-700" role="alert">
              <AlertTriangle className={`${icon} mt-[0.15em] text-red-700`} />
              <p className="leading-relaxed">
                Kwitansi tidak ditemukan atau tautan sudah tidak berlaku. Hubungi klinik untuk meminta tautan baru.
              </p>
            </div>
          )}

          {status === 'ready' && (
            <div className="flex flex-col gap-[0.75em]">
              <p className="kw-item mb-[0.25em] text-center leading-relaxed text-slate-600">
                Kwitansi Anda sudah siap. Pilih untuk melihat pratinjau atau langsung mengunduhnya.
              </p>
              <button type="button" onClick={() => { introPlayed.current = true; setView('preview'); }} className={`kw-item ${btnNavy}`}>
                <Eye className={icon} />
                Lihat pratinjau
              </button>
              <button type="button" onClick={handleDownload} disabled={downloading} className={`kw-item ${btnSoft}`}>
                <Download className={icon} />
                {downloadLabel}
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default InvoiceViewPage;
