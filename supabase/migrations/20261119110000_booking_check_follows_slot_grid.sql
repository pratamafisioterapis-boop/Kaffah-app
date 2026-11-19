-- Slot hijau (status 'aktif') di tampilan booking admin = boleh dibooking, walau
-- jamnya overlap dengan appointment lain yang dimulai di slot berbeda (mis.
-- appointment 14:30 selama 90 menit tidak memblokir slot 15:30-17:00).
-- 1) Tampilan: kembali ke aturan semula (mengembalikan perubahan 20261119100000).
-- 2) check_slot_availability: jika waktu booking = awal sebuah slot di therapist_slots,
--    pakai aturan hitung yang SAMA dengan tampilan; jika tidak (booking di luar grid
--    slot) tetap memakai pengecekan overlap ketat.
CREATE OR REPLACE FUNCTION public.get_available_slots_with_status_by_date(p_date date, p_clinic_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(therapist_id uuid, slot_start time without time zone, slot_end time without time zone, duration_minutes integer, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
BEGIN
  RETURN QUERY
  SELECT
    ts.therapist_id,
    ts.slot_start_time AS slot_start,
    ts.slot_end_time AS slot_end,
    ts.duration_minutes,

    CASE
      WHEN public.time_off_blocks_slot(ts.therapist_id, p_date, ts.slot_start_time, ts.slot_end_time)
        AND NOT (
          EXISTS (
            SELECT 1 FROM therapist_extra_shifts es
            WHERE es.therapist_id = ts.therapist_id AND es.shift_date = p_date
              AND es.start_time <= ts.slot_start_time AND es.end_time >= ts.slot_end_time
          )
          AND NOT public.time_off_blocks_extra_slot(ts.therapist_id, p_date, ts.slot_start_time, ts.slot_end_time)
        )
      THEN 'cuti'

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
$fn$;
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
  v_local_date DATE;
  v_local_time TIME;
  v_slot_end TIME;
  v_slot_capacity INTEGER;
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

  v_local_date := (p_start_time AT TIME ZONE 'Asia/Makassar')::date;
  v_local_time := (p_start_time AT TIME ZONE 'Asia/Makassar')::time;

  SELECT ts.slot_end_time, COALESCE(ts.capacity, 1)
    INTO v_slot_end, v_slot_capacity
  FROM therapist_slots ts
  WHERE ts.therapist_id = p_therapist_id
    AND ts.slot_date = v_local_date
    AND ts.is_available = true
    AND ts.slot_start_time = v_local_time
  LIMIT 1;

  IF v_slot_end IS NOT NULL THEN
    -- Booking tepat di awal slot: aturan sama dengan tampilan slot.
    SELECT COUNT(*) INTO v_conflict_count
    FROM appointments a
    WHERE a.therapist_id = p_therapist_id
      AND a.status IN ('scheduled', 'confirmed', 'pending', 'rescheduled')
      AND (p_exclude_id IS NULL OR a.id <> p_exclude_id)
      AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::date = v_local_date
      AND (
        (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time = v_local_time
        OR (
          (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time < v_slot_end
          AND ((a.appointment_date AT TIME ZONE 'Asia/Makassar')::time
               + (a.duration_minutes || ' minutes')::interval) > v_local_time
          AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time <> v_local_time
          AND NOT EXISTS (
            SELECT 1 FROM therapist_slots ts2
            WHERE ts2.therapist_id = p_therapist_id
              AND ts2.slot_date = v_local_date
              AND ts2.is_available = true
              AND ts2.slot_start_time = (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time
          )
        )
      );
    RETURN v_conflict_count < v_slot_capacity;
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
