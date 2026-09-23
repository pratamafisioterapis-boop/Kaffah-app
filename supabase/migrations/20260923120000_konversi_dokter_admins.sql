-- Standalone "Konversi Jasa/Tindakan Dokter" app, separate from the clinic
-- system (same pattern as pemilih_admins / rotasi_admins): membership in
-- this table is what grants access to /konversi-dokter, independent of the
-- account's role in public.users. Only a super_admin can grant/revoke it.

create table if not exists public.konversi_dokter_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.konversi_dokter_admins enable row level security;

create policy konversi_dokter_admins_self_select
  on public.konversi_dokter_admins
  for select
  using (auth.uid() = user_id);

create policy konversi_dokter_admins_super_admin_manage
  on public.konversi_dokter_admins
  for all
  using (exists (select 1 from public.users where users.id = auth.uid() and users.role = 'super_admin'))
  with check (exists (select 1 from public.users where users.id = auth.uid() and users.role = 'super_admin'));

-- Preserve access for the owner account already using this feature today.
insert into public.konversi_dokter_admins (user_id, clinic_id)
select u.id, u.clinic_id
from public.users u
where u.email = 'ownersuper@kaffah.com' and u.clinic_id is not null
on conflict (user_id) do nothing;
