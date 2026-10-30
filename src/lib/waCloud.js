import { supabase } from '@/lib/customSupabaseClient';
import { getCachedClinicId } from '@/lib/api';

// Semua aksi WhatsApp Cloud API lewat Edge Function `wa-cloud`. Token Meta
// tidak pernah sampai ke browser; fungsi ini hanya membawa JWT user.
const invoke = async (fn, body) => {
  const { data, error } = await supabase.functions.invoke(fn, { body });

  // functions.invoke melempar FunctionsHttpError untuk status non-2xx dan
  // menyembunyikan pesan aslinya di error.context; ambil supaya pengguna
  // melihat alasan sebenarnya (mis. "di luar jendela 24 jam").
  if (error) {
    let message = error.message;
    try {
      const body = await error.context?.json?.();
      if (body?.error) message = body.error;
    } catch (_) { /* pakai pesan bawaan */ }
    throw new Error(message);
  }
  if (!data?.success) throw new Error(data?.error || 'Permintaan gagal');
  return data.data;
};

const call = (action, params = {}) => invoke('wa-cloud', { action, ...params });

export const waSaveAccount = (p) => call('account_save', p);
export const waAccountStatus = () => call('account_status');
export const waToggleAccount = (enabled) => call('account_toggle', { enabled });

export const waSendText = (to, body, extra = {}) => call('send_text', { to, body, ...extra });
export const waSendTemplate = (to, template, params = [], extra = {}) =>
  call('send_template', { to, template, params, language: 'id', ...extra });
export const waMarkRead = (conversationId) => call('mark_read', { conversation_id: conversationId });

export const waSyncTemplates = () => call('templates_sync');
export const waCreateTemplate = (p) => call('template_create', p);
export const waDeleteTemplate = (name) => call('template_delete', { name });

export const waCreateBroadcast = (p) => call('broadcast_create', p);
export const waProcessBroadcast = (broadcastId, limit = 30) =>
  call('broadcast_process', { broadcast_id: broadcastId, limit });
export const waCancelBroadcast = (broadcastId) => call('broadcast_cancel', { broadcast_id: broadcastId });

export const getWaCloudAccount = async () => {
  const { data, error } = await supabase
    .from('wa_meta_accounts')
    .select('waba_id, phone_number_id, display_phone, verified_name, quality_rating, name_status, enabled, last_checked_at')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
};

// true bila klinik ini sudah menyambungkan Cloud API dan aktif.
// Cloud API dimatikan secara default: Watzap adalah jalur satu-satunya sampai
// migrasi wa_cloud_api diterapkan dan VITE_WA_CLOUD_ENABLED=true diset.
export const WA_CLOUD_ENABLED = import.meta.env.VITE_WA_CLOUD_ENABLED === 'true';

export const isWaCloudActive = async () => {
  if (!WA_CLOUD_ENABLED) return false;
  try {
    const acc = await getWaCloudAccount();
    return !!acc?.enabled;
  } catch (_) {
    return false;
  }
};

// ───────────── Inbox: Watzap atau Cloud API langsung ─────────────
// Provider inbox per klinik: 'watzap' bila wa_settings.inbox_enabled, 'cloud'
// bila Cloud API Meta terhubung (dan flag build aktif), selain itu null.
export const getWaInboxProvider = async () => {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess?.session?.user?.id;
    if (!userId) return null;
    const clinicId = await getCachedClinicId(userId);
    if (!clinicId) return null;
    const { data } = await supabase
      .from('wa_settings')
      .select('inbox_enabled')
      .eq('clinic_id', clinicId)
      .maybeSingle();
    if (data?.inbox_enabled) return 'watzap';
    if (WA_CLOUD_ENABLED && (await getWaCloudAccount())) return 'cloud';
  } catch (_) { /* tanpa inbox */ }
  return null;
};

export const sendInboxText = (provider, to, body) =>
  provider === 'watzap'
    ? invoke('wa-watzap-send', { to, body })
    : waSendText(to, body);

export const markInboxRead = async (provider, conversationId) => {
  if (provider === 'watzap') {
    // Hanya mereset penghitung lokal; tidak ada "centang biru" lewat Watzap.
    await supabase.from('wa_inbox_conversations').update({ unread_count: 0 }).eq('id', conversationId);
    return;
  }
  await waMarkRead(conversationId);
};
