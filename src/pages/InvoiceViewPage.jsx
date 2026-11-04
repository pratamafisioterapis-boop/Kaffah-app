import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Download, Loader2, AlertTriangle } from 'lucide-react';

const InvoiceViewPage = () => {
  const { recapId } = useParams();
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [invoiceUrl, setInvoiceUrl] = useState(null);
  const [clinicName, setClinicName] = useState('');

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

  return (
    <main className="min-h-screen bg-stone-100 px-5 py-10 flex flex-col items-center justify-center">
      <div className="w-full max-w-sm">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500">
          {clinicName || 'Kaffah Physiotherapy'}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-stone-900">Kwitansi terapi</h1>

        <div className="mt-6 border-t border-stone-900 pt-5">
          {status === 'loading' && (
            <div className="flex items-center gap-3 text-stone-600" role="status">
              <Loader2 className="w-4 h-4 animate-spin" />
              <p className="text-sm">Menyiapkan kwitansi Anda…</p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-start gap-3 text-stone-700" role="alert">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-700" />
              <p className="text-sm leading-relaxed">
                Kwitansi tidak ditemukan atau tautan sudah tidak berlaku. Hubungi klinik untuk meminta tautan baru.
              </p>
            </div>
          )}

          {status === 'ready' && (
            <>
              <p className="text-sm leading-relaxed text-stone-600">
                Kwitansi Anda sudah siap. Buka untuk melihat, atau simpan sebagai PDF.
              </p>
              <a
                href={invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 flex items-center justify-center gap-2 w-full rounded-md bg-stone-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-800 active:bg-stone-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
              >
                <Download className="w-4 h-4" />
                Buka / unduh kwitansi
              </a>
            </>
          )}
        </div>
      </div>
    </main>
  );
};

export default InvoiceViewPage;
