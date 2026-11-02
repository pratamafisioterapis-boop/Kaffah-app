-- Misi Kaffah (loyalty digital), Fase 1.
-- Rencana: docs/RENCANA_KARTU_LOYALTY_DIGITAL_KAFFAH.md
--
-- Pasien (termasuk pasien lama) menyelesaikan misi di portal /p/:token:
--   google_review : memberi ulasan jujur di Google Bisnis (rating apa pun, TIDAK dipersyaratkan bintang 5)
--   ig_follow     : mengikuti Instagram klinik
--   ig_story_tag  : mengunggah story Instagram dan menandai (tag) klinik
-- Bukti berupa tangkapan layar, diverifikasi staf. Reward (voucher) dan misi referral menyusul di Fase 2.
--
-- Nonaktif sampai loyalty_settings.enabled = true. Klinik tanpa baris pengaturan tidak terpengaruh.
-- Pola keamanan sama dengan portal: pasien tanpa login, hanya lewat fungsi SECURITY DEFINER bertoken sesi.

-- ============================================================ pengaturan per klinik
create table if not exists public.loyalty_settings (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  enabled boolean not null default false,
  google_review_url text,
  instagram_url text,
  instagram_handle text,
  referral_target smallint not null default 4,
  updated_at timestamptz not null default now()
);

-- ============================================================ misi pasien
create table if not exists public.loyalty_missions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  mission_type text not null check (mission_type in ('google_review','ig_follow','ig_story_tag')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  proof_path text,
  reject_reason text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  unique (patient_id, mission_type)
);
create index if not exists loyalty_missions_clinic_status_idx on public.loyalty_missions (clinic_id, status, submitted_at desc);

alter table public.loyalty_settings enable row level security;
alter table public.loyalty_missions enable row level security;

-- Staf klinik membaca/mengelola pengaturan; misi hanya dibaca (perubahan lewat fungsi definer).
create policy loyalty_settings_staff on public.loyalty_settings for all to authenticated
  using (get_my_role() = 'super_admin'
    or (get_my_role() in ('owner','admin','clinic_admin') and clinic_id = get_my_clinic_id()))
  with check (get_my_role() = 'super_admin'
    or (get_my_role() in ('owner','admin','clinic_admin') and clinic_id = get_my_clinic_id()));

create policy loyalty_missions_staff_read on public.loyalty_missions for select to authenticated
  using (get_my_role() = 'super_admin'
    or (get_my_role() in ('owner','admin','clinic_admin') and clinic_id = get_my_clinic_id()));

-- ============================================================ bucket bukti (privat)
insert into storage.buckets (id, name, public)
values ('loyalty-proofs', 'loyalty-proofs', false)
on conflict (id) do nothing;

-- Staf klinik boleh melihat bukti klinik sendiri. Unggah hanya oleh Edge Function (service role).
create policy loyalty_proofs_staff_read on storage.objects for select to authenticated
  using (
    bucket_id = 'loyalty-proofs'
    and (get_my_role() = 'super_admin'
      or (get_my_role() in ('owner','admin','clinic_admin')
          and (storage.foldername(name))[1] = get_my_clinic_id()::text))
  );

-- ============================================================ fungsi pasien
create or replace function public.portal_loyalty_get(p_session text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $fn$
declare s record; v_set public.loyalty_settings; v_missions jsonb;
begin
  select * into s from public.portal_resolve_session(p_session);
  select * into v_set from public.loyalty_settings where clinic_id = s.clinic_id;
  if not found or not v_set.enabled then
    return jsonb_build_object('enabled', false);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'type', m.mission_type, 'status', m.status, 'reject_reason', m.reject_reason)), '[]'::jsonb)
    into v_missions
    from public.loyalty_missions m where m.patient_id = s.patient_id;
  return jsonb_build_object(
    'enabled', true,
    'google_review_url', v_set.google_review_url,
    'instagram_url', v_set.instagram_url,
    'instagram_handle', v_set.instagram_handle,
    'missions', v_missions);
end
$fn$;

-- Edge Function (service role): sesi valid, fitur aktif, misi boleh dikirim (belum ada / ditolak).
-- Mengembalikan awalan path penyimpanan "<clinic>/<patient>".
create or replace function public.portal_loyalty_proof_target(p_session text, p_type text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $fn$
declare s record; v_status text;
begin
  select * into s from public.portal_resolve_session(p_session);
  if p_type not in ('google_review','ig_follow','ig_story_tag') then
    raise exception 'Misi tidak dikenal' using errcode = '22023';
  end if;
  if not coalesce((select enabled from public.loyalty_settings where clinic_id = s.clinic_id), false) then
    raise exception 'Program belum aktif' using errcode = 'P0001';
  end if;
  select status into v_status from public.loyalty_missions where patient_id = s.patient_id and mission_type = p_type;
  if v_status in ('pending','approved') then
    raise exception 'Misi sudah dikirim' using errcode = 'P0001';
  end if;
  return jsonb_build_object('clinic_id', s.clinic_id, 'patient_id', s.patient_id);
end
$fn$;

create or replace function public.portal_loyalty_submit(p_session text, p_type text, p_path text)
returns void
language plpgsql security definer
set search_path = public, extensions
as $fn$
declare s record; v_status text;
begin
  select * into s from public.portal_resolve_session(p_session);
  if p_type not in ('google_review','ig_follow','ig_story_tag') then
    raise exception 'Misi tidak dikenal' using errcode = '22023';
  end if;
  -- Path wajib berada di folder pasien ini.
  if p_path is null or p_path not like (s.clinic_id::text || '/' || s.patient_id::text || '/%') then
    raise exception 'Bukti tidak valid' using errcode = '22023';
  end if;
  select status into v_status from public.loyalty_missions where patient_id = s.patient_id and mission_type = p_type;
  if v_status in ('pending','approved') then
    raise exception 'Misi sudah dikirim' using errcode = 'P0001';
  end if;
  insert into public.loyalty_missions (clinic_id, patient_id, mission_type, status, proof_path)
    values (s.clinic_id, s.patient_id, p_type, 'pending', p_path)
  on conflict (patient_id, mission_type) do update
    set status = 'pending', proof_path = excluded.proof_path, reject_reason = null,
        submitted_at = now(), reviewed_by = null, reviewed_at = null;
end
$fn$;

-- ============================================================ fungsi staf
create or replace function public.loyalty_review_mission(p_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql security definer
set search_path = public
as $fn$
declare v_clinic uuid;
begin
  select clinic_id into v_clinic from public.loyalty_missions where id = p_id;
  if v_clinic is null then
    raise exception 'Misi tidak ditemukan' using errcode = 'P0002';
  end if;
  if not (get_my_role() = 'super_admin'
       or (get_my_role() in ('owner','admin','clinic_admin') and v_clinic = get_my_clinic_id())) then
    raise exception 'Tidak diizinkan' using errcode = '42501';
  end if;
  if not p_approve and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Alasan penolakan wajib diisi' using errcode = '22023';
  end if;
  update public.loyalty_missions
     set status = case when p_approve then 'approved' else 'rejected' end,
         reject_reason = case when p_approve then null else left(btrim(p_reason), 300) end,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id and status = 'pending';
end
$fn$;

-- ============================================================ hak eksekusi
revoke execute on function
  public.portal_loyalty_get(text), public.portal_loyalty_proof_target(text, text),
  public.portal_loyalty_submit(text, text, text), public.loyalty_review_mission(uuid, boolean, text)
from public, anon, authenticated;

grant execute on function public.portal_loyalty_get(text) to anon;
grant execute on function public.portal_loyalty_proof_target(text, text), public.portal_loyalty_submit(text, text, text) to service_role;
grant execute on function public.loyalty_review_mission(uuid, boolean, text) to authenticated;

-- Baris pengaturan Kaffah (nonaktif; owner mengisi tautan lalu mengaktifkan dari halaman Misi Kaffah).
insert into public.loyalty_settings (clinic_id, enabled)
select id, false from public.clinics where id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid
on conflict (clinic_id) do nothing;
