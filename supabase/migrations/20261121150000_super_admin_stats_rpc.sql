-- Super admin: statistik ringkasan dalam satu panggilan.
-- Sebelumnya halaman Ringkasan & Langganan menjalankan 1 query count per klinik (N+1).
CREATE OR REPLACE FUNCTION public.super_admin_clinic_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM public.users),
    'patients', (SELECT count(*) FROM public.patients),
    'therapists', (SELECT count(*) FROM public.physiotherapists),
    'patient_counts', COALESCE(
      (SELECT jsonb_object_agg(clinic_id::text, n)
         FROM (SELECT clinic_id, count(*) AS n FROM public.patients WHERE clinic_id IS NOT NULL GROUP BY clinic_id) t),
      '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_clinic_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_clinic_stats() TO authenticated;
