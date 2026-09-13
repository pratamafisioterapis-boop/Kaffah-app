-- Multi-partai untuk modul Suara PKS / akun DPC. Sebelumnya candidate_number
-- unik per kelurahan+tahun (atau per kecamatan+tahun untuk roster) TANPA
-- memperhitungkan partai, jadi dua partai berbeda tidak bisa sama-sama punya
-- caleg nomor urut 1 di dapil/kelurahan/tahun yang sama. Jumlah TPS
-- (pemilih_suara_tps_count) sengaja TIDAK disentuh di sini — itu properti
-- fisik kelurahan+tahun, dipakai bersama oleh semua partai.

-- pemilih_suara_caleg_tps belum punya kolom party_name sama sekali (beda
-- dengan pemilih_caleg_master & pemilih_suara_caleg yang sudah punya sejak
-- awal, walau baru dipakai satu partai/PKS). Default ke PKS supaya baris
-- yang sudah ada (semuanya data PKS, satu-satunya partai yang bisa diinput
-- sebelum fitur ini) otomatis kebawa benar tanpa backfill manual.
alter table public.pemilih_suara_caleg_tps
  add column if not exists party_name text not null default 'Partai Keadilan Sejahtera';

-- Perlebar unique constraint supaya candidate_number boleh diulang antar
-- partai yang berbeda, tapi tetap unik dalam satu partai yang sama.
alter table public.pemilih_caleg_master
  drop constraint if exists pemilih_caleg_master_kecamatan_id_election_year_candidate_n_key;
alter table public.pemilih_caleg_master
  add constraint pemilih_caleg_master_kecamatan_year_party_number_key
  unique (kecamatan_id, election_year, party_name, candidate_number);

alter table public.pemilih_suara_caleg
  drop constraint if exists pemilih_suara_caleg_kelurahan_candidate_year_key;
alter table public.pemilih_suara_caleg
  add constraint pemilih_suara_caleg_kelurahan_party_candidate_year_key
  unique (kelurahan_id, party_name, candidate_number, election_year);

alter table public.pemilih_suara_caleg_tps
  drop constraint if exists pemilih_suara_caleg_tps_kelurahan_tps_candidate_year_key;
alter table public.pemilih_suara_caleg_tps
  add constraint pemilih_suara_caleg_tps_kelurahan_party_tps_candidate_year_key
  unique (kelurahan_id, party_name, tps_number, candidate_number, election_year);

-- Indeks untuk filter/list per partai (dashboard & input per partai).
create index if not exists pemilih_caleg_master_party_idx on public.pemilih_caleg_master (kecamatan_id, election_year, party_name);
create index if not exists pemilih_suara_caleg_party_idx on public.pemilih_suara_caleg (kelurahan_id, election_year, party_name);
create index if not exists pemilih_suara_caleg_tps_party_idx on public.pemilih_suara_caleg_tps (kelurahan_id, election_year, party_name);
