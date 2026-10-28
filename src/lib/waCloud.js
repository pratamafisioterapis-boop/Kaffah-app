import { supabase } from '@/lib/customSupabaseClient';

// Semua aksi WhatsApp Cloud API lewat Edge Function `wa-cloud`. Token Meta
// tidak pernah sampai ke browser; fungsi ini hanya membawa JWT user.
const call = async (action, params = {}) => {
  const { data, error } = await supabase.functions.invoke('wa-cloud', {
    body: { action, ...params },
  });

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
export const isWaCloudActive = async () => {
  try {
    const acc = await getWaCloudAccount();
    return !!acc?.enabled;
  } catch (_) {
    return false;
  }
};
