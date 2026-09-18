-- regenerate_slots_for_therapist_date previously protected ANY slot that
-- had a confirmed/pending appointment inside it, unconditionally. When an
-- override applies a different slot granularity than the weekly template
-- (e.g. 90-minute override slices vs the old 60-minute weekly shifts), the
-- old booked weekly-shift row was left in place alongside the new
-- override-sliced rows, so the same wall-clock time was represented by two
-- overlapping therapist_slots rows. get_available_slots_with_status_by_date
-- only marks the row whose slot_start_time exactly equals the appointment
-- start as 'terisi' and defers on overlap-only matches when such an exact
-- row exists elsewhere, so the leftover coarse-grained row kept showing as
-- 'aktif' (bookable) even though it covered an already-booked time.
--
-- Fix: when an override with an end_time applies to the date, a booked
-- slot's protection now only holds if that booking falls OUTSIDE the
-- override's own start/end window. A booking inside the window gets its
-- old covering row deleted and picked back up by the freshly generated
-- override slot that covers the same time (matched by time, not by row),
-- so there is exactly one row per time region again. Bookings outside the
-- override window (an edge case) keep the previous protective behavior, as
-- does the no-override (reverting to weekly template) case.
CREATE OR REPLACE FUNCTION public.regenerate_slots_for_therapist_date(p_therapist_id uuid, p_date date)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_override record;
  v_has_override boolean;
begin
  SELECT * INTO v_override
  FROM therapist_schedule_overrides
  WHERE therapist_id = p_therapist_id
    AND override_date = p_date
    AND end_time IS NOT NULL;
  v_has_override := FOUND;

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
      and (
        NOT v_has_override
        OR a.appointment_date::time < v_override.start_time
        OR a.appointment_date::time >= v_override.end_time
      )
  );

  perform public.generate_slots_for_date_for_therapist(p_date, p_therapist_id);
end;
$function$;
