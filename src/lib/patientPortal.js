import { supabase } from '@/lib/customSupabaseClient';
import { APP_DOMAIN, PUBLIC_DOMAIN } from '@/lib/domainRouting';

// Portal pasien Clinara. Sisi staf memakai sesi login biasa; sisi pasien tidak
// login dan memanggil fungsi portal_* dengan token sesi dari portal_verify.
// Skema dan RPC: supabase/manual/9_portal_pasien_clinara.sql

// ---- Tautan (staf) -------------------------------------------------------

// Tautan pasien dibuat di domain klinik sendiri (bukan clinara.id): pasien yang membuka tautan di HP
// yang punya aplikasi Clinara terpasang akan melihat splash Clinara. Urutan: custom domain terverifikasi,
// subdomain klinik (xxx.clinara.id), lalu domain publik utama (Kaffah). Di dev/preview memakai origin.
export const portalBaseUrl = (clinic) => {
  const { hostname, origin } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.vercel.app')) return origin;
  if (clinic?.custom_domain && clinic.custom_domain_status === 'verified') return `https://${clinic.custom_domain}`;
  if (clinic?.subdomain) return `https://${clinic.subdomain}.${APP_DOMAIN}`;
  return `https://${PUBLIC_DOMAIN}`;
};

export const buildPortalUrl = (token, clinic) => `${portalBaseUrl(clinic)}/p/${token}`;

// Normalisasi nomor ke format wa.me (62...). Kosong jika tidak ada angka.
export const toWhatsAppNumber = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
};

// Salam menurut jam kirim di zona waktu perangkat tempat akun login (WIB/WITA/WIT mengikuti lokasi admin).
export const greetingByHour = (date = new Date()) => {
  const hour = date.getHours();
  if (hour >= 4 && hour < 11) return 'pagi';
  if (hour >= 11 && hour < 15) return 'siang';
  if (hour >= 15 && hour < 18) return 'sore';
  return 'malam';
};

// Data lama memuat 'male'/'female' selain 'Laki-laki'/'Perempuan'. Gender kosong: pakai "Bapak/Ibu" daripada menebak.
const honorific = (gender) => {
  const g = String(gender || '').trim().toLowerCase();
  if (g === 'perempuan' || g === 'female') return 'Ibu';
  if (g === 'laki-laki' || g === 'male') return 'Bapak';
  return 'Bapak/Ibu';
};

// Pakai nama panggilan; jika kosong di database, pakai nama lengkap.
export const patientDisplayName = (patient) =>
  String(patient?.nickname || '').trim() || String(patient?.full_name || '').trim();

export const buildWhatsAppMessage = ({ patientName, gender, clinicName, url, now }) => {
  const clinic = clinicName || 'klinik kami';
  const title = honorific(gender);
  return (
    `Selamat ${greetingByHour(now)}, ${title} ${patientName} 🙏\n\n` +
    `Terima kasih telah mempercayakan proses pemulihan Anda kepada *${clinic}*.\n\n` +
    'Kami berkomitmen memberikan pelayanan terbaik, tidak hanya selama sesi terapi berlangsung, tetapi juga setelahnya. ' +
    `Karena itu, kami menyediakan halaman khusus agar ${title} dapat memantau perkembangan terapi secara mudah dan aman. ` +
    `Di halaman ini ${title} juga bisa melihat *home program*, yaitu latihan yang dianjurkan untuk dilakukan secara mandiri di rumah agar pemulihan lebih optimal:\n\n` +
    `🔗 ${url}\n\n` +
    `*Cara mengakses:* buka tautan di atas, lalu masukkan tanggal lahir ${title} (format: DD-MM-YYYY) untuk masuk.\n\n` +
    'Jika ada pertanyaan atau keluhan setelah sesi, jangan ragu menghubungi kami. ' +
    `Semoga ${title} lekas pulih dan sehat selalu.\n\n` +
    `Hormat kami,\n*${clinic}*`
  );
};

export const buildWhatsAppLink = ({ phone, patientName, gender, clinicName, url, now }) => {
  const text = buildWhatsAppMessage({ patientName, gender, clinicName, url, now });
  return `https://wa.me/${toWhatsAppNumber(phone)}?text=${encodeURIComponent(text)}`;
};

export const getLiveLink = async (patientId) => {
  const { data, error } = await supabase
    .from('patient_portal_links')
    .select('id, status, failed_attempts, last_opened_at, sent_at, sent_via, created_at')
    .eq('patient_id', patientId)
    .neq('status', 'revoked')
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const createLink = async (patientId) => {
  const { data, error } = await supabase.rpc('portal_create_link', { p_patient_id: patientId });
  if (error) throw error;
  return data; // { link_id, token, patient_name, phone, expires_at }
};

export const setLinkStatus = async (linkId, status) => {
  const { error } = await supabase.rpc('portal_set_link_status', { p_link_id: linkId, p_status: status });
  if (error) throw error;
};

export const markLinkSent = async (linkId, via = 'whatsapp') => {
  const { error } = await supabase.rpc('portal_mark_link_sent', { p_link_id: linkId, p_via: via });
  if (error) throw error;
};

// ---- Pasien (tanpa login) ------------------------------------------------

const sessionKey = (token) => `clinara-portal:${token}`;

export const loadSession = (token) => {
  try { return window.localStorage.getItem(sessionKey(token)); } catch { return null; }
};
export const saveSession = (token, session) => {
  try { window.localStorage.setItem(sessionKey(token), session); } catch { /* mode privat: sesi tidak tersimpan */ }
};
export const clearSession = (token) => {
  try { window.localStorage.removeItem(sessionKey(token)); } catch { /* abaikan */ }
};

const call = async (fn, args) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    const err = new Error(error.message);
    // 28000 = sesi tidak valid (dinonaktifkan admin atau tautan diganti)
    err.sessionInvalid = error.code === '28000';
    throw err;
  }
  return data;
};

export const portalApi = {
  branding: (token) => call('portal_get_branding', { p_token: token }),
  verify: (token, birthDate) => call('portal_verify', { p_token: token, p_birth_date: birthDate }),
  logout: (session) => call('portal_logout', { p_session: session }),
  home: (session) => call('portal_get_home', { p_session: session }),
  progress: (session) => call('portal_get_progress', { p_session: session }),
  goals: (session) => call('portal_get_goals', { p_session: session }),
  program: (session) => call('portal_get_program', { p_session: session }),
  logExercise: (session, exerciseId, done) =>
    call('portal_log_exercise', { p_session: session, p_exercise_id: exerciseId, p_done: done }),
  // Tautan putar bertanda tangan dari Edge Function (cek sesi, fitur klinik, dan program pasien di server).
  videoUrl: async (session, exerciseId) => {
    const { data, error } = await supabase.functions.invoke('portal-exercise-video', {
      body: { session, exercise_id: exerciseId },
    });
    if (error || !data?.url) throw new Error('Video belum bisa diputar. Coba lagi nanti.');
    return data.url;
  },
  submitFeedback: (session, vas, tags, message) =>
    call('portal_submit_feedback', { p_session: session, p_vas: vas, p_tags: tags, p_message: message }),
  listFeedback: (session) => call('portal_list_feedback', { p_session: session }),
  listMessages: (session) => call('portal_list_messages', { p_session: session }),
  sendMessage: (session, body) => call('portal_send_message', { p_session: session, p_body: body }),
  // Booking jadwal: terapis terakhir lebih dulu, slot kosong 14 hari, lalu pesan slot.
  bookingOptions: (session) => call('portal_get_booking_options', { p_session: session }),
  bookingSlots: (session, days = 14) => call('portal_get_booking_slots', { p_session: session, p_days: days }),
  book: async (session, therapistId, date, time, note) => {
    const res = await call('portal_book_appointment', {
      p_session: session, p_therapist_id: therapistId, p_date: date, p_time: time, p_note: note || null,
    });
    // Notifikasi WhatsApp ke klinik, sama seperti booking online lainnya. Gagal kirim tidak membatalkan booking.
    supabase.functions
      .invoke('process-booking-whatsapp-now', { body: { appointment_id: res.appointment_id, is_homecare: false, disable_whatsapp: false } })
      .catch(() => {});
    return res;
  },
};

// Satu warna brand (#rrggbb) -> hue 0..360 untuk seluruh palet portal.
export const hexToHue = (hex, fallback = 200) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return fallback;
  const x = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round((x * 60 + 360) % 360);
};
