-- Laboratory & Radiology pada SOAP: lampiran gambar + keterangan bebas.
-- lab_radiology_data: { lab: { files: [{path,name}], note }, radiology: { files: [...], note } }
ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS lab_radiology_data jsonb;

-- Bucket privat. Path: {clinic_id}/{uuid}.{ext}
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-record-attachments', 'medical-record-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY medical_record_attachments_clinic_manage ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'medical-record-attachments'
    AND (storage.foldername(name))[1] = get_my_clinic_id()::text
  )
  WITH CHECK (
    bucket_id = 'medical-record-attachments'
    AND (storage.foldername(name))[1] = get_my_clinic_id()::text
  );
