-- Lanjutan masa percobaan SOAP 23.59:
-- 1. Terapis yang dikecualikan dari aturan kunci SOAP (soap_lock_exempt) tidak
--    kena aturan ini dan tidak mendapat pemberitahuan.
-- 2. SOAP hari-hari sebelumnya yang belum terisi dalam periode terapis ikut
--    dihitung terlambat (bukan hanya sesi sejak awal masa percobaan).

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
    and (now() at time zone 'Asia/Jakarta')::date between s.daily_deadline_start and s.daily_deadline_end
    and dr.recap_date >= gtpr.period_start
    and dr.recap_date < (now() at time zone 'Asia/Jakarta')::date
    and not exists (select 1 from medical_records mr where mr.daily_recap_id = dr.id);
$fn$;

CREATE OR REPLACE FUNCTION public.get_soap_deadline_notice(p_therapist_id uuid)
 RETURNS TABLE(
   active boolean,
   deadline_start date,
   deadline_end date,
   overdue_count integer,
   today_unfilled_count integer,
   locked boolean
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
  select
    true,
    s.daily_deadline_start,
    s.daily_deadline_end,
    get_therapist_overdue_daily_soap_count(p.id),
    (select count(*)::int from daily_recaps dr
      where dr.therapist_id = p.id
        and dr.recap_date = (now() at time zone 'Asia/Jakarta')::date
        and not exists (select 1 from medical_records mr where mr.daily_recap_id = dr.id)),
    (select gls.locked from get_therapist_soap_lock_status(p.id) gls limit 1)
  from physiotherapists p
  join soap_lock_settings s on s.clinic_id = p.clinic_id
  where p.id = p_therapist_id
    and not coalesce(p.soap_lock_exempt, false)
    and s.daily_deadline_start is not null
    and s.daily_deadline_end is not null
    and (now() at time zone 'Asia/Jakarta')::date between s.daily_deadline_start and s.daily_deadline_end;
$fn$;
