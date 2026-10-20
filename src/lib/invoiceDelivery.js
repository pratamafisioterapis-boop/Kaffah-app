// Pelacakan pengiriman invoice WhatsApp (klinik dengan invoice_gate_enabled, saat ini Kaffah).
// Respons "sukses" Watzap hanya berarti permintaan diterima; status akhir (failed/sent/delivered/read)
// diambil dari Watzap lewat RPC database. Lihat migrasi 20261021100000_invoice_delivery_tracking.sql.
import { supabase } from '@/lib/customSupabaseClient';

// Status yang berarti invoice SUDAH terbukti/dikonfirmasi sampai ke pasien.
export const INVOICE_PROVEN_STATUSES = ['delivered', 'read', 'dibuka', 'terkirim_manual'];
// 'terkirim' = data lama sebelum pelacakan (hanya "diterima API", belum terverifikasi).
const LEGACY_SENT = 'terkirim';
// Selesai bagi admin: tidak perlu tindakan lagi (menunggu bukti diurus penjadwal + pengingat).
const INVOICE_RESOLVED = [...INVOICE_PROVEN_STATUSES, LEGACY_SENT, 'menunggu', 'tidak_dikirim'];

export const isInvoiceResolved = (status) => INVOICE_RESOLVED.includes(status);

export const STALE_WAITING_MINUTES = 15;

export const isGateActive = (settings) => !!(settings?.invoice_gate_enabled && settings?.invoice_gate_from);

// Pembayaran sudah disimpan dan invoice perlu dikirim ke pasien.
export const invoiceNeedsSending = (recap, settings) => {
  if (!recap || !isGateActive(settings)) return false;
  if (!recap.invoice_created_at || new Date(recap.invoice_created_at) < new Date(settings.invoice_gate_from)) return false;
  if (!(parseFloat(recap.amount) > 0)) return false;
  if (!recap.payment_method || recap.payment_method === 'Package') return false;
  if (recap.special_type === 'free') return false;
  return true;
};

export const minutesSince = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / 60000 : null);

// Menunggu terlalu lama tanpa bukti sampai -> perlu dicek / dikirim manual.
export const isStaleWaiting = (recap) =>
  recap?.invoice_wa_status === 'menunggu' && (minutesSince(recap.invoice_wa_sent_at) ?? 0) >= STALE_WAITING_MINUTES;

// Perlu tindakan admin: belum dikirim, gagal, WA manual belum dikonfirmasi, atau menunggu bukti terlalu lama.
export const invoiceNeedsAction = (recap, settings) => {
  if (!invoiceNeedsSending(recap, settings)) return false;
  const st = recap.invoice_wa_status;
  if (st === 'menunggu') return isStaleWaiting(recap);
  return !INVOICE_RESOLVED.includes(st);
};

// Tampilan badge/status: { key, label, color: 'green'|'amber'|'orange'|'red'|'slate', hint }
export const invoiceStatusView = (recap) => {
  const st = recap?.invoice_wa_status || null;
  const detail = recap?.invoice_wa_detail || recap?.invoice_skip_reason || '';
  switch (st) {
    case 'read': return { key: st, label: 'Sudah dibaca pasien', color: 'green', hint: 'Pasien sudah membaca pesan invoice.' };
    case 'delivered': return { key: st, label: 'Sampai di WhatsApp pasien', color: 'green', hint: 'Pesan sudah sampai di HP pasien (delivered).' };
    case 'dibuka': return { key: st, label: 'Link dibuka pasien', color: 'green', hint: 'Pasien sudah membuka link invoice.' };
    case 'terkirim_manual': return { key: st, label: 'Dikirim manual', color: 'green', hint: 'Dikirim lewat WhatsApp manual dan dikonfirmasi admin.' };
    case LEGACY_SENT: return { key: st, label: 'Terkirim', color: 'green', hint: 'Terkirim. Status berdasarkan respons API (data lama), bukan konfirmasi pasien menerima.' };
    case 'mengirim': return { key: st, label: 'Mengirim...', color: 'amber', hint: 'Sedang dikirim ke Watzap.' };
    case 'menunggu':
      return isStaleWaiting(recap)
        ? { key: 'menunggu_lama', label: 'Perlu dicek', color: 'orange', hint: 'Diterima WhatsApp tetapi belum ada bukti sampai ke pasien lebih dari 15 menit. Cek atau kirim manual.' }
        : { key: st, label: 'Menunggu bukti sampai', color: 'amber', hint: 'Diterima WhatsApp, menunggu sampai di HP pasien.' };
    case 'manual_menunggu': return { key: st, label: 'Menunggu konfirmasi', color: 'amber', hint: 'WhatsApp manual sudah dibuka. Konfirmasi setelah benar-benar dikirim.' };
    case 'gagal': return { key: st, label: 'Gagal dikirim', color: 'red', hint: detail || 'Invoice gagal dikirim.' };
    case 'tidak_dikirim': return { key: st, label: 'Tidak dikirim', color: 'slate', hint: detail ? `Tidak dikirim: ${detail}` : 'Tidak dikirim.' };
    default: return { key: 'belum', label: 'Belum dikirim', color: 'amber', hint: 'Invoice belum pernah dikirim ke WhatsApp pasien.' };
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Meminta status terbaru pesan ke Watzap lalu membacanya (dua langkah karena pg_net mengirim setelah
// transaksi selesai). Mengembalikan { status, detail } atau null bila belum terbaca.
export async function checkInvoiceDelivery(recapId, { waitMs = 2500, tries = 5 } = {}) {
  const { data: req, error } = await supabase.rpc('invoice_wa_start_check', { p_recap_id: recapId });
  if (error) throw new Error(error.message);
  if (req == null) return null;
  for (let i = 0; i < tries; i += 1) {
    await sleep(i === 0 ? waitMs : 1500);
    const { data, error: e } = await supabase.rpc('invoice_wa_finish_check', { p_recap_id: recapId });
    if (e) throw new Error(e.message);
    if (data?.done) return data.unknown ? null : { status: data.status, detail: data.detail };
  }
  return null;
}

// Kirim otomatis lewat Watzap sebagai pesan teks berisi link invoice (hanya pesan teks/template yang tercatat di log
// Watzap sehingga status akhirnya bisa dicek), lalu periksa hasilnya: kegagalan Meta (mis. di luar 24 jam) muncul
// dalam beberapa detik. onStep('send' | 'check') untuk indikator proses.
export async function sendInvoiceAuto({ recapId, phone, message, onStep }) {
  onStep?.('send');
  const { error } = await supabase.rpc('invoice_wa_send', { p_recap_id: recapId, p_phone: phone, p_message: message });
  if (error) throw new Error(error.message);

  let sent = null;
  for (let i = 0; i < 8; i += 1) {
    await sleep(1500);
    const { data, error: e } = await supabase.rpc('invoice_wa_finish_send', { p_recap_id: recapId });
    if (e) throw new Error(e.message);
    if (data?.done) { sent = data; break; }
  }
  if (!sent) return { status: 'mengirim', detail: 'Respons Watzap belum diterima. Status akan diperbarui otomatis.' };
  if (sent.status === 'gagal') return { status: 'gagal', detail: sent.detail };

  onStep?.('check');
  await sleep(1500);
  let result = null;
  for (let k = 0; k < 2; k += 1) {
    result = await checkInvoiceDelivery(recapId);
    if (result && result.status !== 'menunggu') break;
    if (k === 0) await sleep(2500);
  }
  return result || { status: 'menunggu', detail: null };
}

// Konfirmasi manual: 'manual_menunggu' | 'terkirim_manual' | 'tidak_dikirim' (alasan wajib).
export async function setInvoiceManual(recapId, state, note = null) {
  const { error } = await supabase.rpc('invoice_wa_set_manual', { p_recap_id: recapId, p_state: state, p_note: note });
  if (error) throw new Error(error.message);
}

export const normalizePhoneForWa = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
};

export const invoicePublicLink = (recapId) => `${window.location.origin}/i/${recapId}`;

export const buildInvoiceMessage = (clinicName, recapId) =>
  `Berikut *Kwitansi Terapi* hari ini.\n\n` +
  `Terima kasih telah mempercayakan pemulihan di *${clinicName || ''}*.\n` +
  `Semoga lekas membaik dan sehat selalu.\n\n` +
  `Lihat/unduh kwitansi:\n${invoicePublicLink(recapId)}\n\n` +
  `*Salam Sehat,*\n` +
  `${clinicName || ''}`;

export const buildWaMeLink = (phone, message) => `https://wa.me/${normalizePhoneForWa(phone)}?text=${encodeURIComponent(message)}`;
