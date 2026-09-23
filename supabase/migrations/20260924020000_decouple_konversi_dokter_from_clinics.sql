-- Konversi Dokter is a fully standalone app (like Pemilih) — it must never
-- require or depend on the clinic system's `clinics` table. Data isolation
-- is per Konversi Dokter account instead of per clinic.

alter table public.insentif_dokter_reports
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;

update public.insentif_dokter_reports
  set owner_user_id = created_by
  where owner_user_id is null and created_by is not null;

alter table public.insentif_dokter_reports
  alter column owner_user_id set not null;

alter table public.insentif_dokter_reports
  alter column clinic_id drop not null;

drop policy if exists "Users manage insentif dokter reports of their clinic" on public.insentif_dokter_reports;

create policy insentif_dokter_reports_owner_only
  on public.insentif_dokter_reports
  for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- konversi_dokter_admins never needed a clinic — drop the leftover column.
alter table public.konversi_dokter_admins
  drop column if exists clinic_id;
