-- Owner klinik Kaffah dapat memutar video latihan yang sudah direview terapis (hanya baca).
create policy exercise_video_assets_owner_kaffah_read on public.exercise_video_assets for select to authenticated
  using (public.get_my_role() = 'owner' and public.get_my_clinic_id() = 'bfdc3fd8-a052-4753-a5b7-229930b3237a');
create policy exercise_videos_owner_kaffah_read on storage.objects for select to authenticated
  using (bucket_id = 'exercise-videos' and public.get_my_role() = 'owner'
    and public.get_my_clinic_id() = 'bfdc3fd8-a052-4753-a5b7-229930b3237a');
