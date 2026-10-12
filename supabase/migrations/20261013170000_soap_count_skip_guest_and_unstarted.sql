-- Hitungan SOAP belum diisi (kartu dashboard owner):
--  1. Kunjungan guest (patient_id & actual_patient_id kosong) tidak dihitung: tidak bisa diisi SOAP.
--  2. SOAP mulai terhitung tepat di jam appointment (appointments.appointment_date), tanpa grace.
--     Recap tanpa appointment fallback ke recap_date (perilaku lama).
-- Hanya CREATE OR REPLACE, tanpa DROP; signature tidak berubah. Fungsi lain tidak diubah.

CREATE OR REPLACE FUNCTION public.get_therapist_unfilled_soap_count_in_period(
  p_therapist_id uuid, p_period_start date, p_period_end date)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
  select count(*)::int
  from daily_recaps dr
  left join appointments a on a.id = dr.appointment_id
  where dr.therapist_id = p_therapist_id
    and (dr.patient_id is not null or dr.actual_patient_id is not null)
    and dr.recap_date >= p_period_start
    and dr.recap_date <= least(p_period_end, current_date)
    and coalesce(a.appointment_date, dr.recap_date::timestamptz) <= now()
    and not exists (
      select 1 from medical_records mr where mr.daily_recap_id = dr.id
    );
$fn$;
