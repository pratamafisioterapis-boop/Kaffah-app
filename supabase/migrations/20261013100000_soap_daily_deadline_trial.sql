-- Masa percobaan "SOAP tepat waktu" (klinik Kaffah): selama jendela percobaan,
-- SOAP sebuah sesi harus terisi paling lambat pukul 23.59 (WIB) di hari sesi
-- itu. Lewat dari itu, kalender booking terapis terkunci sampai SOAP yang
-- terlambat diisi. Hanya berlaku untuk sesi yang terjadi di dalam jendela.
--
-- Tanpa menghapus fungsi lama: signature get_therapist_soap_lock_status tidak berubah,
-- jadi aturan baru dilaporkan lewat kolom yang sudah ada (locked + rule_source
-- = 'daily_deadline'). Semua notifikasi/kunci kalender yang membaca fungsi itu
-- otomatis ikut.

ALTER TABLE public.soap_lock_settings
  ADD COLUMN IF NOT EXISTS daily_deadline_start date,
  ADD COLUMN IF NOT EXISTS daily_deadline_end date;

-- SOAP sesi (di dalam jendela) yang hari sesinya sudah lewat 23.59 WIB dan
-- belum terisi.
CREATE OR REPLACE FUNCTION public.get_therapist_overdue_daily_soap_count(p_therapist_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
  select count(*)::int
  from physiotherapists p
  join soap_lock_settings s on s.clinic_id = p.clinic_id
  join daily_recaps dr on dr.therapist_id = p.id
  where p.id = p_therapist_id
    and s.daily_deadline_start is not null
    and s.daily_deadline_end is not null
    and (now() at time zone 'Asia/Jakarta')::date between s.daily_deadline_start and s.daily_deadline_end
    and dr.recap_date >= s.daily_deadline_start
    and dr.recap_date < (now() at time zone 'Asia/Jakarta')::date
    and not exists (select 1 from medical_records mr where mr.daily_recap_id = dr.id);
$fn$;

-- Data untuk banner pemberitahuan di akun terapis.
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
    and s.daily_deadline_start is not null
    and s.daily_deadline_end is not null
    and (now() at time zone 'Asia/Jakarta')::date between s.daily_deadline_start and s.daily_deadline_end;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_therapist_overdue_daily_soap_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_soap_deadline_notice(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_therapist_soap_lock_status(p_therapist_id uuid)
 RETURNS TABLE(
   therapist_id uuid,
   locked boolean,
   unfilled_count integer,
   threshold_count integer,
   period_start date,
   period_end date,
   rule_source text,
   age_rule_enabled boolean,
   max_age_days integer,
   oldest_unfilled_age_days integer,
   age_rule_triggered boolean
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE
  v_therapist physiotherapists%rowtype;
  v_settings soap_lock_settings%rowtype;
  v_threshold integer;
  v_period_start date;
  v_period_end date;
  v_count integer;
  v_source text;
  v_clinic_enabled boolean;
  v_age_enabled boolean;
  v_max_age integer;
  v_oldest_age integer;
  v_age_triggered boolean;
  v_count_locked boolean;
  v_deadline_locked boolean;
BEGIN
  SELECT * INTO v_therapist FROM physiotherapists WHERE id = p_therapist_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT p_therapist_id, false, 0, 0, NULL::date, NULL::date, 'not_found'::text, false, NULL::integer, NULL::integer, false;
    RETURN;
  END IF;

  SELECT gtpr.period_start, gtpr.period_end INTO v_period_start, v_period_end
    FROM get_therapist_period_range(p_therapist_id) gtpr;

  v_age_enabled := COALESCE(v_therapist.soap_lock_age_rule_enabled, false);
  v_max_age := COALESCE(v_therapist.soap_lock_max_age_days, 4);

  IF v_therapist.soap_lock_exempt THEN
    RETURN QUERY SELECT p_therapist_id, false, 0, 0, v_period_start, v_period_end, 'exempt'::text, v_age_enabled, v_max_age, NULL::integer, false;
    RETURN;
  END IF;

  SELECT * INTO v_settings FROM soap_lock_settings WHERE clinic_id = v_therapist.clinic_id;
  v_clinic_enabled := COALESCE(v_settings.enabled, false);

  IF v_therapist.soap_lock_custom_enabled THEN
    v_threshold := COALESCE(v_therapist.soap_lock_threshold_count, 5);
    v_source := 'custom';
  ELSE
    v_threshold := COALESCE(v_settings.threshold_count, 5);
    v_source := CASE WHEN v_clinic_enabled THEN 'clinic' ELSE 'disabled' END;
  END IF;

  v_count := get_therapist_unfilled_soap_count_in_period(p_therapist_id, v_period_start, v_period_end);

  IF v_age_enabled THEN
    v_oldest_age := get_therapist_oldest_unfilled_soap_age_days(p_therapist_id, v_period_start, v_period_end);
  ELSE
    v_oldest_age := NULL;
  END IF;
  v_age_triggered := v_age_enabled AND v_oldest_age IS NOT NULL AND v_oldest_age >= v_max_age;

  IF v_therapist.soap_lock_manual_unlock THEN
    RETURN QUERY SELECT p_therapist_id, false, v_count, v_threshold, v_period_start, v_period_end, 'manual_unlock'::text, v_age_enabled, v_max_age, v_oldest_age, v_age_triggered;
    RETURN;
  END IF;

  v_count_locked := (v_therapist.soap_lock_custom_enabled OR v_clinic_enabled) AND (v_count >= v_threshold);

  -- Masa percobaan: SOAP harus terisi sebelum pukul 23.59 di hari sesi.
  v_deadline_locked := get_therapist_overdue_daily_soap_count(p_therapist_id) > 0;

  IF v_deadline_locked AND NOT v_count_locked AND NOT v_age_triggered THEN
    v_source := 'daily_deadline';
  ELSIF v_age_triggered AND NOT v_count_locked THEN
    v_source := 'age';
  END IF;

  RETURN QUERY SELECT p_therapist_id, (v_count_locked OR v_age_triggered OR v_deadline_locked), v_count, v_threshold, v_period_start, v_period_end, v_source, v_age_enabled, v_max_age, v_oldest_age, v_age_triggered;
END;
$fn$;

-- Aktifkan hanya untuk klinik Kaffah, jendela percobaan satu minggu.
INSERT INTO public.soap_lock_settings (clinic_id, enabled, threshold_count, period_days, daily_deadline_start, daily_deadline_end)
VALUES ('bfdc3fd8-a052-4753-a5b7-229930b3237a', false, 5, 7, '2026-10-11', '2026-10-18')
ON CONFLICT (clinic_id) DO UPDATE
  SET daily_deadline_start = EXCLUDED.daily_deadline_start,
      daily_deadline_end = EXCLUDED.daily_deadline_end;
