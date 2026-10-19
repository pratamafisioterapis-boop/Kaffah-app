-- Waktu homecare (dalam/luar jam kerja) otomatis dari jam appointment dan jam buka klinik
-- (appointment_settings.operating_hours, 0 = Minggu ... 6 = Sabtu, WITA). Admin tidak perlu
-- memilih lagi; pilihan manual yang sudah ada tidak ditimpa.
CREATE OR REPLACE FUNCTION public.homecare_time_from_date(p_date timestamptz)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_local timestamp := p_date AT TIME ZONE 'Asia/Makassar';
  v_dow text := extract(dow FROM v_local)::int::text;
  v_cfg jsonb;
  v_start time;
  v_end time;
BEGIN
  SELECT s.operating_hours -> v_dow INTO v_cfg FROM appointment_settings s LIMIT 1;
  IF v_cfg IS NULL OR (v_cfg ->> 'enabled') IS DISTINCT FROM 'true' THEN
    RETURN 'luar';
  END IF;
  v_start := (v_cfg ->> 'start')::time;
  v_end := (v_cfg ->> 'end')::time;
  IF v_local::time >= v_start AND v_local::time < v_end THEN
    RETURN 'dalam';
  END IF;
  RETURN 'luar';
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trg_appointment_homecare_time()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  IF COALESCE(NEW.is_homecare, false) AND NEW.homecare_time_type IS NULL THEN
    NEW.homecare_time_type := homecare_time_from_date(NEW.appointment_date);
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS aa_appointment_homecare_time ON public.appointments;
CREATE TRIGGER aa_appointment_homecare_time
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.trg_appointment_homecare_time();

UPDATE public.appointments
SET homecare_time_type = homecare_time_from_date(appointment_date)
WHERE is_homecare AND homecare_time_type IS NULL AND appointment_date >= '2026-10-19 00:00:00+08';
