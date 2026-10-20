-- TTV wajib memuat tekanan darah (sistolik + diastolik), nadi, dan SpO2.
-- NOT VALID: data lama yang belum lengkap tidak menggagalkan migrasi; hanya INSERT/UPDATE baru yang diperiksa.
-- Setelah data lama dilengkapi (atau diputuskan dibiarkan), VALIDATE CONSTRAINT bila diinginkan.
ALTER TABLE public.recap_vital_signs
  DROP CONSTRAINT IF EXISTS recap_vital_signs_required_check;

ALTER TABLE public.recap_vital_signs
  ADD CONSTRAINT recap_vital_signs_required_check
  CHECK (systolic IS NOT NULL AND diastolic IS NOT NULL AND pulse IS NOT NULL AND spo2 IS NOT NULL) NOT VALID;
