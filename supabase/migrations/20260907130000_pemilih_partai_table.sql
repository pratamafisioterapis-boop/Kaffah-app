-- "Tambah Partai" sebelumnya cuma menambah nama partai ke state lokal
-- (pendingPartyDrafts) — kalau belum ada caleg yang disimpan untuk partai
-- itu, tidak ada baris apapun di database yang menandakan partai itu ada,
-- jadi begitu halaman di-refresh partainya hilang lagi. Tabel ini menyimpan
-- daftar partai per dapil secara eksplisit supaya "Tambah Partai" langsung
-- persisten, tidak perlu menunggu caleg pertamanya diisi.
create table if not exists public.pemilih_partai (
  id uuid primary key default gen_random_uuid(),
  kecamatan_id uuid not null references public.pemilih_kecamatan(id) on delete cascade,
  nama text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (kecamatan_id, nama)
);

alter table public.pemilih_partai enable row level security;

create policy pemilih_partai_admin_all on public.pemilih_partai
  for all
  using (exists (select 1 from public.pemilih_admins where pemilih_admins.user_id = auth.uid()))
  with check (exists (select 1 from public.pemilih_admins where pemilih_admins.user_id = auth.uid()));

-- Sama seperti pemilih_caleg_master_dpc_all: akun DPC boleh kelola daftar
-- partai untuk dapilnya sendiri saja.
create policy pemilih_partai_dpc_all on public.pemilih_partai
  for all
  using (kecamatan_id = public.pemilih_dpc_kecamatan_id())
  with check (kecamatan_id = public.pemilih_dpc_kecamatan_id());

grant all on public.pemilih_partai to anon, authenticated;
