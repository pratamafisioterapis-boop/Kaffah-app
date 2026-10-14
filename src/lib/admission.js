import { supabase } from '@/lib/customSupabaseClient';

// No Admission (nomor registrasi) dibuat otomatis di daily_recaps saat pasien
// terjadwal terapi. Recap yang dibatalkan/reschedule/tidak hadir tidak dihitung.
const INACTIVE_STATUSES = ['cancelled', 'rescheduled', 'no_show', 'rejected', 'dibatalkan'];

export const getPatientAdmissionNumber = async (patientId) => {
  if (!patientId) return null;
  // Disaring di sisi klien: status NULL tidak boleh ikut tersingkir.
  const { data } = await supabase
    .from('daily_recaps')
    .select('admission_number, status')
    .eq('patient_id', patientId)
    .not('admission_number', 'is', null)
    .order('recap_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20);
  const active = (data || []).find((r) => !INACTIVE_STATUSES.includes(r.status));
  return active?.admission_number || null;
};
