-- Notifikasi booking (push + salinan Telegram) menambah baris "Jenis":
--   Jenis     : Klinik
--   Jenis     : Homecare (Dalam jam kerja)
--   Jenis     : Homecare (Luar jam kerja)
--
-- Dalam/luar jam kerja memakai appointments.homecare_time_type bila sudah terisi.
-- Saat booking baru dibuat kolom itu masih NULL (admin menyimpannya lewat UPDATE
-- setelah insert), jadi dihitung dari jadwal aktif terapis (override > jadwal
-- mingguan + extra shift): logika yang sama dengan homecare_shift_check, yang
-- juga dipakai form booking sebagai petunjuk.
--
-- Empat fungsi notifikasi dipatch lewat replace pada definisi yang sedang aktif
-- (satu baris "Terapis" ditambah sufiks), dan migrasi gagal bila pola tidak
-- ditemukan tepat satu kali, sehingga tidak ada fungsi yang rusak diam-diam.

CREATE OR REPLACE FUNCTION public.booking_jenis_suffix(p public.appointments)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_type text := p.homecare_time_type;
  v_local timestamp := p.appointment_date AT TIME ZONE 'Asia/Makassar';
  v_date date := v_local::date;
  v_time time := v_local::time;
  v_start time;
  v_end time;
  v_inside boolean := false;
BEGIN
  IF NOT COALESCE(p.is_homecare, false) THEN
    RETURN E'\nJenis     : Klinik';
  END IF;

  IF v_type NOT IN ('dalam', 'luar') OR v_type IS NULL THEN
    SELECT o.start_time, o.end_time INTO v_start, v_end
    FROM therapist_schedule_overrides o
    WHERE o.therapist_id = p.therapist_id AND o.override_date = v_date
    LIMIT 1;

    IF NOT FOUND THEN
      SELECT min(s.start_time), max(s.end_time) INTO v_start, v_end
      FROM therapist_schedules s
      WHERE s.therapist_id = p.therapist_id AND s.is_active
        AND s.day_of_week = extract(dow FROM v_local)::int;
    END IF;

    IF v_start IS NOT NULL AND v_time >= v_start AND v_time < v_end THEN
      v_inside := true;
    END IF;

    IF NOT v_inside AND EXISTS (
      SELECT 1 FROM therapist_extra_shifts e
      WHERE e.therapist_id = p.therapist_id AND e.shift_date = v_date
        AND v_time >= e.start_time AND v_time < e.end_time
    ) THEN
      v_inside := true;
    END IF;

    v_type := CASE WHEN v_inside THEN 'dalam' ELSE 'luar' END;
  END IF;

  RETURN E'\nJenis     : Homecare (' ||
         CASE v_type WHEN 'dalam' THEN 'Dalam' ELSE 'Luar' END || ' jam kerja)';
EXCEPTION WHEN OTHERS THEN
  RETURN E'\nJenis     : ' || CASE WHEN COALESCE(p.is_homecare, false) THEN 'Homecare' ELSE 'Klinik' END;
END;
$fn$;

REVOKE ALL ON FUNCTION public.booking_jenis_suffix(public.appointments) FROM public, anon, authenticated;

DO $do$
DECLARE
  r record;
  v_def text;
  v_new text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('public.notify_booking_created()'::regprocedure,     'COALESCE(v_therapist_name,''-'')',       'COALESCE(v_therapist_name,''-'') || public.booking_jenis_suffix(NEW)'),
      ('public.notify_booking_cancelled()'::regprocedure,   'COALESCE(v_therapist_name, ''-'')',      'COALESCE(v_therapist_name, ''-'') || public.booking_jenis_suffix(NEW)'),
      ('public.notify_booking_rescheduled()'::regprocedure, 'COALESCE(v_new_therapist_name, ''-'')',  'COALESCE(v_new_therapist_name, ''-'') || public.booking_jenis_suffix(NEW)'),
      ('tgreport.mirror_owner_booking()'::regprocedure,     'coalesce(v_therapist, ''-'')',           'coalesce(v_therapist, ''-'') || public.booking_jenis_suffix(NEW)')
    ) AS t(fn, old_expr, new_expr)
  LOOP
    v_def := pg_get_functiondef(r.fn);
    IF v_def LIKE '%booking_jenis_suffix%' THEN
      CONTINUE; -- sudah dipatch
    END IF;
    IF (length(v_def) - length(replace(v_def, r.old_expr, ''))) <> length(r.old_expr) THEN
      RAISE EXCEPTION 'Pola % tidak ditemukan tepat satu kali di %', r.old_expr, r.fn;
    END IF;
    v_new := replace(v_def, r.old_expr, r.new_expr);
    EXECUTE v_new;
  END LOOP;
END
$do$;
