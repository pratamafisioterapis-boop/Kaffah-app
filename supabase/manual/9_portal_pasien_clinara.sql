-- SUDAH DITERAPKAN ke produksi (17 Okt 2026) lewat apply_migration per tahap, nama
-- migrasi portal_pasien_1 ... portal_pasien_8. Fitur nonaktif di semua klinik sampai Super
-- Admin mengaktifkannya (clinics.patient_portal_enabled). File ini adalah salinan acuan.
-- Catatan: dijalankan di Supabase SQL Editor, skrip utuh ini gagal dengan error
-- 'relation "v_patient" does not exist' (penyebab belum jelas; tidak terjadi di Postgres lokal
-- maupun lewat apply_migration). Jika perlu dijalankan ulang di SQL Editor, jalankan per tahap.
--
-- Fondasi portal pasien Clinara.
--
-- Sumber data tampilan pasien adalah SOAP yang sudah ada (medical_records):
--   * Riwayat sesi + grafik nyeri: baris "Nyeri 0-10: sekarang N" / NPRS di kolom
--     objective (pola yang sama dengan ObjectiveProgressUpdate.jsx), dan baris
--     "Update Kondisi: ..." untuk catatan perubahan per sesi.
--   * Program rumah: plan_data.exercises + exDose di SOAP terbaru yang berisi latihan,
--     detailnya dari plan_exercises. Catatan terapis: plan_data.notes.
--   * Video latihan: satu video per kode latihan (plan_exercises.id), diunggah Super
--     Admin ke bucket privat exercise-videos. Pasien memutar lewat tautan bertanda
--     tangan dari Edge Function portal-exercise-video.
--
-- Fitur ini per klinik (opt-in). clinics.patient_portal_enabled default FALSE, diatur
-- Super Admin. Jika nonaktif: staf klinik tidak bisa membuat tautan, tautan yang ada
-- tidak bisa dipakai, dan staf tidak melihat video latihan.
--
-- Aturan penulisan file ini:
--   * Tanpa DROP dan tanpa DELETE (tool apply_migration membatalkan skrip yang berisi
--     pernyataan destruktif). Sesi dan catatan latihan memakai tanda (revoked_at, is_done).
--     Semua objek baru; fungsi memakai CREATE OR REPLACE.
--   * Tubuh fungsi memakai $fn$ (bukan $$).
--   * Dibagi per tahap supaya mudah dijalankan satu per satu di SQL Editor.
--
-- Prinsip keamanan:
--   * Pasien TIDAK login dan TIDAK punya akses ke tabel apa pun. Semua akses lewat
--     fungsi SECURITY DEFINER yang memeriksa token + tanggal lahir (portal_verify) lalu
--     token sesi (portal_*).
--   * Token tautan dan sesi hanya disimpan sebagai hash SHA-256.
--   * Percobaan salah dihitung dan dikembalikan sebagai hasil (bukan RAISE), karena
--     RAISE akan membatalkan UPDATE penghitung itu sendiri.
--   * Tautan dan sesi tidak kedaluwarsa sendiri; admin menonaktifkan (disabled) atau
--     mencabut (revoked). Perangkat baru tetap harus memasukkan tanggal lahir.
--   * Pasien hanya melihat: nyeri, "Update Kondisi", catatan terapis (plan_data.notes),
--     dan program latihan. Bukan S/O/A/P mentah.
--
-- Memakai yang sudah ada: patients, clinics, medical_records, daily_recaps,
-- plan_exercises, appointments, get_my_role(), get_my_clinic_id().
-- Catatan: patient_feedback_links/responses adalah alur rating Google Review, bukan
-- keluhan klinis, jadi tidak dipakai. exercises/exercise_videos (kosong, tak terpakai)
-- juga tidak dipakai.

-- =============================================================== TAHAP 1: fitur per klinik + brand
alter table public.clinics add column if not exists patient_portal_enabled boolean not null default false;
comment on column public.clinics.patient_portal_enabled is
  'Super Admin: klinik ini boleh mengirim tautan Clinara ke pasien dan memakai video latihan.';

alter table public.clinics
  add column if not exists portal_brand_color text
  check (portal_brand_color is null or portal_brand_color ~ '^#[0-9a-fA-F]{6}$');
comment on column public.clinics.portal_brand_color is
  'Satu warna brand aplikasi pasien. Kosong = pakai landing_primary_color.';

create or replace function public.portal_clinic_enabled(p_clinic_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $fn$ select coalesce((select patient_portal_enabled from public.clinics where id = p_clinic_id), false) $fn$;

-- Untuk policy staf: super admin, atau klinik saya mengaktifkan fitur.
create or replace function public.portal_my_clinic_enabled()
returns boolean
language sql security definer stable
set search_path = public
as $fn$ select get_my_role() = 'super_admin' or public.portal_clinic_enabled(get_my_clinic_id()) $fn$;

-- =============================================================== TAHAP 2: tabel
create table if not exists public.patient_portal_links (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  token_hash text not null unique,
  -- active = bisa dipakai; locked = terkunci otomatis (5x salah); disabled = dimatikan admin
  -- (bisa diaktifkan lagi); revoked = dicabut permanen (diganti tautan baru)
  status text not null default 'active' check (status in ('active','locked','disabled','revoked')),
  failed_attempts smallint not null default 0,
  locked_at timestamptz,
  expires_at timestamptz,  -- NULL = tidak kedaluwarsa
  last_opened_at timestamptz,
  sent_via text,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists patient_portal_links_one_live_per_patient
  on public.patient_portal_links (patient_id) where status <> 'revoked';
create index if not exists patient_portal_links_clinic_idx on public.patient_portal_links (clinic_id);

create table if not exists public.patient_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.patient_portal_links(id) on delete cascade,
  session_hash text not null unique,
  expires_at timestamptz,  -- NULL = berlaku selama tautan aktif
  revoked_at timestamptz,  -- diisi saat keluar atau saat melebihi 10 perangkat
  created_at timestamptz not null default now()
);
create index if not exists patient_portal_sessions_link_idx on public.patient_portal_sessions (link_id);

-- Catatan "latihan hari ini selesai". Program itu sendiri dibaca dari SOAP.
create table if not exists public.patient_exercise_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  exercise_id text not null references public.plan_exercises(id),
  done_on date not null default current_date,
  is_done boolean not null default true,  -- false = pasien membatalkan tanda selesai
  created_at timestamptz not null default now(),
  unique (patient_id, exercise_id, done_on)
);
create index if not exists patient_exercise_logs_clinic_idx on public.patient_exercise_logs (clinic_id);
create index if not exists patient_exercise_logs_exercise_idx on public.patient_exercise_logs (exercise_id);

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

-- Video latihan: satu per kode latihan di plan_exercises, dikelola Super Admin.
create table if not exists public.exercise_video_assets (
  exercise_id text primary key references public.plan_exercises(id) on delete cascade,
  storage_path text not null,
  duration_seconds integer,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

-- Untuk database yang sudah menjalankan versi awal tahap 2 (idempotent).
alter table public.patient_portal_sessions add column if not exists revoked_at timestamptz;
alter table public.patient_exercise_logs add column if not exists is_done boolean not null default true;

-- =============================================================== TAHAP 3: RLS, hak akses, storage
alter table public.patient_portal_links enable row level security;
alter table public.patient_portal_sessions enable row level security;
alter table public.patient_exercise_logs enable row level security;
alter table public.patient_portal_feedback enable row level security;
alter table public.patient_portal_messages enable row level security;
alter table public.exercise_video_assets enable row level security;

-- Staf klinik. Sesi: tanpa policy (hanya fungsi definer).
-- Tautan: staf hanya membaca; tulis lewat portal_create_link / portal_set_link_status.
create policy portal_links_staff_read on public.patient_portal_links for select
  using (get_my_role() = 'super_admin'
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

-- Video: hanya Super Admin yang mengelola; staf hanya melihat jika klinik mereka aktif.
create policy exercise_video_assets_read on public.exercise_video_assets for select to authenticated
  using (public.portal_my_clinic_enabled());
create policy exercise_video_assets_write on public.exercise_video_assets for all to authenticated
  using (get_my_role() = 'super_admin') with check (get_my_role() = 'super_admin');

-- Cabut hak bawaan Supabase (default privileges memberi anon/authenticated).
revoke all on public.patient_portal_links, public.patient_portal_sessions,
  public.patient_exercise_logs, public.patient_portal_feedback,
  public.patient_portal_messages, public.exercise_video_assets from public, anon, authenticated;
grant select on public.patient_portal_links, public.patient_exercise_logs to authenticated;
grant select, insert, update, delete on public.patient_portal_feedback to authenticated;
grant select, insert, update on public.patient_portal_messages to authenticated;
grant select, insert, update, delete on public.exercise_video_assets to authenticated;

-- Bucket video privat. Batas 200 MB per file (batas global proyek di Dashboard juga berlaku).
insert into storage.buckets (id, name, public, file_size_limit)
values ('exercise-videos', 'exercise-videos', false, 209715200)
on conflict (id) do nothing;

create policy exercise_videos_super_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'exercise-videos' and get_my_role() = 'super_admin')
  with check (bucket_id = 'exercise-videos' and get_my_role() = 'super_admin');
create policy exercise_videos_clinic_read on storage.objects for select to authenticated
  using (bucket_id = 'exercise-videos' and public.portal_my_clinic_enabled());

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

-- Nilai nyeri 0-10 dari teks Objective. Pola yang sama dengan ObjectiveProgressUpdate.jsx.
create or replace function public.portal_extract_nprs(p_text text)
returns smallint language sql immutable
set search_path = public
as $fn$
  select case when v between 0 and 10 then v::smallint end
  from (select coalesce(
      (regexp_match(p_text, 'nyeri[^.\n]*?sekarang\D{0,3}(\d{1,2})(?!\d)', 'i'))[1],
      (regexp_match(p_text, 'NPRS[^\d\n]{0,20}(\d{1,2})(?!\d)', 'i'))[1])::int as v) t
$fn$;

-- Kalimat "Update Kondisi: ..." (mis. "nyeri tekan berkurang, ROM bertambah").
create or replace function public.portal_extract_update(p_text text)
returns text language sql immutable
set search_path = public
as $fn$ select nullif(btrim((regexp_match(p_text, 'Update Kondisi:\s*([^\n]*)', 'i'))[1]), '') $fn$;

-- Latihan di SOAP terbaru yang berisi latihan: (kode, dosis dari SOAP).
create or replace function public.portal_program_items(p_patient_id uuid)
returns table (exercise_id text, soap_dose text)
language sql security definer stable
set search_path = public
as $fn$
  select e.key, nullif(btrim(mr.plan_data->'exDose'->>e.key), '')
  from (select plan_data from public.medical_records
        where patient_id = p_patient_id
          and jsonb_typeof(plan_data->'exercises') = 'object'
          and plan_data->'exercises' <> '{}'::jsonb
        order by created_at desc limit 1) mr,
       jsonb_each(mr.plan_data->'exercises') e
  where e.value = 'true'::jsonb
$fn$;

-- Menerjemahkan token sesi ke (link, pasien, klinik). Klinik harus mengaktifkan fitur.
-- RAISE di sini aman karena tidak ada yang diubah.
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
    join public.clinics c on c.id = l.clinic_id
    where s.session_hash = public.portal_hash(p_session)
      and s.revoked_at is null
      and (s.expires_at is null or s.expires_at > now())
      and l.status = 'active'
      and (l.expires_at is null or l.expires_at > now())
      and c.patient_portal_enabled;
  if not found then
    raise exception 'Sesi tidak valid atau sudah berakhir' using errcode = '28000';
  end if;
end
$fn$;

-- =============================================================== TAHAP 5: fungsi staf (authenticated)
create or replace function public.portal_create_link(p_patient_id uuid, p_valid_days int default null)
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
  if not public.portal_clinic_enabled(v_patient.clinic_id) then
    raise exception 'Fitur Clinara untuk pasien belum diaktifkan di klinik ini' using errcode = '42501';
  end if;
  if v_patient.birth_date is null then
    raise exception 'Tanggal lahir pasien belum diisi' using errcode = 'P0001';
  end if;

  update public.patient_portal_links set status = 'revoked'
    where patient_id = p_patient_id and status <> 'revoked';

  v_token := public.portal_new_token();
  -- default: tidak kedaluwarsa. Isi p_valid_days hanya jika klinik ingin batas waktu.
  v_exp := case when p_valid_days is null then null else now() + make_interval(days => greatest(1, p_valid_days)) end;
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
  if p_status not in ('active','locked','disabled','revoked') then
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
  select name, logo_url, coalesce(portal_brand_color, landing_primary_color) as color, patient_portal_enabled as enabled
    into v_c from public.clinics where id = v_link.clinic_id;
  v_status := case when not v_c.enabled then 'disabled'
                   when v_link.status in ('locked','disabled') then v_link.status
                   when v_link.expires_at is not null and v_link.expires_at <= now() then 'expired'
                   else 'active' end;
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
begin
  select * into v_link from public.patient_portal_links
    where token_hash = public.portal_hash(p_token) for update;
  if not found or v_link.status = 'revoked' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if not public.portal_clinic_enabled(v_link.clinic_id) then
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;
  if v_link.status in ('locked','disabled') then
    return jsonb_build_object('ok', false, 'reason', v_link.status);
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
    values (v_link.id, public.portal_hash(v_session), null);
  -- simpan maksimal 10 perangkat/sesi terbaru per tautan; yang lebih lama dinonaktifkan
  update public.patient_portal_sessions set revoked_at = now()
    where link_id = v_link.id and revoked_at is null
      and id not in (select id from public.patient_portal_sessions
                     where link_id = v_link.id and revoked_at is null order by created_at desc limit 10);
  return jsonb_build_object('ok', true, 'session', v_session, 'first_name', v_pat.first_name);
end
$fn$;

create or replace function public.portal_logout(p_session text)
returns void
language sql security definer
set search_path = public, extensions
as $fn$ update public.patient_portal_sessions set revoked_at = now()
  where session_hash = public.portal_hash(p_session) and revoked_at is null $fn$;

-- Tab Beranda.
create or replace function public.portal_get_home(p_session text)
returns jsonb
language plpgsql security definer stable
set search_path = public, extensions
as $fn$
declare
  s record; v_pat record; v_c record; v_last record; v_next jsonb; v_note text;
  v_total int; v_done int; v_unread int; v_vas jsonb; v_week jsonb;
  v_sessions int; v_streak int := 0; v_i int := 0;
  v_vas_first smallint; v_vas_last smallint;
begin
  select * into s from public.portal_resolve_session(p_session);
  select coalesce(nullif(nickname, ''), split_part(full_name, ' ', 1)) as first_name into v_pat
    from public.patients where id = s.patient_id;
  select name, logo_url, coalesce(portal_brand_color, landing_primary_color) as color into v_c
    from public.clinics where id = s.clinic_id;

  -- keluhan (diagnosis) dan terapis dari sesi terbaru
  select case when jsonb_typeof(diagnosis_labels->0) = 'string' then diagnosis_labels->>0 end as complaint,
         therapist_name as therapist into v_last
    from public.daily_recaps
    where patient_id = s.patient_id and diagnosis_labels is not null and jsonb_typeof(diagnosis_labels) = 'array'
    order by recap_date desc, created_at desc limit 1;

  select jsonb_build_object('appointment_date', a.appointment_date, 'therapist', t.name)
    into v_next
    from public.appointments a left join public.physiotherapists t on t.id = a.therapist_id
    where a.patient_id = s.patient_id and a.appointment_date > now() and a.status = 'confirmed'
    order by a.appointment_date limit 1;

  select count(*) into v_sessions from public.medical_records where patient_id = s.patient_id;

  select nullif(btrim(plan_data->>'notes'), '') into v_note from public.medical_records
    where patient_id = s.patient_id and nullif(btrim(plan_data->>'notes'), '') is not null
    order by created_at desc limit 1;

  -- nyeri per SOAP (yang terbaca), 12 terakhir
  select coalesce(jsonb_agg(n order by d), '[]'::jsonb) into v_vas from (
    select public.portal_extract_nprs(mr.objective) as n, mr.created_at as d
    from public.medical_records mr
    where mr.patient_id = s.patient_id and public.portal_extract_nprs(mr.objective) is not null
    order by mr.created_at desc limit 12) x;
  select (array_agg(n order by d))[1], (array_agg(n order by d desc))[1] into v_vas_first, v_vas_last from (
    select public.portal_extract_nprs(mr.objective) as n, mr.created_at as d
    from public.medical_records mr
    where mr.patient_id = s.patient_id and public.portal_extract_nprs(mr.objective) is not null) y;

  select count(*), count(l.id) into v_total, v_done
    from public.portal_program_items(s.patient_id) p
    left join public.patient_exercise_logs l
      on l.patient_id = s.patient_id and l.exercise_id = p.exercise_id and l.done_on = current_date and l.is_done;

  -- kalender Senin sampai Minggu minggu ini
  select jsonb_agg(jsonb_build_object('date', d::date, 'done',
           exists (select 1 from public.patient_exercise_logs l where l.patient_id = s.patient_id and l.done_on = d::date and l.is_done),
           'today', d::date = current_date) order by d)
    into v_week
    from generate_series(date_trunc('week', current_date), date_trunc('week', current_date) + interval '6 days', interval '1 day') d;

  -- beruntun: hari berturut-turut ada latihan; hari ini yang belum dicatat tidak memutus.
  loop
    exit when v_i > 365;
    if exists (select 1 from public.patient_exercise_logs l
               where l.patient_id = s.patient_id and l.done_on = current_date - v_i and l.is_done) then
      v_streak := v_streak + 1;
    elsif v_i > 0 then
      exit;
    end if;
    v_i := v_i + 1;
  end loop;

  select count(*) into v_unread from public.patient_portal_messages
    where patient_id = s.patient_id and sender = 'therapist' and read_at is null;

  return jsonb_build_object('first_name', v_pat.first_name,
    'clinic', jsonb_build_object('name', v_c.name, 'logo_url', v_c.logo_url, 'brand_color', v_c.color),
    'complaint', v_last.complaint, 'therapist', v_last.therapist, 'sessions_done', v_sessions,
    'next_appointment', v_next, 'latest_note', left(v_note, 600), 'vas_series', v_vas,
    'vas_first', v_vas_first, 'vas_latest', v_vas_last, 'streak_days', v_streak,
    'week', v_week, 'program_total', v_total, 'program_done_today', v_done,
    'unread_messages', v_unread);
end
$fn$;

-- Tab Progres: satu entri per SOAP (urut tanggal sesi): nyeri (bila terbaca) dan Update Kondisi.
create or replace function public.portal_get_progress(p_session text)
returns jsonb
language plpgsql security definer stable
set search_path = public, extensions
as $fn$
declare s record;
begin
  select * into s from public.portal_resolve_session(p_session);
  return jsonb_build_object('entries', coalesce((
    select jsonb_agg(jsonb_build_object('no', n, 'date', d, 'vas', vas, 'update', upd) order by n)
    from (select row_number() over (order by coalesce(dr.recap_date, mr.created_at::date), mr.created_at) as n,
                 coalesce(dr.recap_date, mr.created_at::date) as d,
                 public.portal_extract_nprs(mr.objective) as vas,
                 public.portal_extract_update(mr.objective) as upd
          from public.medical_records mr
          left join public.daily_recaps dr on dr.id = mr.daily_recap_id
          where mr.patient_id = s.patient_id) x), '[]'::jsonb));
end
$fn$;

-- Tab Latihan: dari SOAP terbaru yang berisi latihan.
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
      'done_today', exists (select 1 from public.patient_exercise_logs l
                            where l.patient_id = s.patient_id and l.exercise_id = e.id and l.done_on = current_date and l.is_done))
      order by e.id)
    from public.portal_program_items(s.patient_id) p
    join public.plan_exercises e on e.id = p.exercise_id), '[]'::jsonb);
end
$fn$;

create or replace function public.portal_log_exercise(p_session text, p_exercise_id text, p_done boolean)
returns void
language plpgsql security definer
set search_path = public, extensions
as $fn$
declare s record;
begin
  select * into s from public.portal_resolve_session(p_session);
  if not exists (select 1 from public.portal_program_items(s.patient_id) where exercise_id = p_exercise_id) then
    raise exception 'Latihan tidak ditemukan' using errcode = 'P0002';
  end if;
  insert into public.patient_exercise_logs (clinic_id, patient_id, exercise_id, is_done)
    values (s.clinic_id, s.patient_id, p_exercise_id, coalesce(p_done, true))
    on conflict (patient_id, exercise_id, done_on) do update set is_done = excluded.is_done;
end
$fn$;

-- Jalur file video di storage, hanya untuk latihan yang ada di program pasien. Dipanggil Edge
-- Function portal-exercise-video (service role), TIDAK dibuka ke anon.
create or replace function public.portal_video_path(p_session text, p_exercise_id text)
returns text
language plpgsql security definer stable
set search_path = public, extensions
as $fn$
declare s record; v_path text;
begin
  select * into s from public.portal_resolve_session(p_session);
  select v.storage_path into v_path
    from public.exercise_video_assets v
    where v.exercise_id = p_exercise_id
      and exists (select 1 from public.portal_program_items(s.patient_id) where exercise_id = p_exercise_id);
  if v_path is null then
    raise exception 'Video tidak tersedia' using errcode = 'P0002';
  end if;
  return v_path;
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

create or replace function public.portal_list_feedback(p_session text)
returns jsonb
language plpgsql security definer stable
set search_path = public, extensions
as $fn$
declare s record;
begin
  select * into s from public.portal_resolve_session(p_session);
  return coalesce((select jsonb_agg(jsonb_build_object('at', created_at, 'vas', vas, 'tags', tags,
            'message', message, 'status', status) order by created_at desc)
    from (select * from public.patient_portal_feedback where patient_id = s.patient_id
          order by created_at desc limit 50) f), '[]'::jsonb);
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

-- =============================================================== TAHAP 7: hak eksekusi fungsi
-- Default Supabase memberi EXECUTE ke anon pada fungsi baru. Cabut semua dulu.
revoke execute on function
  public.portal_clinic_enabled(uuid), public.portal_my_clinic_enabled(),
  public.portal_hash(text), public.portal_new_token(), public.portal_extract_nprs(text),
  public.portal_extract_update(text), public.portal_program_items(uuid), public.portal_resolve_session(text),
  public.portal_create_link(uuid, int), public.portal_set_link_status(uuid, text),
  public.portal_mark_link_sent(uuid, text), public.portal_get_branding(text),
  public.portal_verify(text, date), public.portal_logout(text), public.portal_get_home(text),
  public.portal_get_progress(text), public.portal_get_program(text),
  public.portal_log_exercise(text, text, boolean), public.portal_video_path(text, text),
  public.portal_submit_feedback(text, int, text[], text), public.portal_list_feedback(text),
  public.portal_list_messages(text), public.portal_send_message(text, text)
from public, anon, authenticated;

-- Dipakai policy RLS (dievaluasi sebagai pengguna login). portal_clinic_enabled sengaja tidak
-- dibuka; ia hanya dipanggil dari dalam fungsi definer lain.
grant execute on function public.portal_my_clinic_enabled() to authenticated;
-- Staf
grant execute on function public.portal_create_link(uuid, int),
  public.portal_set_link_status(uuid, text), public.portal_mark_link_sent(uuid, text) to authenticated;
-- Edge Function portal-exercise-video memanggil ini dengan service role.
grant execute on function public.portal_video_path(text, text) to service_role;
-- Pasien (anon). Fungsi internal dan portal_video_path (khusus Edge Function) TIDAK dibuka.
grant execute on function public.portal_get_branding(text), public.portal_verify(text, date),
  public.portal_logout(text), public.portal_get_home(text), public.portal_get_progress(text),
  public.portal_get_program(text), public.portal_log_exercise(text, text, boolean),
  public.portal_submit_feedback(text, int, text[], text), public.portal_list_feedback(text),
  public.portal_list_messages(text), public.portal_send_message(text, text) to anon;
