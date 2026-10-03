-- Super admin memilih terapis mana yang muncul di mode "pindah ke terapis"
-- pada akun admin (untuk mengisi SOAP atas nama terapis).
ALTER TABLE public.physiotherapists
  ADD COLUMN IF NOT EXISTS admin_soap_enabled boolean NOT NULL DEFAULT false;

-- Hanya super_admin (atau service role / SQL langsung) yang boleh mengubah flag ini.
CREATE OR REPLACE FUNCTION public.guard_admin_soap_enabled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.admin_soap_enabled IS DISTINCT FROM OLD.admin_soap_enabled
     AND auth.uid() IS NOT NULL
     AND get_my_role() IS DISTINCT FROM 'super_admin' THEN
    NEW.admin_soap_enabled := OLD.admin_soap_enabled;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_admin_soap_enabled ON public.physiotherapists;
CREATE TRIGGER trg_guard_admin_soap_enabled
  BEFORE UPDATE ON public.physiotherapists
  FOR EACH ROW EXECUTE FUNCTION public.guard_admin_soap_enabled();

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
        AND p.admin_soap_enabled
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
        AND p.admin_soap_enabled
    )
  )
  WITH CHECK (filled_by_admin_id = auth.uid());
