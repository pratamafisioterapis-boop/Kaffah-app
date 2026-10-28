-- Satukan role admin klinik menjadi 'admin'. 'clinic_admin' adalah nama lama
-- yang dibuat form "Tambah Admin"; banyak RLS policy & fungsi (layanan,
-- payroll, jadwal terapis, notifikasi booking/SOAP, dll.) hanya mengecek
-- 'admin', sehingga akun clinic_admin tidak punya hak yang sama.
-- Semua kode (RLS, fungsi, edge function, frontend) sekarang memakai 'admin'.

-- 1. Migrasi data. guard_user_privilege_columns hanya mengizinkan perubahan
--    role lewat flag trusted internal call.
SELECT set_config('app.trusted_role_change', 'on', true);

UPDATE public.users SET role = 'admin' WHERE role = 'clinic_admin';

UPDATE auth.users
   SET raw_user_meta_data = jsonb_set(raw_user_meta_data, '{role}', '"admin"')
 WHERE raw_user_meta_data->>'role' = 'clinic_admin';

-- 2. Hanya satu nama yang diizinkan.
ALTER TABLE public.users DROP CONSTRAINT users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'therapist'::text, 'physiotherapist'::text, 'patient'::text, 'super_admin'::text, 'konversi_dokter'::text]));

-- 3. Pengaman transisi: client/edge function lama yang masih mengirim
--    'clinic_admin' otomatis dinormalisasi (jalan sebelum guard & CHECK).
CREATE OR REPLACE FUNCTION public.normalize_legacy_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role = 'clinic_admin' THEN
    NEW.role := 'admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_a_normalize_legacy_admin_role ON public.users;
CREATE TRIGGER trg_a_normalize_legacy_admin_role
  BEFORE INSERT OR UPDATE OF role ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.normalize_legacy_admin_role();
