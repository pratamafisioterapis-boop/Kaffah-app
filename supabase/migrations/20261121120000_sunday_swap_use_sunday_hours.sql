-- Tukar jadwal Minggu: jam yang dipindahkan harus jam kerja HARI MINGGU pemohon
-- (therapist_schedules day_of_week = 0), bukan jam kerja umum (work_start_time /
-- work_end_time, mis. shift siang 13:00). Akibat sebelumnya: terapis pengganti mendapat
-- slot mulai 13:00 padahal jadwal Minggu pemohon mulai 09:00.

CREATE OR REPLACE FUNCTION public.create_sunday_swap_request(
  p_substitute_id uuid,
  p_date date,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_me public.physiotherapists%ROWTYPE;
  v_sub public.physiotherapists%ROWTYPE;
  v_start time;
  v_end time;
  v_id uuid;
BEGIN
  SELECT * INTO v_me FROM public.physiotherapists WHERE user_id = auth.uid() LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Akun Anda bukan terapis'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = v_me.clinic_id AND c.therapist_leave_request_enabled) THEN
    RAISE EXCEPTION 'Fitur tukar jadwal tidak aktif di klinik ini';
  END IF;
  IF EXTRACT(DOW FROM p_date) <> 0 THEN RAISE EXCEPTION 'Tukar jadwal hanya untuk hari Minggu'; END IF;
  IF p_date < current_date THEN RAISE EXCEPTION 'Tanggal sudah lewat'; END IF;
  IF public.therapist_is_off_on(v_me.id, p_date) THEN
    RAISE EXCEPTION 'Anda tidak punya jadwal masuk di tanggal itu';
  END IF;

  -- Jam kerja Minggu pemohon: dari jadwal tetap hari Minggu; jam kerja umum hanya cadangan.
  SELECT MIN(s.start_time), MAX(s.end_time) INTO v_start, v_end
    FROM public.therapist_schedules s
    WHERE s.therapist_id = v_me.id AND s.is_active
      AND s.day_of_week = EXTRACT(DOW FROM p_date)::int
      AND s.end_time > s.start_time;
  IF v_start IS NULL OR v_end IS NULL THEN
    v_start := v_me.work_start_time;
    v_end := v_me.work_end_time;
  END IF;
  IF v_start IS NULL OR v_end IS NULL THEN
    RAISE EXCEPTION 'Jam kerja Anda belum diatur, hubungi owner';
  END IF;

  SELECT * INTO v_sub FROM public.physiotherapists WHERE id = p_substitute_id;
  IF NOT FOUND OR v_sub.clinic_id <> v_me.clinic_id OR v_sub.user_id IS NULL OR v_sub.is_active IS FALSE THEN
    RAISE EXCEPTION 'Terapis pengganti tidak valid';
  END IF;
  IF NOT public.therapist_is_off_on(v_sub.id, p_date) THEN
    RAISE EXCEPTION 'Terapis pengganti tidak libur di tanggal itu';
  END IF;

  INSERT INTO public.therapist_sunday_swap_requests
    (clinic_id, therapist_id, therapist_name, substitute_id, substitute_name, substitute_user_id,
     swap_date, start_time, end_time, notes, requested_by)
  VALUES
    (v_me.clinic_id, v_me.id, v_me.name, v_sub.id, v_sub.name, v_sub.user_id,
     p_date, v_start, v_end, NULLIF(btrim(COALESCE(p_notes, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.create_sunday_swap_request(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sunday_swap_request(uuid, date, text) TO authenticated;

-- Perbaiki pengajuan yang sudah ada (tanggal belum lewat) yang jamnya salah.
DO $fix$
DECLARE
  r record;
  v_start time;
  v_end time;
  v_shift public.therapist_extra_shifts%ROWTYPE;
BEGIN
  FOR r IN
    SELECT * FROM public.therapist_sunday_swap_requests
    WHERE swap_date >= current_date
      AND status IN ('pending_substitute', 'pending_owner', 'approved')
  LOOP
    SELECT MIN(s.start_time), MAX(s.end_time) INTO v_start, v_end
      FROM public.therapist_schedules s
      WHERE s.therapist_id = r.therapist_id AND s.is_active
        AND s.day_of_week = 0 AND s.end_time > s.start_time;

    CONTINUE WHEN v_start IS NULL OR v_end IS NULL
      OR (v_start = r.start_time AND v_end = r.end_time);

    UPDATE public.therapist_sunday_swap_requests
      SET start_time = v_start, end_time = v_end
      WHERE id = r.id;

    IF r.status = 'approved' THEN
      -- Hapus lalu buat ulang jadwal pengganti agar slot tanggal itu digenerate ulang oleh trigger.
      DELETE FROM public.therapist_extra_shifts WHERE sunday_swap_id = r.id RETURNING * INTO v_shift;
      IF v_shift.id IS NOT NULL THEN
        v_shift.start_time := v_start;
        v_shift.end_time := v_end;
        INSERT INTO public.therapist_extra_shifts
          (therapist_id, shift_date, start_time, end_time, capacity, slot_duration_minutes, sunday_swap_id)
        VALUES
          (v_shift.therapist_id, v_shift.shift_date, v_start, v_end, v_shift.capacity,
           v_shift.slot_duration_minutes, r.id);
      END IF;
    END IF;
  END LOOP;
END;
$fix$;
