-- Foto ilustrasi untuk latihan yang belum punya video (plan_exercises tanpa exercise_video_assets).
-- Diunggah terapis klinik Kaffah Physiotherapy. Satu foto per kode latihan; mengunggah lagi = mengganti.
create table if not exists public.exercise_illustrations (
  exercise_id text primary key references public.plan_exercises(id) on delete cascade,
  storage_path text not null,
  size_bytes bigint,
  uploaded_by uuid,
  uploader_name text,
  updated_at timestamptz not null default now()
);
alter table public.exercise_illustrations enable row level security;

revoke all on public.exercise_illustrations from public, anon, authenticated;
grant select, insert, update, delete on public.exercise_illustrations to authenticated;

-- Baca: staf klinik & super admin. Tulis: hanya terapis klinik Kaffah Physiotherapy (dan super admin).
create policy exercise_illustrations_read on public.exercise_illustrations for select to authenticated
  using (public.get_my_role() in ('super_admin','owner','admin','clinic_admin','therapist','physiotherapist'));
create policy exercise_illustrations_write on public.exercise_illustrations for all to authenticated
  using (public.get_my_role() = 'super_admin'
    or (public.get_my_role() in ('therapist','physiotherapist') and public.get_my_clinic_id() = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'))
  with check (public.get_my_role() = 'super_admin'
    or (public.get_my_role() in ('therapist','physiotherapist') and public.get_my_clinic_id() = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'));

-- Bucket privat, maks 5 MB per foto (klien sudah mengecilkan ke ~1280 px JPEG).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-illustrations', 'exercise-illustrations', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy exercise_illustrations_obj_read on storage.objects for select to authenticated
  using (bucket_id = 'exercise-illustrations'
    and public.get_my_role() in ('super_admin','owner','admin','clinic_admin','therapist','physiotherapist'));
create policy exercise_illustrations_obj_write on storage.objects for all to authenticated
  using (bucket_id = 'exercise-illustrations'
    and (public.get_my_role() = 'super_admin'
      or (public.get_my_role() in ('therapist','physiotherapist') and public.get_my_clinic_id() = 'bfdc3fd8-a052-4753-a5b7-229930b3237a')))
  with check (bucket_id = 'exercise-illustrations'
    and (public.get_my_role() = 'super_admin'
      or (public.get_my_role() in ('therapist','physiotherapist') and public.get_my_clinic_id() = 'bfdc3fd8-a052-4753-a5b7-229930b3237a')));
