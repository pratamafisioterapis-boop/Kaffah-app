import { supabase } from '@/lib/customSupabaseClient';

export const EMPTY_VITALS = {
  systolic: '', diastolic: '', pulse: '', spo2: '',
  respiration: '', temperature: '', weight: '', height: '', notes: '',
};

const NUMERIC_KEYS = ['systolic', 'diastolic', 'pulse', 'spo2', 'respiration', 'temperature', 'weight', 'height'];

const toNum = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export const hasAnyVital = (v) =>
  !!v && (NUMERIC_KEYS.some((k) => toNum(v[k]) !== null) || !!(v.notes || '').trim());

export const vitalsFromRow = (row) => {
  if (!row) return { ...EMPTY_VITALS };
  const out = { ...EMPTY_VITALS };
  NUMERIC_KEYS.forEach((k) => { out[k] = row[k] === null || row[k] === undefined ? '' : String(row[k]); });
  out.notes = row.notes || '';
  return out;
};

export async function fetchRecapVitals(recapId) {
  if (!recapId) return null;
  const { data } = await supabase.from('recap_vital_signs').select('*').eq('recap_id', recapId).maybeSingle();
  return data || null;
}

// Simpan (upsert) tanda vital recap. Semua kolom kosong = hapus barisnya.
export async function saveRecapVitals(recapId, patientId, vitals, user) {
  if (!recapId) return { error: null };
  if (!hasAnyVital(vitals)) {
    const { error } = await supabase.from('recap_vital_signs').delete().eq('recap_id', recapId);
    return { error };
  }
  const row = { recap_id: recapId, patient_id: patientId || null, notes: (vitals.notes || '').trim() || null, updated_at: new Date().toISOString() };
  NUMERIC_KEYS.forEach((k) => { row[k] = toNum(vitals[k]); });
  if (user?.id) { row.recorded_by = user.id; row.recorded_by_name = user.name || user.email || null; }
  const { error } = await supabase.from('recap_vital_signs').upsert(row, { onConflict: 'recap_id' });
  return { error };
}

// Ringkasan satu baris, mis. "TD 120/80 mmHg | Nadi 80 x/mnt | SpO2 98%"
export function formatVitalsLine(v) {
  if (!v) return '';
  const parts = [];
  if (toNum(v.systolic) !== null && toNum(v.diastolic) !== null) parts.push(`TD ${toNum(v.systolic)}/${toNum(v.diastolic)} mmHg`);
  if (toNum(v.pulse) !== null) parts.push(`Nadi ${toNum(v.pulse)} x/mnt`);
  if (toNum(v.respiration) !== null) parts.push(`RR ${toNum(v.respiration)} x/mnt`);
  if (toNum(v.spo2) !== null) parts.push(`SpO2 ${toNum(v.spo2)}%`);
  if (toNum(v.temperature) !== null) parts.push(`Suhu ${toNum(v.temperature)} °C`);
  if (toNum(v.weight) !== null) parts.push(`BB ${toNum(v.weight)} kg`);
  if (toNum(v.height) !== null) parts.push(`TB ${toNum(v.height)} cm`);
  return parts.join(' | ');
}
