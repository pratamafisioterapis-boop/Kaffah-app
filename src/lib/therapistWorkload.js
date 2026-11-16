// Pemerataan pasien antar terapis (khusus Kaffah).
// Satu baris daily_recaps = satu sesi yang benar-benar terlaksana pada recap_date
// (recap batal/no-show otomatis dihapus oleh trigger), jadi pasien paket 8x
// dihitung 8 kunjungan, tetapi hanya sesi yang tanggalnya masuk periode.

// Terapis yang tidak ikut dihitung dalam pemerataan.
const EXCLUDED_NAME_PATTERNS = [/adi\s+pratama/i];

export const isExcludedTherapist = (name) =>
  EXCLUDED_NAME_PATTERNS.some((re) => re.test(name || ''));

export const WORKLOAD_THRESHOLDS = { warn: 0.15, alert: 0.3 };

const patientKey = (r) =>
  r.actual_patient_id || r.patient_id || (r.guest_name ? `guest:${r.guest_name.trim().toLowerCase()}` : null);

export const getStatus = (deviation) => {
  const abs = Math.abs(deviation);
  if (abs > WORKLOAD_THRESHOLDS.alert) return deviation < 0 ? 'low_alert' : 'high_alert';
  if (abs > WORKLOAD_THRESHOLDS.warn) return deviation < 0 ? 'low' : 'high';
  return 'ok';
};

export function computeWorkload(recaps, therapists) {
  const rows = new Map();
  const ensure = (id, name, active) => {
    if (!rows.has(id)) {
      rows.set(id, { id, name, active, visits: 0, clinic: 0, homecare: 0, patients: new Set() });
    }
    return rows.get(id);
  };

  (therapists || []).forEach((t) => {
    if (isExcludedTherapist(t.name) || t.is_active === false) return;
    ensure(t.id, t.name, true);
  });

  (recaps || []).forEach((r) => {
    if (!r.therapist_id) return;
    const t = (therapists || []).find((x) => x.id === r.therapist_id);
    if (t && isExcludedTherapist(t.name)) return;
    const row = ensure(r.therapist_id, t?.name || 'Terapis', t ? t.is_active !== false : false);
    row.visits += 1;
    if (r.is_homecare) row.homecare += 1; else row.clinic += 1;
    const key = patientKey(r);
    if (key) row.patients.add(key);
  });

  const list = [...rows.values()].map((r) => ({ ...r, uniquePatients: r.patients.size }));
  const total = list.reduce((s, r) => s + r.visits, 0);
  const avg = list.length ? total / list.length : 0;

  const withStats = list
    .map((r) => {
      const deviation = avg > 0 ? (r.visits - avg) / avg : 0;
      return { ...r, deviation, status: getStatus(deviation) };
    })
    .sort((a, b) => b.visits - a.visits);

  const sd = list.length
    ? Math.sqrt(list.reduce((s, r) => s + (r.visits - avg) ** 2, 0) / list.length)
    : 0;
  const fairness = avg > 0 ? Math.max(0, 1 - sd / avg) : 1;

  return {
    rows: withStats,
    total,
    avg,
    fairness,
    max: withStats[0] || null,
    min: withStats[withStats.length - 1] || null,
  };
}

// Ambil seluruh baris (Supabase membatasi 1000 baris per query).
export async function fetchRecapsForWorkload(supabase, clinicId, start, end) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    const { data, error } = await supabase
      .from('daily_recaps')
      .select('id, therapist_id, patient_id, actual_patient_id, guest_name, is_homecare, recap_date')
      .eq('clinic_id', clinicId)
      .gte('recap_date', start)
      .lte('recap_date', end)
      .order('recap_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
