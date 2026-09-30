-- Manajemen User (Super Admin) mengkategorikan akun pemilih, sehingga
-- super_admin perlu bisa membaca pemilih_admins & pemilih_dpc. Hanya SELECT.
drop policy if exists pemilih_admins_super_admin_select on public.pemilih_admins;
create policy pemilih_admins_super_admin_select on public.pemilih_admins
  for select
  using (exists (select 1 from public.users where users.id = auth.uid() and users.role = 'super_admin'));

drop policy if exists pemilih_dpc_super_admin_select on public.pemilih_dpc;
create policy pemilih_dpc_super_admin_select on public.pemilih_dpc
  for select
  using (exists (select 1 from public.users where users.id = auth.uid() and users.role = 'super_admin'));
