import { escapeHtml } from '@/lib/safeFilter';
import React, { useRef, useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '@/lib/supabase';
import { 
  Dialog, 
  DialogContent, 
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Printer, Download, X, Loader2, Send } from "lucide-react";
import InvoiceTemplate from './InvoiceTemplate';
import InvoiceTemplateKwitansi from './InvoiceTemplateKwitansi';
import InvoiceTemplateModern from './InvoiceTemplateModern';
import { useToast } from "@/components/ui/use-toast";
import { getInvoiceSettings, getWaApiSettings } from '@/lib/api';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { stripSignatureBackground } from '@/lib/signatureImage';
import { KAFFAH_CLINIC_ID } from '@/lib/clinicIds';
import { kaffahServiceLine, kaffahSessionLabel } from '@/lib/kaffahInvoiceLine';
import { fetchRecapHandlerEvents } from '@/lib/recapCashier';

// Ukuran acuan A4 (210mm x 297mm) dalam px @96dpi — dipakai untuk menghitung
// skala preview di layar sempit. Generasi PDF/print tetap memakai elemen asli
// (lihat componentRef) sehingga hasil rasterisasi tidak terpengaruh skala tampilan.
const INVOICE_BASE_WIDTH  = 794;
// PDF desain baru yang dibuat sebelum waktu ini memakai tampilan lama (teks turun / stempel terlalu atas)
// dan dibuat ulang diam-diam saat invoice dibuka. Naikkan waktu ini bila tampilan PDF diubah lagi.
const PDF_RENDER_FIXED_AT = new Date('2026-11-05T00:30:00Z');
// Kasir di kwitansi kini diambil dari admin pengisi TTV (bukan pembuat rekap). PDF tersimpan
// untuk rekap tanggal 4 Nov 2026 ke atas yang dibuat sebelum waktu ini dibuat ulang sekali
// (berkas dan tautan sama) saat invoice dibuka admin, supaya nama/tanda tangan kasir ikut benar.
const PDF_CASHIER_FIXED_AT = new Date('2026-11-04T23:30:00Z');
const PDF_CASHIER_FIXED_FROM_DATE = '2026-11-04';
const INVOICE_BASE_HEIGHT = Math.round(794 * 297 / 210);

// Kalimat pembuka pesan WA: "hari ini" hanya bila kwitansi memang untuk hari ini (WIB);
// bila kwitansi tanggal lain, tampilkan tanggalnya, mis. "tanggal 3 November 2026".
const receiptDayPhrase = (recapDate) => {
  const todayWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  if (!recapDate || recapDate === todayWib) return 'hari ini';
  const d = new Date(`${recapDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return 'hari ini';
  const tgl = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return `tanggal ${tgl}`;
};

const InvoiceModal = ({ isOpen, onClose, data, onSent }) => {
  const { userDetails } = useAuth();
  const [detailData, setDetailData]       = useState(null);
  const componentRef                       = useRef();
  const previewWrapperRef                  = useRef(null);
  const [previewScale, setPreviewScale]   = useState(1);
  const { toast }                          = useToast();
  const [isGenerating, setIsGenerating]   = useState(false);
  const [isSendingManualWA, setIsSendingManualWA] = useState(false);
  const [isSendingWA, setIsSendingWA]     = useState(false);
  const [logoUrl, setLogoUrl]             = useState(null);
  const [invoiceSettings, setInvoiceSettings] = useState({
    invoiceTitle: 'Invoice',
    invoiceSubtitle: 'Layanan Fisioterapi',
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  // Data klinik (termasuk pilihan template invoice) diambil terpisah dari pengaturan.
  // Pratinjau ditahan sampai keduanya siap supaya tidak sempat tampil template lama.
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [waAutoAvailable, setWaAutoAvailable] = useState(false);
  const [processedSignatureUrl, setProcessedSignatureUrl] = useState(null);
  // Khusus Kaffah: nama pasien pada invoice bisa diganti untuk satu kali kirim.
  // Tidak disimpan ke database (lihat isOneOff di bawah).
  const [oneOffName, setOneOffName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setOneOffName('');
      setLoadingDetail(true);
      fetchSettings();
      fetchDetailData();
      fetchWaAvailability();
    }
  }, [isOpen, data?.id]);

  // ── Bersihkan background & pertegas kontras tanda tangan terapis ─────────
  // Beberapa hasil scan tanda tangan punya background abu-abu/blur. Diproses
  // di sini (bukan lewat CSS filter) supaya hasilnya identik antara preview
  // dan PDF/print yang dirasterisasi lewat html2canvas.
  useEffect(() => {
    const signatureUrl = data?.therapist?.signature_url;
    if (!isOpen || !signatureUrl) {
      setProcessedSignatureUrl(null);
      return;
    }
    let cancelled = false;
    stripSignatureBackground(signatureUrl).then((result) => {
      if (!cancelled) setProcessedSignatureUrl(result);
    });
    return () => { cancelled = true; };
  }, [isOpen, data?.therapist?.signature_url]);

  const templateData = {
    ...detailData,
    ...data,
    therapist: data?.therapist
      ? { ...data.therapist, signature_url: processedSignatureUrl || data.therapist.signature_url }
      : data?.therapist,
  };
  // Template kwitansi memakai nomor invoice yang sama dengan yang disimpan saat
  // download/kirim, supaya tampil sebelum record tersimpan.
  const canOneOffName = (templateData.clinic?.id || detailData?.clinic?.id) === KAFFAH_CLINIC_ID;
  const oneOffTrimmed = canOneOffName ? oneOffName.trim() : '';
  // Mode kirim sekali: nama diganti, tidak ada yang dicatat (invoice_url, nomor
  // kwitansi, invoice_records, status WA) dan invoice asli pasien tidak tertimpa.
  const isOneOff = !!oneOffTrimmed;
  if (isOneOff) {
    templateData.patient_name = oneOffTrimmed;
    templateData.guest_name = oneOffTrimmed;
    templateData.patients = { ...(templateData.patients || {}), full_name: oneOffTrimmed };
    if (templateData.patient) templateData.patient = { ...templateData.patient, full_name: oneOffTrimmed };
  }
  // Prop `data` bisa membawa receipt_number kosong yang menimpa nomor dari database.
  if (canOneOffName && detailData?.receipt_number) templateData.receipt_number = detailData.receipt_number;
  if (!templateData.receipt_number && !templateData.invoice_number) {
    const rm = data?.patients?.medical_record_number || data?.patient?.medical_record_number || data?.medical_record_number || 'RM00000';
    templateData.invoice_number = `INV/KFF/${data?.recap_date || new Date().toISOString().split('T')[0]}/${rm}`;
  }
  const isPreviewLoading = loadingSettings || loadingDetail;
  const useKwitansi = templateData.clinic?.invoice_template === 'kwitansi';
  const useModern = !!templateData.use_modern_layout;
  const TemplateComponent = useModern ? InvoiceTemplateModern : (useKwitansi ? InvoiceTemplateKwitansi : InvoiceTemplate);

  // ── Skala preview agar invoice A4 tetap utuh terlihat di layar sempit (PWA/mobile) ──
  useEffect(() => {
    if (!isOpen) return;
    const node = previewWrapperRef.current;
    if (!node) return;

    const computeScale = () => {
      const availableWidth = node.clientWidth;
      if (!availableWidth) return;
      setPreviewScale(Math.min(1, availableWidth / INVOICE_BASE_WIDTH));
    };

    computeScale();
    const observer = new ResizeObserver(computeScale);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isOpen, isPreviewLoading]);

  // ── Cek apakah klinik ini sudah punya API Key WA (untuk kirim otomatis) ───
  const fetchWaAvailability = async () => {
    const { data: waSettings } = await getWaApiSettings();
    setWaAutoAvailable(!!(waSettings?.enabled && waSettings?.api_key));
  };

  // ── Fetch Invoice Settings ────────────────────────────────────────────────
  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      const { data: settingsData, error } = await getInvoiceSettings();
      if (settingsData && !error) {
        setInvoiceSettings({
          invoiceTitle:    settingsData.invoice_title    || 'Invoice',
          invoiceSubtitle: settingsData.invoice_subtitle || 'Layanan Fisioterapi',
        });
        setLogoUrl(settingsData.logo_url || null);
      }
    } catch (err) {
      console.error("Error fetching invoice settings:", err);
    } finally {
      setLoadingSettings(false);
    }
  };

  // ── Fetch Detail Data ─────────────────────────────────────────────────────
  // FIX: destructure error dengan benar (sebelumnya error tidak terdefinisi)
  const fetchDetailData = async () => {
    try {
      await loadDetailData();
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadDetailData = async () => {
    if (!data?.id) return;

    const { data: recap, error } = await supabase
      .from('daily_recaps')
      .select('*, payment_splits:daily_recap_payment_splits(payment_method, amount)')
      .eq('id', data.id)
      .single();

    if (error || !recap) {
      console.error("Error fetching recap:", error);
      return;
    }

    // Kaffah: nomor kwitansi dibuat database (KFF/XI/2026/0042), satu nomor tetap per recap.
    // Recap yang sudah punya nomor (termasuk format lama INV/KFF/...) tidak diubah.
    // Nomor RCPT/... (diberi otomatis saat recap dibuat) adalah penampung; fungsi database
    // menggantinya dengan nomor KFF bila invoice belum pernah terbit/diunduh.
    if (recap.clinic_id === KAFFAH_CLINIC_ID && (!recap.receipt_number || /^RCPT\//.test(recap.receipt_number))) {
      const { data: assigned, error: assignErr } = await supabase.rpc('assign_kaffah_receipt_number', { p_recap_id: recap.id });
      if (assignErr) console.error('Gagal membuat nomor kwitansi:', assignErr);
      else if (assigned) recap.receipt_number = assigned;
    }

    // Kasir = admin yang pertama kali menyimpan rekap (cashier_id, diisi sekali).
    // Data lama yang belum punya cashier_id memakai created_by hanya jika rolenya admin;
    // jika masih kosong, diklaim oleh admin yang pertama kali membukanya.
    const isAdminRole = (r) => r === 'admin';
    const lookupCashier = async (id) => {
      if (!id) return null;
      const { data: c } = await supabase.from('users').select('full_name, signature_url, role').eq('id', id).maybeSingle();
      // RLS users hanya mengizinkan admin/owner membaca user lain, jadi admin
      // (Praxis) yang membuka invoice rekannya mendapat hasil kosong; RPC hanya
      // mengembalikan admin satu klinik.
      if (c && isAdminRole(c.role)) return c;
      if (!c) {
        const { data: rows } = await supabase.rpc('get_invoice_cashier', { p_user_id: id });
        return rows?.[0] || null;
      }
      return null;
    };
    // Urutan kasir: cashier_id -> admin pertama yang mengisi TTV/mengubah pembayaran -> pembuat rekap bila admin.
    // Rekap sering dibuat lebih awal oleh admin lain, jadi pembuat rekap bukan penanda kasir yang andal.
    let creator = null;
    if (recap.cashier_id) {
      creator = await lookupCashier(recap.cashier_id);
    } else {
      const events = (await fetchRecapHandlerEvents(supabase, [recap.id]))[recap.id] || [];
      for (const e of events) {
        creator = await lookupCashier(e.userId);
        if (creator) break;
      }
      if (!creator) creator = await lookupCashier(recap.created_by);
    }
    if (!creator && !recap.cashier_id && userDetails?.id && isAdminRole(userDetails.role)) {
      const { error: claimErr } = await supabase
        .from('daily_recaps').update({ cashier_id: userDetails.id }).eq('id', recap.id).is('cashier_id', null);
      if (!claimErr) {
        const { data: me } = await supabase.from('users').select('full_name, signature_url').eq('id', userDetails.id).maybeSingle();
        creator = me;
      }
    }

    let physioData = null;
    let clinicData = null;
    if (recap.therapist_id) {
      const { data: physio } = await supabase
        .from('physiotherapists')
        .select('name, signature_url, stamp_url, clinic_id')
        .eq('id', recap.therapist_id)
        .single();
      if (physio) {
        physioData = physio;
        if (physio.clinic_id) {
          const { data: clinic } = await supabase
            .from('clinics')
            .select('id, name, address, phone, email, logo_url, invoice_signer, invoice_signer_from, invoice_desc_style, invoice_desc_from, invoice_layout, invoice_layout_from, stamp_url, invoice_admin_name, invoice_admin_signature_url, invoice_show_patient_signature, invoice_template')
            .eq('id', physio.clinic_id)
            .single();
          if (clinic) clinicData = clinic;
        }
      }
    }

    // Jam slot terapi (dipakai template kwitansi untuk klinik Praxis).
    let slotEnd = null;
    if (recap.appointment_id) {
      const { data: appt } = await supabase
        .from('appointments')
        .select('appointment_date, duration_minutes')
        .eq('id', recap.appointment_id)
        .maybeSingle();
      if (appt?.appointment_date) {
        slotEnd = new Date(new Date(appt.appointment_date).getTime() + (appt.duration_minutes || 60) * 60000).toISOString();
      }
    }

    // Kaffah: deskripsi layanan bertingkat (Essential/Advanced/Recovery, "N-Session Package"),
    // hanya untuk invoice yang terbit sejak invoice_desc_from; invoice lama tidak berubah.
    let tieredLine = null;
    if (clinicData?.invoice_desc_style === 'tiered') {
      const from = clinicData.invoice_desc_from ? new Date(clinicData.invoice_desc_from) : null;
      // Recap lama tidak punya invoice_created_at -> pakai created_at; tidak diketahui = invoice lama.
      const issuedSource = recap.invoice_created_at || recap.created_at;
      const issued = issuedSource ? new Date(issuedSource) : null;
      if (!(from && (!issued || issued < from))) {
        const ids = [recap.patient_type, recap.package_type].filter(Boolean);
        const labels = {};
        if (ids.length) {
          const { data: opts } = await supabase.from('operational_options').select('id, label').in('id', ids.filter((v) => /^[0-9a-f-]{36}$/i.test(v)));
          (opts || []).forEach((o) => { labels[o.id] = o.label; });
        }
        let totalSessions = null;
        if (recap.package_tracking_id) {
          const { data: pt } = await supabase.from('package_tracking').select('total_sessions').eq('id', recap.package_tracking_id).maybeSingle();
          totalSessions = pt?.total_sessions || null;
        }
        const service = kaffahServiceLine(labels[recap.patient_type] || recap.patient_type);
        tieredLine = {
          code: service.code,
          description: service.description,
          session: kaffahSessionLabel(labels[recap.package_type] || recap.package_type, totalSessions),
        };
      }
    }

    // Kaffah: desain kwitansi "Minimal Bersih" (InvoiceTemplateModern), hanya untuk invoice yang
    // terbit sejak invoice_layout_from; invoice lama tetap memakai desain lama.
    let useModernLayout = false;
    if (clinicData?.invoice_layout === 'modern') {
      const from = clinicData.invoice_layout_from ? new Date(clinicData.invoice_layout_from) : null;
      const issuedSource = recap.invoice_created_at || recap.created_at;
      const issued = issuedSource ? new Date(issuedSource) : null;
      useModernLayout = !(from && (!issued || issued < from));
    }

    // Kapan PDF tersimpan dibuat (untuk memperbarui PDF lama yang tampilannya keliru).
    let pdfGeneratedAt = null;
    if (useModernLayout && recap.invoice_url) {
      const { data: rec } = await supabase
        .from('invoice_records')
        .select('generated_at')
        .eq('daily_recap_id', recap.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      pdfGeneratedAt = rec?.generated_at || null;
    }

    setDetailData({
      ...recap,
      pdf_generated_at: pdfGeneratedAt,
      use_modern_layout: useModernLayout,
      tiered_line: tieredLine,
      slot_end_at: slotEnd,
      therapist_name: physioData?.name || recap.therapist_name || '-',
      signature_url:  physioData?.signature_url || null,
      stamp_url:      physioData?.stamp_url     || null,
      clinic: clinicData,
      admin_signer_name: creator?.full_name || null,
      admin_signer_signature_url: creator?.signature_url || null,
    });
  };

  // ── Helper: koreksi pengukuran huruf html2canvas ──────────────────────────
  // html2canvas mengukur garis dasar huruf dengan <img width=1 height=1> di <body>. CSS dasar
  // Tailwind membuat semua <img> berupa block, sehingga hasil ukurnya salah dan teks di PDF
  // turun ~6-12px dari posisinya di preview (kotak metode bayar & Balance Paid tidak di tengah).
  // Hanya dipakai desain baru; desain lama dibiarkan seperti semula.
  const withFontMetricsFix = async (enabled, fn) => {
    if (!enabled) return fn();
    const style = document.createElement('style');
    style.textContent = 'img[width="1"][height="1"]{display:inline-block !important;vertical-align:baseline !important}';
    document.head.appendChild(style);
    try { return await fn(); } finally { style.remove(); }
  };

  // ── Helper: Generate PDF ──────────────────────────────────────────────────
  const generatePDF = async () => {
    const element = componentRef.current;
    if (!element) throw new Error("Element invoice tidak ditemukan");

    // Cukup tunggu font siap + satu frame render. (Dulu jeda tetap 500 ms; html2canvas memuat
    // gambar sendiri, jadi tidak perlu menunggu gambar di sini.)
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const canvas = await withFontMetricsFix(useModern, () => html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
    }));

    // JPEG, bukan PNG: jsPDF memproses ulang PNG piksel demi piksel (~2 detik atau lebih untuk
    // halaman A4 beresolusi 2x), sedangkan JPEG langsung disisipkan (~0,02 detik).
    const imgData   = canvas.toDataURL('image/jpeg', 0.95);
    const pdfWidth  = 210;
    const pdfHeight = 297;

    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const imgProps    = pdf.getImageProperties(imgData);
    const pdfImgH     = (imgProps.height * pdfWidth) / imgProps.width;
    const finalHeight = Math.min(pdfImgH, pdfHeight);

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, finalHeight);
    // Simpan kanvas untuk gambar pratinjau tautan WhatsApp (lihat buildPreviewBlob / uploadPDF).
    pdf.__previewCanvas = canvas;
    return pdf;
  };

  // ── Helper: gambar pratinjau tautan (1200x630) ─────────────────────────────
  // WhatsApp/Telegram menampilkan og:image sebagai kartu lebar. Yang dipakai hanya bagian atas
  // kwitansi (kop klinik, judul, nomor, data pasien) tanpa tepi putih halaman, sehingga di chat
  // tulisannya masih terbaca dan ukurannya proporsional, bukan satu halaman utuh yang mengecil.
  const buildPreviewBlob = (pageCanvas) => new Promise((resolve) => {
    try {
      const W = 1200;
      const H = 630;
      const card = document.createElement('canvas');
      card.width = W;
      card.height = H;
      const ctx = card.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      const sideCrop = Math.round(pageCanvas.width * 0.03); // buang tepi putih kiri/kanan
      const srcW = pageCanvas.width - sideCrop * 2;
      const scale = W / srcW;
      const srcH = Math.min(pageCanvas.height, Math.round(H / scale));
      ctx.drawImage(pageCanvas, sideCrop, 0, srcW, srcH, 0, 0, W, Math.round(srcH * scale));
      card.toBlob((blob) => resolve(blob), 'image/jpeg', 0.88);
    } catch {
      resolve(null);
    }
  });

  // ── Helper: Medical Record Number ────────────────────────────────────────
  // FIX: medical_record_number ada di data.patients (hasil join di getDailyRecaps)
  // bukan di root data, makanya selalu fallback ke RM00000
  const getMedicalRecordNumber = () =>
    data?.patients?.medical_record_number ||
    data?.patient?.medical_record_number  ||
    data?.medical_record_number           ||
    'RM00000';

  // ── Helper: Nama Pasien (dipakai untuk nama file PDF) ─────────────────────
  const getPatientNameSlug = () => {
    const name =
      oneOffTrimmed ||
      data?.patients?.full_name ||
      data?.patient?.full_name  ||
      data?.guest_name          ||
      data?.patient_name        ||
      'Pasien';
    return name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  };

  // ── Helper: Invoice Number ────────────────────────────────────────────────
  const getInvoiceNumber = () => {
    if (canOneOffName && detailData?.receipt_number) return detailData.receipt_number;
    const rm      = getMedicalRecordNumber();
    const dateStr = data?.recap_date || new Date().toISOString().split('T')[0];
    return `INV/KFF/${dateStr}/${rm}`;
  };

  // ── Helper: Nomor HP Pasien ───────────────────────────────────────────────
  // FIX: data.patient (singular) bukan data.patients
  const getPatientPhone = () =>
    data?.patient?.phone     ||
    data?.patients?.phone    ||   // fallback lama
    data?.guest_phone        ||
    detailData?.guest_phone  ||
    '';

  // ── Helper: Upload PDF ke Supabase Storage → return public URL ───────────
  // FIX: fileName diterima sebagai parameter, bukan hardcode inv_${data.id}.pdf
  const uploadPDF = async (pdf, fileName, { persist = true, cacheControl } = {}) => {
    const blob = pdf.output('blob');

    const { error: uploadError } = await supabase
      .storage
      .from('invoices')
      .upload(fileName, blob, { contentType: 'application/pdf', upsert: true, ...(cacheControl ? { cacheControl } : {}) });

    if (uploadError) throw new Error(`Upload gagal: ${uploadError.message}`);

    // Gambar pratinjau tautan disimpan di samping PDF (nama sama, .jpg). Gagal di sini tidak
    // boleh menggagalkan pengiriman kwitansi, jadi hanya dicatat.
    if (pdf.__previewCanvas && /\.pdf$/i.test(fileName) && !fileName.startsWith('oneoff/')) {
      try {
        const previewBlob = await buildPreviewBlob(pdf.__previewCanvas);
        if (previewBlob) {
          await supabase.storage.from('invoices').upload(
            fileName.replace(/\.pdf$/i, '.jpg'),
            previewBlob,
            { contentType: 'image/jpeg', upsert: true, ...(cacheControl ? { cacheControl } : {}) },
          );
        }
      } catch (previewError) {
        console.error('Gagal mengunggah gambar pratinjau tautan:', previewError);
      }
    }

    const { data: publicUrlData } = supabase
      .storage
      .from('invoices')
      .getPublicUrl(fileName);

    const fileUrl = publicUrlData.publicUrl;

    if (!persist) return fileUrl;

    // Simpan URL ke daily_recaps
    const { error: saveUrlError } = await supabase
      .from('daily_recaps')
      .update({ invoice_url: fileUrl })
      .eq('id', data.id);

    if (saveUrlError) throw new Error(`Gagal menyimpan invoice_url: ${saveUrlError.message}`);

    return fileUrl;
  };

  // ── Helper: Simpan Invoice Record ─────────────────────────────────────────
  const saveInvoiceRecord = async (invoiceNumber) => {
    const { error: saveReceiptError } = await supabase
      .from('daily_recaps')
      .update({ receipt_number: invoiceNumber })
      .eq('id', data.id);

    if (saveReceiptError) throw new Error(`Gagal menyimpan receipt_number: ${saveReceiptError.message}`);

    const { data: existing } = await supabase
      .from('invoice_records')
      .select('id')
      .eq('daily_recap_id', data.id)
      .maybeSingle();

    if (!existing) {
      await supabase.from('invoice_records').insert([{
        daily_recap_id: data.id,
        patient_id:     data.patient_id,
        therapist_id:   data.therapist_id,
        amount:         data.amount || 0,
        invoice_number: invoiceNumber,
        generated_at:   new Date(),
      }]);
    }
  };

  // ── Perbarui PDF tersimpan yang tampilannya keliru ────────────────────────
  // PDF desain baru yang dibuat sebelum PDF_RENDER_FIXED_AT dibuat ulang ke berkas yang sama
  // (URL/tautan tetap). Hanya tampilan; nomor, nominal, dan data invoice tidak diubah.
  const pdfRefreshedRef = useRef(new Set());
  const pdfRefreshBusyRef = useRef(false);
  useEffect(() => {
    if (!isOpen || isPreviewLoading || isOneOff || !useModern) return undefined;
    const url = detailData?.invoice_url;
    const generatedAt = detailData?.pdf_generated_at;
    const recapId = detailData?.id;
    if (!url || !generatedAt || !recapId) return undefined;
    const needsRenderFix = new Date(generatedAt) < PDF_RENDER_FIXED_AT;
    const needsCashierFix = new Date(generatedAt) < PDF_CASHIER_FIXED_AT
      && String(detailData?.revenue_date || '').slice(0, 10) >= PDF_CASHIER_FIXED_FROM_DATE;
    if (!needsRenderFix && !needsCashierFix) return undefined;
    if (pdfRefreshedRef.current.has(recapId) || pdfRefreshBusyRef.current) return undefined;
    const match = url.match(/\/object\/public\/invoices\/([^?]+)/);
    if (!match) return undefined;

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled || !componentRef.current) return;
      pdfRefreshBusyRef.current = true;
      try {
        const pdf = await generatePDF();
        if (cancelled) return;
        await uploadPDF(pdf, decodeURIComponent(match[1]), { persist: false, cacheControl: '60' });
        await supabase.from('invoice_records').update({ generated_at: new Date().toISOString() }).eq('daily_recap_id', recapId);
        pdfRefreshedRef.current.add(recapId);
        toast({ title: 'PDF invoice diperbarui', description: 'PDF tersimpan sudah disesuaikan dengan preview (termasuk kasir).' });
      } catch (err) {
        console.error('Gagal memperbarui PDF tersimpan:', err);
      } finally {
        pdfRefreshBusyRef.current = false;
      }
    }, 900);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isPreviewLoading, isOneOff, useModern, detailData?.id, detailData?.invoice_url, detailData?.pdf_generated_at, detailData?.revenue_date]);

  // ── Pulihkan invoice_url yang gagal tersimpan ─────────────────────────────
  // Kirim Manual membuka WhatsApp lebih dulu, lalu menyiapkan PDF di latar. Di HP, aplikasi yang
  // dibuang ke latar bisa dibekukan tepat setelah PDF terunggah dan sebelum invoice_url disimpan:
  // berkasnya ada di Storage tetapi tautan /i/:id menampilkan "tidak ditemukan". Saat kwitansi
  // dibuka lagi, bila invoice sudah pernah dibuat namun invoice_url kosong dan berkasnya ada di
  // Storage, simpan URL-nya (tidak membuat ulang apa pun).
  const urlHealedRef = useRef(new Set());
  useEffect(() => {
    if (!isOpen || isPreviewLoading || isOneOff) return undefined;
    const recapId = detailData?.id;
    const rawDate = data?.recap_date;
    if (!recapId || detailData?.invoice_url || !rawDate) return undefined;
    if (urlHealedRef.current.has(recapId)) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const { data: rec } = await supabase
          .from('invoice_records').select('id').eq('daily_recap_id', recapId).limit(1).maybeSingle();
        if (!rec || cancelled) return;
        const [yr, mo, dy] = rawDate.split('-');
        const expectedName = `Kwitansi_${getPatientNameSlug()}_${dy}-${mo}-${yr.slice(2)}.pdf`;
        const { data: files } = await supabase.storage.from('invoices').list('', { search: expectedName, limit: 5 });
        if (cancelled || !files?.some((f) => f.name === expectedName)) return;
        const { data: pub } = supabase.storage.from('invoices').getPublicUrl(expectedName);
        const { error } = await supabase
          .from('daily_recaps').update({ invoice_url: pub.publicUrl }).eq('id', recapId).is('invoice_url', null);
        if (!error && !cancelled) setDetailData((prev) => (prev ? { ...prev, invoice_url: pub.publicUrl } : prev));
      } catch (err) {
        console.error('Gagal memulihkan invoice_url:', err);
      } finally {
        if (!cancelled) urlHealedRef.current.add(recapId);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isPreviewLoading, isOneOff, detailData?.id, detailData?.invoice_url]);

  // ── Download PDF ──────────────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    try {
      const invoiceNumber = getInvoiceNumber();

      // Pembuatan PDF dan penyimpanan data invoice berjalan bersamaan (dulu berurutan).
      const [pdf] = await Promise.all([
        generatePDF(),
        isOneOff ? Promise.resolve() : saveInvoiceRecord(invoiceNumber),
      ]);

      const rawDate = data?.recap_date || new Date().toISOString().split('T')[0];
      const [yr, mo, dy] = rawDate.split('-');
      const dateFormatted = `${dy}-${mo}-${yr.slice(2)}`;

      pdf.save(`Kwitansi_${getPatientNameSlug()}_${dateFormatted}.pdf`);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      toast({ variant: "destructive", title: "Gagal Mengunduh", description: err.message });
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Kirim Invoice via WA ──────────────────────────────────────────────────
  // FIX UTAMA: pakai supabase.rpc('send_invoice_whatsapp') bukan fetch langsung
  // → Menghindari CORS error karena request ke Wablas lewat database, bukan browser
  const handleSendWA = async () => {
    setIsSendingWA(true);
    // Setelah dispatch, status invoice dimiliki SERVER (invoice_wa_sends + cron). Browser tidak lagi
    // menulis 'terkirim'/'gagal' untuk pengiriman yang sudah diserahkan ke server.
    let dispatchAttempted = false;
    try {

      // 1. Validasi nomor HP
      const rawPhone = getPatientPhone();
      if (!rawPhone) {
        toast({
          variant: "destructive",
          title: "Gagal Kirim WA",
          description: "Nomor telepon pasien tidak tersedia.",
        });
        return;
      }

      // 1b. Cek jendela 24 jam. PDF lewat jalur non-resmi Watzap tidak punya status pengiriman, dan
      //     Meta menolak diam-diam bila pasien tidak membalas dalam 24 jam, jadi jangan kirim percuma.
      const { data: win } = await supabase.rpc('invoice_wa_window', { p_phone: rawPhone });
      if (win?.checkable && !win.open) {
        if (!isOneOff) {
          await supabase
            .from('daily_recaps')
            .update({ invoice_wa_status: 'perlu_manual', invoice_wa_sent_at: new Date().toISOString() })
            .eq('id', data.id);
        }
        toast({
          variant: "destructive",
          title: "Tidak dikirim: di luar 24 jam",
          description: "Pasien belum membalas WhatsApp klinik dalam 24 jam terakhir, jadi PDF tidak akan sampai. Gunakan tombol kirim manual (lewat link).",
        });
        onSent?.();
        return;
      }

      // 2. Gunakan invoice_url yang sudah ada, atau generate + upload baru
      let fileUrl = isOneOff ? null : (data?.invoice_url || detailData?.invoice_url || null);

      // 3. Siapkan nama file dengan format Rcpt_RM_DD-MM-YY.pdf
      const rm       = getMedicalRecordNumber();
      const rawDate  = data?.recap_date || new Date().toISOString().split('T')[0];
      const [yr, mo, dy] = rawDate.split('-');
      const dateFormatted = `${dy}-${mo}-${yr.slice(2)}`;
      const fileName = `Kwitansi_${getPatientNameSlug()}_${dateFormatted}.pdf`;

      if (!fileUrl) {
        toast({ title: "Menyiapkan Invoice...", description: "Sedang generate dan upload PDF." });
        const pdf = await generatePDF();
        if (isOneOff) {
          // File sementara di storage (nama unik) hanya agar bisa dikirim; tidak ditautkan ke recap mana pun.
          fileUrl = await uploadPDF(pdf, `oneoff/${data.id}_${Date.now()}.pdf`, { persist: false });
        } else {
          // FIX: teruskan fileName ke uploadPDF supaya nama file di Storage juga benar
          fileUrl = await uploadPDF(pdf, fileName);
          await saveInvoiceRecord(getInvoiceNumber());
        }
      }

      // 4. Siapkan pesan caption
      const clinicName = detailData?.clinic?.name || '';
      const caption =
        `Berikut *Kwitansi Terapi* ${receiptDayPhrase(data?.recap_date)}.\n\n` +
        `Terima kasih telah mempercayakan pemulihan di *${clinicName}*.\n` +
        `Semoga lekas membaik dan sehat selalu.\n\n` +
        `*Salam Sehat,*\n` +
        `${clinicName}`;

      // 5a. Rekap harian: serahkan ke server. Server mengirim ke Watzap, mencatat status 'mengirim', lalu
      //     menetapkan 'terkirim'/'gagal' dari balasan Watzap (browser hanya menanyakan hasilnya).
      if (!isOneOff) {
        dispatchAttempted = true;
        const { data: sent, error: sendErr } = await supabase.rpc('invoice_wa_dispatch', {
          p_recap_id: data.id,
          p_phone:    rawPhone,
          p_caption:  caption,
          p_file_url: fileUrl,
          p_filename: fileName,
        });
        if (sendErr) throw new Error(sendErr.message);
        const sendId = sent?.send_id;
        if (!sendId) throw new Error('Pengiriman tidak tercatat di server.');

        let final = null;
        for (let i = 0; i < 30 && !final; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          try {
            const { data: rs } = await supabase.rpc('invoice_wa_resolve', { p_send_id: sendId });
            if (rs?.status && rs.status !== 'mengirim') final = rs;
          } catch (pollErr) {
            console.warn('invoice_wa_resolve:', pollErr); // server/cron tetap menyelesaikan
          }
        }

        if (final?.status === 'terkirim') {
          toast({
            title: "✅ Invoice Terkirim",
            description: `Invoice PDF diterima Watzap untuk dikirim ke ${rawPhone}. Catatan: status berdasarkan respons API, bukan konfirmasi pasien menerima pesan.`,
          });
        } else if (final?.status === 'gagal') {
          toast({
            variant: "destructive",
            title: "Gagal Kirim WA",
            description: final.detail || "Watzap menolak pengiriman invoice.",
          });
        } else {
          toast({
            title: "Masih diproses",
            description: "Watzap belum membalas. Status badge akan diperbarui otomatis; cek WhatsApp pasien sebelum mengirim ulang agar tidak terkirim dobel.",
          });
        }
        onSent?.();
        return;
      }

      // 5. Panggil SQL function send_invoice_whatsapp via RPC (hanya untuk invoice sekali kirim / one-off)
      // → Request ke Wablas dilakukan dari DATABASE bukan browser → bebas CORS
      let { data: rpcResult, error: rpcError } = await supabase.rpc(
        'send_invoice_whatsapp',
        {
          p_phone:       rawPhone,
          p_message:     caption,
          p_file_base64: fileUrl,   // SQL function pakai nama p_file_base64 tapi isinya URL
          p_filename:    fileName,
        }
      );

      if (rpcError) throw new Error(rpcError.message);

      // Balasan Watzap kadang lebih lambat dari batas tunggu fungsi database (~6 dtk). Permintaan sudah
      // terkirim, jadi tunggu balasannya (maks ~30 dtk) agar status tetap tercatat, bukan dibiarkan kosong.
      if (rpcResult?.pending && rpcResult?.request_id) {
        toast({ title: "Menunggu respons Watzap...", description: "Watzap membalas lebih lambat dari biasanya." });
        for (let attempt = 0; attempt < 10 && rpcResult?.pending; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          const { data: polled } = await supabase.rpc('invoice_wa_poll', { p_request_id: rpcResult.request_id });
          if (polled?.done) rpcResult = { ...polled, request_id: rpcResult.request_id };
        }
      }
      // 6. Cek response dari Wablas
      // Sukses hanya bila HTTP 200 DAN isi balasan Watzap menyatakan status 200. Sebelumnya adanya
      // request_id saja dianggap sukses, sehingga respons kosong/ditolak tetap berbadge hijau.
      let body = null;
      try { body = typeof rpcResult?.content === 'string' ? JSON.parse(rpcResult.content) : rpcResult?.content; } catch { /* bukan JSON */ }
      const accepted = Number(rpcResult?.status) === 200 && String(body?.status) === '200';

      if (accepted) {
        if (!isOneOff) {
          await supabase
            .from('daily_recaps')
            .update({
              invoice_wa_status: 'terkirim',
              invoice_wa_sent_at: new Date().toISOString(),
            })
            .eq('id', data.id);
        }

        toast({
          title: "✅ Invoice Terkirim",
          description: `Invoice PDF diterima Watzap untuk dikirim ke ${rawPhone}. Catatan: status berdasarkan respons API, bukan konfirmasi pasien menerima pesan.`,
        });

        onSent?.();
      } else if (rpcResult?.error) {
        throw new Error(rpcResult.error);
      } else if (rpcResult?.pending || !rpcResult?.status) {
        // Permintaan sudah diteruskan ke Watzap tetapi balasannya belum datang. Bukan kegagalan:
        // jangan tandai merah; status dibiarkan agar tidak menyesatkan, staf diminta memeriksa.
        toast({
          title: "Menunggu respons Watzap",
          description: `Permintaan sudah dikirim ke ${rawPhone} tetapi Watzap belum membalas. Cek WhatsApp pasien sebelum mengirim ulang agar tidak terkirim dobel.`,
        });
      } else {
        throw new Error(body?.message || String(rpcResult.content || 'Gagal mengirim invoice otomatis').slice(0, 200));
      }

    } catch (err) {
      console.error("handleSendWA error:", err);

      // Bila sudah diserahkan ke server (dispatch), jangan menulis 'gagal' dari browser: permintaan mungkin
      // sudah diproses walau balasan ke browser terputus; server/cron yang menetapkan status akhirnya.
      if (!isOneOff && !dispatchAttempted) {
        await supabase
          .from('daily_recaps')
          .update({
            invoice_wa_status: 'gagal',
            invoice_wa_sent_at: new Date().toISOString(),
          })
          .eq('id', data.id);
      }

      toast({
        variant: "destructive",
        title: "Gagal Kirim WA",
        description: err.message || "Terjadi kesalahan saat mengirim invoice.",
      });
    } finally {
      setIsSendingWA(false);
    }
  };
const handleSendManualWA = async () => {
  const rawPhone = getPatientPhone();
  if (!rawPhone) {
    toast({
      variant: "destructive",
      title: "Nomor Tidak Ditemukan",
      description: "Nomor telepon pasien tidak tersedia.",
    });
    return;
  }

  const rawDate = data?.recap_date || new Date().toISOString().split('T')[0];
  const [yr, mo, dy] = rawDate.split('-');
  const fileName = `Kwitansi_${getPatientNameSlug()}_${dy}-${mo}-${yr.slice(2)}.pdf`;

  const clinicName = detailData?.clinic?.name || '';
  const invoiceLink = `${window.location.origin}/i/${data.id}`;
  const message =
    `Berikut *Kwitansi Terapi* ${receiptDayPhrase(data?.recap_date)}.\n\n` +
    `Terima kasih telah mempercayakan pemulihan di *${clinicName}*.\n` +
    `Semoga lekas membaik dan sehat selalu.\n\n` +
    (isOneOff ? '' : `Lihat/unduh kwitansi:\n${invoiceLink}\n\n`) +
    `*Salam Sehat,*\n` +
    `${clinicName}`;
  const waUrl = `https://wa.me/${rawPhone.replace(/^0/, '62')}?text=${encodeURIComponent(message)}`;

  // Pesan hanya butuh link /i/:id, yang sudah diketahui dari id rekap, jadi WhatsApp dibuka SEKARANG,
  // sinkron dengan klik (tidak diblokir popup blocker dan tidak memuat ulang PWA ke splash screen).
  // PDF disiapkan sesudahnya; petugas masih perlu menekan Kirim di WhatsApp, dan halaman /i/:id
  // mencoba ulang beberapa detik bila PDF belum selesai diunggah. (Dulu WhatsApp baru dibuka setelah
  // generate + upload + simpan selesai berurutan, beberapa detik pada klik pertama.)
  window.open(waUrl, '_blank');

  setIsSendingManualWA(true);
  try {
    if (isOneOff) {
      // Link /i/:id menampilkan invoice asli (tersimpan), jadi untuk kirim sekali
      // PDF diunduh dan admin melampirkannya sendiri di chat WhatsApp.
      const pdf = await generatePDF();
      pdf.save(fileName);
    } else {
      const hasPdf = !!(data?.invoice_url || detailData?.invoice_url);
      if (!hasPdf) {
        // Pembuatan PDF dan penyimpanan data invoice berjalan bersamaan (sama seperti Download PDF).
        const [pdf] = await Promise.all([generatePDF(), saveInvoiceRecord(getInvoiceNumber())]);
        await uploadPDF(pdf, fileName);
      }

      await supabase
        .from('daily_recaps')
        .update({
          invoice_wa_status: 'terkirim_manual',
          invoice_wa_sent_at: new Date().toISOString(),
        })
        .eq('id', data.id);
    }

    onSent?.();
  } catch (err) {
    toast({
      variant: "destructive",
      title: "Kwitansi belum siap",
      description: `${err.message}. Link di WhatsApp belum bisa dibuka pasien; klik Kirim Manual lagi sebelum mengirim.`,
    });
  } finally {
    setIsSendingManualWA(false);
  }
};
  // ── Print ─────────────────────────────────────────────────────────────────
  // Render the exact same rasterized image used for the PDF download so the
  // printed result always matches — the browser's native print layout of the
  // raw DOM tends to paginate/reflow the fixed-size invoice unpredictably.
  const [isPrinting, setIsPrinting] = useState(false);
  const handlePrint = async () => {
    // Buka tab SEKARANG (sinkron dengan klik) agar tidak diblokir popup blocker;
    // isinya diisi setelah invoice selesai dirasterisasi.
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write('<p style="font-family:sans-serif;padding:24px">Menyiapkan invoice...</p>');
    }
    setIsPrinting(true);
    try {
      const element = componentRef.current;
      if (!element) throw new Error('Invoice belum siap dicetak');

      await new Promise(resolve => setTimeout(resolve, 300));
      const canvas = await withFontMetricsFix(useModern, () => html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794,
      }));
      const imgData = canvas.toDataURL('image/png');
      const title = escapeHtml(`Invoice - ${data?.patient_name || 'Patient'}`);
      const html = `<!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>${title}</title>
            <style>
              @page { size: A4; margin: 0; }
              html, body { margin: 0; padding: 0; background: #fff; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              img { display: block; width: 100%; max-width: 210mm; height: auto; margin: 0 auto; }
              @media print { img { width: 210mm; max-width: none; height: 297mm; } }
            </style>
          </head>
          <body>
            <img id="inv" src="${imgData}" />
            <script>
              (function () {
                var img = document.getElementById('inv');
                function go() { setTimeout(function () { window.focus(); window.print(); }, 200); }
                if (img.complete) go(); else img.onload = go;
              })();
            <\/script>
          </body>
        </html>`;

      if (printWin && !printWin.closed) {
        // Tab pratinjau: dialog cetak + preview browser tampil dari sini.
        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();
      } else {
        // Popup diblokir → fallback iframe (di luar layar, bukan display:none
        // karena iframe tersembunyi menghasilkan preview kosong).
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(html.replace(/<script>[\s\S]*?<\/script>/, ''));
        doc.close();
        const img = doc.getElementById('inv');
        if (img && !img.complete) {
          await new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => iframe.remove(), 60000);
      }
    } catch (err) {
      console.error('Print Error:', err);
      if (printWin && !printWin.closed) printWin.close();
      toast({ variant: "destructive", title: "Gagal Mencetak", description: err.message });
    } finally {
      setIsPrinting(false);
    }
  };

  if (!data) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[1000px] w-full max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 bg-slate-100">

        {/* Header */}
        <div className="flex items-center justify-between gap-2 p-3 sm:p-4 border-b bg-white z-10 shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 shrink-0">Preview Invoice</h2>
          <div className="flex flex-wrap justify-end gap-1.5 sm:gap-2">

            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting}>
              {isPrinting
                ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
                : <Printer className="w-4 h-4 sm:mr-2" />
              }
              <span className="hidden sm:inline">Cetak</span>
            </Button>

            <Button
              size="sm"
              onClick={handleDownloadPDF}
              disabled={isGenerating || isPreviewLoading}
              className="bg-app-accent hover:bg-app-accent-hover"
            >
              {isGenerating
                ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
                : <Download className="w-4 h-4 sm:mr-2" />
              }
              <span className="hidden sm:inline">Download PDF</span>
            </Button>

            {waAutoAvailable && (
              <Button
                size="sm"
                onClick={handleSendWA}
                disabled={isSendingWA || isPreviewLoading}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isSendingWA
                  ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
                  : <Send className="w-4 h-4 sm:mr-2" />
                }
                <span className="hidden sm:inline">{isSendingWA ? 'Mengirim...' : 'Kirim Otomatis'}</span>
              </Button>
            )}

<Button
  size="sm"
  onClick={handleSendManualWA}
  disabled={isSendingManualWA || isPreviewLoading}
  className="bg-emerald-500 hover:bg-emerald-600 text-white"
>
  {isSendingManualWA
    ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
    : <Send className="w-4 h-4 sm:mr-2" />
  }
  <span className="hidden sm:inline">{isSendingManualWA ? 'Membuka...' : 'Kirim Manual'}</span>
</Button>

            <DialogClose asChild>
              <Button aria-label="Tutup" variant="ghost" size="icon">
                <X className="w-4 h-4" />
              </Button>
            </DialogClose>
          </div>
        </div>

        {canOneOffName && (
          <div className="px-3 sm:px-4 py-2 border-b bg-amber-50 shrink-0">
            <label className="text-xs font-medium text-amber-900">
              Nama pada invoice (kirim sekali, tidak tercatat di sistem)
            </label>
            <Input
              value={oneOffName}
              onChange={(e) => setOneOffName(e.target.value)}
              placeholder="Kosongkan untuk memakai nama pasien asli"
              className="mt-1 h-9 bg-white"
              maxLength={100}
            />
            {isOneOff && (
              <p className="text-[11px] text-amber-800 mt-1">
                Mode kirim sekali: Download/Kirim tidak menyimpan invoice, nomor kwitansi, atau status kirim. Kirim Manual akan mengunduh PDF untuk dilampirkan sendiri.
              </p>
            )}
          </div>
        )}

        {/* Preview Area — discalakan agar invoice A4 tetap utuh terlihat di layar sempit */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-8 bg-slate-200/50">
          <div ref={previewWrapperRef} className="w-full flex justify-center">
            {isPreviewLoading ? (
              <div
                className="flex items-center justify-center bg-white shadow-2xl shrink-0"
                style={{ width: INVOICE_BASE_WIDTH * previewScale, height: INVOICE_BASE_HEIGHT * previewScale }}
              >
                <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
              </div>
            ) : (
              <div
                className="shadow-2xl print:shadow-none overflow-hidden shrink-0"
                style={{ width: INVOICE_BASE_WIDTH * previewScale, height: INVOICE_BASE_HEIGHT * previewScale }}
              >
                <div style={{ width: INVOICE_BASE_WIDTH, height: INVOICE_BASE_HEIGHT, transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                  <TemplateComponent
                    data={templateData}
                    logoUrl={logoUrl}
                    invoiceTitle={invoiceSettings.invoiceTitle}
                    invoiceSubtitle={invoiceSettings.invoiceSubtitle}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Klon tersembunyi beresolusi penuh — target html2canvas untuk PDF/print,
            dipisah dari elemen preview supaya transform skala di atas tidak ikut
            terekam saat rasterisasi. */}
        {!isPreviewLoading && (
          <div style={{ position: 'fixed', top: 0, left: '-9999px', pointerEvents: 'none' }} aria-hidden="true">
            <TemplateComponent
              ref={componentRef}
              data={templateData}
              logoUrl={logoUrl}
              invoiceTitle={invoiceSettings.invoiceTitle}
              invoiceSubtitle={invoiceSettings.invoiceSubtitle}
            />
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
};

export default InvoiceModal;
