-- Percepat pencarian & listing Database Pasien.
-- Pencarian memakai ILIKE '%term%' pada nama / No RM / No HP, yang tidak bisa
-- memakai btree biasa; trigram GIN index membuatnya cepat.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_patients_full_name_trgm
  ON public.patients USING gin (full_name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_patients_rm_number_trgm
  ON public.patients USING gin (medical_record_number extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_patients_phone_trgm
  ON public.patients USING gin (phone extensions.gin_trgm_ops);

-- Listing: WHERE clinic_id = ? ORDER BY created_at DESC LIMIT 20
CREATE INDEX IF NOT EXISTS idx_patients_clinic_created_at
  ON public.patients (clinic_id, created_at DESC);
