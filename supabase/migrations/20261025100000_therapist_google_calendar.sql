-- Sinkron jadwal booking ke Google Calendar pribadi tiap terapis (khusus klinik Kaffah).
-- Terapis menghubungkan akun Google-nya sendiri lewat OAuth (edge function therapist-gcal-oauth-start/callback);
-- refresh token disimpan di sini dan hanya bisa dibaca service role. Setiap insert/update/delete appointment
-- milik terapis yang terhubung memanggil edge function therapist-gcal-sync lewat net.http_post. ID event Google
-- dibuat deterministik dari ID appointment ("kfh" + uuid tanpa strip), jadi tidak perlu kolom tambahan di appointments.
-- Kegagalan sinkron tidak pernah menggagalkan penyimpanan appointment.
-- Diterapkan langsung ke produksi (dqkejdamagvlhqvxaqej) lewat Supabase MCP; disimpan di sini sebagai riwayat.

create table if not exists public.therapist_google_calendars (
  physiotherapist_id uuid primary key references public.physiotherapists(id) on delete cascade,
  user_id uuid not null,
  clinic_id uuid not null references public.clinics(id),
  refresh_token text not null,
  google_email text,
  calendar_id text not null default 'primary',
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.therapist_google_calendars enable row level security;

-- Refresh token tidak boleh terbaca dari client: hanya kolom status yang di-grant.
revoke all on public.therapist_google_calendars from anon, authenticated;
grant select (physiotherapist_id, user_id, google_email, connected_at, last_synced_at, last_error)
  on public.therapist_google_calendars to authenticated;

drop policy if exists "therapist reads own google calendar link" on public.therapist_google_calendars;
create policy "therapist reads own google calendar link"
  on public.therapist_google_calendars for select to authenticated
  using (user_id = auth.uid());

create table if not exists public.therapist_gcal_oauth_states (
  state text primary key,
  physiotherapist_id uuid not null references public.physiotherapists(id) on delete cascade,
  user_id uuid not null,
  return_url text not null,
  created_at timestamptz not null default now()
);

alter table public.therapist_gcal_oauth_states enable row level security;
revoke all on public.therapist_gcal_oauth_states from anon, authenticated;

-- Secret bersama trigger -> edge function therapist-gcal-sync. Nilainya acak dan hanya ada di Vault;
-- edge function membacanya lewat RPC kaffah_gcal_sync_secret() yang hanya boleh dipanggil service role.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'gcal_sync_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'gcal_sync_secret');
  end if;
end
$$;

create or replace function public.kaffah_gcal_sync_secret()
returns text
language sql security definer
set search_path = public
as $fn$
  select decrypted_secret from vault.decrypted_secrets where name = 'gcal_sync_secret' limit 1
$fn$;

revoke all on function public.kaffah_gcal_sync_secret() from public, anon, authenticated;
grant execute on function public.kaffah_gcal_sync_secret() to service_role;

create or replace function public.kaffah_gcal_sync_appointment()
returns trigger
language plpgsql security definer
set search_path = public
as $fn$
declare
  v_kaffah constant uuid := 'bfdc3fd8-a052-4753-a5b7-229930b3237a';
  v_body jsonb;
  v_secret text;
begin
  if tg_op = 'DELETE' then
    if old.clinic_id is distinct from v_kaffah or old.therapist_id is null then return null; end if;
    if not exists (select 1 from public.therapist_google_calendars where physiotherapist_id = old.therapist_id) then
      return null;
    end if;
    v_body := jsonb_build_object('op', 'delete', 'appointment_id', old.id, 'therapist_id', old.therapist_id);
  elsif tg_op = 'INSERT' then
    if new.clinic_id is distinct from v_kaffah or new.therapist_id is null then return null; end if;
    if not exists (select 1 from public.therapist_google_calendars where physiotherapist_id = new.therapist_id) then
      return null;
    end if;
    v_body := jsonb_build_object('op', 'upsert', 'appointment_id', new.id);
  else
    if new.clinic_id is distinct from v_kaffah then return null; end if;
    if new.appointment_date is not distinct from old.appointment_date
       and new.duration_minutes is not distinct from old.duration_minutes
       and new.status is not distinct from old.status
       and new.therapist_id is not distinct from old.therapist_id
       and new.patient_id is not distinct from old.patient_id
       and new.guest_name is not distinct from old.guest_name
       and new.guest_address is not distinct from old.guest_address
       and new.service_id is not distinct from old.service_id
       and new.is_homecare is not distinct from old.is_homecare then
      return null;
    end if;
    if not exists (select 1 from public.therapist_google_calendars
                   where physiotherapist_id in (new.therapist_id, old.therapist_id)) then
      return null;
    end if;
    v_body := jsonb_build_object('op', 'upsert', 'appointment_id', new.id, 'prev_therapist_id', old.therapist_id);
  end if;

  begin
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'gcal_sync_secret' limit 1;
    perform net.http_post(
      url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/therapist-gcal-sync',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-gcal-sync-secret', coalesce(v_secret, '')),
      body := v_body);
  exception when others then
    null;
  end;
  return null;
end
$fn$;

revoke all on function public.kaffah_gcal_sync_appointment() from public, anon, authenticated;

drop trigger if exists trg_kaffah_gcal_sync on public.appointments;
create trigger trg_kaffah_gcal_sync
  after insert or update or delete on public.appointments
  for each row execute function public.kaffah_gcal_sync_appointment();
