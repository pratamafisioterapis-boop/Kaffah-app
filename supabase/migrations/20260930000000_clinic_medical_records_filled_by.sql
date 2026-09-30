-- Siapa yang mengisi Medical Records (rekam medis) per klinik.
-- 'admin'     (default, perilaku lama): admin klinik mengisi rekam medis.
-- 'therapist' : terapis mengisi rekam medis; admin hanya bisa melihat.
-- Hanya super admin yang mengubahnya (lewat halaman Klinik).
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS medical_records_filled_by text NOT NULL DEFAULT 'admin';

ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_medical_records_filled_by_check;
ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_medical_records_filled_by_check
  CHECK (medical_records_filled_by IN ('admin', 'therapist'));
