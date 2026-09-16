-- Allow a therapist shift/slot to host more than one patient at the same
-- time (e.g. group therapy, multiple beds/rooms staffed by one therapist).
-- Adds a `capacity` column (default 1, so all existing schedules keep their
-- current one-patient-per-slot behavior) and makes the slot-generation and
-- availability/booking functions capacity-aware instead of treating any
-- overlapping booking as an automatic conflict.

ALTER TABLE public.therapist_schedules
  ADD COLUMN IF NOT EXISTS capacity integer NOT NULL DEFAULT 1;

ALTER TABLE public.therapist_schedules
  ADD CONSTRAINT therapist_schedules_capacity_check CHECK (capacity BETWEEN 1 AND 20);

ALTER TABLE public.therapist_slots
  ADD COLUMN IF NOT EXISTS capacity integer NOT NULL DEFAULT 1;

ALTER TABLE public.therapist_slots
  ADD CONSTRAINT therapist_slots_capacity_check CHECK (capacity BETWEEN 1 AND 20);

-- Carry the shift's capacity onto the slots generated from it.
CREATE OR REPLACE FUNCTION public.generate_slots_for_date(p_date date)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  day_index int;
begin
  day_index := extract(dow from p_date);

  insert into therapist_slots (
    therapist_id,
    slot_date,
    slot_start_time,
    slot_end_time,
    duration_minutes,
    capacity
  )
  select
    ts.therapist_id,
    p_date,
    ts.start_time,
    ts.end_time,
    extract(epoch from (ts.end_time - ts.start_time)) / 60,
    ts.capacity
  from therapist_schedules ts
  join physiotherapists p on p.id = ts.therapist_id
  where
    ts.day_of_week = day_index
    and ts.is_active = true
    and p.is_active = true
    and not exists (
      select 1
      from therapist_time_off tto
      where tto.therapist_id = ts.therapist_id
      and p_date between tto.start_date and tto.end_date
    )
    and not exists (
      select 1
      from therapist_slots s
      where s.therapist_id = ts.therapist_id
      and s.slot_date = p_date
      and s.slot_start_time = ts.start_time
      and s.slot_end_time = ts.end_time
    );

end;
$function$;

-- Booking gate used by create_appointment_safe (and therefore by every
-- booking path: manual, recurring, public/smart booking). Previously any
-- overlapping appointment made a slot unavailable; now a slot stays
-- bookable until the number of overlapping appointments reaches the
-- matching shift's capacity. Falls back to capacity 1 when the requested
-- time isn't inside any defined shift, preserving the old strict behavior
-- for ad-hoc/manual bookings outside normal hours.
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
  FROM therapist_schedules
  WHERE therapist_id = p_therapist_id
    AND day_of_week = EXTRACT(DOW FROM v_date)
    AND is_active = true
    AND start_time <= v_time
    AND end_time > v_time
  LIMIT 1;

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

-- Slot status used to render "aktif"/"terisi" across every booking screen.
-- Same overlap logic as before, but now counts overlapping bookings against
-- the slot's own capacity instead of flipping to 'terisi' on the first one.
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
      WHEN EXISTS (
        SELECT 1
        FROM therapist_time_off tto
        WHERE tto.therapist_id = ts.therapist_id
          AND p_date BETWEEN tto.start_date AND tto.end_date
      ) THEN 'cuti'

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

-- Keep the recurring-booking conflict preview consistent with the new
-- capacity-aware check_slot_availability: a day only counts as a conflict
-- once the number of overlapping bookings reaches the shift's capacity.
CREATE OR REPLACE FUNCTION public.check_recurring_slot_conflicts(p_therapist_id uuid, p_start_date date, p_end_date date, p_weekday integer, p_time time without time zone, p_duration_minutes integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  curr_date date := p_start_date;
  total_planned int := 0;
  conflicts date[] := ARRAY[]::date[];

  v_start_timestamp timestamp with time zone;
  v_conflict_count int;
  v_capacity int;
BEGIN
  IF p_start_date > p_end_date THEN
     RETURN json_build_object('total_planned', 0, 'conflicts', conflicts);
  END IF;

  SELECT capacity INTO v_capacity
  FROM therapist_schedules
  WHERE therapist_id = p_therapist_id
    AND day_of_week = p_weekday
    AND is_active = true
    AND start_time <= p_time
    AND end_time > p_time
  LIMIT 1;

  IF v_capacity IS NULL THEN
    v_capacity := 1;
  END IF;

  WHILE curr_date <= p_end_date LOOP
    IF EXTRACT(DOW FROM curr_date) = p_weekday THEN

       total_planned := total_planned + 1;

       v_start_timestamp := (curr_date || ' ' || p_time)::timestamp with time zone;

       SELECT COUNT(*) INTO v_conflict_count
          FROM appointments a
          WHERE a.therapist_id = p_therapist_id
            AND a.status IN ('confirmed', 'pending', 'scheduled', 'rescheduled', 'ongoing')
            AND a.appointment_date < (v_start_timestamp + (p_duration_minutes || ' minutes')::interval)
            AND (a.appointment_date + (a.duration_minutes || ' minutes')::interval) > v_start_timestamp;

       IF v_conflict_count >= v_capacity THEN
          conflicts := array_append(conflicts, curr_date);
       END IF;

    END IF;

    curr_date := curr_date + 1;
  END LOOP;

  RETURN json_build_object(
    'total_planned', total_planned,
    'conflicts', conflicts
  );
END;
$function$;
