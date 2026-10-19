import React, { useRef, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, X, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import InvoiceTemplateKwitansi from './InvoiceTemplateKwitansi';
import { rasterizeInvoice, canvasToPdf, printInvoiceCanvas } from '@/lib/invoiceRaster';

const INVOICE_BASE_WIDTH = 794;
const INVOICE_BASE_HEIGHT = Math.round(794 * 297 / 210);

// Invoice penjualan alkes (tabel alkes_sales), memakai template kwitansi klinik.
const AlkesInvoiceModal = ({ isOpen, onClose, sale }) => {
  const { toast } = useToast();
  const componentRef = useRef(null);
  const previewWrapperRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [invoiceData, setInvoiceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (!isOpen || !sale?.id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [{ data: clinic }, { data: patient }, creatorRes] = await Promise.all([
          supabase.from('clinics')
            .select('id, name, address, phone, email, logo_url, invoice_admin_name, invoice_admin_signature_url')
            .eq('id', sale.clinic_id).maybeSingle(),
          supabase.from('patients')
            .select('full_name, medical_record_number, phone, address')
            .eq('id', sale.patient_id).maybeSingle(),
          sale.created_by
            ? supabase.from('users').select('full_name, signature_url').eq('id', sale.created_by).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        if (cancelled) return;
        const creator = creatorRes?.data;
        setInvoiceData({
          clinic,
          patients: patient,
          invoice_items: sale.items,
          amount: sale.total,
          amount_original: sale.total,
          payment_method: sale.payment_method,
          recap_date: sale.sale_date,
          created_at: sale.created_at,
          receipt_number: sale.invoice_number,
          admin_signer_name: creator?.full_name || null,
          admin_signer_signature_url: creator?.signature_url || null,
        });
      } catch (err) {
        console.error('AlkesInvoiceModal load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, sale?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const node = previewWrapperRef.current;
    if (!node) return;
    const compute = () => {
      if (node.clientWidth) setPreviewScale(Math.min(1, node.clientWidth / INVOICE_BASE_WIDTH));
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isOpen, loading]);

  const patientSlug = () =>
    (invoiceData?.patients?.full_name || 'Pasien').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const pdf = canvasToPdf(await rasterizeInvoice(componentRef.current));
      const [yr, mo, dy] = String(sale.sale_date).split('-');
      pdf.save(`Kwitansi_Alkes_${patientSlug()}_${dy}-${mo}-${yr.slice(2)}.pdf`);
    } catch (err) {
      console.error('Alkes PDF error:', err);
      toast({ variant: 'destructive', title: 'Gagal Mengunduh', description: err.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = async () => {
    // Tab dibuka sinkron dengan klik agar tidak diblokir popup blocker.
    const printWin = window.open('', '_blank');
    if (printWin) printWin.document.write('<p style="font-family:sans-serif;padding:24px">Menyiapkan invoice...</p>');
    setIsPrinting(true);
    try {
      const canvas = await rasterizeInvoice(componentRef.current);
      await printInvoiceCanvas(canvas, `Invoice Alkes - ${invoiceData?.patients?.full_name || 'Pasien'}`, printWin);
    } catch (err) {
      console.error('Alkes print error:', err);
      if (printWin && !printWin.closed) printWin.close();
      toast({ variant: 'destructive', title: 'Gagal Mencetak', description: err.message });
    } finally {
      setIsPrinting(false);
    }
  };

  if (!sale) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="max-w-[1000px] w-full max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 bg-slate-100">
        <div className="flex items-center justify-between gap-2 p-3 sm:p-4 border-b bg-white z-10 shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 shrink-0">Invoice Alkes</h2>
          <div className="flex flex-wrap justify-end gap-1.5 sm:gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting || loading}>
              {isPrinting ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <Printer className="w-4 h-4 sm:mr-2" />}
              <span className="hidden sm:inline">Cetak</span>
            </Button>
            <Button size="sm" onClick={handleDownload} disabled={isGenerating || loading} className="bg-app-accent hover:bg-app-accent-hover">
              {isGenerating ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <Download className="w-4 h-4 sm:mr-2" />}
              <span className="hidden sm:inline">Download PDF</span>
            </Button>
            <DialogClose asChild>
              <Button aria-label="Tutup" variant="ghost" size="icon"><X className="w-4 h-4" /></Button>
            </DialogClose>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-8 bg-slate-200/50">
          <div ref={previewWrapperRef} className="w-full flex justify-center">
            {loading || !invoiceData ? (
              <div
                className="flex items-center justify-center bg-white shadow-2xl shrink-0"
                style={{ width: INVOICE_BASE_WIDTH * previewScale, height: INVOICE_BASE_HEIGHT * previewScale }}
              >
                <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
              </div>
            ) : (
              <div
                className="shadow-2xl overflow-hidden shrink-0"
                style={{ width: INVOICE_BASE_WIDTH * previewScale, height: INVOICE_BASE_HEIGHT * previewScale }}
              >
                <div style={{ width: INVOICE_BASE_WIDTH, height: INVOICE_BASE_HEIGHT, transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                  <InvoiceTemplateKwitansi data={invoiceData} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Klon tersembunyi beresolusi penuh - target rasterisasi PDF/cetak. */}
        {!loading && invoiceData && (
          <div style={{ position: 'fixed', top: 0, left: '-9999px', pointerEvents: 'none' }} aria-hidden="true">
            <InvoiceTemplateKwitansi ref={componentRef} data={invoiceData} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AlkesInvoiceModal;
