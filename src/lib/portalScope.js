import { supabase } from '@/lib/customSupabaseClient';

// Pasien yang pernah ditangani terapis ini (dari rekap harian). Chat dan keluhan dari aplikasi pasien
// hanya ditampilkan ke terapis untuk pasien-pasien ini; owner/admin melihat seluruh klinik.
export const fetchTherapistPatientIds = async (therapistId) => {
  const ids = new Set();
  const PAGE = 1000;
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await supabase.from('daily_recaps').select('patient_id')
      .eq('therapist_id', therapistId).not('patient_id', 'is', null).range(from, from + PAGE - 1);
    if (error) return null;
    (data || []).forEach((r) => ids.add(r.patient_id));
    if (!data || data.length < PAGE) break;
  }
  return ids;
};
