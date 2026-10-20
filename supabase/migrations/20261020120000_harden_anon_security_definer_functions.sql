-- Hardening fungsi SECURITY DEFINER yang bisa dipanggil tanpa login.
-- Booking online publik tetap jalan: fungsi yang dipakai SmartBookingPage /
-- ClinicBookingPage / portal pasien / feedback / invoice TIDAK disentuh.

-- 1) Fungsi khusus staf (sudah cek auth.uid()/role di dalamnya): cabut dari anon.
--    REVOKE dari PUBLIC juga, karena default grant PUBLIC membuat anon ikut bisa.
REVOKE EXECUTE ON FUNCTION public.set_recovery_outside_package(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lookup_referral_reward(text, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_decree_signer_signature(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_recovery_outside_package(uuid, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lookup_referral_reward(text, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_decree_signer_signature(uuid) TO authenticated, service_role;

-- 2) Pencarian pasien lama untuk booking publik: tolak nama kosong/pendek dan
--    escape wildcard LIKE, supaya '%' atau '' tidak bisa dipakai menyapu seluruh
--    pasien berdasarkan tanggal lahir saja. Perilaku booking normal tidak berubah.
CREATE OR REPLACE FUNCTION public.search_patient_for_booking(p_last_name text, p_birth_date date, p_clinic_id uuid)
 RETURNS TABLE(id uuid, full_name text, nickname text, birth_date date, phone character varying, gender character varying, medical_record_number character varying)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text := btrim(coalesce(p_last_name, ''));
BEGIN
  IF length(v_name) < 2 OR p_birth_date IS NULL THEN
    RETURN;
  END IF;
  v_name := replace(replace(replace(v_name, '\', '\\'), '%', '\%'), '_', '\_');

  RETURN QUERY
  SELECT p.id, p.full_name, p.nickname, p.birth_date, p.phone, p.gender, p.medical_record_number
  FROM patients p
  WHERE p.birth_date = p_birth_date
    AND p.full_name ILIKE '%' || v_name
    AND p.status = 'aktif'
    AND p.clinic_id = p_clinic_id
  LIMIT 5;
END;
$function$;
