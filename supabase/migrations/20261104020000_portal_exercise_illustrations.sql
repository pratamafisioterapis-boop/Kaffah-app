-- Sambungkan foto ilustrasi latihan (exercise_illustrations) ke portal pasien Clinara.
-- 1) portal_get_program menambah has_illustration. 2) portal_illustration_path dipanggil Edge Function
--    portal-exercise-video (service role) untuk membuat tautan foto bertanda tangan.

create or replace function public.portal_get_program(p_session text)
returns jsonb
language plpgsql security definer stable
set search_path = public, extensions
as $fn$
declare s record;
begin
  select * into s from public.portal_resolve_session(p_session);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'exercise_id', e.id, 'title', e.name, 'group', e.grp, 'how_to', e.how_to,
      'dose', coalesce(p.soap_dose, e.dose), 'progression', e.progression, 'caution', e.caution,
      'has_video', exists (select 1 from public.exercise_video_assets v where v.exercise_id = e.id),
      'has_illustration', exists (select 1 from public.exercise_illustrations i where i.exercise_id = e.id),
      'done_today', exists (select 1 from public.patient_exercise_logs l
                            where l.patient_id = s.patient_id and l.exercise_id = e.id and l.done_on = current_date and l.is_done))
      order by e.id)
    from public.portal_program_items(s.patient_id) p
    join public.plan_exercises e on e.id = p.exercise_id), '[]'::jsonb);
end
$fn$;

-- Jalur foto ilustrasi, hanya untuk latihan yang ada di program pasien. TIDAK dibuka ke anon.
create or replace function public.portal_illustration_path(p_session text, p_exercise_id text)
returns text
language plpgsql security definer stable
set search_path = public, extensions
as $fn$
declare s record; v_path text;
begin
  select * into s from public.portal_resolve_session(p_session);
  select i.storage_path into v_path
    from public.exercise_illustrations i
    where i.exercise_id = p_exercise_id
      and exists (select 1 from public.portal_program_items(s.patient_id) where exercise_id = p_exercise_id);
  if v_path is null then
    raise exception 'Ilustrasi tidak tersedia' using errcode = 'P0002';
  end if;
  return v_path;
end
$fn$;
revoke all on function public.portal_illustration_path(text, text) from public, anon, authenticated;
grant execute on function public.portal_illustration_path(text, text) to service_role;
