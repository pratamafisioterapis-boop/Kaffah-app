-- Saat pengajuan izin disetujui, slot booking langsung ikut berubah:
--   * jadwal pengganti menjadi slot tambahan (therapist_extra_shifts),
--   * izin parsial hanya menutup slot yang beririsan dengan jam izin
--     (sebelumnya izin dengan jam tertentu tetap menutup seluruh tanggal),
--   * slot tanggal terkait dibuat ulang otomatis (tanpa menunggu cron).
-- Slot yang sudah punya booking aktif tidak dihapus.

-- 1) Hari kerja tambahan (pengganti izin). Terpisah dari override agar jam normal tidak tertimpa.
CREATE TABLE IF NOT EXISTS public.therapist_extra_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.physiotherapists(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 20),
  slot_duration_minutes integer NOT NULL DEFAULT 60 CHECK (slot_duration_minutes BETWEEN 5 AND 480),
  leave_request_id uuid REFERENCES public.therapist_leave_requests(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS therapist_extra_shifts_lookup ON public.therapist_extra_shifts (therapist_id, shift_date);

ALTER TABLE public.therapist_extra_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extra_shifts_select" ON public.therapist_extra_shifts;
CREATE POLICY "extra_shifts_select" ON public.therapist_extra_shifts
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM public.physiotherapists p
      WHERE p.id = therapist_extra_shifts.therapist_id
        AND (p.clinic_id = get_my_clinic_id() OR p.user_id = auth.uid())
    )
  );
-- Tanpa policy tulis: hanya diisi oleh RPC review_therapist_leave_request (SECURITY DEFINER).

-- 2) Apakah slot [start, end) tertutup izin/cuti pada tanggal itu?
--    Cuti tanpa jam = seharian; dengan jam = hanya slot yang beririsan.
CREATE OR REPLACE FUNCTION public.time_off_blocks_slot(p_therapist_id uuid, p_date date, p_slot_start time, p_slot_end time)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM therapist_time_off tto
    WHERE tto.therapist_id = p_therapist_id
      AND p_date BETWEEN tto.start_date AND tto.end_date
      AND (
        tto.start_time IS NULL OR tto.end_time IS NULL
        OR (p_slot_start < tto.end_time AND p_slot_end > tto.start_time)
      )
  );
$$;

-- Durasi slot "kebiasaan" klinik: satu baris therapist_schedules = satu slot, jadi
-- ambil durasi yang paling sering dipakai pada jadwal mingguan terapis itu;
-- jika terapis belum punya jadwal, pakai kebiasaan klinik; terakhir 60 menit.
-- Hanya baris <= 180 menit yang dianggap slot (baris 6-8 jam adalah shift panjang).
CREATE OR REPLACE FUNCTION public.habitual_slot_minutes(p_therapist_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT mode() WITHIN GROUP (ORDER BY m) FROM (
       SELECT (extract(epoch from (ts.end_time - ts.start_time)) / 60)::int AS m
       FROM therapist_schedules ts
       WHERE ts.therapist_id = p_therapist_id AND ts.is_active
         AND ts.end_time > ts.start_time) x
     WHERE m BETWEEN 5 AND 180),
    (SELECT mode() WITHIN GROUP (ORDER BY m) FROM (
       SELECT (extract(epoch from (ts.end_time - ts.start_time)) / 60)::int AS m
       FROM therapist_schedules ts
       JOIN physiotherapists p ON p.id = ts.therapist_id
       WHERE p.clinic_id = (SELECT clinic_id FROM physiotherapists WHERE id = p_therapist_id)
         AND ts.is_active AND ts.end_time > ts.start_time) y
     WHERE m BETWEEN 5 AND 180),
    60
  );
$$;

-- Slot tambahan hari itu (dipotong per slot_duration_minutes (default dari kebiasaan jadwal terapis)), dilewati bila
-- beririsan dengan slot yang sudah ada atau tertutup izin.
CREATE OR REPLACE FUNCTION public.generate_extra_shift_slots(p_date date, p_therapist_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_shift record;
  v_cursor time;
  v_slot_end time;
  v_dur interval;
BEGIN
  FOR v_shift IN
    SELECT e.* FROM therapist_extra_shifts e
    JOIN physiotherapists p ON p.id = e.therapist_id
    WHERE e.therapist_id = p_therapist_id AND e.shift_date = p_date AND p.is_active = true
  LOOP
    v_dur := (v_shift.slot_duration_minutes || ' minutes')::interval;
    v_cursor := v_shift.start_time;
    WHILE v_cursor + v_dur <= v_shift.end_time LOOP
      v_slot_end := v_cursor + v_dur;
      INSERT INTO therapist_slots (therapist_id, slot_date, slot_start_time, slot_end_time, duration_minutes, capacity)
      SELECT p_therapist_id, p_date, v_cursor, v_slot_end, v_shift.slot_duration_minutes, v_shift.capacity
      WHERE NOT public.time_off_blocks_slot(p_therapist_id, p_date, v_cursor, v_slot_end)
        AND NOT EXISTS (
          SELECT 1 FROM therapist_slots s
          WHERE s.therapist_id = p_therapist_id AND s.slot_date = p_date
            AND s.slot_start_time < v_slot_end AND s.slot_end_time > v_cursor
        );
      v_cursor := v_slot_end;
    END LOOP;
  END LOOP;
END;
$function$;

-- 3) Pembuat slot per terapis: pakai time_off_blocks_slot + slot tambahan.
CREATE OR REPLACE FUNCTION public.generate_slots_for_date_for_therapist(p_date date, p_therapist_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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

  IF FOUND THEN
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
$function$;

-- 4) Varian semua terapis (dipakai job harian) dibuat konsisten dengan di atas.
CREATE OR REPLACE FUNCTION public.generate_slots_for_date(p_date date)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_therapist uuid;
begin
  FOR v_therapist IN
    SELECT p.id FROM physiotherapists p WHERE p.is_active = true
  LOOP
    perform public.generate_slots_for_date_for_therapist(p_date, v_therapist);
  END LOOP;
end;
$function$;

-- 5) Status slot: 'cuti' hanya untuk slot yang benar-benar tertutup izin.
CREATE OR REPLACE FUNCTION public.get_available_slots_with_status_by_date(p_date date, p_clinic_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(therapist_id uuid, slot_start time without time zone, slot_end time without time zone, duration_minutes integer, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ts.therapist_id,
    ts.slot_start_time AS slot_start,
    ts.slot_end_time AS slot_end,
    ts.duration_minutes,

    CASE
      WHEN public.time_off_blocks_slot(ts.therapist_id, p_date, ts.slot_start_time, ts.slot_end_time) THEN 'cuti'

      WHEN (
        SELECT COUNT(*)
        FROM appointments a
        WHERE a.therapist_id = ts.therapist_id
          AND a.status IN ('confirmed', 'pending', 'scheduled', 'rescheduled')
          AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::date = p_date
          AND (
            (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time = ts.slot_start_time
            OR
            (
              (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time < ts.slot_end_time
              AND (
                (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time
                + (a.duration_minutes || ' minutes')::interval
              ) > ts.slot_start_time
              AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time <> ts.slot_start_time
              AND NOT EXISTS (
                SELECT 1
                FROM therapist_slots ts2
                WHERE ts2.therapist_id = ts.therapist_id
                  AND ts2.slot_date = p_date
                  AND ts2.is_available = true
                  AND ts2.slot_start_time = (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time
              )
            )
          )
      ) >= COALESCE(ts.capacity, 1) THEN 'terisi'

      WHEN is_therapist_soap_locked(ts.therapist_id) THEN 'terkunci'

      ELSE 'aktif'
    END AS status

  FROM therapist_slots ts
  JOIN physiotherapists p ON p.id = ts.therapist_id

  WHERE ts.slot_date = p_date
    AND ts.is_available = true
    AND p.is_active = true
    AND (p_clinic_id IS NULL OR p.clinic_id = p_clinic_id)

  ORDER BY ts.therapist_id, ts.slot_start_time;
END;
$function$;

-- 6) Kapasitas: slot tambahan memakai kapasitasnya sendiri.
CREATE OR REPLACE FUNCTION public.check_slot_availability(p_therapist_id uuid, p_start_time timestamp with time zone, p_duration_minutes integer, p_exclude_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_conflict_count INTEGER;
  v_end_time TIMESTAMP WITH TIME ZONE;
  v_capacity INTEGER;
  v_date DATE;
  v_time TIME;
BEGIN
  v_end_time := p_start_time + (p_duration_minutes || ' minutes')::interval;
  v_date := p_start_time::date;
  v_time := p_start_time::time;

  SELECT capacity INTO v_capacity
  FROM therapist_schedule_overrides
  WHERE therapist_id = p_therapist_id
    AND override_date = v_date
    AND end_time IS NOT NULL
    AND start_time <= v_time
    AND end_time > v_time
  LIMIT 1;

  IF v_capacity IS NULL THEN
    SELECT capacity INTO v_capacity
    FROM therapist_schedules
    WHERE therapist_id = p_therapist_id
      AND day_of_week = EXTRACT(DOW FROM v_date)
      AND is_active = true
      AND start_time <= v_time
      AND end_time > v_time
    LIMIT 1;
  END IF;

  IF v_capacity IS NULL THEN
    SELECT capacity INTO v_capacity
    FROM therapist_extra_shifts
    WHERE therapist_id = p_therapist_id
      AND shift_date = v_date
      AND start_time <= v_time
      AND end_time > v_time
    LIMIT 1;
  END IF;

  IF v_capacity IS NULL THEN
    v_capacity := 1;
  END IF;

  SELECT COUNT(*) INTO v_conflict_count
  FROM appointments a
  WHERE a.therapist_id = p_therapist_id
    AND a.status IN ('scheduled', 'confirmed', 'pending', 'rescheduled')
    AND (p_exclude_id IS NULL OR a.id <> p_exclude_id)
    AND a.appointment_date < v_end_time
    AND (a.appointment_date + (a.duration_minutes || ' minutes')::interval) > p_start_time;

  RETURN v_conflict_count < v_capacity;
END;
$function$;

-- 7) Perubahan therapist_extra_shifts / therapist_time_off langsung membuat ulang slot tanggal terkait.
CREATE OR REPLACE FUNCTION public.handle_extra_shift_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
begin
  if TG_OP = 'DELETE' then
    perform public.regenerate_slots_for_therapist_date(OLD.therapist_id, OLD.shift_date);
    return OLD;
  end if;
  perform public.regenerate_slots_for_therapist_date(NEW.therapist_id, NEW.shift_date);
  return NEW;
end;
$function$;

DROP TRIGGER IF EXISTS trg_extra_shift_change ON public.therapist_extra_shifts;
CREATE TRIGGER trg_extra_shift_change
  AFTER INSERT OR DELETE ON public.therapist_extra_shifts
  FOR EACH ROW EXECUTE FUNCTION public.handle_extra_shift_change();

CREATE OR REPLACE FUNCTION public.handle_time_off_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
declare
  v_d date;
  v_from date;
  v_to date;
begin
  -- Hanya tanggal hari ini ke depan, maksimal 120 hari per perubahan.
  if TG_OP <> 'INSERT' then
    v_from := greatest(OLD.start_date, current_date);
    v_to := least(OLD.end_date, current_date + 120);
    for v_d in select d::date from generate_series(v_from, v_to, interval '1 day') d loop
      perform public.regenerate_slots_for_therapist_date(OLD.therapist_id, v_d);
    end loop;
  end if;
  if TG_OP <> 'DELETE' then
    v_from := greatest(NEW.start_date, current_date);
    v_to := least(NEW.end_date, current_date + 120);
    for v_d in select d::date from generate_series(v_from, v_to, interval '1 day') d loop
      perform public.regenerate_slots_for_therapist_date(NEW.therapist_id, v_d);
    end loop;
  end if;
  return coalesce(NEW, OLD);
end;
$function$;

DROP TRIGGER IF EXISTS trg_time_off_change ON public.therapist_time_off;
CREATE TRIGGER trg_time_off_change
  AFTER INSERT OR UPDATE OR DELETE ON public.therapist_time_off
  FOR EACH ROW EXECUTE FUNCTION public.handle_time_off_change();

-- 8) Persetujuan: buat time_off DAN slot pengganti.
CREATE OR REPLACE FUNCTION public.review_therapist_leave_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      ELSE 'Lainnya'
    END;

    -- Slot pengganti dulu, lalu izin (trigger membuat ulang slot tiap tanggal).
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
       v_req.leave_type, auth.uid())
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
$$;

REVOKE ALL ON FUNCTION public.review_therapist_leave_request(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_therapist_leave_request(uuid, boolean, text) TO authenticated;

-- 9) Hak akses: fungsi SECURITY DEFINER baru tidak boleh dipanggil anon lewat API.
REVOKE EXECUTE ON FUNCTION public.time_off_blocks_slot(uuid, date, time, time) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.habitual_slot_minutes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.time_off_blocks_slot(uuid, date, time, time) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.habitual_slot_minutes(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.handle_extra_shift_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_time_off_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_leave_request() FROM PUBLIC, anon, authenticated;
