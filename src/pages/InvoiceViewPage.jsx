import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { FileText, Download, Loader2, AlertTriangle } from 'lucide-react';

const InvoiceViewPage = () => {
  const { recapId } = useParams();
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [invoiceUrl, setInvoiceUrl] = useState(null);
  const [clinicName, setClinicName] = useState('');

  useEffect(() => {
    let cancelled = false;

    const fetchInvoice = async () => {
      const { data, error } = await supabase
        .rpc('get_public_invoice_url', { p_recap_id: recapId })
        .maybeSingle();

      if (cancelled) return;

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 px-6 py-8 text-center text-white">
          <div className="mx-auto w-14 h-14 rounded-full bg-white/15 flex items-center justify-center mb-3">
            <FileText className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold">Kwitansi Terapi</h1>
          {clinicName && <p className="text-indigo-200 text-sm mt-0.5">{clinicName}</p>}
        </div>

        <div className="p-6 text-center">
          {status === 'loading' && (
            <div className="py-6 flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-sm">Menyiapkan kwitansi Anda...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="py-6 flex flex-col items-center gap-3 text-red-500">
              <AlertTriangle className="w-8 h-8" />
              <p className="text-sm text-slate-600">Kwitansi tidak ditemukan atau tautan sudah tidak berlaku.</p>
            </div>
          )}

          {status === 'ready' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Kwitansi Anda sudah siap. Silakan unduh atau lihat dokumennya di bawah ini.</p>
              <a
                href={invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" />
                Buka / Unduh Kwitansi
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoiceViewPage;
