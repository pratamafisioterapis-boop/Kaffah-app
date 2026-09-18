-- The override's start/end window was being inserted into therapist_slots
-- as a single row spanning the whole window (e.g. 09:00-16:30 as ONE slot
-- with capacity 5), unlike the weekly template which slices its open/close
-- window into duration-sized bookable slots. That meant a booking screen
-- showed one giant block for the day instead of individual time slots.
-- Add slot_duration_minutes/gap_minutes to the override (mirroring the
-- weekly auto-slice inputs) and slice the override window the same way.

ALTER TABLE public.therapist_schedule_overrides
  ADD COLUMN IF NOT EXISTS slot_duration_minutes integer NOT NULL DEFAULT 60;

ALTER TABLE public.therapist_schedule_overrides
  ADD CONSTRAINT therapist_schedule_overrides_slot_duration_check CHECK (slot_duration_minutes BETWEEN 5 AND 480);

ALTER TABLE public.therapist_schedule_overrides
  ADD COLUMN IF NOT EXISTS gap_minutes integer NOT NULL DEFAULT 0;

ALTER TABLE public.therapist_schedule_overrides
  ADD CONSTRAINT therapist_schedule_overrides_gap_check CHECK (gap_minutes BETWEEN 0 AND 120);

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
        v_cursor,
        v_slot_end,
        v_override.slot_duration_minutes,
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
          and s.slot_start_time = v_cursor
          and s.slot_end_time = v_slot_end
        );

      v_cursor := v_slot_end + v_gap_dur;
    END LOOP;

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

CREATE OR REPLACE FUNCTION public.generate_slots_for_date(p_date date)
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

  FOR v_override IN
    SELECT o.* FROM therapist_schedule_overrides o
    JOIN physiotherapists p ON p.id = o.therapist_id
    WHERE o.override_date = p_date
      AND o.end_time IS NOT NULL
      AND p.is_active = true
  LOOP
    v_slot_dur := (v_override.slot_duration_minutes || ' minutes')::interval;
    v_gap_dur := (v_override.gap_minutes || ' minutes')::interval;
    v_cursor := v_override.start_time;

    WHILE v_cursor + v_slot_dur <= v_override.end_time LOOP
      v_slot_end := v_cursor + v_slot_dur;

      insert into therapist_slots (
        therapist_id,
        slot_date,
        slot_start_time,
        slot_end_time,
        duration_minutes,
        capacity
      )
      select
        v_override.therapist_id,
        p_date,
        v_cursor,
        v_slot_end,
        v_override.slot_duration_minutes,
        v_override.capacity
      where not exists (
          select 1
          from therapist_time_off tto
          where tto.therapist_id = v_override.therapist_id
          and p_date between tto.start_date and tto.end_date
        )
        and not exists (
          select 1
          from therapist_slots s
          where s.therapist_id = v_override.therapist_id
          and s.slot_date = p_date
          and s.slot_start_time = v_cursor
          and s.slot_end_time = v_slot_end
        );

      v_cursor := v_slot_end + v_gap_dur;
    END LOOP;
  END LOOP;

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
