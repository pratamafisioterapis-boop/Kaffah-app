-- USULAN, BELUM DIJALANKAN. Tidak ada yang diubah di database tanpa persetujuan.
-- Masalah: exercise_video_assets memakai exercise_id sebagai PRIMARY KEY, jadi satu latihan hanya bisa punya satu video.
-- Usulan: tabel baru untuk banyak video per latihan. Tabel lama tidak diubah dan tidak ada DROP.

create table if not exists public.exercise_video_variants (
  id            bigint generated always as identity primary key,
  exercise_id   text not null references public.plan_exercises(id) on delete cascade,
  storage_path  text not null unique,
  label         text,                 -- mis. 'Varian 2', 'Tampak samping'
  sort_order    int  not null default 0,
  is_primary    boolean not null default false,
  source_code   text,                 -- kode lama/baru asal video, mis. 'AN01'
  duration_seconds integer,
  size_bytes    bigint,
  uploaded_by   uuid,
  created_at    timestamptz not null default now()
);

create index if not exists exercise_video_variants_exercise_idx
  on public.exercise_video_variants (exercise_id, sort_order);

-- Mengisi dari tabel lama (video yang sudah ada tetap jadi video utama):
-- insert into public.exercise_video_variants (exercise_id, storage_path, is_primary, source_code, duration_seconds, size_bytes, uploaded_by, created_at)
-- select exercise_id, storage_path, true, exercise_id, duration_seconds, size_bytes, uploaded_by, created_at
-- from public.exercise_video_assets;

-- Aktifkan RLS dan samakan kebijakannya dengan exercise_video_assets sebelum dipakai aplikasi.
alter table public.exercise_video_variants enable row level security;
