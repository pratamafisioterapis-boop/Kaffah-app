-- Variabel kustom untuk template Subjective.
--
-- Owner bisa membuat variabel (pilihan, isian bebas, angka, tanggal, durasi)
-- lalu menyisipkannya ke template diagnosa sebagai {{key}}. Saat terapis
-- mengisi SOAP, {{key}} otomatis tampil sebagai isian klik-pilih yang sesuai.

drop table if exists public._subj_units;

create table if not exists public.subjective_variables (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default public.get_my_clinic_id() references public.clinics(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  label text not null,
  kind text not null default 'choice' check (kind in ('choice', 'free', 'number', 'date', 'duration')),
  options text[] not null default '{}',
  multi boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, key)
);

alter table public.subjective_variables enable row level security;

create policy "subjective_variables_read" on public.subjective_variables
  for select to authenticated
  using (public.get_my_role() = 'super_admin' or clinic_id = public.get_my_clinic_id());

create policy "subjective_variables_write" on public.subjective_variables
  for all to authenticated
  using (public.get_my_role() = 'super_admin' or (clinic_id = public.get_my_clinic_id() and public.get_my_role() = 'owner'))
  with check (public.get_my_role() = 'super_admin' or (clinic_id = public.get_my_clinic_id() and public.get_my_role() = 'owner'));
