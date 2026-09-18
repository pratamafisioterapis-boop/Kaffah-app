-- therapist_schedule_overrides previously only fed the attendance discipline
-- check (expected check-in for a date with a temporary shift swap). Extend
-- it so a date-specific override also changes what's actually bookable for
-- that therapist on that date, without touching the weekly template
-- (therapist_schedules) or any other date.
--
-- An override only replaces the day's bookable slot when it has an
-- end_time; a start_time-only override (still allowed, for attendance-only
-- use) is ignored for slot generation/capacity and that date keeps
-- following the weekly template as before.

ALTER TABLE public.therapist_schedule_overrides
  ADD COLUMN IF NOT EXISTS capacity integer NOT NULL DEFAULT 1;

ALTER TABLE public.therapist_schedule_overrides
  ADD CONSTRAINT therapist_schedule_overrides_capacity_check CHECK (capacity BETWEEN 1 AND 20);

-- Per-therapist slot generation: use the override's start/end/capacity for
-- the date instead of the weekly therapist_schedules row(s) when one exists
-- with an end_time set.
CREATE OR REPLACE FUNCTION public.generate_slots_for_date_for_therapist(p_date date, p_therapist_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  day_index int;
  v_override record;
begin
  day_index := extract(dow from p_date);

  SELECT * INTO v_override
  FROM therapist_schedule_overrides
  WHERE therapist_id = p_therapist_id
    AND override_date = p_date
    AND end_time IS NOT NULL;

  IF FOUND THEN
    insert into therapist_slots (
      therapist_id,
      slot_date,
      slot_start_time,
      slot_end_time,
      duration_minutes,
      capacity
    )
    select
      p_therapist_id,
      p_date,
      v_override.start_time,
      v_override.end_time,
      extract(epoch from (v_override.end_time - v_override.start_time)) / 60,
      v_override.capacity
    from physiotherapists p
    where
      p.id = p_therapist_id
      and p.is_active = true
      and not exists (
        select 1
        from therapist_time_off tto
        where tto.therapist_id = p_therapist_id
        and p_date between tto.start_date and tto.end_date
      )
      and not exists (
        select 1
        from therapist_slots s
        where s.therapist_id = p_therapist_id
        and s.slot_date = p_date
        and s.slot_start_time = v_override.start_time
        and s.slot_end_time = v_override.end_time
      );

    RETURN;
  END IF;

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
    ts.therapist_id = p_therapist_id
    and ts.day_of_week = day_index
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

-- Bulk (all-therapists) variant kept consistent with the per-therapist one
-- above, for any caller that still uses it.
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
    o.therapist_id,
    p_date,
    o.start_time,
    o.end_time,
    extract(epoch from (o.end_time - o.start_time)) / 60,
    o.capacity
  from therapist_schedule_overrides o
  join physiotherapists p on p.id = o.therapist_id
  where
    o.override_date = p_date
    and o.end_time is not null
    and p.is_active = true
    and not exists (
      select 1
      from therapist_time_off tto
      where tto.therapist_id = o.therapist_id
      and p_date between tto.start_date and tto.end_date
    )
    and not exists (
      select 1
      from therapist_slots s
      where s.therapist_id = o.therapist_id
      and s.slot_date = p_date
      and s.slot_start_time = o.start_time
      and s.slot_end_time = o.end_time
    );

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
      from therapist_schedule_overrides o
      where o.therapist_id = ts.therapist_id
      and o.override_date = p_date
      and o.end_time is not null
    )
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

-- Capacity gate used by create_appointment_safe: prefer the date's override
-- capacity when one applies, otherwise fall back to the weekly template as
-- before.
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

-- Recurring-booking conflict preview: same override-first capacity lookup,
-- evaluated per iterated date since an override only ever applies to one
-- specific occurrence in the series.
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

  WHILE curr_date <= p_end_date LOOP
    IF EXTRACT(DOW FROM curr_date) = p_weekday THEN

       total_planned := total_planned + 1;

       SELECT capacity INTO v_capacity
       FROM therapist_schedule_overrides
       WHERE therapist_id = p_therapist_id
         AND override_date = curr_date
         AND end_time IS NOT NULL
         AND start_time <= p_time
         AND end_time > p_time
       LIMIT 1;

       IF v_capacity IS NULL THEN
         SELECT capacity INTO v_capacity
         FROM therapist_schedules
         WHERE therapist_id = p_therapist_id
           AND day_of_week = p_weekday
           AND is_active = true
           AND start_time <= p_time
           AND end_time > p_time
         LIMIT 1;
       END IF;

       IF v_capacity IS NULL THEN
         v_capacity := 1;
       END IF;

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

-- Regenerate just the affected date's slots when an override is added,
-- edited, or removed, so booking availability reflects it immediately
-- instead of waiting for the next unrelated schedule change. Slots that
-- already have an appointment on that date are left untouched, matching
-- regenerate_future_slots_for_therapist's guard.
CREATE OR REPLACE FUNCTION public.regenerate_slots_for_therapist_date(p_therapist_id uuid, p_date date)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  delete from therapist_slots s
  where s.therapist_id = p_therapist_id
  and s.slot_date = p_date
  and not exists (
      select 1
      from appointments a
      where a.therapist_id = s.therapist_id
      and a.appointment_date::date = s.slot_date
      and a.appointment_date::time >= s.slot_start_time
      and a.appointment_date::time < s.slot_end_time
      and a.status in ('confirmed', 'pending', 'scheduled', 'rescheduled')
  );

  perform public.generate_slots_for_date_for_therapist(p_date, p_therapist_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_schedule_override_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if TG_OP = 'DELETE' then
    perform public.regenerate_slots_for_therapist_date(OLD.therapist_id, OLD.override_date);
    return OLD;
  else
    perform public.regenerate_slots_for_therapist_date(NEW.therapist_id, NEW.override_date);
    if TG_OP = 'UPDATE' and OLD.override_date <> NEW.override_date then
      perform public.regenerate_slots_for_therapist_date(OLD.therapist_id, OLD.override_date);
    end if;
    return NEW;
  end if;
end;
$function$;

DROP TRIGGER IF EXISTS trg_schedule_override_change ON public.therapist_schedule_overrides;
CREATE TRIGGER trg_schedule_override_change
AFTER INSERT OR DELETE OR UPDATE ON public.therapist_schedule_overrides
FOR EACH ROW EXECUTE FUNCTION public.handle_schedule_override_change();
