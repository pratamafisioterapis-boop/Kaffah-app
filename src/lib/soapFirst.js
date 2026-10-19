// SOAP-first (khusus klinik yang mengaktifkannya, saat ini Kaffah): SOAP wajib selesai
// sebelum pembayaran. Semua aturan ditegakkan di database (trigger); file ini hanya
// membantu tampilan dan perhitungan insentif.
import { supabase } from '@/lib/customSupabaseClient';

export const OVERRIDE_KIND_LABELS = {
  payment_unlock: 'Buka kunci pembayaran',
  incentive_restore: 'Pulihkan insentif terapis',
  homecare_discount: 'Diskon homecare',
  xtratime: 'Tandai Xtratime',
  package_extend: 'Perpanjang masa aktif paket',
  amount_adjust: 'Ubah nominal',
  manual_discount: 'Diskon manual (perlu persetujuan)',
  vitals_edit: 'Ubah tanda vital (TTV)',
  recovery_outside_package: 'Recovery di luar paket',
};

export const OVERRIDE_STATUS_LABELS = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
};

export const INCENTIVE_REASON_LABELS = {
  soap_terlambat: 'SOAP terlambat',
  soap_tidak_diisi: 'SOAP tidak diisi',
  ditandai_owner: 'Ditandai owner (SOAP tidak memenuhi ketentuan)',
};

// Label netral untuk terapis: tidak membuka aturan waktunya.
export const NEUTRAL_ZERO_LABEL = 'Tidak memenuhi ketentuan SOAP';

export const todayWita = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];

export const isSoapFirstActiveOn = (settings, isoDate) => (
  !!settings && !!settings.enabled && !!isoDate && String(isoDate).slice(0, 10) >= settings.start_date
);

export const fetchSoapFirstSettings = async () => {
  const { data, error } = await supabase.from('soap_first_settings').select('*').maybeSingle();
  if (error) return null;
  return data || null;
};

export const fetchRecapQuote = async (recapId, packageLabel = null) => {
  const { data, error } = await supabase.rpc('soap_first_quote', {
    p_recap_id: recapId,
    p_package_label: packageLabel || null,
  });
  if (error) throw error;
  return data || { active: false };
};

export const requestOverride = async ({ kind, recapId = null, packageId = null, reason, payload = {} }) => {
  const { data, error } = await supabase.rpc('soap_first_request_override', {
    p_kind: kind,
    p_recap_id: recapId,
    p_reason: reason,
    p_payload: payload,
    p_package_id: packageId,
  });
  if (error) throw error;
  return data;
};

// Khusus Kaffah: sesi lanjutan paket diambil sebagai Recovery (DOMS) tanpa memotong kuota paket,
// atau dikembalikan ke paket. Aturan ditegakkan RPC; setelah invoice terbit harus lewat override owner.
export const setRecoveryOutsidePackage = async ({ recapId, outside, reason = null }) => {
  const { error } = await supabase.rpc('set_recovery_outside_package', {
    p_recap_id: recapId,
    p_outside: outside,
    p_reason: reason,
  });
  if (error) throw error;
};

export const decideOverride = async (id, approve, note = null) => {
  const { error } = await supabase.rpc('soap_first_decide_override', {
    p_id: id,
    p_approve: approve,
    p_note: note,
  });
  if (error) throw error;
};

export const flagRecapIncentive = async (recapId, zero, reason = null) => {
  const { error } = await supabase.rpc('soap_first_owner_flag', {
    p_recap_id: recapId,
    p_zero: zero,
    p_reason: reason,
  });
  if (error) throw error;
};

export const reviseLockedSoap = async ({ recordId, subjective, objective, assessment, plan, reason }) => {
  const { error } = await supabase.rpc('soap_first_revise_soap', {
    p_record_id: recordId,
    p_subjective: subjective,
    p_objective: objective,
    p_assessment: assessment,
    p_plan: plan,
    p_reason: reason,
  });
  if (error) throw error;
};

/**
 * Menandai recap yang insentifnya nol karena SOAP terlambat / tidak diisi.
 * Hasil: salinan array dengan `_incentiveZeroed` + `_incentiveReason` pada recap terkait.
 * Klinik tanpa fitur ini tidak terpengaruh (server mengembalikan zeroed=false).
 * strict=true: kegagalan membaca status melempar error (supaya gaji tidak terhitung terlalu besar).
 */
export const markIncentiveFlags = async (recaps, { strict = true } = {}) => {
  const list = Array.isArray(recaps) ? recaps : [];
  const ids = list.map((r) => r?.id).filter(Boolean);
  if (ids.length === 0) return list;
  const flags = new Map();
  try {
    for (let i = 0; i < ids.length; i += 150) {
      const { data, error } = await supabase.rpc('get_recap_incentive_flags', { p_recap_ids: ids.slice(i, i + 150) });
      if (error) throw error;
      (data || []).forEach((f) => flags.set(f.recap_id, f));
    }
  } catch (err) {
    if (strict) throw new Error(`Gagal membaca status insentif SOAP: ${err.message || err}`);
    console.error('Gagal membaca status insentif SOAP', err);
    return list;
  }
  return list.map((r) => {
    const f = flags.get(r.id);
    return f?.zeroed ? { ...r, _incentiveZeroed: true, _incentiveReason: f.reason } : r;
  });
};
