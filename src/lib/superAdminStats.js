import { supabase } from '@/lib/customSupabaseClient';

// Satu panggilan RPC untuk total + jumlah pasien per klinik.
// Fallback ke count per klinik (paralel) bila RPC belum tersedia di database.
export async function fetchSuperAdminStats(clinicIds = []) {
  const { data, error } = await supabase.rpc('super_admin_clinic_stats');
  if (!error && data) {
    return {
      users: data.users || 0,
      patients: data.patients || 0,
      therapists: data.therapists || 0,
      patientCounts: data.patient_counts || {},
    };
  }
  const head = (table) => supabase.from(table).select('id', { count: 'exact', head: true });
  const [u, p, t, per] = await Promise.all([
    head('users'), head('patients'), head('physiotherapists'),
    Promise.all(clinicIds.map(async (id) => {
      const { count } = await head('patients').eq('clinic_id', id);
      return [id, count || 0];
    })),
  ]);
  return { users: u.count || 0, patients: p.count || 0, therapists: t.count || 0, patientCounts: Object.fromEntries(per) };
}
