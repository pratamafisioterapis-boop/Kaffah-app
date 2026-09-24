-- Sistem kalkulator Insentif Bulanan untuk Konversi Dokter — mereplikasi
-- alur spreadsheet manual (Total Sebelum/Setelah PPH -> Tindakan -> Ranap
-- Swasta/Tumbang -> Laporan Final) sebagai aplikasi standalone, di-scope
-- per akun (owner_user_id), bukan per klinik.

create table if not exists public.insentif_bulanan_laporan (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  periode_bulan date not null, -- selalu tanggal 1 bulan itu
  kategori_sebelum_pph jsonb not null default '[]'::jsonb,
  kategori_setelah_pph jsonb not null default '[]'::jsonb,
  tindakan_sebelum_pph jsonb not null default '[]'::jsonb,
  tindakan_setelah_pph jsonb not null default '[]'::jsonb,
  ranap_swasta jsonb not null default '[]'::jsonb,
  tumbang jsonb not null default '[]'::jsonb,
  kas_total numeric not null default 1250000,
  f5_nominal numeric not null default 3500000,
  final_transfers jsonb not null default '{}'::jsonb, -- {roster_id: {nominal_transfer}}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, periode_bulan)
);

create table if not exists public.insentif_roster (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  nama text not null,
  persentase numeric not null default 0,
  urutan int not null default 0,
  is_active boolean not null default true,
  is_capped boolean not null default false, -- aturan khusus (mis. Om Phius): dibatasi min/max, sisanya diredistribusi
  redistribusi_dari_capped_persen numeric, -- persentase yang diterima orang ini dari sisa forfeited milik anggota capped
  created_at timestamptz not null default now()
);

create table if not exists public.insentif_tabungan_pajak_penarikan (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  laporan_id uuid references public.insentif_bulanan_laporan(id) on delete set null,
  nominal numeric not null,
  keterangan text,
  created_at timestamptz not null default now()
);

alter table public.insentif_bulanan_laporan enable row level security;
alter table public.insentif_roster enable row level security;
alter table public.insentif_tabungan_pajak_penarikan enable row level security;

create policy insentif_bulanan_laporan_owner_only
  on public.insentif_bulanan_laporan for all
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy insentif_roster_owner_only
  on public.insentif_roster for all
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy insentif_tabungan_pajak_penarikan_owner_only
  on public.insentif_tabungan_pajak_penarikan for all
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create trigger insentif_bulanan_laporan_set_updated_at
  before update on public.insentif_bulanan_laporan
  for each row execute function public.set_updated_at();
