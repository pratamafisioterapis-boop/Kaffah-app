-- Jumlah TPS per kelurahan/desa untuk modul Suara PKS ternyata berbeda
-- antar periode pemilu (mis. Batu Ampar: 96 TPS di 2019, 98 TPS di 2024),
-- tapi "Jumlah TPS" di Setup Dapil sejauh ini memakai pemilih_tps yang
-- global per kelurahan tanpa tahun (dipakai bersama oleh modul Data
-- Pemilih/DPT). Tabel baru ini murni untuk Suara PKS — sengaja terpisah
-- dari pemilih_tps supaya modul Data Pemilih/DPT (dan datanya yang sudah
-- ada) sama sekali tidak tersentuh oleh perubahan ini.
create table if not exists public.pemilih_suara_tps_count (
  id uuid primary key default gen_random_uuid(),
  kelurahan_id uuid not null references public.pemilih_kelurahan(id) on delete cascade,
  election_year int4 not null,
  jumlah_tps int4 not null default 0,
  updated_at timestamptz not null default now(),
  unique (kelurahan_id, election_year)
);

alter table public.pemilih_suara_tps_count enable row level security;

create policy pemilih_suara_tps_count_admin_all on public.pemilih_suara_tps_count
  for all
  using (exists (select 1 from public.pemilih_admins where pemilih_admins.user_id = auth.uid()))
  with check (exists (select 1 from public.pemilih_admins where pemilih_admins.user_id = auth.uid()));

create policy pemilih_suara_tps_count_dpc_all on public.pemilih_suara_tps_count
  for all
  using (exists (
    select 1 from public.pemilih_kelurahan k
    where k.id = pemilih_suara_tps_count.kelurahan_id and k.kecamatan_id = public.pemilih_dpc_kecamatan_id()
  ))
  with check (exists (
    select 1 from public.pemilih_kelurahan k
    where k.id = pemilih_suara_tps_count.kelurahan_id and k.kecamatan_id = public.pemilih_dpc_kecamatan_id()
  ));

grant all on public.pemilih_suara_tps_count to anon, authenticated;

-- Dipakai Setup Dapil untuk menyarankan/mengisi otomatis jumlah TPS suatu
-- kelurahan+tahun dari nomor TPS tertinggi yang sudah benar-benar tercatat
-- di data suara (pemilih_suara_caleg_tps), tanpa perlu menarik ribuan baris
-- mentah ke client hanya untuk dihitung MAX-nya. SECURITY INVOKER (default)
-- supaya RLS pemilih_suara_caleg_tps tetap berlaku sesuai pemanggilnya
-- (admin melihat semua, akun DPC otomatis terbatas ke dapilnya sendiri).
create or replace function public.pemilih_suara_tps_discover(p_kelurahan_ids uuid[], p_election_year int)
returns table(kelurahan_id uuid, max_tps_number int)
language sql
stable
as $$
  select t.kelurahan_id, max(t.tps_number)::int as max_tps_number
  from public.pemilih_suara_caleg_tps t
  where t.election_year = p_election_year and t.kelurahan_id = any(p_kelurahan_ids)
  group by t.kelurahan_id;
$$;

grant execute on function public.pemilih_suara_tps_discover(uuid[], int) to authenticated;
