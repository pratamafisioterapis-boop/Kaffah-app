-- USULAN, BELUM DITERAPKAN. Fondasi portal pasien Clinara: tautan akses +
-- verifikasi tanggal lahir, progres, home program, keluhan, dan chat.
--
-- Aturan penulisan file ini:
--   * Tanpa DROP. Semua objek baru; fungsi memakai CREATE OR REPLACE.
--   * Tubuh fungsi memakai $fn$ (bukan $$).
--   * Tahap dipisah per bagian supaya mudah dijalankan satu per satu di SQL
--     Editor kalau ada yang ditolak/timeout lewat tool MCP.
--
-- Prinsip keamanan:
--   * Pasien TIDAK login dan TIDAK punya akses ke tabel apa pun. Semua akses
--     lewat fungsi SECURITY DEFINER yang memeriksa token + tanggal lahir
--     (portal_verify) lalu memakai token sesi pendek (portal_*).
--   * Token tautan dan token sesi tidak disimpan mentah, hanya hash SHA-256.
--   * Percobaan salah dihitung dan dikembalikan sebagai hasil (bukan RAISE),
--     karena RAISE akan membatalkan UPDATE penghitung itu sendiri.
--   * Yang dibuka ke anon hanya: portal_get_branding, portal_verify, dan fungsi
--     portal_* yang butuh token sesi. Tidak ada tabel yang dibuka ke anon.
--   * Pasien hanya melihat data yang sengaja diisi terapis (progres, catatan
--     untuk pasien), bukan SOAP/rekam medis mentah.
--
-- Memakai yang sudah ada: patients (birth_date, phone, clinic_id), clinics
-- (logo_url, landing_primary_color), exercises + exercise_videos (perpustakaan
-- video, saat ini kosong), appointments, get_my_role(), get_my_clinic_id().
-- Catatan: patient_feedback_links/responses adalah alur rating Google Review,
-- BUKAN keluhan klinis, jadi tidak dipakai di sini.

-- =============================================================== TAHAP 1: brand
alter table public.clinics
  add column if not exists portal_brand_color text
  check (portal_brand_color is null or portal_brand_color ~ '^#[0-9a-fA-F]{6}$');
comment on column public.clinics.portal_brand_color is
  'Satu warna brand untuk aplikasi pasien Clinara. Kosong = pakai landing_primary_color.';

-- =============================================================== TAHAP 2: tabel
create table if not exists public.patient_portal_links (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active','locked','revoked')),
  failed_attempts smallint not null default 0,
  locked_at timestamptz,
  expires_at timestamptz,
  last_opened_at timestamptz,
  sent_via text,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
-- satu tautan hidup (aktif atau terkunci) per pasien
create unique index if not exists patient_portal_links_one_live_per_patient
  on public.patient_portal_links (patient_id) where status <> 'revoked';
create index if not exists patient_portal_links_clinic_idx on public.patient_portal_links (clinic_id);

create table if not exists public.patient_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.patient_portal_links(id) on delete cascade,
  session_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists patient_portal_sessions_link_idx on public.patient_portal_sessions (link_id);
create index if not exists patient_portal_sessions_exp_idx on public.patient_portal_sessions (expires_at);

create table if not exists public.patient_progress_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  entry_date date not null default current_date,
  vas smallint check (vas between 0 and 10),
  -- ukuran fleksibel per regio tubuh, mis.
  -- [{"key":"knee_flexion","label":"Fleksi lutut","unit":"°","value":118,"target":130,"start":75}]
  measures jsonb not null default '[]'::jsonb,
  note_for_patient text,
  visible_to_patient boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists patient_progress_patient_idx on public.patient_progress_entries (patient_id, entry_date);
create index if not exists patient_progress_clinic_idx on public.patient_progress_entries (clinic_id);

create table if not exists public.patient_home_programs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  sets_reps text,
  notes text,
  is_active boolean not null default true,
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  unique (patient_id, exercise_id)
);
create index if not exists patient_home_programs_clinic_idx on public.patient_home_programs (clinic_id);
create index if not exists patient_home_programs_exercise_idx on public.patient_home_programs (exercise_id);

create table if not exists public.patient_exercise_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  program_id uuid not null references public.patient_home_programs(id) on delete cascade,
  done_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (program_id, done_on)
);
create index if not exists patient_exercise_logs_patient_idx on public.patient_exercise_logs (patient_id, done_on);
create index if not exists patient_exercise_logs_clinic_idx on public.patient_exercise_logs (clinic_id);

create table if not exists public.patient_portal_feedback (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  vas smallint check (vas between 0 and 10),
  tags text[] not null default '{}',
  message text check (message is null or char_length(message) <= 2000),
  status text not null default 'new' check (status in ('new','reviewed')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists patient_portal_feedback_patient_idx on public.patient_portal_feedback (patient_id, created_at desc);
create index if not exists patient_portal_feedback_clinic_idx on public.patient_portal_feedback (clinic_id, status);

create table if not exists public.patient_portal_messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  sender text not null check (sender in ('patient','therapist')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists patient_portal_messages_thread_idx on public.patient_portal_messages (patient_id, created_at);
create index if not exists patient_portal_messages_clinic_idx on public.patient_portal_messages (clinic_id);

-- =============================================================== TAHAP 3: RLS dan hak akses tabel
alter table public.patient_portal_links enable row level security;
alter table public.patient_portal_sessions enable row level security;
alter table public.patient_progress_entries enable row level security;
alter table public.patient_home_programs enable row level security;
alter table public.patient_exercise_logs enable row level security;
alter table public.patient_portal_feedback enable row level security;
alter table public.patient_portal_messages enable row level security;

-- Staf klinik. Sesi: tanpa policy sama sekali (hanya fungsi SECURITY DEFINER).
-- Tautan: staf hanya boleh membaca; tulis lewat portal_create_link / portal_set_link_status.
create policy portal_links_staff_read on public.patient_portal_links for select
  using (get_my_role() = 'super_admin'
    or (get_my_role() in ('owner','admin','clinic_admin','therapist') and clinic_id = get_my_clinic_id()));

create policy portal_progress_staff on public.patient_progress_entries for all
  using (get_my_role() = 'super_admin'
    or (get_my_role() in ('owner','admin','clinic_admin','therapist') and clinic_id = get_my_clinic_id()))
  with check (get_my_role() = 'super_admin'
    or (get_my_role() in ('owner','admin','clinic_admin','therapist') and clinic_id = get_my_clinic_id()));

create policy portal_programs_staff on public.patient_home_programs for all
  using (get_my_role() = 'super_admin'
    or (get_my_role() in ('owner','admin','clinic_admin','therapist') and clinic_id = get_my_clinic_id()))
  with check (get_my_role() = 'super_admin'
    or (get_my_role() in ('owner','admin','clinic_admin','therapist') and clinic_id = get_my_clinic_id()));

create policy portal_logs_staff_read on public.patient_exercise_logs for select
  using (get_my_role() = 'super_admin'
    or (get_my_role() in ('owner','admin','clinic_admin','therapist') and clinic_id = get_my_clinic_id()));

create policy portal_feedback_staff on public.patient_portal_feedback for all
  using (get_my_role() = 'super_admin'
    or (get_my_role() in ('owner','admin','clinic_admin','therapist') and clinic_id = get_my_clinic_id()))
  with check (get_my_role() = 'super_admin'
    or (get_my_role() in ('owner','admin','clinic_admin','therapist') and clinic_id = get_my_clinic_id()));

-- Pesan: staf hanya boleh mengirim sebagai 'therapist'; pesan pasien masuk lewat RPC.
create policy portal_messages_staff_read on public.patient_portal_messages for select
  using (get_my_role() = 'super_admin'
    or (get_my_role() in ('owner','admin','clinic_admin','therapist') and clinic_id = get_my_clinic_id()));
create policy portal_messages_staff_send on public.patient_portal_messages for insert
  with check (sender = 'therapist'
    and (get_my_role() = 'super_admin'
      or (get_my_role() in ('owner','admin','clinic_admin','therapist') and clinic_id = get_my_clinic_id())));
create policy portal_messages_staff_mark_read on public.patient_portal_messages for update
  using (get_my_role() = 'super_admin'
    or (get_my_role() in ('owner','admin','clinic_admin','therapist') and clinic_id = get_my_clinic_id()))
  with check (get_my_role() = 'super_admin'
    or (get_my_role() in ('owner','admin','clinic_admin','therapist') and clinic_id = get_my_clinic_id()));

-- Cabut hak bawaan Supabase (default privileges memberi anon/authenticated),
-- lalu beri hanya yang perlu ke authenticated; anon tidak dapat apa-apa.
revoke all on public.patient_portal_links, public.patient_portal_sessions,
  public.patient_progress_entries, public.patient_home_programs,
  public.patient_exercise_logs, public.patient_portal_feedback,
  public.patient_portal_messages from public, anon, authenticated;
grant select on public.patient_portal_links to authenticated;
grant select, insert, update, delete on public.patient_progress_entries,
  public.patient_home_programs, public.patient_portal_feedback to authenticated;
grant select on public.patient_exercise_logs to authenticated;
grant select, insert, update on public.patient_portal_messages to authenticated;

do $do$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.patient_portal_messages;
  end if;
end
$do$;

-- =============================================================== TAHAP 4: fungsi internal
create or replace function public.portal_hash(p_text text)
returns text language sql immutable
set search_path = public, extensions
as $fn$ select encode(digest(convert_to(coalesce(p_text, ''), 'utf8'), 'sha256'), 'hex') $fn$;

create or replace function public.portal_new_token()
returns text language sql volatile
set search_path = public, extensions
as $fn$ select translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_') $fn$;

-- Menerjemahkan token sesi ke (link, pasien, klinik). RAISE di sini aman karena tidak ada yang diubah.
create or replace function public.portal_resolve_session(p_session text)
returns table (link_id uuid, patient_id uuid, clinic_id uuid)
language plpgsql security definer
set search_path = public, extensions
as $fn$
begin
  return query
    select l.id, l.patient_id, l.clinic_id
    from public.patient_portal_sessions s
    join public.patient_portal_links l on l.id = s.link_id
    where s.session_hash = public.portal_hash(p_session)
      and s.expires_at > now()
      and l.status = 'active'
      and (l.expires_at is null or l.expires_at > now());
  if not found then
    raise exception 'Sesi tidak valid atau sudah berakhir' using errcode = '28000';
  end if;
end
$fn$;

-- =============================================================== TAHAP 5: fungsi staf (authenticated)
create or replace function public.portal_create_link(p_patient_id uuid, p_valid_days int default 90)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $fn$
declare
  v_role text := get_my_role();
  v_patient public.patients%rowtype;
  v_token text;
  v_link uuid;
  v_exp timestamptz;
begin
  if v_role is null or v_role not in ('super_admin','owner','admin','clinic_admin','therapist') then
    raise exception 'Tidak berwenang' using errcode = '42501';
  end if;
  select * into v_patient from public.patients where id = p_patient_id;
  if not found or (v_role <> 'super_admin' and v_patient.clinic_id is distinct from get_my_clinic_id()) then
    raise exception 'Pasien tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_patient.birth_date is null then
    raise exception 'Tanggal lahir pasien belum diisi' using errcode = 'P0001';
  end if;

  update public.patient_portal_links set status = 'revoked'
    where patient_id = p_patient_id and status <> 'revoked';

  v_token := public.portal_new_token();
  v_exp := now() + make_interval(days => greatest(1, least(coalesce(p_valid_days, 90), 365)));
  insert into public.patient_portal_links (clinic_id, patient_id, token_hash, expires_at, created_by)
    values (v_patient.clinic_id, p_patient_id, public.portal_hash(v_token), v_exp, auth.uid())
    returning id into v_link;

  -- token mentah hanya dikembalikan di sini, sekali.
  return jsonb_build_object('link_id', v_link, 'token', v_token, 'expires_at', v_exp,
    'patient_name', v_patient.full_name, 'phone', v_patient.phone);
end
$fn$;

create or replace function public.portal_set_link_status(p_link_id uuid, p_status text)
returns void
language plpgsql security definer
set search_path = public, extensions
as $fn$
declare
  v_role text := get_my_role();
  v_link public.patient_portal_links%rowtype;
begin
  if v_role is null or v_role not in ('super_admin','owner','admin','clinic_admin','therapist') then
    raise exception 'Tidak berwenang' using errcode = '42501';
  end if;
  if p_status not in ('active','locked','revoked') then
    raise exception 'Status tidak dikenal' using errcode = '22023';
  end if;
  select * into v_link from public.patient_portal_links where id = p_link_id;
  if not found or (v_role <> 'super_admin' and v_link.clinic_id is distinct from get_my_clinic_id()) then
    raise exception 'Tautan tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_link.status = 'revoked' then
    raise exception 'Tautan sudah dicabut, buat tautan baru' using errcode = 'P0001';
  end if;
  update public.patient_portal_links
    set status = p_status,
        failed_attempts = case when p_status = 'active' then 0 else failed_attempts end,
        locked_at = case when p_status = 'locked' then now() else null end
    where id = p_link_id;
end
$fn$;

create or replace function public.portal_mark_link_sent(p_link_id uuid, p_via text default 'whatsapp')
returns void
language plpgsql security definer
set search_path = public, extensions
as $fn$
declare v_role text := get_my_role();
begin
  if v_role is null or v_role not in ('super_admin','owner','admin','clinic_admin','therapist') then
    raise exception 'Tidak berwenang' using errcode = '42501';
  end if;
  update public.patient_portal_links
    set sent_via = left(coalesce(p_via, 'whatsapp'), 30), sent_at = now()
    where id = p_link_id and (v_role = 'super_admin' or clinic_id = get_my_clinic_id());
end
$fn$;

-- =============================================================== TAHAP 6: fungsi pasien (anon)
-- Sebelum verifikasi: hanya brand klinik, tanpa nama pasien.
create or replace function public.portal_get_branding(p_token text)
returns jsonb
language plpgsql security definer stable
set search_path = public, extensions
as $fn$
declare v_link public.patient_portal_links%rowtype; v_c record; v_status text;
begin
  select * into v_link from public.patient_portal_links where token_hash = public.portal_hash(p_token);
  if not found or v_link.status = 'revoked' then
    return jsonb_build_object('status', 'invalid');
  end if;
  v_status := case when v_link.status = 'locked' then 'locked'
                   when v_link.expires_at is not null and v_link.expires_at <= now() then 'expired'
                   else 'active' end;
  select name, logo_url, coalesce(portal_brand_color, landing_primary_color) as color
    into v_c from public.clinics where id = v_link.clinic_id;
  return jsonb_build_object('status', v_status, 'clinic_name', v_c.name,
    'logo_url', v_c.logo_url, 'brand_color', v_c.color);
end
$fn$;

create or replace function public.portal_verify(p_token text, p_birth_date date)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $fn$
declare
  v_link public.patient_portal_links%rowtype;
  v_pat record;
  v_fail smallint;
  v_session text;
  v_exp timestamptz := now() + interval '12 hours';
begin
  select * into v_link from public.patient_portal_links
    where token_hash = public.portal_hash(p_token) for update;
  if not found or v_link.status = 'revoked' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if v_link.status = 'locked' then
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;
  if v_link.expires_at is not null and v_link.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  select birth_date, coalesce(nullif(nickname, ''), split_part(full_name, ' ', 1)) as first_name
    into v_pat from public.patients where id = v_link.patient_id;

  if v_pat.birth_date is null or p_birth_date is distinct from v_pat.birth_date then
    v_fail := v_link.failed_attempts + 1;
    update public.patient_portal_links
      set failed_attempts = v_fail,
          status = case when v_fail >= 5 then 'locked' else status end,
          locked_at = case when v_fail >= 5 then now() else locked_at end
      where id = v_link.id;
    return jsonb_build_object('ok', false,
      'reason', case when v_fail >= 5 then 'locked' else 'mismatch' end,
      'remaining', greatest(0, 5 - v_fail));
  end if;

  v_session := public.portal_new_token();
  update public.patient_portal_links set failed_attempts = 0, last_opened_at = now() where id = v_link.id;
  insert into public.patient_portal_sessions (link_id, session_hash, expires_at)
    values (v_link.id, public.portal_hash(v_session), v_exp);
  return jsonb_build_object('ok', true, 'session', v_session, 'expires_at', v_exp,
    'first_name', v_pat.first_name);
end
$fn$;

create or replace function public.portal_logout(p_session text)
returns void
language sql security definer
set search_path = public, extensions
as $fn$ delete from public.patient_portal_sessions where session_hash = public.portal_hash(p_session) $fn$;

create or replace function public.portal_get_home(p_session text)
returns jsonb
language plpgsql security definer stable
set search_path = public, extensions
as $fn$
declare
  s record; v_pat record; v_c record; v_next jsonb; v_note text;
  v_total int; v_done int; v_unread int; v_vas jsonb;
begin
  select * into s from public.portal_resolve_session(p_session);
  select coalesce(nullif(nickname, ''), split_part(full_name, ' ', 1)) as first_name into v_pat
    from public.patients where id = s.patient_id;
  select name, logo_url, coalesce(portal_brand_color, landing_primary_color) as color into v_c
    from public.clinics where id = s.clinic_id;

  select jsonb_build_object('appointment_date', a.appointment_date, 'therapist', t.name)
    into v_next
    from public.appointments a left join public.physiotherapists t on t.id = a.therapist_id
    where a.patient_id = s.patient_id and a.appointment_date > now() and a.status = 'confirmed'
    order by a.appointment_date limit 1;

  select note_for_patient into v_note from public.patient_progress_entries
    where patient_id = s.patient_id and visible_to_patient and note_for_patient is not null
    order by entry_date desc, created_at desc limit 1;

  select coalesce(jsonb_agg(vas order by entry_date, created_at), '[]'::jsonb) into v_vas
    from (select vas, entry_date, created_at from public.patient_progress_entries
          where patient_id = s.patient_id and visible_to_patient and vas is not null
          order by entry_date desc, created_at desc limit 12) x;

  select count(*), count(l.id) into v_total, v_done
    from public.patient_home_programs p
    left join public.patient_exercise_logs l on l.program_id = p.id and l.done_on = current_date
    where p.patient_id = s.patient_id and p.is_active;

  select count(*) into v_unread from public.patient_portal_messages
    where patient_id = s.patient_id and sender = 'therapist' and read_at is null;

  return jsonb_build_object('first_name', v_pat.first_name,
    'clinic', jsonb_build_object('name', v_c.name, 'logo_url', v_c.logo_url, 'brand_color', v_c.color),
    'next_appointment', v_next, 'latest_note', v_note, 'vas_series', v_vas,
    'program_total', v_total, 'program_done_today', v_done, 'unread_messages', v_unread);
end
$fn$;

create or replace function public.portal_get_progress(p_session text)
returns jsonb
language plpgsql security definer stable
set search_path = public, extensions
as $fn$
declare s record;
begin
  select * into s from public.portal_resolve_session(p_session);
  return coalesce((select jsonb_agg(jsonb_build_object('date', entry_date, 'vas', vas,
            'measures', measures, 'note', note_for_patient) order by entry_date, created_at)
    from public.patient_progress_entries
    where patient_id = s.patient_id and visible_to_patient), '[]'::jsonb);
end
$fn$;

create or replace function public.portal_get_program(p_session text)
returns jsonb
language plpgsql security definer stable
set search_path = public, extensions
as $fn$
declare s record;
begin
  select * into s from public.portal_resolve_session(p_session);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'program_id', p.id, 'title', e.title, 'description', e.description,
      'duration_seconds', e.duration_seconds, 'sets_reps', p.sets_reps, 'notes', p.notes,
      'video_url', (select v.video_url from public.exercise_videos v where v.exercise_id = e.id
                    order by v.created_at limit 1),
      'done_today', exists (select 1 from public.patient_exercise_logs l
                            where l.program_id = p.id and l.done_on = current_date))
      order by p.assigned_at)
    from public.patient_home_programs p join public.exercises e on e.id = p.exercise_id
    where p.patient_id = s.patient_id and p.is_active), '[]'::jsonb);
end
$fn$;

create or replace function public.portal_log_exercise(p_session text, p_program_id uuid, p_done boolean)
returns void
language plpgsql security definer
set search_path = public, extensions
as $fn$
declare s record;
begin
  select * into s from public.portal_resolve_session(p_session);
  if not exists (select 1 from public.patient_home_programs
                 where id = p_program_id and patient_id = s.patient_id and is_active) then
    raise exception 'Latihan tidak ditemukan' using errcode = 'P0002';
  end if;
  if p_done then
    insert into public.patient_exercise_logs (clinic_id, patient_id, program_id)
      values (s.clinic_id, s.patient_id, p_program_id)
      on conflict (program_id, done_on) do nothing;
  else
    delete from public.patient_exercise_logs
      where program_id = p_program_id and patient_id = s.patient_id and done_on = current_date;
  end if;
end
$fn$;

create or replace function public.portal_submit_feedback(p_session text, p_vas int, p_tags text[], p_message text)
returns void
language plpgsql security definer
set search_path = public, extensions
as $fn$
declare s record;
begin
  select * into s from public.portal_resolve_session(p_session);
  if p_vas is null or p_vas not between 0 and 10 then
    raise exception 'Nilai nyeri harus 0 sampai 10' using errcode = '22023';
  end if;
  if (select count(*) from public.patient_portal_feedback
      where patient_id = s.patient_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Terlalu banyak laporan hari ini' using errcode = 'P0001';
  end if;
  insert into public.patient_portal_feedback (clinic_id, patient_id, vas, tags, message)
    values (s.clinic_id, s.patient_id, p_vas::smallint,
            coalesce((select array_agg(left(t, 60)) from unnest(p_tags[1:10]) t), '{}'),
            left(p_message, 2000));
end
$fn$;

create or replace function public.portal_list_messages(p_session text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $fn$
declare s record;
begin
  select * into s from public.portal_resolve_session(p_session);
  update public.patient_portal_messages set read_at = now()
    where patient_id = s.patient_id and sender = 'therapist' and read_at is null;
  return coalesce((select jsonb_agg(jsonb_build_object('sender', sender, 'body', body, 'at', created_at)
                                    order by created_at)
    from (select * from public.patient_portal_messages where patient_id = s.patient_id
          order by created_at desc limit 200) m), '[]'::jsonb);
end
$fn$;

create or replace function public.portal_send_message(p_session text, p_body text)
returns void
language plpgsql security definer
set search_path = public, extensions
as $fn$
declare s record; v_body text := btrim(coalesce(p_body, ''));
begin
  select * into s from public.portal_resolve_session(p_session);
  if char_length(v_body) not between 1 and 2000 then
    raise exception 'Pesan kosong atau terlalu panjang' using errcode = '22023';
  end if;
  if (select count(*) from public.patient_portal_messages
      where patient_id = s.patient_id and sender = 'patient' and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Terlalu banyak pesan, coba lagi nanti' using errcode = 'P0001';
  end if;
  insert into public.patient_portal_messages (clinic_id, patient_id, sender, body)
    values (s.clinic_id, s.patient_id, 'patient', v_body);
end
$fn$;

-- Pembersih sesi kedaluwarsa. Jadwalkan lewat pg_cron (mis. harian) di SQL Editor.
create or replace function public.portal_cleanup_expired()
returns void
language sql security definer
set search_path = public
as $fn$ delete from public.patient_portal_sessions where expires_at < now() - interval '1 day' $fn$;

-- =============================================================== TAHAP 7: hak eksekusi fungsi
-- Default Supabase memberi EXECUTE ke anon pada fungsi baru. Cabut semua dulu.
revoke execute on function
  public.portal_hash(text), public.portal_new_token(), public.portal_resolve_session(text),
  public.portal_create_link(uuid, int), public.portal_set_link_status(uuid, text),
  public.portal_mark_link_sent(uuid, text), public.portal_get_branding(text),
  public.portal_verify(text, date), public.portal_logout(text), public.portal_get_home(text),
  public.portal_get_progress(text), public.portal_get_program(text),
  public.portal_log_exercise(text, uuid, boolean), public.portal_submit_feedback(text, int, text[], text),
  public.portal_list_messages(text), public.portal_send_message(text, text),
  public.portal_cleanup_expired()
from public, anon, authenticated;

-- Staf
grant execute on function public.portal_create_link(uuid, int),
  public.portal_set_link_status(uuid, text), public.portal_mark_link_sent(uuid, text) to authenticated;
-- Pasien (anon). portal_hash/new_token/resolve_session/cleanup sengaja TIDAK dibuka.
grant execute on function public.portal_get_branding(text), public.portal_verify(text, date),
  public.portal_logout(text), public.portal_get_home(text), public.portal_get_progress(text),
  public.portal_get_program(text), public.portal_log_exercise(text, uuid, boolean),
  public.portal_submit_feedback(text, int, text[], text), public.portal_list_messages(text),
  public.portal_send_message(text, text) to anon;
