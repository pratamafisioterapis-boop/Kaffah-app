-- The AFTER-STATEMENT trigger on therapist_schedules called
-- regenerate_future_slots_safe(), which deletes and rebuilds *every*
-- clinic's future therapist_slots on every single shift insert/update/
-- delete. The "auto slot generator" UI creates one shift per statement,
-- so setting up one therapist's week fires this full-database rewrite
-- many times back to back, which is slow and has repeatedly left
-- therapist_slots mid-rebuild (deleted but not fully regenerated) for
-- unrelated therapists/clinics. Scope the regeneration to the therapist
-- whose schedule actually changed, and fire it once per row instead of
-- once per statement.

create or replace function public.generate_slots_for_date_for_therapist(p_date date, p_therapist_id uuid)
 returns void
 language plpgsql
as $function$
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

create or replace function public.regenerate_future_slots_for_therapist(p_therapist_id uuid)
 returns void
 language plpgsql
as $function$
begin

  delete from therapist_slots s
  where s.therapist_id = p_therapist_id
  and s.slot_date >= current_date
  and not exists (
      select 1
      from appointments a
      where a.therapist_id = s.therapist_id
      and a.appointment_date::date = s.slot_date
      and a.appointment_date::time >= s.slot_start_time
      and a.appointment_date::time < s.slot_end_time
      and a.status in ('confirmed', 'pending', 'scheduled', 'rescheduled')
  );

  for i in 0..30 loop
    perform public.generate_slots_for_date_for_therapist(current_date + i, p_therapist_id);
  end loop;

end;
$function$;

create or replace function public.handle_schedule_change()
 returns trigger
 language plpgsql
as $function$
begin

  if TG_OP = 'DELETE' then
    perform public.regenerate_future_slots_for_therapist(OLD.therapist_id);
    return OLD;
  else
    perform public.regenerate_future_slots_for_therapist(NEW.therapist_id);
    return NEW;
  end if;

end;
$function$;

drop trigger if exists trg_schedule_change on public.therapist_schedules;

create trigger trg_schedule_change
after insert or delete or update on public.therapist_schedules
for each row execute function public.handle_schedule_change();
