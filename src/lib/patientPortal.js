import { supabase } from '@/lib/customSupabaseClient';

// Portal pasien Clinara. Sisi staf memakai sesi login biasa; sisi pasien tidak
// login dan memanggil fungsi portal_* dengan token sesi dari portal_verify.
// Skema dan RPC: supabase/manual/9_portal_pasien_clinara.sql

// ---- Tautan (staf) -------------------------------------------------------

export const portalBaseUrl = () => {
  const { hostname, origin } = window.location;
  const dev = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.vercel.app');
  return dev ? origin : 'https://clinara.id';
};

export const buildPortalUrl = (token) => `${portalBaseUrl()}/p/${token}`;

// Normalisasi nomor ke format wa.me (62...). Kosong jika tidak ada angka.
export const toWhatsAppNumber = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
};

export const buildWhatsAppLink = ({ phone, patientName, clinicName, url }) => {
  const text =
    `Halo ${patientName}, ini tautan ${clinicName || 'klinik kami'} untuk melihat perkembangan terapi Anda: ${url}\n` +
    'Masukkan tanggal lahir Anda untuk masuk.';
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
  program: (session) => call('portal_get_program', { p_session: session }),
  logExercise: (session, programId, done) =>
    call('portal_log_exercise', { p_session: session, p_program_id: programId, p_done: done }),
  submitFeedback: (session, vas, tags, message) =>
    call('portal_submit_feedback', { p_session: session, p_vas: vas, p_tags: tags, p_message: message }),
  listFeedback: (session) => call('portal_list_feedback', { p_session: session }),
  listMessages: (session) => call('portal_list_messages', { p_session: session }),
  sendMessage: (session, body) => call('portal_send_message', { p_session: session, p_body: body }),
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
