-- Pekerjaan, agama, dan foto KTP pasien.
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS occupation text,
  ADD COLUMN IF NOT EXISTS religion text,
  ADD COLUMN IF NOT EXISTS ktp_photo_path text;

-- Bucket privat: KTP adalah data sensitif. Path: {clinic_id}/{uuid}.{ext}
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-ktp', 'patient-ktp', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY patient_ktp_storage_clinic_manage ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'patient-ktp'
    AND get_my_role() = ANY (ARRAY['owner', 'admin', 'super_admin'])
    AND (storage.foldername(name))[1] = get_my_clinic_id()::text
  )
  WITH CHECK (
    bucket_id = 'patient-ktp'
    AND get_my_role() = ANY (ARRAY['owner', 'admin', 'super_admin'])
    AND (storage.foldername(name))[1] = get_my_clinic_id()::text
  );
