import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
// eslint-disable-next-line import/no-unresolved
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { supabase } from '@/lib/customSupabaseClient';
import { ArrowLeft, Download, Eye, Loader2, AlertTriangle } from 'lucide-react';

const InvoiceViewPage = () => {
  const { recapId } = useParams();
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [invoiceUrl, setInvoiceUrl] = useState(null);
  const [clinicName, setClinicName] = useState('');
  const [view, setView] = useState('choose'); // choose | preview
  const [preview, setPreview] = useState('idle'); // idle | loading | ready | failed
  const [downloading, setDownloading] = useState(false);
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

  const btn = 'flex w-full items-center justify-center gap-2.5 rounded-2xl min-h-[58px] px-4 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a3d70] disabled:opacity-60';
  const btnNavy = `${btn} bg-[#0a3d70] text-white active:bg-[#072c52]`;
  const btnSoft = `${btn} bg-[#e6f1f9] text-[#0a3d70] active:bg-[#d4e6f3]`;
  const downloadLabel = downloading ? 'Menyiapkan…' : 'Unduh PDF';

  // Mode pratinjau: hanya dokumen, tanpa header.
  if (status === 'ready' && view === 'preview') {
    return (
      <main className="min-h-[100dvh] bg-[#e4ecf2]">
        <div className="mx-auto max-w-xl px-2 pt-2 pb-28">
          {preview === 'loading' && (
            <div className="flex items-center justify-center gap-3 py-24 text-slate-600" role="status">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p className="text-sm">Memuat pratinjau…</p>
            </div>
          )}
          {preview === 'failed' && (
            <p className="px-3 py-16 text-center text-sm leading-relaxed text-slate-600">
              Pratinjau tidak dapat ditampilkan di perangkat ini. Silakan unduh kwitansi.
            </p>
          )}
          <div ref={pagesRef} className={preview === 'failed' ? 'hidden' : ''} />
        </div>
        <div className="fixed inset-x-0 bottom-0 bg-[#0a3d70] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-xl gap-3">
            <button type="button" onClick={() => setView('choose')} className={`${btn} bg-white/15 text-white active:bg-white/25`}>
              <ArrowLeft className="w-5 h-5" />
              Kembali
            </button>
            <button type="button" onClick={handleDownload} disabled={downloading} className={`${btn} bg-white text-[#0a3d70] active:bg-slate-200`}>
              <Download className="w-5 h-5" />
              {downloadLabel}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#0a3d70] text-white flex flex-col">
      <section className="flex-1 flex flex-col items-center justify-center gap-3.5 px-6 pt-10 pb-4 text-center">
        <div className="grid aspect-square w-[48%] max-w-[210px] place-items-center rounded-full bg-white ring-[9px] ring-white/10">
          <img src="/kaffah-logo.png" alt="Kaffah Physiotherapy" className="w-[66%] h-auto" />
        </div>
        <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-[#9fd5f3]">
          {clinicName || 'Kaffah Physiotherapy'}
        </p>
        <h1 className="text-3xl font-bold leading-tight tracking-tight">Kwitansi terapi</h1>
      </section>

      <section className="rounded-t-[28px] bg-white px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-slate-800">
        <div className="mx-auto w-full max-w-md">
          {status === 'loading' && (
            <div className="flex items-center justify-center gap-3 py-8 text-slate-600" role="status">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p className="text-base">Menyiapkan kwitansi Anda…</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-start gap-3 py-4 text-slate-700" role="alert">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-red-700" />
              <p className="text-base leading-relaxed">
                Kwitansi tidak ditemukan atau tautan sudah tidak berlaku. Hubungi klinik untuk meminta tautan baru.
              </p>
            </div>
          )}

          {status === 'ready' && (
            <div className="flex flex-col gap-3">
              <p className="mb-1 text-center text-base leading-relaxed text-slate-600">
                Kwitansi Anda sudah siap. Pilih untuk melihat pratinjau atau langsung mengunduhnya.
              </p>
              <button type="button" onClick={() => setView('preview')} className={btnNavy}>
                <Eye className="w-5 h-5" />
                Lihat pratinjau
              </button>
              <button type="button" onClick={handleDownload} disabled={downloading} className={btnSoft}>
                <Download className="w-5 h-5" />
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
