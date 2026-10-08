-- Tukar shift tidak boleh diajukan / disetujui bila sudah ada pasien yang booking
-- di jam yang terdampak: booking aktif terapis pada tanggal itu yang tidak
-- sepenuhnya berada di dalam jam shift tujuan. (Tukar shift hanya untuk
-- jadwal terapis itu sendiri, bukan tukar dengan terapis lain.)

CREATE OR REPLACE FUNCTION public.shift_swap_booking_conflicts(
  p_therapist_id uuid, p_date date, p_start time, p_end time
) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.appointments a
  WHERE a.therapist_id = p_therapist_id
    AND a.status IN ('scheduled', 'confirmed', 'pending', 'rescheduled')
    AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::date = p_date
    AND (
      (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time < p_start
      OR ((a.appointment_date AT TIME ZONE 'Asia/Makassar')
          + (a.duration_minutes || ' minutes')::interval)::time > p_end
    )
    AND (
      get_my_role() = 'super_admin'
      OR EXISTS (
        SELECT 1 FROM public.physiotherapists p
        WHERE p.id = p_therapist_id AND p.clinic_id = get_my_clinic_id()
      )
    );
$$;

REVOKE ALL ON FUNCTION public.shift_swap_booking_conflicts(uuid, date, time, time) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shift_swap_booking_conflicts(uuid, date, time, time) TO authenticated;

CREATE OR REPLACE FUNCTION public.shift_swap_require_no_booking()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  v_count := public.shift_swap_booking_conflicts(NEW.therapist_id, NEW.swap_date, NEW.to_start_time, NEW.to_end_time);
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Sudah ada % pasien yang booking di jam yang terdampak, tukar shift tidak bisa diajukan.', v_count
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shift_swap_no_booking ON public.therapist_shift_swap_requests;
CREATE TRIGGER trg_shift_swap_no_booking
  BEFORE INSERT ON public.therapist_shift_swap_requests
  FOR EACH ROW EXECUTE FUNCTION public.shift_swap_require_no_booking();

-- Cek ulang saat persetujuan (pasien bisa saja booking setelah pengajuan dibuat).
CREATE OR REPLACE FUNCTION public.review_therapist_shift_swap_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.therapist_shift_swap_requests%ROWTYPE;
  v_role text := get_my_role();
  v_reviewer_name text;
  v_capacity integer;
  v_override_id uuid;
  v_conflicts integer;
BEGIN
  SELECT * INTO v_req FROM public.therapist_shift_swap_requests WHERE id = p_request_id FOR UPDATE;
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
    IF v_req.swap_date < current_date THEN
      RAISE EXCEPTION 'Tanggal tukar shift sudah lewat';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.therapist_time_off tto
      WHERE tto.therapist_id = v_req.therapist_id
        AND tto.leave_type <> 'weekly_off'
        AND v_req.swap_date BETWEEN tto.start_date AND tto.end_date
        AND tto.start_time IS NULL
    ) THEN
      RAISE EXCEPTION 'Terapis sedang izin / cuti seharian di tanggal itu';
    END IF;

    v_conflicts := public.shift_swap_booking_conflicts(v_req.therapist_id, v_req.swap_date, v_req.to_start_time, v_req.to_end_time);
    IF v_conflicts > 0 THEN
      RAISE EXCEPTION 'Sudah ada % pasien yang booking di jam yang terdampak, tukar shift tidak bisa disetujui. Tolak pengajuan ini.', v_conflicts;
    END IF;

    SELECT COALESCE(MAX(capacity), 1) INTO v_capacity
      FROM public.therapist_schedules WHERE therapist_id = v_req.therapist_id AND is_active;

    INSERT INTO public.therapist_schedule_overrides
      (therapist_id, override_date, start_time, end_time, note, capacity, created_by)
    VALUES
      (v_req.therapist_id, v_req.swap_date, v_req.to_start_time, v_req.to_end_time,
       'Tukar shift' || COALESCE(': ' || NULLIF(btrim(v_req.to_shift_name), ''), ''),
       v_capacity, auth.uid())
    ON CONFLICT (therapist_id, override_date) DO UPDATE
      SET start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          note = EXCLUDED.note,
          capacity = EXCLUDED.capacity
    RETURNING id INTO v_override_id;
  END IF;

  UPDATE public.therapist_shift_swap_requests
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        reviewed_by = auth.uid(),
        reviewed_by_name = v_reviewer_name,
        reviewed_at = now(),
        review_note = NULLIF(btrim(COALESCE(p_note, '')), ''),
        override_id = v_override_id
    WHERE id = p_request_id;
END;
$$;
