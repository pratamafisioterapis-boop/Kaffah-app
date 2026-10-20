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

export const vitalsToRow = (v) => {
  const row = {};
  NUMERIC_KEYS.forEach((k) => { row[k] = toNum(v[k]); });
  row.notes = (v.notes || '').trim() || null;
  return row;
};

// Batas nilai sama dengan CHECK constraint di tabel recap_vital_signs; int = kolom bilangan bulat.
const VITAL_LIMITS = {
  systolic: { label: 'Sistolik', unit: 'mmHg', min: 30, max: 300, int: true },
  diastolic: { label: 'Diastolik', unit: 'mmHg', min: 20, max: 200, int: true },
  pulse: { label: 'Nadi', unit: 'x/mnt', min: 20, max: 250, int: true },
  respiration: { label: 'RR (pernapasan)', unit: 'x/mnt', min: 4, max: 80, int: true },
  spo2: { label: 'SpO2', unit: '%', min: 50, max: 100 },
  temperature: { label: 'Suhu', unit: '°C', min: 30, max: 45 },
  weight: { label: 'Berat badan', unit: 'kg', min: 1, max: 500 },
  height: { label: 'Tinggi badan', unit: 'cm', min: 30, max: 260 },
};

// Pesan kesalahan untuk nilai di luar batas / bukan bilangan bulat, atau null bila semua wajar.
function validateVitalRanges(v) {
  for (const [key, lim] of Object.entries(VITAL_LIMITS)) {
    const raw = v[key];
    if (raw === '' || raw === null || raw === undefined) continue;
    const n = toNum(raw);
    if (n === null) return `${lim.label} harus berupa angka.`;
    if (lim.int && !Number.isInteger(n)) return `${lim.label} harus berupa bilangan bulat (tanpa koma).`;
    if (n < lim.min || n > lim.max) return `${lim.label} ${raw} di luar batas wajar. Isi antara ${lim.min} dan ${lim.max} ${lim.unit}.`;
  }
  return null;
}

// Mengembalikan pesan kesalahan, atau null bila isian valid.
export function validateVitals(v) {
  // Wajib: tekanan darah (sistolik + diastolik), nadi, dan SpO2. Sisanya opsional.
  const missing = [];
  if (toNum(v?.systolic) === null || toNum(v?.diastolic) === null) missing.push('tekanan darah (sistolik dan diastolik)');
  if (toNum(v?.pulse) === null) missing.push('nadi');
  if (toNum(v?.spo2) === null) missing.push('SpO2');
  if (missing.length) return `Wajib diisi: ${missing.join(', ')}.`;
  const rangeErr = validateVitalRanges(v);
  if (rangeErr) return rangeErr;
  if (toNum(v.systolic) <= toNum(v.diastolic)) return 'Sistolik harus lebih besar dari diastolik.';
  return null;
}

// TTV sekali diisi terkunci: hanya INSERT (RLS menolak UPDATE/DELETE langsung).
// Perubahan lewat pengajuan override 'vitals_edit' yang disetujui owner.
export async function insertRecapVitals(recapId, patientId, vitals, user) {
  const row = { recap_id: recapId, patient_id: patientId || null, ...vitalsToRow(vitals) };
  if (user?.id) { row.recorded_by = user.id; row.recorded_by_name = user.name || user.email || null; }
  const { error } = await supabase.from('recap_vital_signs').insert(row);
  return { error };
}

export async function fetchPendingVitalsEdit(recapId) {
  if (!recapId) return null;
  const { data } = await supabase
    .from('soap_overrides')
    .select('id, reason, requested_by_name, requested_at')
    .eq('recap_id', recapId).eq('kind', 'vitals_edit').eq('status', 'pending')
    .maybeSingle();
  return data || null;
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
