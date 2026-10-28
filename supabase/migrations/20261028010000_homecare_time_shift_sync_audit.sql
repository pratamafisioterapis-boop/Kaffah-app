-- Waktu homecare (dalam/luar jam kerja) mengacu ke jadwal slot aktif / shift terapis, bukan jam buka klinik.
--  1. homecare_shift_check: apakah suatu jam berada di dalam jadwal aktif terapis (override > jadwal mingguan, + extra shift).
--  2. homecare_time_audit: daftar homecare yang kosong / tidak sesuai jadwal / rekapnya belum sinkron (untuk cek sebelum gajian).
--  3. Perubahan homecare_time_type otomatis menyinkronkan tipe pasien di rekap harian (dasar hitung insentif).
--  4. trg_appointment_confirmed_to_recap tidak lagi menjalankan ulang upsert rekap saat yang berubah hanya homecare_time_type
--     (sebelumnya payment_method rekap bisa ter-reset NULL).

CREATE OR REPLACE FUNCTION public.homecare_shift_check(p_therapist_id uuid, p_at timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_local timestamp := p_at AT TIME ZONE 'Asia/Makassar';
  v_date date := v_local::date;
  v_time time := v_local::time;
  v_dow int := extract(dow FROM v_local)::int;
  v_start time;
  v_end time;
  v_src text;
  v_inside boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM physiotherapists p
    WHERE p.id = p_therapist_id AND p.clinic_id = public.get_my_clinic_id()
  ) THEN
    RETURN NULL;
  END IF;

  SELECT o.start_time, o.end_time INTO v_start, v_end
  FROM therapist_schedule_overrides o
  WHERE o.therapist_id = p_therapist_id AND o.override_date = v_date
  LIMIT 1;

  IF FOUND THEN
    v_src := 'override';
  ELSE
    SELECT min(s.start_time), max(s.end_time) INTO v_start, v_end
    FROM therapist_schedules s
    WHERE s.therapist_id = p_therapist_id AND s.is_active AND s.day_of_week = v_dow;
    v_src := 'jadwal';
  END IF;

  IF v_start IS NOT NULL AND v_time >= v_start AND v_time < v_end THEN
    v_inside := true;
  END IF;

  IF NOT v_inside AND EXISTS (
    SELECT 1 FROM therapist_extra_shifts e
    WHERE e.therapist_id = p_therapist_id AND e.shift_date = v_date
      AND v_time >= e.start_time AND v_time < e.end_time
  ) THEN
    v_inside := true;
  END IF;

  RETURN jsonb_build_object('inside', v_inside, 'start', v_start, 'end', v_end, 'source', v_src);
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.homecare_shift_check(uuid, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.homecare_time_audit(p_start date, p_end date, p_therapist_id uuid DEFAULT NULL)
RETURNS TABLE (
  appointment_id uuid,
  therapist_id uuid,
  therapist_name text,
  appt_at timestamp,
  patient_name text,
  appt_status text,
  current_value text,
  expected_value text,
  problem text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_clinic uuid := public.get_my_clinic_id();
BEGIN
  IF v_clinic IS NULL OR NOT EXISTS (
    SELECT 1 FROM soap_first_settings s WHERE s.clinic_id = v_clinic AND s.enabled
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT a.id, a.therapist_id AS tid, p.name AS tname,
           (a.appointment_date AT TIME ZONE 'Asia/Makassar') AS appt_local,
           COALESCE(pt.full_name, a.guest_name) AS pname,
           a.status AS astatus, a.homecare_time_type AS cur,
           CASE WHEN (public.homecare_shift_check(a.therapist_id, a.appointment_date) ->> 'inside')::boolean
                THEN 'dalam' ELSE 'luar' END AS expected,
           d.patient_type AS recap_type
    FROM appointments a
    JOIN physiotherapists p ON p.id = a.therapist_id
    LEFT JOIN patients pt ON pt.id = a.patient_id
    LEFT JOIN daily_recaps d ON d.appointment_id = a.id
    WHERE a.clinic_id = v_clinic
      AND a.is_homecare
      AND a.status NOT IN ('cancelled', 'no_show', 'rejected')
      AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::date BETWEEN p_start AND p_end
      AND (p_therapist_id IS NULL OR a.therapist_id = p_therapist_id)
  )
  SELECT b.id, b.tid, b.tname, b.appt_local, b.pname, b.astatus, b.cur, b.expected,
         CASE
           WHEN b.cur IS NULL THEN 'kosong'
           WHEN b.cur <> b.expected THEN 'tidak_sesuai_shift'
           WHEN b.recap_type IS NOT NULL AND b.recap_type <>
                CASE b.cur WHEN 'dalam' THEN 'HOMECARE (dlm jam kerja)' ELSE 'HOMECARE (luar jam kerja)' END
             THEN 'rekap_tidak_sinkron'
         END
  FROM base b
  WHERE b.cur IS NULL
     OR b.cur <> b.expected
     OR (b.recap_type IS NOT NULL AND b.recap_type <>
         CASE b.cur WHEN 'dalam' THEN 'HOMECARE (dlm jam kerja)' ELSE 'HOMECARE (luar jam kerja)' END)
  ORDER BY b.appt_local;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.homecare_time_audit(date, date, uuid) TO authenticated;

-- Sinkron tipe pasien rekap saat homecare_time_type berubah. Update rekap tanpa perubahan kolom
-- memicu trigger BEFORE rekap yang menurunkan ulang tipe pasien dari appointment (nominal tetap).
CREATE OR REPLACE FUNCTION public.trg_sync_recap_homecare_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  UPDATE daily_recaps SET updated_at = now() WHERE appointment_id = NEW.id;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_sync_recap_homecare_type ON public.appointments;
CREATE TRIGGER trg_sync_recap_homecare_type
  AFTER UPDATE OF homecare_time_type ON public.appointments
  FOR EACH ROW
  WHEN (OLD.homecare_time_type IS DISTINCT FROM NEW.homecare_time_type AND NEW.is_homecare)
  EXECUTE FUNCTION public.trg_sync_recap_homecare_type();

CREATE OR REPLACE FUNCTION public.trg_appointment_confirmed_to_recap()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_therapist_name  text;
  v_clinic_id       uuid;
  v_pkg_tracking_id uuid;
  v_package_type    text;
  v_recap_date      date;
  v_today           date;
BEGIN

  -- Hanya homecare_time_type yang berubah: tidak ada yang perlu di-upsert ulang ke rekap.
  IF TG_OP = 'UPDATE'
     AND NEW.homecare_time_type IS DISTINCT FROM OLD.homecare_time_type
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.appointment_date IS NOT DISTINCT FROM OLD.appointment_date
     AND NEW.therapist_id IS NOT DISTINCT FROM OLD.therapist_id
     AND NEW.patient_id IS NOT DISTINCT FROM OLD.patient_id
     AND NEW.guest_name IS NOT DISTINCT FROM OLD.guest_name
     AND NEW.guest_phone IS NOT DISTINCT FROM OLD.guest_phone
     AND NEW.is_homecare IS NOT DISTINCT FROM OLD.is_homecare THEN
    RETURN NEW;
  END IF;

  v_recap_date := (NEW.appointment_date AT TIME ZONE 'Asia/Makassar')::date;
  v_today      := (NOW() AT TIME ZONE 'Asia/Makassar')::date;

  IF NEW.status NOT IN ('confirmed', 'rescheduled') THEN
    RETURN NEW;
  END IF;

  IF v_recap_date > v_today THEN
    RETURN NEW;
  END IF;

  -- Kalau recap utk appointment ini sudah ada, sudah ke-link paket, punya pasien
  -- yang sama, DAN tanggal recap-nya tidak berubah (reschedule cuma geser jam /
  -- ganti terapis di hari yang sama) -- pertahankan link itu, jangan dicari ulang.
  -- Kalau tanggalnya beneran pindah hari, biarkan dicari ulang di bawah karena
  -- rentang validitas paket bisa beda utk tanggal baru.
  SELECT dr.package_tracking_id, dr.package_type
  INTO v_pkg_tracking_id, v_package_type
  FROM daily_recaps dr
  WHERE dr.appointment_id = NEW.id
    AND dr.patient_id IS NOT DISTINCT FROM NEW.patient_id
    AND dr.recap_date = v_recap_date;

  IF v_pkg_tracking_id IS NULL AND NEW.patient_id IS NOT NULL THEN
    SELECT pt.id, pt.package_name
    INTO v_pkg_tracking_id, v_package_type
    FROM package_tracking pt
    WHERE pt.patient_id = NEW.patient_id
      AND pt.status = 'aktif'
      AND pt.sessions_remaining > 0
      AND v_recap_date BETWEEN pt.start_date
      AND COALESCE(pt.extended_until, pt.end_date)
    ORDER BY pt.start_date DESC
    LIMIT 1;
  END IF;

  IF v_pkg_tracking_id IS NULL THEN
    v_package_type := NULL;
  END IF;

  -- ambil nama therapist + clinic_id
  SELECT name, clinic_id
  INTO v_therapist_name, v_clinic_id
  FROM physiotherapists
  WHERE id = NEW.therapist_id;

  -- fallback kalau clinic_id therapist kosong
  IF v_clinic_id IS NULL THEN
    SELECT id INTO v_clinic_id FROM clinics LIMIT 1;
  END IF;

  INSERT INTO daily_recaps (
    id,
    appointment_id,
    patient_id,
    therapist_id,
    therapist_name,
    patient_type,
    recap_date,
    created_at,
    updated_at,
    status,
    package_tracking_id,
    package_type,
    payment_method,
    guest_name,
    guest_phone,
    clinic_id
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    CASE WHEN NEW.patient_id IS NOT NULL THEN NEW.patient_id ELSE NULL END,
    NEW.therapist_id,
    v_therapist_name,
    CASE WHEN NEW.patient_id IS NOT NULL THEN 'registered' ELSE 'guest' END,
    v_recap_date,
    NOW(),
    NOW(),
    NEW.status,
    v_pkg_tracking_id,
    v_package_type,
    CASE WHEN v_pkg_tracking_id IS NOT NULL THEN 'Package' ELSE NULL END,
    NEW.guest_name,
    NEW.guest_phone,
    v_clinic_id
  )
  ON CONFLICT (appointment_id)
  DO UPDATE SET
    therapist_id      = EXCLUDED.therapist_id,
    therapist_name     = EXCLUDED.therapist_name,
    guest_name        = EXCLUDED.guest_name,
    guest_phone       = EXCLUDED.guest_phone,
    status            = EXCLUDED.status,
    updated_at        = NOW(),
    package_tracking_id = CASE WHEN daily_recaps.prepaid_at IS NOT NULL
      THEN daily_recaps.package_tracking_id ELSE EXCLUDED.package_tracking_id END,
    package_type      = CASE WHEN daily_recaps.prepaid_at IS NOT NULL
      THEN daily_recaps.package_type ELSE EXCLUDED.package_type END,
    payment_method    = CASE
      WHEN daily_recaps.prepaid_at IS NOT NULL THEN daily_recaps.payment_method
      WHEN EXCLUDED.package_tracking_id IS NOT NULL THEN 'Package'
      ELSE NULL
    END,
    clinic_id         = COALESCE(daily_recaps.clinic_id, EXCLUDED.clinic_id);

  RETURN NEW;
END;
$fn$;
