-- Push notification ke terapis pasien dan owner klinik saat pasien mengirim chat atau keluhan dari portal Clinara.
-- Pola sama dengan notifikasi lain (net.http_post ke send-push-notification); kegagalan kirim tidak menggagalkan
-- pesan/keluhan pasien. Terapis tujuan = terapis di rekap harian terbaru pasien tersebut.
-- Diterapkan langsung ke produksi (dqkejdamagvlhqvxaqej) lewat Supabase MCP; disimpan di sini sebagai riwayat.

create or replace function public.portal_notify_staff(p_clinic_id uuid, p_patient_id uuid, p_title text, p_body text)
returns void
language plpgsql security definer
set search_path = public
as $fn$
declare v_target record;
begin
  for v_target in
    select u.id as user_id, 'owner'::text as kind
      from public.users u where u.role = 'owner' and u.clinic_id = p_clinic_id
    union
    select ph.user_id, 'therapist'
      from public.physiotherapists ph
      where ph.user_id is not null and ph.clinic_id = p_clinic_id
        and ph.id = (select dr.therapist_id from public.daily_recaps dr
                     where dr.patient_id = p_patient_id and dr.therapist_id is not null
                     order by dr.recap_date desc, dr.created_at desc limit 1)
  loop
    begin
      perform net.http_post(
        url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-push-notification',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'user_id', v_target.user_id,
          'title', p_title,
          'body', p_body,
          'url', case when v_target.kind = 'owner' then '/owner/clinara-pasien' else '/therapist/clinara-pasien' end));
    exception when others then
      null;
    end;
  end loop;
end
$fn$;

create or replace function public.portal_notify_new_message()
returns trigger
language plpgsql security definer
set search_path = public
as $fn$
declare v_name text;
begin
  if new.sender <> 'patient' then return new; end if;
  select coalesce(nullif(nickname, ''), full_name, 'Pasien') into v_name from public.patients where id = new.patient_id;
  perform public.portal_notify_staff(new.clinic_id, new.patient_id,
    '💬 Pesan dari ' || coalesce(v_name, 'pasien'), left(new.body, 140));
  return new;
end
$fn$;

create or replace function public.portal_notify_new_feedback()
returns trigger
language plpgsql security definer
set search_path = public
as $fn$
declare v_name text;
begin
  select coalesce(nullif(nickname, ''), full_name, 'Pasien') into v_name from public.patients where id = new.patient_id;
  perform public.portal_notify_staff(new.clinic_id, new.patient_id,
    '📝 Keluhan baru dari ' || coalesce(v_name, 'pasien'),
    coalesce(nullif(concat_ws(' · ', case when new.vas is not null then 'Nyeri ' || new.vas || '/10' end,
                              nullif(left(btrim(coalesce(new.message, '')), 100), '')), ''), 'Keluhan baru dari aplikasi pasien'));
  return new;
end
$fn$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'portal_message_push' and tgrelid = 'public.patient_portal_messages'::regclass) then
    create trigger portal_message_push after insert on public.patient_portal_messages
      for each row execute function public.portal_notify_new_message();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'portal_feedback_push' and tgrelid = 'public.patient_portal_feedback'::regclass) then
    create trigger portal_feedback_push after insert on public.patient_portal_feedback
      for each row execute function public.portal_notify_new_feedback();
  end if;
end
$$;

-- Fungsi ini hanya dipanggil trigger; tidak boleh bisa dipanggil klien (bisa dipakai mengirim push palsu).
revoke execute on function public.portal_notify_staff(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.portal_notify_new_message() from public, anon, authenticated;
revoke execute on function public.portal_notify_new_feedback() from public, anon, authenticated;
