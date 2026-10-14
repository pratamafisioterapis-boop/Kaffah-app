-- Tukar shift: pola jam slot hari itu harus sama dengan terapis lain yang memang
-- bekerja di shift tujuan (mis. Shift Siang: 13:00-14:30, 14:30-15:30, 15:30-17:00,
-- 17:00-18:30, 19:00-20:30), bukan dipotong rata dari jam mulai. Pola jadwal klinik
-- tidak rata (ada slot yang beririsan dan ada jeda), jadi potongan rata tidak cocok.
--
-- therapist_schedule_overrides.template_therapist_id: bila terisi, slot hari itu
-- disalin dari therapist_schedules terapis tsb (hari yang sama dalam seminggu,
-- di dalam jam override). Bila kosong, perilaku lama (potongan rata) tetap berlaku.

ALTER TABLE public.therapist_schedule_overrides
  ADD COLUMN IF NOT EXISTS template_therapist_id uuid REFERENCES public.physiotherapists(id) ON DELETE SET NULL;

-- Terapis acuan: terapis lain di klinik yang sama, aktif, yang jadwal tetapnya pada
-- hari itu paling banyak berada di dalam jam shift tujuan.
CREATE OR REPLACE FUNCTION public.shift_swap_template_therapist(
  p_therapist_id uuid, p_date date, p_start time, p_end time
) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT ts.therapist_id
  FROM therapist_schedules ts
  JOIN physiotherapists p ON p.id = ts.therapist_id
  WHERE ts.is_active AND p.is_active
    AND p.id <> p_therapist_id
    AND p.clinic_id = (SELECT clinic_id FROM physiotherapists WHERE id = p_therapist_id)
    AND ts.day_of_week = extract(dow from p_date)::int
    AND ts.start_time >= p_start AND ts.end_time <= p_end
    AND ts.end_time > ts.start_time
  GROUP BY ts.therapist_id, p.name
  ORDER BY count(*) DESC, p.name
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public.shift_swap_template_therapist(uuid, date, time, time) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shift_swap_template_therapist(uuid, date, time, time) TO authenticated;

CREATE OR REPLACE FUNCTION public.generate_slots_for_date_for_therapist(p_date date, p_therapist_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $fn$
declare
  day_index int;
  v_override record;
  v_cursor time;
  v_slot_dur interval;
  v_gap_dur interval;
  v_slot_end time;
begin
  day_index := extract(dow from p_date);

  SELECT * INTO v_override
  FROM therapist_schedule_overrides
  WHERE therapist_id = p_therapist_id
    AND override_date = p_date
    AND end_time IS NOT NULL;

  IF FOUND AND v_override.template_therapist_id IS NOT NULL THEN
    -- Salin pola jam dari jadwal tetap terapis acuan.
    insert into therapist_slots (therapist_id, slot_date, slot_start_time, slot_end_time, duration_minutes, capacity)
    select
      p_therapist_id, p_date, ts.start_time, ts.end_time,
      extract(epoch from (ts.end_time - ts.start_time)) / 60,
      v_override.capacity
    from therapist_schedules ts
    join physiotherapists p on p.id = p_therapist_id
    where ts.therapist_id = v_override.template_therapist_id
      and ts.day_of_week = day_index
      and ts.is_active = true
      and p.is_active = true
      and ts.start_time >= v_override.start_time
      and ts.end_time <= v_override.end_time
      and not public.time_off_blocks_slot(p_therapist_id, p_date, ts.start_time, ts.end_time)
      and not exists (
        select 1 from therapist_slots s
        where s.therapist_id = p_therapist_id
          and s.slot_date = p_date
          and s.slot_start_time = ts.start_time
          and s.slot_end_time = ts.end_time
      );
  ELSIF FOUND THEN
    v_slot_dur := (v_override.slot_duration_minutes || ' minutes')::interval;
    v_gap_dur := (v_override.gap_minutes || ' minutes')::interval;
    v_cursor := v_override.start_time;

    WHILE v_cursor + v_slot_dur <= v_override.end_time LOOP
      v_slot_end := v_cursor + v_slot_dur;

      insert into therapist_slots (therapist_id, slot_date, slot_start_time, slot_end_time, duration_minutes, capacity)
      select p_therapist_id, p_date, v_cursor, v_slot_end, v_override.slot_duration_minutes, v_override.capacity
      from physiotherapists p
      where p.id = p_therapist_id
        and p.is_active = true
        and not public.time_off_blocks_slot(p_therapist_id, p_date, v_cursor, v_slot_end)
        and not exists (
          select 1 from therapist_slots s
          where s.therapist_id = p_therapist_id
            and s.slot_date = p_date
            and s.slot_start_time = v_cursor
            and s.slot_end_time = v_slot_end
        );

      v_cursor := v_slot_end + v_gap_dur;
    END LOOP;
  ELSE
    insert into therapist_slots (therapist_id, slot_date, slot_start_time, slot_end_time, duration_minutes, capacity)
    select
      ts.therapist_id, p_date, ts.start_time, ts.end_time,
      extract(epoch from (ts.end_time - ts.start_time)) / 60,
      ts.capacity
    from therapist_schedules ts
    join physiotherapists p on p.id = ts.therapist_id
    where ts.therapist_id = p_therapist_id
      and ts.day_of_week = day_index
      and ts.is_active = true
      and p.is_active = true
      and not public.time_off_blocks_slot(ts.therapist_id, p_date, ts.start_time, ts.end_time)
      and not exists (
        select 1 from therapist_slots s
        where s.therapist_id = ts.therapist_id
          and s.slot_date = p_date
          and s.slot_start_time = ts.start_time
          and s.slot_end_time = ts.end_time
      );
  END IF;

  perform public.generate_extra_shift_slots(p_date, p_therapist_id);
end;
$fn$;

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
  v_template uuid;
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
    v_template := public.shift_swap_template_therapist(v_req.therapist_id, v_req.swap_date, v_req.to_start_time, v_req.to_end_time);

    INSERT INTO public.therapist_schedule_overrides
      (therapist_id, override_date, start_time, end_time, note, capacity, slot_duration_minutes, template_therapist_id, created_by)
    VALUES
      (v_req.therapist_id, v_req.swap_date, v_req.to_start_time, v_req.to_end_time,
       'Tukar shift' || COALESCE(': ' || NULLIF(btrim(v_req.to_shift_name), ''), ''),
       v_capacity, v_slot_minutes, v_template, auth.uid())
    ON CONFLICT (therapist_id, override_date) DO UPDATE
      SET start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          note = EXCLUDED.note,
          capacity = EXCLUDED.capacity,
          slot_duration_minutes = EXCLUDED.slot_duration_minutes,
          template_therapist_id = EXCLUDED.template_therapist_id
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

-- Tukar shift yang sudah disetujui (hari ini dan ke depan) ikut memakai pola shift
-- tujuan; trigger trg_schedule_override_change membuat ulang slot-nya.
UPDATE public.therapist_schedule_overrides o
SET template_therapist_id = public.shift_swap_template_therapist(o.therapist_id, o.override_date, o.start_time, o.end_time)
FROM public.therapist_shift_swap_requests r
WHERE r.override_id = o.id
  AND r.status = 'approved'
  AND o.override_date >= current_date
  AND o.template_therapist_id IS DISTINCT FROM public.shift_swap_template_therapist(o.therapist_id, o.override_date, o.start_time, o.end_time);
