-- Fondasi bridging SATUSEHAT (Kemenkes): identitas pasien/nakes dan kode ICD.
-- Belum ada pengiriman data; ini hanya field + kode terstandar yang nanti dipakai
-- resource FHIR (Patient/Practitioner, Condition = ICD-10, Procedure = ICD-9-CM).

-- 1) Pasien: NIK sudah ada (patients.nik). IHS Number = ID pasien di SATUSEHAT,
--    didapat dari pencarian NIK ke API; sementara bisa diisi manual.
alter table public.patients
  add column if not exists ihs_number text,
  add column if not exists ihs_checked_at timestamptz;

comment on column public.patients.ihs_number is
  'IHS Number SATUSEHAT pasien (diperoleh dari pencarian NIK ke API SATUSEHAT).';

-- 2) Kode ICD pada katalog diagnosa (category = diagnosa) dan layanan/tindakan
--    (category = service). icd_verified = kode sudah ditinjau klinisi klinik.
alter table public.operational_options
  add column if not exists icd10_code text,
  add column if not exists icd9_code text,
  add column if not exists icd_verified boolean not null default false;

comment on column public.operational_options.icd10_code is
  'Kode ICD-10 untuk diagnosa (Condition SATUSEHAT), contoh M54.5.';
comment on column public.operational_options.icd9_code is
  'Kode ICD-9-CM prosedur untuk layanan/tindakan (Procedure SATUSEHAT), contoh 93.39.';
comment on column public.operational_options.icd_verified is
  'true bila kode ICD sudah ditinjau/dikonfirmasi klinisi (bukan sekadar saran otomatis).';

do $fn$
begin
  if not exists (select 1 from pg_constraint where conname = 'operational_options_icd10_format') then
    alter table public.operational_options
      add constraint operational_options_icd10_format
      check (icd10_code is null or icd10_code ~ '^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'operational_options_icd9_format') then
    alter table public.operational_options
      add constraint operational_options_icd9_format
      check (icd9_code is null or icd9_code ~ '^[0-9]{2}(\.[0-9]{1,2})?$');
  end if;
end
$fn$;

-- Saran awal dari template edukasi (diagnosis_education.icd10). Hanya kode bersih
-- yang diambil; yang bertanda "*", "-", atau lebih dari satu kode dibiarkan kosong
-- agar ditentukan klinisi. icd_verified tetap false.
update public.operational_options o
   set icd10_code = btrim(e.icd10)
  from public.diagnosis_education e
 where o.category = 'diagnosa'
   and o.icd10_code is null
   and lower(btrim(o.label)) = e.diagnosis_key
   and btrim(e.icd10) ~ '^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$';

-- 3) Identitas nakes (NIK + IHS Practitioner) di tabel terpisah. physiotherapists
--    dibaca halaman publik (profil terapis), jadi NIK tidak ditaruh di sana.
create table if not exists public.physiotherapist_satusehat (
  physiotherapist_id uuid primary key references public.physiotherapists(id) on delete cascade,
  clinic_id uuid not null,
  nik text check (nik is null or nik ~ '^[0-9]{16}$'),
  ihs_number text,
  ihs_checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists physiotherapist_satusehat_clinic_idx
  on public.physiotherapist_satusehat (clinic_id);

alter table public.physiotherapist_satusehat enable row level security;

create policy "physiotherapist_satusehat_staff_all" on public.physiotherapist_satusehat
  for all to authenticated
  using (
    public.get_my_role() = 'super_admin'
    or (clinic_id = public.get_my_clinic_id() and public.get_my_role() in ('owner', 'admin'))
  )
  with check (
    public.get_my_role() = 'super_admin'
    or (clinic_id = public.get_my_clinic_id() and public.get_my_role() in ('owner', 'admin'))
  );
