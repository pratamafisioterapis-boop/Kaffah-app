-- "Akun DPC" — a restricted account type for the Suara PKS module. Unlike
-- pemilih_admins (full access) or pemilih_relawan (KTP-scan PWA only), a DPC
-- account is assigned to exactly one dapil/kecamatan and can only manage
-- that dapil's setup (kelurahan, jumlah TPS, roster caleg) and per-TPS vote
-- values — never the dashboard/rekap/grafik.
create table if not exists public.pemilih_dpc (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  kecamatan_id uuid not null references public.pemilih_kecamatan(id),
  username text not null,
  nama text not null,
  no_hp text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (username)
);

alter table public.pemilih_dpc enable row level security;

create policy pemilih_dpc_admin_all on public.pemilih_dpc
  for all
  using (exists (select 1 from public.pemilih_admins where pemilih_admins.user_id = auth.uid()))
  with check (exists (select 1 from public.pemilih_admins where pemilih_admins.user_id = auth.uid()));

-- A DPC user needs to read its own row to know its nama & assigned dapil.
create policy pemilih_dpc_self_select on public.pemilih_dpc
  for select
  using (user_id = auth.uid());

grant all on public.pemilih_dpc to anon, authenticated;

-- Looks up the caller's assigned dapil if they're an active DPC account —
-- null otherwise (including for admins, who don't need this scoping since
-- they already have their own admin_all policies on every table below).
create or replace function public.pemilih_dpc_kecamatan_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select kecamatan_id from public.pemilih_dpc where user_id = auth.uid() and is_active limit 1;
$$;

grant execute on function public.pemilih_dpc_kecamatan_id() to authenticated;

-- Scope every table a DPC account needs to read/write to their assigned
-- dapil only. These are additional PERMISSIVE policies alongside the
-- existing admin_all ones — they only ever ADD access (to matching rows for
-- an active DPC user), never take any away from admins/relawan.
create policy pemilih_kecamatan_dpc_select on public.pemilih_kecamatan
  for select
  using (id = public.pemilih_dpc_kecamatan_id());

create policy pemilih_kelurahan_dpc_all on public.pemilih_kelurahan
  for all
  using (kecamatan_id = public.pemilih_dpc_kecamatan_id())
  with check (kecamatan_id = public.pemilih_dpc_kecamatan_id());

create policy pemilih_tps_dpc_all on public.pemilih_tps
  for all
  using (exists (
    select 1 from public.pemilih_kelurahan k
    where k.id = pemilih_tps.kelurahan_id and k.kecamatan_id = public.pemilih_dpc_kecamatan_id()
  ))
  with check (exists (
    select 1 from public.pemilih_kelurahan k
    where k.id = pemilih_tps.kelurahan_id and k.kecamatan_id = public.pemilih_dpc_kecamatan_id()
  ));

create policy pemilih_caleg_master_dpc_all on public.pemilih_caleg_master
  for all
  using (kecamatan_id = public.pemilih_dpc_kecamatan_id())
  with check (kecamatan_id = public.pemilih_dpc_kecamatan_id());

create policy pemilih_suara_caleg_dpc_all on public.pemilih_suara_caleg
  for all
  using (exists (
    select 1 from public.pemilih_kelurahan k
    where k.id = pemilih_suara_caleg.kelurahan_id and k.kecamatan_id = public.pemilih_dpc_kecamatan_id()
  ))
  with check (exists (
    select 1 from public.pemilih_kelurahan k
    where k.id = pemilih_suara_caleg.kelurahan_id and k.kecamatan_id = public.pemilih_dpc_kecamatan_id()
  ));

create policy pemilih_suara_caleg_tps_dpc_all on public.pemilih_suara_caleg_tps
  for all
  using (exists (
    select 1 from public.pemilih_kelurahan k
    where k.id = pemilih_suara_caleg_tps.kelurahan_id and k.kecamatan_id = public.pemilih_dpc_kecamatan_id()
  ))
  with check (exists (
    select 1 from public.pemilih_kelurahan k
    where k.id = pemilih_suara_caleg_tps.kelurahan_id and k.kecamatan_id = public.pemilih_dpc_kecamatan_id()
  ));

-- Account management RPCs, mirroring pemilih_create_relawan_account /
-- pemilih_delete_relawan_account / pemilih_reset_relawan_password.
create or replace function public.pemilih_create_dpc_account(
  p_username text, p_password text, p_nama text, p_kecamatan_id uuid, p_no_hp text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'auth', 'extensions'
as $function$
declare
  v_user_id uuid;
  v_dpc_id uuid;
  v_username text := lower(trim(p_username));
  v_email text;
begin
  if not exists (select 1 from public.pemilih_admins where user_id = auth.uid()) then
    raise exception 'Not authorized to create DPC account';
  end if;

  if coalesce(trim(p_nama), '') = '' then
    raise exception 'Nama wajib diisi';
  end if;

  if p_kecamatan_id is null or not exists (select 1 from public.pemilih_kecamatan where id = p_kecamatan_id) then
    raise exception 'Dapil/kecamatan tidak valid';
  end if;

  if coalesce(p_password, '') = '' or length(p_password) < 6 then
    raise exception 'Password minimal 6 karakter';
  end if;

  if v_username ~ '@' then
    if v_username !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then
      raise exception 'Format email tidak valid';
    end if;
    v_email := v_username;
  else
    if v_username !~ '^[a-z0-9._]{3,32}$' then
      raise exception 'Username tidak valid (huruf kecil/angka/titik/underscore, 3-32 karakter, atau isi email lengkap)';
    end if;
    v_email := v_username || '@dpc.pemilih.local';
  end if;

  if exists (select 1 from public.pemilih_dpc where username = v_username) then
    raise exception 'Username sudah digunakan';
  end if;

  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Username sudah digunakan';
  end if;

  v_user_id := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id, 'authenticated', 'authenticated', v_email,
    crypt(p_password, gen_salt('bf', 10)),
    now(), now(), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', trim(p_nama))
  );

  insert into public.pemilih_dpc (user_id, kecamatan_id, username, nama, no_hp, created_by)
  values (v_user_id, p_kecamatan_id, v_username, trim(p_nama), nullif(trim(p_no_hp), ''), auth.uid())
  returning id into v_dpc_id;

  return v_dpc_id;
end;
$function$;

create or replace function public.pemilih_delete_dpc_account(p_dpc_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'auth', 'extensions'
as $function$
declare
  v_user_id uuid;
begin
  if not exists (select 1 from public.pemilih_admins where user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  select user_id into v_user_id from public.pemilih_dpc where id = p_dpc_id;
  if v_user_id is null then
    raise exception 'Akun DPC tidak ditemukan';
  end if;

  delete from public.pemilih_dpc where id = p_dpc_id;
  delete from auth.users where id = v_user_id;
end;
$function$;

create or replace function public.pemilih_reset_dpc_password(p_dpc_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path to 'public', 'auth', 'extensions'
as $function$
declare
  v_user_id uuid;
begin
  if not exists (select 1 from public.pemilih_admins where user_id = auth.uid()) then
    raise exception 'Not authorized';
  end if;

  if coalesce(p_password, '') = '' or length(p_password) < 6 then
    raise exception 'Password minimal 6 karakter';
  end if;

  select user_id into v_user_id from public.pemilih_dpc where id = p_dpc_id;
  if v_user_id is null then
    raise exception 'Akun DPC tidak ditemukan';
  end if;

  update auth.users
  set encrypted_password = crypt(p_password, gen_salt('bf', 10)), updated_at = now()
  where id = v_user_id;
end;
$function$;

grant execute on function public.pemilih_create_dpc_account(text, text, text, uuid, text) to authenticated;
grant execute on function public.pemilih_delete_dpc_account(uuid) to authenticated;
grant execute on function public.pemilih_reset_dpc_password(uuid, text) to authenticated;
