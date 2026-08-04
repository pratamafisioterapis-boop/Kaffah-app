-- Master roster of caleg (candidate number + name) per dapil/kecamatan and
-- election year, for the "Suara PKS" module. Lets an admin define candidate
-- names/numbers up front (before any vote data is uploaded/entered) so a
-- brand-new dapil can be set up end-to-end without waiting for a PDF/manual
-- entry to "discover" a candidate. Vote tables (pemilih_suara_caleg /
-- pemilih_suara_caleg_tps) keep storing candidate_name per-row as before —
-- this table is purely a setup/reference roster, merged client-side with
-- whatever candidates are already present in vote data.
create table if not exists public.pemilih_caleg_master (
  id uuid primary key default gen_random_uuid(),
  kecamatan_id uuid not null references public.pemilih_kecamatan(id) on delete cascade,
  election_year int4 not null default 2024,
  party_name text not null default 'Partai Keadilan Sejahtera',
  candidate_number int4 not null,
  candidate_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pemilih_caleg_master_number_check check (candidate_number >= 1),
  unique (kecamatan_id, election_year, candidate_number)
);

alter table public.pemilih_caleg_master enable row level security;

-- Same access pattern as pemilih_suara_caleg: admin-only (no relawan policy),
-- since the candidate roster is part of the vote-tally admin feature.
create policy pemilih_caleg_master_admin_all on public.pemilih_caleg_master
  for all
  using (exists (select 1 from public.pemilih_admins where pemilih_admins.user_id = auth.uid()))
  with check (exists (select 1 from public.pemilih_admins where pemilih_admins.user_id = auth.uid()));

grant all on public.pemilih_caleg_master to anon, authenticated;
