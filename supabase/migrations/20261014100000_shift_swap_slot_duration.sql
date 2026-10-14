-- Tukar shift: slot hasil override harus mengikuti durasi slot shift tujuan,
-- bukan default 60 menit. Sebelumnya review_therapist_shift_swap_request tidak
-- mengisi slot_duration_minutes sehingga override jatuh ke default 60.
--
-- Durasi shift tujuan = durasi yang paling sering dipakai pada baris
-- therapist_schedules (satu baris = satu slot) yang berada di dalam jam shift
-- tujuan: dari terapis itu sendiri dulu, lalu terapis lain di klinik yang sama;
-- bila tidak ada, pakai kebiasaan terapis (habitual_slot_minutes).

CREATE OR REPLACE FUNCTION public.shift_swap_slot_minutes(
  p_therapist_id uuid, p_start time, p_end time
) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT COALESCE(
    (SELECT mode() WITHIN GROUP (ORDER BY m) FROM (
       SELECT (extract(epoch from (ts.end_time - ts.start_time)) / 60)::int AS m
       FROM therapist_schedules ts
       WHERE ts.therapist_id = p_therapist_id AND ts.is_active
         AND ts.start_time >= p_start AND ts.end_time <= p_end
         AND ts.end_time > ts.start_time) x
     WHERE m BETWEEN 5 AND 180),
    (SELECT mode() WITHIN GROUP (ORDER BY m) FROM (
       SELECT (extract(epoch from (ts.end_time - ts.start_time)) / 60)::int AS m
       FROM therapist_schedules ts
       JOIN physiotherapists p ON p.id = ts.therapist_id
       WHERE p.clinic_id = (SELECT clinic_id FROM physiotherapists WHERE id = p_therapist_id)
         AND ts.is_active
         AND ts.start_time >= p_start AND ts.end_time <= p_end
         AND ts.end_time > ts.start_time) y
     WHERE m BETWEEN 5 AND 180),
    public.habitual_slot_minutes(p_therapist_id)
  );
$fn$;

REVOKE ALL ON FUNCTION public.shift_swap_slot_minutes(uuid, time, time) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shift_swap_slot_minutes(uuid, time, time) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_therapist_shift_swap_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_req public.therapist_shift_swap_requests%ROWTYPE;
  v_role text := get_my_role();
  v_reviewer_name text;
  v_capacity integer;
  v_override_id uuid;
  v_conflicts integer;
  v_slot_minutes integer;
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

    v_slot_minutes := public.shift_swap_slot_minutes(v_req.therapist_id, v_req.to_start_time, v_req.to_end_time);

    INSERT INTO public.therapist_schedule_overrides
      (therapist_id, override_date, start_time, end_time, note, capacity, slot_duration_minutes, created_by)
    VALUES
      (v_req.therapist_id, v_req.swap_date, v_req.to_start_time, v_req.to_end_time,
       'Tukar shift' || COALESCE(': ' || NULLIF(btrim(v_req.to_shift_name), ''), ''),
       v_capacity, v_slot_minutes, auth.uid())
    ON CONFLICT (therapist_id, override_date) DO UPDATE
      SET start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          note = EXCLUDED.note,
          capacity = EXCLUDED.capacity,
          slot_duration_minutes = EXCLUDED.slot_duration_minutes
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
$fn$;

-- Perbaiki override tukar shift yang sudah disetujui (hari ini dan ke depan);
-- trigger trg_schedule_override_change membuat ulang slot-nya.
UPDATE public.therapist_schedule_overrides o
SET slot_duration_minutes = public.shift_swap_slot_minutes(o.therapist_id, o.start_time, o.end_time)
FROM public.therapist_shift_swap_requests r
WHERE r.override_id = o.id
  AND r.status = 'approved'
  AND o.override_date >= current_date
  AND o.slot_duration_minutes IS DISTINCT FROM public.shift_swap_slot_minutes(o.therapist_id, o.start_time, o.end_time);
