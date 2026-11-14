import React, { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Download, Loader2, Printer, Undo2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { getRenewalTerms } from '@/lib/packageRenewalTerms';
import InvoiceTemplateKwitansi from './InvoiceTemplateKwitansi';

const BASE_WIDTH = 794;
const BASE_HEIGHT = Math.round((794 * 297) / 210);

const wita = (value) => new Date(new Date(value).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);

// Kwitansi pembayaran perpanjangan paket: memakai template kwitansi klinik, tetapi datanya
// dari package_payments (bukan rekap kunjungan).
const PackagePaymentReceiptModal = ({ isOpen, onClose, paymentId, clinicId, onChanged }) => {
  const { toast } = useToast();
  const { userDetails, role } = useAuth();
  const isOwner = role === 'owner' || role === 'super_admin';
  const terms = getRenewalTerms(clinicId);

  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState(null);
  const [data, setData] = useState(null);
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState('');
  const componentRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !paymentId) return;
    let cancelled = false;
    setLoading(true);
    setData(null);
    setPayment(null);
    setVoidOpen(false);
    setReason('');
    (async () => {
      try {
        const { data: pay, error } = await supabase.from('package_payments').select('*').eq('id', paymentId).single();
        if (error || !pay) throw error || new Error('Pembayaran tidak ditemukan');

        const [{ data: patient }, { data: clinic }] = await Promise.all([
          supabase.from('patients').select('full_name, medical_record_number, phone').eq('id', pay.patient_id).maybeSingle(),
          supabase.from('clinics')
            .select('id, name, address, phone, email, logo_url, invoice_admin_name, invoice_admin_signature_url, invoice_template')
            .eq('id', pay.clinic_id).maybeSingle(),
        ]);

        // Kasir: admin yang mencatat pembayaran; bila kosong, admin yang sedang membuka.
        let cashier = null;
        const cashierId = pay.cashier_id || (role === 'admin' ? userDetails?.id : null);
        if (cashierId) {
          const { data: c } = await supabase.from('users').select('full_name, signature_url').eq('id', cashierId).maybeSingle();
          if (c) cashier = c;
          else {
            const { data: rows } = await supabase.rpc('get_invoice_cashier', { p_user_id: cashierId });
            cashier = rows?.[0] || null;
          }
        }

        if (cancelled) return;
        const paidAtIso = pay.paid_at;
        setPayment(pay);
        setData({
          clinic: clinic || { id: pay.clinic_id },
          patients: patient || {},
          patient_name: patient?.full_name,
          receipt_number: pay.receipt_number,
          recap_date: wita(paidAtIso),
          created_at: paidAtIso,
          invoice_created_at: paidAtIso,
          payment_method: pay.payment_method,
          amount: pay.amount,
          amount_original: pay.amount,
          therapist_name: '-',
          invoice_items: [{
            category: 'procedure',
            name: terms.itemName(pay.package_name, pay.total_sessions),
            qty: 1,
            price: Number(pay.amount),
            discount: 0,
          }],
          admin_signer_name: cashier?.full_name || null,
          admin_signer_signature_url: cashier?.signature_url || null,
        });
      } catch (err) {
        console.error('Gagal memuat kwitansi:', err);
        toast({ variant: 'destructive', title: 'Gagal memuat kwitansi', description: err?.message || '' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, paymentId]);

  // Skala preview agar A4 utuh terlihat di layar sempit.
  useEffect(() => {
    if (!isOpen || !data) return undefined;
    const node = wrapperRef.current;
    if (!node) return undefined;
    const compute = () => {
      const w = node.clientWidth;
      if (w) setScale(Math.min(1, w / BASE_WIDTH));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(node);
    return () => ro.disconnect();
  }, [isOpen, data]);

  const generatePDF = async () => {
    const element = componentRef.current;
    if (!element) throw new Error('Kwitansi belum siap');
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const canvas = await html2canvas(element, {
      scale: 2, useCORS: true, logging: false, allowTaint: true,
      backgroundColor: '#ffffff', width: 794, windowWidth: 794,
    });
    const img = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const props = pdf.getImageProperties(img);
    const h = Math.min((props.height * 210) / props.width, 297);
    pdf.addImage(img, 'JPEG', 0, 0, 210, h);
    return pdf;
  };

  const fileName = () => {
    const slug = (data?.patient_name || 'Pasien').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    return `Kwitansi_Paket_${slug}_${(data?.recap_date || '').split('-').reverse().join('-')}.pdf`;
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      const pdf = await generatePDF();
      pdf.save(fileName());
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal membuat PDF', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = async () => {
    setBusy(true);
    try {
      const pdf = await generatePDF();
      const url = pdf.output('bloburl');
      const w = window.open(url, '_blank', 'noopener');
      if (!w) toast({ variant: 'destructive', title: 'Pop-up diblokir', description: 'Izinkan pop-up untuk mencetak kwitansi.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal mencetak', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleVoid = async () => {
    if (reason.trim().length < 5) {
      toast({ variant: 'destructive', title: 'Alasan wajib diisi', description: 'Tulis alasan minimal 5 karakter.' });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc('praxis_void_package_renewal', { p_payment_id: paymentId, p_reason: reason.trim() });
      if (error) throw error;
      toast({ title: 'Pembayaran dibatalkan', description: 'Paket baru dihapus dan pembayaran ditandai batal.' });
      onChanged?.();
      onClose?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal membatalkan', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const isVoid = payment?.status === 'void';

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!busy && !o) onClose?.(); }}>
      <DialogContent className="max-w-[860px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{terms.receiptTitle}</DialogTitle>
          <DialogDescription>
            {payment ? `${payment.receipt_number}${isVoid ? ' · DIBATALKAN' : ''}` : 'Memuat…'}
          </DialogDescription>
        </DialogHeader>

        {loading || !data ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleDownload} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Unduh PDF
              </Button>
              <Button type="button" variant="outline" onClick={handlePrint} disabled={busy}>
                <Printer className="mr-2 h-4 w-4" /> Cetak
              </Button>
              {isOwner && !isVoid && (
                <Button type="button" variant="outline" onClick={() => setVoidOpen((v) => !v)} disabled={busy}>
                  <Undo2 className="mr-2 h-4 w-4" /> Batalkan
                </Button>
              )}
            </div>

            {voidOpen && (
              <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3">
                <Label>Alasan pembatalan (wajib)</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Mis. salah input nominal" />
                <p className="text-xs text-red-800">Hanya bisa selama paket baru belum dipakai pada kunjungan. Paket baru akan dihapus.</p>
                <Button type="button" variant="destructive" size="sm" onClick={handleVoid} disabled={busy}>Batalkan pembayaran</Button>
              </div>
            )}

            <div ref={wrapperRef} className="w-full overflow-hidden">
              <div style={{ width: BASE_WIDTH * scale, height: BASE_HEIGHT * scale }}>
                <div style={{ width: BASE_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                  <InvoiceTemplateKwitansi ref={componentRef} data={data} />
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PackagePaymentReceiptModal;
