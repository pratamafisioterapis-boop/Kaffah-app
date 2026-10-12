-- Hitungan SOAP belum diisi (dipakai kartu dashboard owner & aturan kunci SOAP):
--  1. Kunjungan guest (patient_id & actual_patient_id kosong) tidak dihitung: tidak bisa diisi SOAP.
--  2. Jam mulai diambil dari appointments.appointment_date, karena daily_recaps.start_time
--     kosong sehingga sebelumnya kunjungan dianggap lewat sejak tengah malam.
--     Tanpa appointment, fallback ke start_time lalu recap_date (perilaku lama).
-- Grace 60 menit tetap. Hanya CREATE OR REPLACE, tanpa DROP; signature tidak berubah.

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
    and coalesce(a.appointment_date, dr.start_time, dr.recap_date::timestamptz) + interval '60 minutes' <= now()
    and not exists (
      select 1 from medical_records mr where mr.daily_recap_id = dr.id
    );
$fn$;

CREATE OR REPLACE FUNCTION public.get_therapist_oldest_unfilled_soap_age_days(
  p_therapist_id uuid, p_period_start date, p_period_end date)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
  select floor(extract(epoch from (now() - min(coalesce(a.appointment_date, dr.start_time, dr.recap_date::timestamptz) + interval '60 minutes'))) / 86400)::int
  from daily_recaps dr
  left join appointments a on a.id = dr.appointment_id
  where dr.therapist_id = p_therapist_id
    and (dr.patient_id is not null or dr.actual_patient_id is not null)
    and dr.recap_date >= p_period_start
    and dr.recap_date <= least(p_period_end, current_date)
    and coalesce(a.appointment_date, dr.start_time, dr.recap_date::timestamptz) + interval '60 minutes' <= now()
    and not exists (
      select 1 from medical_records mr where mr.daily_recap_id = dr.id
    );
$fn$;

CREATE OR REPLACE FUNCTION public.get_therapist_overdue_daily_soap_count(p_therapist_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
  select count(*)::int
  from physiotherapists p
  join soap_lock_settings s on s.clinic_id = p.clinic_id
  cross join lateral get_therapist_period_range(p.id) gtpr
  join daily_recaps dr on dr.therapist_id = p.id
  where p.id = p_therapist_id
    and not coalesce(p.soap_lock_exempt, false)
    and s.daily_deadline_start is not null
    and s.daily_deadline_end is not null
    and (now() at time zone 'Asia/Makassar')::date between s.daily_deadline_start and s.daily_deadline_end
    and (dr.patient_id is not null or dr.actual_patient_id is not null)
    and dr.recap_date >= gtpr.period_start
    and dr.recap_date < (now() at time zone 'Asia/Makassar')::date
    and not exists (select 1 from medical_records mr where mr.daily_recap_id = dr.id);
$fn$;
