-- Sisa migrasi 20261010110000_sunday_weekly_off_rules.sql yang BELUM terpasang di database
-- (bagian 1-2: tabel national_holidays & therapist_weekly_off_waivers sudah terpasang).
-- Jalankan seluruh file ini di SQL Editor dashboard Supabase (sekali jalan, berurutan).
-- Terakhir, bagian 9 menerapkan aturan ke izin Minggu yang sudah ada.

-- 3) Inti aturan: sesuaikan jatah libur mingguan setelah satu hari Minggu untuk satu terapis.
--    Jatah yang dibatalkan = libur mingguan seharian pertama di hari Senin atau Selasa setelah
--    Minggu itu (hari libur mingguan terapis berbeda-beda: ada yang Senin, ada yang Selasa).
CREATE OR REPLACE FUNCTION public.sync_weekly_off_waiver(p_therapist_id uuid, p_sunday date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_clinic uuid;
  v_reason text;
  v_row record;
  v_w record;
BEGIN
  IF EXTRACT(DOW FROM p_sunday) <> 0 OR p_sunday + 2 < current_date THEN
    RETURN;
  END IF;

  SELECT p.clinic_id INTO v_clinic
  FROM public.physiotherapists p
  JOIN public.clinics c ON c.id = p.clinic_id
  WHERE p.id = p_therapist_id AND c.therapist_leave_request_enabled;
  IF v_clinic IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.national_holidays h WHERE h.clinic_id = v_clinic AND h.holiday_date = p_sunday) THEN
    v_reason := 'national_holiday';
  ELSIF EXISTS (
    SELECT 1 FROM public.therapist_time_off tto
    WHERE tto.therapist_id = p_therapist_id
      AND tto.leave_type <> 'weekly_off'
      AND tto.start_time IS NULL
      AND p_sunday BETWEEN tto.start_date AND tto.end_date
  ) THEN
    v_reason := 'sunday_leave';
  END IF;

  IF v_reason IS NOT NULL THEN
    -- Satu Minggu hanya membatalkan satu jatah libur; bila sudah ada catatannya, jangan ambil libur berikutnya.
    IF NOT EXISTS (
      SELECT 1 FROM public.therapist_weekly_off_waivers
      WHERE therapist_id = p_therapist_id AND sunday_date = p_sunday
    ) THEN
      SELECT * INTO v_row FROM public.therapist_time_off
      WHERE therapist_id = p_therapist_id AND leave_type = 'weekly_off' AND start_time IS NULL
        AND start_date = end_date
        AND start_date BETWEEN p_sunday + 1 AND p_sunday + 2
        AND start_date >= current_date
      ORDER BY start_date
      LIMIT 1;
      IF FOUND THEN
        INSERT INTO public.therapist_weekly_off_waivers
          (clinic_id, therapist_id, sunday_date, off_date, reason, original_reason, created_by)
        VALUES
          (v_clinic, p_therapist_id, p_sunday, v_row.start_date, v_reason, v_row.reason, v_row.created_by)
        ON CONFLICT (therapist_id, off_date) DO UPDATE
          SET sunday_date = EXCLUDED.sunday_date, reason = EXCLUDED.reason;
        DELETE FROM public.therapist_time_off WHERE id = v_row.id;
      END IF;
    END IF;
  ELSE
    FOR v_w IN
      SELECT * FROM public.therapist_weekly_off_waivers
      WHERE therapist_id = p_therapist_id AND sunday_date = p_sunday AND off_date >= current_date
    LOOP
      INSERT INTO public.therapist_time_off
        (therapist_id, start_date, end_date, start_time, end_time, reason, leave_type, created_by)
      VALUES
        (p_therapist_id, v_w.off_date, v_w.off_date, NULL, NULL, COALESCE(v_w.original_reason, 'Libur'), 'weekly_off', v_w.created_by);
      DELETE FROM public.therapist_weekly_off_waivers WHERE id = v_w.id;
    END LOOP;
  END IF;
END;
$fn$;

-- 4) Pemicu dari therapist_time_off (izin Minggu dibuat / diubah / dihapus; libur Senin / Selasa ditambah).
CREATE OR REPLACE FUNCTION public.sync_sunday_rule_for_time_off(p_therapist_id uuid, p_leave_type text, p_start date, p_end date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_d date;
BEGIN
  IF p_therapist_id IS NULL THEN
    RETURN;
  END IF;
  IF p_leave_type = 'weekly_off' THEN
    -- Libur mingguan baru di hari Senin / Selasa: langsung diabaikan bila Minggu sebelumnya sudah izin / libur nasional.
    IF p_start = p_end AND EXTRACT(DOW FROM p_start) IN (1, 2) THEN
      PERFORM public.sync_weekly_off_waiver(p_therapist_id, p_start - EXTRACT(DOW FROM p_start)::int);
    END IF;
    RETURN;
  END IF;
  FOR v_d IN
    SELECT d::date FROM generate_series(greatest(p_start, current_date - 2), least(p_end, current_date + 120), interval '1 day') d
    WHERE EXTRACT(DOW FROM d) = 0
  LOOP
    PERFORM public.sync_weekly_off_waiver(p_therapist_id, v_d);
  END LOOP;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.handle_time_off_sunday_rule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- Perubahan yang dibuat fungsi sync sendiri tidak dievaluasi ulang.
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.leave_type <> 'weekly_off' THEN
    PERFORM public.sync_sunday_rule_for_time_off(OLD.therapist_id, OLD.leave_type, OLD.start_date, OLD.end_date);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.sync_sunday_rule_for_time_off(NEW.therapist_id, NEW.leave_type, NEW.start_date, NEW.end_date);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$fn$;

CREATE OR REPLACE TRIGGER trg_time_off_sunday_rule
  AFTER INSERT OR UPDATE OR DELETE ON public.therapist_time_off
  FOR EACH ROW EXECUTE FUNCTION public.handle_time_off_sunday_rule();

-- 5) Pemicu dari hari libur nasional: semua terapis klinik itu.
CREATE OR REPLACE FUNCTION public.handle_national_holiday_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_date date;
  v_clinic uuid;
  v_t record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_date := OLD.holiday_date; v_clinic := OLD.clinic_id;
  ELSE
    v_date := NEW.holiday_date; v_clinic := NEW.clinic_id;
  END IF;
  IF EXTRACT(DOW FROM v_date) = 0 THEN
    FOR v_t IN SELECT p.id FROM public.physiotherapists p WHERE p.clinic_id = v_clinic LOOP
      PERFORM public.sync_weekly_off_waiver(v_t.id, v_date);
    END LOOP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$fn$;

CREATE OR REPLACE TRIGGER trg_national_holiday_change
  AFTER INSERT OR DELETE ON public.national_holidays
  FOR EACH ROW EXECUTE FUNCTION public.handle_national_holiday_change();

-- 6) Persetujuan izin: tambah label "Event" (disimpan sebagai leave_type 'other').
CREATE OR REPLACE FUNCTION public.review_therapist_leave_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_req public.therapist_leave_requests%ROWTYPE;
  v_role text := get_my_role();
  v_time_off_id uuid;
  v_reviewer_name text;
  v_label text;
  v_shift jsonb;
  v_capacity integer;
  v_slot_minutes integer;
BEGIN
  SELECT * INTO v_req FROM public.therapist_leave_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan tidak ditemukan';
  END IF;

  IF v_role = 'super_admin' OR (v_role = 'owner' AND v_req.clinic_id = get_my_clinic_id()) THEN
    NULL;
  ELSIF public.is_my_clinic_head_therapist(v_req.clinic_id) THEN
    IF v_req.requested_by = auth.uid() THEN
      RAISE EXCEPTION 'Pengajuan Anda sendiri harus ditinjau oleh owner';
    END IF;
  ELSE
    RAISE EXCEPTION 'Tidak punya akses untuk meninjau pengajuan ini';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Pengajuan sudah ditinjau';
  END IF;

  SELECT COALESCE(
           (SELECT p.name FROM public.physiotherapists p WHERE p.user_id = auth.uid() LIMIT 1),
           (SELECT u.full_name FROM public.users u WHERE u.id = auth.uid()),
           'Owner')
    INTO v_reviewer_name;

  IF p_approve THEN
    v_label := CASE v_req.leave_type
      WHEN 'annual' THEN 'Cuti'
      WHEN 'sick' THEN 'Sakit'
      WHEN 'training' THEN 'Training'
      WHEN 'personal' THEN 'Izin Pribadi'
      WHEN 'organization' THEN 'Kegiatan Organisasi'
      WHEN 'event' THEN 'Event'
      ELSE 'Lainnya'
    END;

    SELECT COALESCE(MAX(capacity), 1) INTO v_capacity
      FROM public.therapist_schedules WHERE therapist_id = v_req.therapist_id AND is_active;

    v_slot_minutes := public.habitual_slot_minutes(v_req.therapist_id);

    FOR v_shift IN SELECT * FROM jsonb_array_elements(v_req.replacement_shifts) LOOP
      CONTINUE WHEN (v_shift->>'date')::date < current_date;
      INSERT INTO public.therapist_extra_shifts
        (therapist_id, shift_date, start_time, end_time, capacity, slot_duration_minutes, leave_request_id)
      VALUES
        (v_req.therapist_id, (v_shift->>'date')::date, (v_shift->>'start_time')::time,
         (v_shift->>'end_time')::time, v_capacity, v_slot_minutes, v_req.id);
    END LOOP;

    INSERT INTO public.therapist_time_off
      (therapist_id, start_date, end_date, start_time, end_time, reason, leave_type, created_by)
    VALUES
      (v_req.therapist_id, v_req.leave_date, v_req.leave_date, v_req.start_time, v_req.end_time,
       CASE WHEN COALESCE(btrim(v_req.notes), '') = '' THEN v_label ELSE v_label || ' - ' || btrim(v_req.notes) END,
       CASE WHEN v_req.leave_type IN ('organization', 'event') THEN 'other' ELSE v_req.leave_type END,
       auth.uid())
    RETURNING id INTO v_time_off_id;
  END IF;

  UPDATE public.therapist_leave_requests
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        reviewed_by = auth.uid(),
        reviewed_by_name = v_reviewer_name,
        reviewed_at = now(),
        review_note = NULLIF(btrim(COALESCE(p_note, '')), ''),
        time_off_id = v_time_off_id
    WHERE id = p_request_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.review_therapist_leave_request(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_therapist_leave_request(uuid, boolean, text) TO authenticated;

-- 7) Persetujuan tukar jadwal Minggu: jatah libur pindah ke terapis pengganti.
CREATE OR REPLACE FUNCTION public.review_sunday_swap_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_req public.therapist_sunday_swap_requests%ROWTYPE;
  v_role text := get_my_role();
  v_reviewer_name text;
  v_capacity integer;
  v_time_off_id uuid;
  v_gift_date date;
BEGIN
  SELECT * INTO v_req FROM public.therapist_sunday_swap_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pengajuan tidak ditemukan'; END IF;
  IF NOT (v_role = 'super_admin' OR (v_role = 'owner' AND v_req.clinic_id = get_my_clinic_id())) THEN
    RAISE EXCEPTION 'Hanya owner yang bisa meninjau tukar jadwal';
  END IF;
  IF v_req.status <> 'pending_owner' THEN
    RAISE EXCEPTION 'Pengajuan belum disetujui terapis pengganti atau sudah ditinjau';
  END IF;

  SELECT COALESCE(
           (SELECT u.full_name FROM public.users u WHERE u.id = auth.uid()),
           'Owner')
    INTO v_reviewer_name;

  IF p_approve THEN
    IF v_req.swap_date < current_date THEN RAISE EXCEPTION 'Tanggal tukar jadwal sudah lewat'; END IF;
    IF NOT public.therapist_is_off_on(v_req.substitute_id, v_req.swap_date) THEN
      RAISE EXCEPTION 'Terapis pengganti sudah tidak libur di tanggal itu';
    END IF;

    SELECT COALESCE(MAX(capacity), 1) INTO v_capacity
      FROM public.therapist_schedules WHERE therapist_id = v_req.therapist_id AND is_active;

    INSERT INTO public.therapist_extra_shifts
      (therapist_id, shift_date, start_time, end_time, capacity, slot_duration_minutes, sunday_swap_id)
    VALUES
      (v_req.substitute_id, v_req.swap_date, v_req.start_time, v_req.end_time, v_capacity,
       public.habitual_slot_minutes(v_req.substitute_id), v_req.id);

    INSERT INTO public.therapist_time_off
      (therapist_id, start_date, end_date, start_time, end_time, reason, leave_type, created_by)
    VALUES
      (v_req.therapist_id, v_req.swap_date, v_req.swap_date, NULL, NULL,
       'Tukar jadwal Minggu dengan ' || COALESCE(v_req.substitute_name, 'rekan'), 'other', auth.uid())
    RETURNING id INTO v_time_off_id;

    -- Jatah libur mingguan terapis yang izin berpindah ke terapis pengganti: pengganti libur di
    -- hari yang sama dengan jatah yang hilang (dicatat trigger time_off di atas); bila belum ada
    -- jatah yang tercatat, hari Senin setelah Minggu itu. Dilewati bila pengganti sudah libur di hari itu.
    SELECT w.off_date INTO v_gift_date
      FROM public.therapist_weekly_off_waivers w
      WHERE w.therapist_id = v_req.therapist_id AND w.sunday_date = v_req.swap_date;
    v_gift_date := COALESCE(v_gift_date, v_req.swap_date + 1);
    IF NOT EXISTS (
      SELECT 1 FROM public.therapist_time_off tto
      WHERE tto.therapist_id = v_req.substitute_id
        AND v_gift_date BETWEEN tto.start_date AND tto.end_date
        AND tto.start_time IS NULL
    ) THEN
      INSERT INTO public.therapist_time_off
        (therapist_id, start_date, end_date, start_time, end_time, reason, leave_type, created_by)
      VALUES
        (v_req.substitute_id, v_gift_date, v_gift_date, NULL, NULL,
         'Libur - Pengganti jatah libur ' || COALESCE(v_req.therapist_name, 'rekan')
           || ' (menggantikan Minggu ' || to_char(v_req.swap_date, 'DD-MM-YYYY') || ')',
         'weekly_off', auth.uid());
    END IF;
  END IF;

  UPDATE public.therapist_sunday_swap_requests
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        rejected_by = CASE WHEN p_approve THEN NULL ELSE 'owner' END,
        reviewed_by = auth.uid(),
        reviewed_by_name = v_reviewer_name,
        reviewed_at = now(),
        review_note = NULLIF(btrim(COALESCE(p_note, '')), ''),
        time_off_id = v_time_off_id
    WHERE id = p_request_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.review_sunday_swap_request(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_sunday_swap_request(uuid, boolean, text) TO authenticated;

-- 8) Hak akses fungsi internal (hanya dipanggil trigger / fungsi lain).
REVOKE ALL ON FUNCTION public.sync_weekly_off_waiver(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_sunday_rule_for_time_off(uuid, text, date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_time_off_sunday_rule() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_national_holiday_change() FROM PUBLIC, anon, authenticated;

-- 9) Terapkan ke izin Minggu yang sudah ada (hanya hari libur hari ini ke depan).
DO $fn$
DECLARE
  v_t record;
  v_d date;
BEGIN
  FOR v_t IN
    SELECT p.id FROM public.physiotherapists p
    JOIN public.clinics c ON c.id = p.clinic_id
    WHERE c.therapist_leave_request_enabled
  LOOP
    FOR v_d IN
      SELECT d::date FROM generate_series(current_date - 2, current_date + 120, interval '1 day') d
      WHERE EXTRACT(DOW FROM d) = 0
    LOOP
      PERFORM public.sync_weekly_off_waiver(v_t.id, v_d);
    END LOOP;
  END LOOP;
END;
$fn$;
