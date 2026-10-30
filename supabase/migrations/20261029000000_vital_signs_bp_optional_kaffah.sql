-- Tekanan darah (sistolik + diastolik) boleh kosong KHUSUS klinik Kaffah Physiotherapy.
-- Klinik lain tetap wajib mengisi tekanan darah, nadi, dan SpO2.
-- Nadi dan SpO2 tetap wajib di semua klinik.
ALTER TABLE public.recap_vital_signs
  DROP CONSTRAINT IF EXISTS recap_vital_signs_required_check;

ALTER TABLE public.recap_vital_signs
  ADD CONSTRAINT recap_vital_signs_required_check
  CHECK (
    pulse IS NOT NULL AND spo2 IS NOT NULL
    AND (
      clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid
      OR (systolic IS NOT NULL AND diastolic IS NOT NULL)
    )
  ) NOT VALID;
