-- Format bagian Assessment (SOAP) per klinik.
-- 'icf'       (default, perilaku lama): Assessment disusun otomatis format ICF.
-- 'diagnosis' : Assessment berisi diagnosa fisioterapi yang dipilih terapis.
-- Hanya super admin yang mengubahnya (lewat halaman Klinik).
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS assessment_mode text NOT NULL DEFAULT 'icf';

ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_assessment_mode_check;
ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_assessment_mode_check
  CHECK (assessment_mode IN ('icf', 'diagnosis'));
