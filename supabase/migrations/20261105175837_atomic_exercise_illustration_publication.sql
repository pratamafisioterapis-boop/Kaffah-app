-- Atomic publication after every approved file has been uploaded and verified.
create or replace function public.publish_exercise_illustration_steps(p_exercise_id text, p_steps jsonb)
returns void language plpgsql security invoker set search_path = public, storage as $$
declare n integer; item jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_exercise_id, 0));
  if not exists(select 1 from public.plan_exercises where id=p_exercise_id)
     or exists(select 1 from public.exercise_video_assets where exercise_id=p_exercise_id) then
    raise exception 'Exercise missing or already has video';
  end if;
  if exists(select 1 from public.exercise_illustrations where exercise_id=p_exercise_id)
     or exists(select 1 from public.exercise_illustration_steps where exercise_id=p_exercise_id) then
    raise exception 'Existing illustrations must not be overwritten';
  end if;
  if jsonb_typeof(p_steps) is distinct from 'array' then raise exception 'Steps must be an array'; end if;
  n := jsonb_array_length(p_steps);
  if n < 2 or n > 12 then raise exception 'Expected 2 to 12 steps'; end if;
  for item in select value from jsonb_array_elements(p_steps) loop
    if (item->>'step_number')::integer < 1 or (item->>'step_number')::integer > n
       or (item->>'storage_path') is distinct from p_exercise_id || '/step-' || lpad(item->>'step_number',2,'0') || '.jpg'
       or coalesce((item->>'size_bytes')::bigint,0) <= 0 then
      raise exception 'Invalid step metadata';
    end if;
    if not exists(select 1 from storage.objects where bucket_id='exercise-illustrations'
       and name=item->>'storage_path' and (metadata->>'size')::bigint=(item->>'size_bytes')::bigint) then
      raise exception 'Storage file missing or size mismatch';
    end if;
  end loop;
  insert into public.exercise_illustration_steps(exercise_id,step_number,storage_path,size_bytes)
    select p_exercise_id,(value->>'step_number')::integer,value->>'storage_path',(value->>'size_bytes')::bigint
    from jsonb_array_elements(p_steps);
  insert into public.exercise_illustrations(exercise_id,storage_path,size_bytes,uploader_name)
    select exercise_id,storage_path,size_bytes,'Clinara automated illustration pipeline'
    from public.exercise_illustration_steps where exercise_id=p_exercise_id and step_number=1;
end $$;
revoke all on function public.publish_exercise_illustration_steps(text,jsonb) from public,anon,authenticated;
grant execute on function public.publish_exercise_illustration_steps(text,jsonb) to service_role;
