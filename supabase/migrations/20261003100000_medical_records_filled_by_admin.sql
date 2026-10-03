-- Admin bisa mengisi SOAP atas nama terapis (menu "Masuk sebagai Terapis").
-- created_by tetap terapis; filled_by_admin_id menandai bahwa pengisian
-- dilakukan lewat akun admin.
ALTER TABLE public.medical_records
  ADD COLUMN IF NOT EXISTS filled_by_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Admin can insert SOAP for clinic therapist" ON public.medical_records;
CREATE POLICY "Admin can insert SOAP for clinic therapist" ON public.medical_records
  FOR INSERT TO authenticated
  WITH CHECK (
    filled_by_admin_id = auth.uid()
    AND get_my_role() IN ('admin', 'clinic_admin')
    AND EXISTS (
      SELECT 1 FROM public.physiotherapists p
      WHERE p.user_id = medical_records.created_by
        AND p.clinic_id = get_my_clinic_id()
    )
  );

DROP POLICY IF EXISTS "Admin can update SOAP for clinic therapist" ON public.medical_records;
CREATE POLICY "Admin can update SOAP for clinic therapist" ON public.medical_records
  FOR UPDATE TO authenticated
  USING (
    get_my_role() IN ('admin', 'clinic_admin')
    AND EXISTS (
      SELECT 1 FROM public.physiotherapists p
      WHERE p.user_id = medical_records.created_by
        AND p.clinic_id = get_my_clinic_id()
    )
  )
  WITH CHECK (filled_by_admin_id = auth.uid());
