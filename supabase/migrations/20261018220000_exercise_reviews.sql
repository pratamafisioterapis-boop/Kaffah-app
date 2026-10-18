-- Review katalog latihan (plan_exercises) oleh terapis klinik. Satu latihan cukup direview satu terapis;
-- yang sudah direview ditandai (siapa + kapan) sehingga terapis lain tidak perlu mengulang.
-- Terapis hanya boleh mengubah nama, jenis (grp), cara melakukan, dan dosis. Kode, progresi, dan perhatian tetap.
create table if not exists public.exercise_reviews (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  exercise_id text not null references public.plan_exercises(id) on delete cascade,
  reviewed_by uuid not null,
  reviewer_name text not null,
  reviewed_at timestamptz not null default now(),
  primary key (clinic_id, exercise_id)
);
alter table public.exercise_reviews enable row level security;

create policy exercise_reviews_read on public.exercise_reviews for select to authenticated
  using (public.get_my_role() = 'super_admin'
    or (public.get_my_role() in ('owner','admin','clinic_admin','therapist','physiotherapist') and clinic_id = public.get_my_clinic_id()));

revoke all on public.exercise_reviews from public, anon, authenticated;
grant select on public.exercise_reviews to authenticated;

-- Terapis perlu memutar video latihan saat mereview, terlepas dari status Link Clinara klinik. Hanya baca.
create policy exercise_video_assets_therapist_read on public.exercise_video_assets for select to authenticated
  using (public.get_my_role() in ('therapist','physiotherapist'));
create policy exercise_videos_therapist_read on storage.objects for select to authenticated
  using (bucket_id = 'exercise-videos' and public.get_my_role() in ('therapist','physiotherapist'));

-- Simpan hasil review secara atomik. Gagal jika latihan sudah direview terapis lain (race antar terapis).
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
  if v_existing is not null then
    raise exception 'Latihan ini sudah direview oleh %', v_existing using errcode = 'P0001';
  end if;

  update plan_exercises
     set name = v_name, grp = v_grp,
         how_to = nullif(btrim(coalesce(p_how_to, '')), ''),
         dose = nullif(btrim(coalesce(p_dose, '')), '')
   where id = p_exercise_id;

  insert into exercise_reviews (clinic_id, exercise_id, reviewed_by, reviewer_name)
  values (v_clinic, p_exercise_id, v_uid, v_therapist);

  -- Notifikasi push ke owner klinik setiap ada latihan selesai direview.
  for o in select u.id from users u where u.role = 'owner' and u.clinic_id = v_clinic loop
    perform net.http_post(
      url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-push-notification',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'user_id', o.id,
        'title', '✅ Review latihan selesai',
        'body', v_therapist || ' selesai mereview ' || p_exercise_id || ' - ' || v_name || '.',
        'url', '/owner'
      )
    );
  end loop;

  return jsonb_build_object('exercise_id', p_exercise_id, 'reviewer_name', v_therapist);
end;
$fn$;
revoke all on function public.review_plan_exercise(text, text, text, text, text) from public, anon;
grant execute on function public.review_plan_exercise(text, text, text, text, text) to authenticated;
