-- Review boleh diulang: latihan yang sudah direview bisa diedit lagi (mis. salah review). Penandanya diperbarui ke terapis yang terakhir mengedit.
create or replace function public.review_plan_exercise(
  p_exercise_id text, p_name text, p_grp text, p_how_to text, p_dose text
) returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_clinic uuid := public.get_my_clinic_id();
  v_name text := btrim(coalesce(p_name, ''));
  v_grp text := btrim(coalesce(p_grp, ''));
  v_therapist text;
  v_existing text;
  v_verb text;
  o record;
begin
  if v_uid is null or public.get_my_role() not in ('therapist','physiotherapist') or v_clinic is null then
    raise exception 'Hanya terapis klinik yang dapat mereview latihan' using errcode = '42501';
  end if;
  if char_length(v_name) < 3 or char_length(v_name) > 120 or v_grp = '' or char_length(v_grp) > 60 then
    raise exception 'Nama (3-120 karakter) dan jenis latihan wajib diisi' using errcode = '22023';
  end if;

  select name into v_therapist from physiotherapists where user_id = v_uid and clinic_id = v_clinic limit 1;
  if v_therapist is null then
    raise exception 'Profil terapis tidak ditemukan' using errcode = '42501';
  end if;

  perform 1 from plan_exercises where id = p_exercise_id for update;
  if not found then
    raise exception 'Latihan tidak ditemukan' using errcode = 'P0002';
  end if;

  select reviewer_name into v_existing from exercise_reviews where clinic_id = v_clinic and exercise_id = p_exercise_id;
  v_verb := case when v_existing is null then ' selesai mereview ' else ' memperbarui review ' end;

  update plan_exercises
     set name = v_name, grp = v_grp,
         how_to = nullif(btrim(coalesce(p_how_to, '')), ''),
         dose = nullif(btrim(coalesce(p_dose, '')), '')
   where id = p_exercise_id;

  insert into exercise_reviews (clinic_id, exercise_id, reviewed_by, reviewer_name)
  values (v_clinic, p_exercise_id, v_uid, v_therapist)
  on conflict (clinic_id, exercise_id) do update
    set reviewed_by = excluded.reviewed_by, reviewer_name = excluded.reviewer_name, reviewed_at = now();

  -- Notifikasi push ke owner klinik setiap ada latihan selesai direview.
  for o in select u.id from users u where u.role = 'owner' and u.clinic_id = v_clinic loop
    perform net.http_post(
      url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-push-notification',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'user_id', o.id,
        'title', case when v_existing is null then '✅ Review latihan selesai' else '✏️ Review latihan diperbarui' end,
        'body', v_therapist || v_verb || p_exercise_id || ' - ' || v_name || '.',
        'url', '/owner'
      )
    );
  end loop;

  return jsonb_build_object('exercise_id', p_exercise_id, 'reviewer_name', v_therapist);
end;
$fn$;
revoke all on function public.review_plan_exercise(text, text, text, text, text) from public, anon;
grant execute on function public.review_plan_exercise(text, text, text, text, text) to authenticated;
