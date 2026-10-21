import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Send, CheckCircle2, AlertTriangle, XCircle, MessageCircle, RefreshCw, Clock, PencilLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  checkInvoiceDelivery,
  sendInvoiceAuto,
  setInvoiceManual,
  invoiceStatusView,
  buildInvoiceMessage,
  buildWaMeLink,
  isStaleWaiting,
  INVOICE_PROVEN_STATUSES,
} from '@/lib/invoiceDelivery';

const formatRupiah = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

const TONE = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  orange: 'border-orange-200 bg-orange-50 text-orange-800',
  red: 'border-red-200 bg-red-50 text-red-800',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
};

const SummaryRow = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
    <span className="text-slate-500 shrink-0">{label}</span>
    <span className="text-right font-semibold text-slate-900 break-words">{value || '-'}</span>
  </div>
);

/**
 * Alur pengiriman invoice WhatsApp.
 * mode "gate": setelah pembayaran disimpan - konfirmasi tagihan, lalu wajib kirim invoice atau ajukan perubahan.
 * mode "view": dari tombol Invoice di daftar - menampilkan status dan tombol kirim ulang.
 * Selalu kirim otomatis lebih dulu; bila diketahui tidak masuk (mis. di luar jendela 24 jam), admin diarahkan
 * kirim manual lewat link. Centang hijau hanya muncul bila ada bukti sampai.
 */
const InvoiceDeliveryPanel = ({
  mode = 'view',
  recapId,
  recap,
  summary,
  phone,
  clinicName,
  prepareFile,
  hasInvoiceUrl,
  canRequestChange = false,
  onRequestChange,
  onStatusChange,
}) => {
  const { toast } = useToast();
  const [status, setStatus] = useState(recap?.invoice_wa_status || null);
  const [detail, setDetail] = useState(recap?.invoice_wa_detail || recap?.invoice_skip_reason || '');
  const [sentAt, setSentAt] = useState(recap?.invoice_wa_sent_at || null);
  const [phase, setPhase] = useState(() => {
    const st = recap?.invoice_wa_status || null;
    if (!st) return mode === 'gate' ? 'confirm' : 'idle';
    if (st === 'manual_menunggu') return 'manual';
    return 'result';
  });
  const [step, setStep] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [showChange, setShowChange] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const view = invoiceStatusView({ invoice_wa_status: status, invoice_wa_detail: detail, invoice_skip_reason: detail, invoice_wa_sent_at: sentAt });
  const proven = INVOICE_PROVEN_STATUSES.includes(status);
  // 'terkirim' = data lama (diterima API, belum terverifikasi): tidak perlu tindakan lagi.
  const done = proven || status === 'terkirim';
  const noPhone = !phone;

  const update = (st, dt = '') => {
    if (!mounted.current) return;
    setStatus(st);
    setDetail(dt || '');
    if (st && st !== 'gagal') setSentAt((prev) => prev || new Date().toISOString());
    onStatusChange?.(st);
  };

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Gagal', description: err.message });
    } finally {
      if (mounted.current) { setBusy(false); setStep(null); }
    }
  };

  // ── Kirim otomatis (Watzap), lalu periksa hasil akhirnya ──
  const sendAuto = () => run(async () => {
    setPhase('sending');
    setStep('prepare');
    let res;
    try {
      // PDF dibuat ulang dan diunggah dulu agar link /i/<id> di pesan dan lampiran memakai invoice yang terbaru.
      const { fileUrl, fileName } = await prepareFile({ force: true });
      res = await sendInvoiceAuto({
        recapId,
        phone,
        message: buildInvoiceMessage(clinicName, recapId),
        fileUrl,
        fileName,
        fileCaption: 'Kwitansi Terapi',
        onStep: setStep,
      });
      if (res.fileError) {
        toast({ title: 'Lampiran PDF tidak terkirim', description: `Pesan berisi link invoice sudah terkirim ke pasien, tetapi lampiran PDF gagal: ${res.fileError}` });
      }
    } catch (err) {
      // Gagal sebelum/ketika menghubungi Watzap (mis. nomor tidak valid): tampilkan sebagai gagal agar admin kirim manual.
      res = { status: 'gagal', detail: err.message || 'Gagal mengirim otomatis.' };
    }
    update(res.status, res.detail);
    setPhase('result');
  });

  // ── Cek status terbaru ke Watzap ──
  const recheck = () => run(async () => {
    setStep('check');
    const res = await checkInvoiceDelivery(recapId);
    if (res) update(res.status, res.detail);
    else toast({ title: 'Status belum berubah', description: 'Watzap belum memberi status terbaru. Coba lagi sebentar.' });
  });

  // ── Kirim manual lewat link WhatsApp ──
  const openManual = () => run(async () => {
    // Buka tab sekarang (sinkron dengan klik) agar tidak diblokir popup blocker; alamatnya diisi sesudah siap.
    const win = window.open('', '_blank');
    try {
      if (!hasInvoiceUrl) {
        setStep('prepare');
        await prepareFile({ force: false });
      }
      await setInvoiceManual(recapId, 'manual_menunggu');
      const link = buildWaMeLink(phone, buildInvoiceMessage(clinicName, recapId));
      if (win && !win.closed) win.location.href = link; else window.open(link, '_blank');
      update('manual_menunggu', '');
      setPhase('manual');
    } catch (err) {
      if (win && !win.closed) win.close();
      throw err;
    }
  });

  const reopenWa = () => {
    window.open(buildWaMeLink(phone, buildInvoiceMessage(clinicName, recapId)), '_blank');
  };

  const confirmManual = () => run(async () => {
    await setInvoiceManual(recapId, 'terkirim_manual');
    update('terkirim_manual', '');
    setPhase('result');
  });

  const skipSend = () => run(async () => {
    if (skipReason.trim().length < 5) {
      toast({ variant: 'destructive', title: 'Alasan wajib diisi', description: 'Tulis alasan invoice tidak dikirim (minimal 5 karakter).' });
      return;
    }
    await setInvoiceManual(recapId, 'tidak_dikirim', skipReason.trim());
    update('tidak_dikirim', skipReason.trim());
    setShowSkip(false);
    setPhase('result');
  });

  const SkipBlock = (
    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-sm font-medium text-slate-800">Invoice tidak dapat dikirim?</p>
      <Textarea value={skipReason} onChange={(e) => setSkipReason(e.target.value)} rows={2} placeholder="Alasan, mis. pasien tidak memakai WhatsApp / nomor salah" />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowSkip(false)} disabled={busy}>Batal</Button>
        <Button size="sm" onClick={skipSend} disabled={busy}>Catat tidak dikirim</Button>
      </div>
    </div>
  );

  const stepLabel = step === 'prepare' ? 'Menyiapkan PDF invoice...' : step === 'send' ? 'Mengirim pesan ke WhatsApp pasien...' : step === 'check' ? 'Memeriksa apakah pesan masuk...' : step === 'file' ? 'Mengirim lampiran PDF...' : 'Memproses...';

  // ───────────────────────── Tampilan ─────────────────────────
  if (phase === 'sending') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center space-y-3">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-app-accent" />
        <p className="font-semibold text-slate-900">{stepLabel}</p>
        <p className="text-xs text-slate-500">Mohon tunggu, jangan tutup halaman ini. Hasilnya muncul dalam beberapa detik.</p>
      </div>
    );
  }

  if (phase === 'confirm') {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-sm font-bold text-slate-900">Konfirmasi tagihan</p>
          <p className="mb-2 text-xs text-slate-500">Periksa kembali data berikut sebelum invoice dikirim ke pasien.</p>
          <div className="divide-y divide-slate-100">
            <SummaryRow label="Nama pasien" value={summary?.patientName} />
            <SummaryRow label="Tipe pasien" value={summary?.patientType} />
            <SummaryRow label="Tipe paket" value={summary?.packageType} />
            <SummaryRow label="Nominal" value={formatRupiah(summary?.amount)} />
            <SummaryRow label="Metode pembayaran" value={summary?.paymentMethod} />
          </div>
        </div>

        {noPhone && (
          <div className={cn('rounded-lg border p-3 text-sm', TONE.amber)}>
            Nomor WhatsApp pasien belum ada, jadi invoice tidak bisa dikirim. Lengkapi nomornya di data pasien, atau catat alasan tidak dikirim.
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button className="h-12 bg-green-600 text-white hover:bg-green-700" onClick={sendAuto} disabled={busy || noPhone}>
            <Send className="mr-2 h-4 w-4" /> Kirim Invoice
          </Button>
          <Button variant="outline" className="h-12 border-amber-300 text-amber-800 hover:bg-amber-50" onClick={() => setShowChange((v) => !v)} disabled={busy || !canRequestChange}>
            <PencilLine className="mr-2 h-4 w-4" /> Ajukan Perubahan (diskon/nominal)
          </Button>
        </div>
        {showChange && canRequestChange && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
            <p className="text-xs text-amber-900">Perubahan berlaku setelah disetujui owner. Invoice tetap harus dikirim setelah disetujui.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button size="sm" variant="outline" className="bg-white" onClick={() => onRequestChange?.('amount')}>Ubah nominal</Button>
              <Button size="sm" variant="outline" className="bg-white" onClick={() => onRequestChange?.('discount')}>Ubah diskon</Button>
            </div>
          </div>
        )}
        <button type="button" className="text-xs text-slate-500 underline" onClick={() => setShowSkip((v) => !v)}>Invoice tidak bisa dikirim?</button>
        {showSkip && SkipBlock}
      </div>
    );
  }

  if (phase === 'manual') {
    return (
      <div className="space-y-3">
        <div className={cn('rounded-xl border p-4 space-y-2', TONE.amber)}>
          <p className="flex items-center gap-2 font-semibold"><MessageCircle className="h-4 w-4" /> WhatsApp sudah dibuka</p>
          <p className="text-sm">Tekan tombol kirim di WhatsApp ke <b>{summary?.patientName || 'pasien'}</b>. Setelah pesannya benar-benar terkirim, konfirmasi di sini. Invoice belum dianggap terkirim sebelum dikonfirmasi.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button className="h-11 bg-emerald-600 text-white hover:bg-emerald-700" onClick={confirmManual} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Sudah saya kirim
          </Button>
          <Button variant="outline" className="h-11" onClick={reopenWa} disabled={busy}>
            <MessageCircle className="mr-2 h-4 w-4" /> Buka WhatsApp lagi
          </Button>
        </div>
        <button type="button" className="text-xs text-slate-500 underline" onClick={() => setShowSkip((v) => !v)}>Tidak bisa dikirim?</button>
        {showSkip && SkipBlock}
      </div>
    );
  }

  // phase 'result' atau 'idle' (mode view tanpa status)
  const stale = isStaleWaiting({ invoice_wa_status: status, invoice_wa_sent_at: sentAt });
  const headline = {
    green: proven ? 'Invoice terkonfirmasi sampai ke pasien' : 'Invoice tercatat terkirim',
    amber: status === 'menunggu' ? 'Invoice diterima WhatsApp, menunggu sampai di HP pasien' : (view.label || 'Belum dikirim'),
    orange: 'Belum ada bukti invoice sampai ke pasien',
    red: 'Invoice otomatis gagal terkirim',
    slate: 'Invoice tidak dikirim',
  }[view.color];
  const Icon = view.color === 'green' ? CheckCircle2 : view.color === 'red' ? XCircle : view.color === 'orange' ? AlertTriangle : Clock;

  return (
    <div className="space-y-3">
      <div className={cn('rounded-xl border p-4 space-y-1.5', TONE[view.color])}>
        <p className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 shrink-0" /> {headline}</p>
        <p className="text-sm">{view.hint}</p>
        {status === 'gagal' && !noPhone && (
          <p className="text-sm font-medium">Kirim lewat WhatsApp secara manual dengan link invoice, lalu konfirmasi setelah terkirim.</p>
        )}
        {(status === 'menunggu' && !stale) && <p className="text-xs opacity-80">Status diperbarui otomatis. Jika lebih dari 15 menit belum berubah, kirim manual.</p>}
        {status === 'dibuka' && <p className="text-xs opacity-80">Pasien membuka link invoice, jadi pesannya sudah sampai.</p>}
      </div>

      {noPhone && !done && status !== 'tidak_dikirim' && (
        <div className={cn('rounded-lg border p-3 text-sm', TONE.amber)}>Nomor WhatsApp pasien belum ada. Lengkapi nomornya di data pasien, atau catat alasan tidak dikirim.</div>
      )}

      {!done && status !== 'tidak_dikirim' && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(status === 'gagal' || stale || status === 'menunggu' || status === 'mengirim') && (
            <Button className={cn('h-11', status === 'gagal' || stale ? 'bg-emerald-600 text-white hover:bg-emerald-700' : '')} variant={status === 'gagal' || stale ? 'default' : 'outline'} onClick={openManual} disabled={busy || noPhone}>
              <MessageCircle className="mr-2 h-4 w-4" /> Kirim lewat WhatsApp (manual)
            </Button>
          )}
          {(status === 'menunggu' || status === 'mengirim') && (
            <Button variant="outline" className="h-11" onClick={recheck} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Cek status sekarang
            </Button>
          )}
          {(status === 'gagal' || !status) && (
            <Button variant="outline" className="h-11" onClick={sendAuto} disabled={busy || noPhone}>
              <Send className="mr-2 h-4 w-4" /> {status === 'gagal' ? 'Coba kirim otomatis lagi' : 'Kirim otomatis'}
            </Button>
          )}
          {!status && (
            <Button variant="outline" className="h-11" onClick={openManual} disabled={busy || noPhone}>
              <MessageCircle className="mr-2 h-4 w-4" /> Kirim manual
            </Button>
          )}
          {(stale || status === 'menunggu') && (
            <Button variant="outline" className="h-11 sm:col-span-2" onClick={confirmManual} disabled={busy}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Pasien sudah menerima invoice
            </Button>
          )}
        </div>
      )}

      {done && (
        <Button variant="outline" size="sm" onClick={sendAuto} disabled={busy || noPhone}>
          <Send className="mr-2 h-4 w-4" /> Kirim ulang
        </Button>
      )}

      {!done && status !== 'tidak_dikirim' && (
        <>
          <button type="button" className="text-xs text-slate-500 underline" onClick={() => setShowSkip((v) => !v)}>Invoice tidak bisa dikirim?</button>
          {showSkip && SkipBlock}
        </>
      )}
    </div>
  );
};

export default InvoiceDeliveryPanel;
