-- Penarikan operasional dari Tabungan Pajak perlu tahu ditambahkan ke
-- siapa (anggota roster), supaya nominalnya ikut masuk ke total hitungan
-- orang itu di Laporan Final.
alter table public.insentif_tabungan_pajak_penarikan
  add column if not exists roster_id uuid references public.insentif_roster(id) on delete set null;
