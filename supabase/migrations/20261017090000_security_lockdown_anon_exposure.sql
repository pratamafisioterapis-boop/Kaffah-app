-- Security lockdown: tutup eksposur data/aksi untuk role `anon`
-- (temuan audit Supabase advisor + uji langsung sebagai role anon).
--
-- Migrasi ini TIDAK memakai DROP supaya aman dijalankan lewat apply_migration
-- (tool menolak statement DROP). Perubahan yang butuh DROP POLICY ada di
-- supabase/manual/5_storage_lockdown.sql (jalankan di SQL Editor).
--
-- Isi:
--   1. Policy "Service role full access ..." yang ternyata berlaku untuk PUBLIC
--      (migrasi 20260913010000 belum pernah ter-apply di database live).
--   2. Fungsi SECURITY DEFINER tanpa pengecekan auth yang bisa dipanggil anon
--      (hapus pasien beserta cascade, hapus janji lampau, CRUD target terapis).
--   3. View SECURITY DEFINER (melewati RLS) yang bisa dibaca anon.
--   4. Tabel public._subj_units tanpa RLS.

-- ---------------------------------------------------------------------------
-- 1. Policy "Service role full access" -> benar-benar hanya service_role.
--    service_role sudah bypass RLS; metadata-only, tidak menyentuh data.
-- ---------------------------------------------------------------------------
ALTER POLICY "Service role full access patient_feedback_links"
  ON public.patient_feedback_links TO service_role;
ALTER POLICY "Service role full access patient_feedback_responses"
  ON public.patient_feedback_responses TO service_role;
ALTER POLICY "Service role full access clinic_pricelist"
  ON public.clinic_pricelist TO service_role;
ALTER POLICY "Service role full access employee_attendance_records"
  ON public.employee_attendance_records TO service_role;
ALTER POLICY "Service role full access employee_attendance_shift_settings"
  ON public.employee_attendance_shift_settings TO service_role;
ALTER POLICY "Service role full access therapist_schedule_overrides"
  ON public.therapist_schedule_overrides TO service_role;
ALTER POLICY "Service role full access attendance_employee_aliases"
  ON public.attendance_employee_aliases TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Fungsi destruktif: cabut akses anon/PUBLIC.
--    cron (role postgres) dan service_role tidak terpengaruh.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.delete_patient_with_cascade(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.delete_patient_with_cascade(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.delete_past_appointments() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.delete_past_appointments() TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_therapist_target(uuid, uuid, date, date, integer, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_therapist_target(uuid, uuid, date, date, integer, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_therapist_target(uuid, integer, date, date, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_therapist_target(uuid, integer, date, date, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.delete_therapist_target(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.delete_therapist_target(uuid) TO authenticated, service_role;

-- delete_patient_with_cascade: HARD DELETE lintas-tabel tanpa cek apa pun.
-- Tambahkan guard peran + isolasi klinik (tidak dipakai frontend saat ini).
CREATE OR REPLACE FUNCTION public.delete_patient_with_cascade(target_patient_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_role   text;
  v_clinic uuid;
  v_patient_clinic uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    v_role   := public.get_my_role();
    v_clinic := public.get_my_clinic_id();

    IF v_role IS NULL OR v_role NOT IN ('super_admin', 'owner', 'clinic_admin', 'admin') THEN
      RAISE EXCEPTION 'Forbidden: tidak punya izin menghapus pasien' USING ERRCODE = '42501';
    END IF;

    IF v_role <> 'super_admin' THEN
      SELECT clinic_id INTO v_patient_clinic FROM public.patients WHERE id = target_patient_id;
      IF v_patient_clinic IS DISTINCT FROM v_clinic THEN
        RAISE EXCEPTION 'Forbidden: pasien bukan milik klinik Anda' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- Delete related records in order of dependency to avoid FK violations.
  -- This function performs a HARD DELETE on all related data.
  DELETE FROM public.medical_records_detailed WHERE patient_id = target_patient_id;
  DELETE FROM public.medical_records WHERE patient_id = target_patient_id;
  DELETE FROM public.daily_recaps WHERE patient_id = target_patient_id;
  DELETE FROM public.invoice_records WHERE patient_id = target_patient_id;
  DELETE FROM public.financial_transactions WHERE patient_id = target_patient_id;
  DELETE FROM public.receivables WHERE patient_id = target_patient_id;
  DELETE FROM public.treatment_packages WHERE patient_id = target_patient_id;

  -- Package usage history and shares depend on package_tracking or patients
  DELETE FROM public.package_usage_history WHERE used_by_patient_id = target_patient_id;
  DELETE FROM public.package_shares WHERE shared_to_patient_id = target_patient_id OR shared_by_patient_id = target_patient_id;

  DELETE FROM public.package_tracking WHERE patient_id = target_patient_id;
  DELETE FROM public.appointments WHERE patient_id = target_patient_id;
  DELETE FROM public.follow_ups WHERE patient_id = target_patient_id;
  DELETE FROM public.wa_schedule_logs WHERE patient_id = target_patient_id;
  DELETE FROM public.patient_progress WHERE patient_id = target_patient_id;
  DELETE FROM public.patient_programs WHERE patient_id = target_patient_id;

  -- Finally delete the patient
  DELETE FROM public.patients WHERE id = target_patient_id;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. View SECURITY DEFINER: cabut akses anon.
--    Hanya daily_recaps_with_labels yang dipakai frontend (user login).
--    Catatan: view tetap melewati RLS untuk user login lintas klinik; lihat
--    supabase/manual/6_views_security_invoker.sql untuk langkah lanjutan.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.patients_view                       FROM anon;
REVOKE ALL ON public.patients_master_view                FROM anon;
REVOKE ALL ON public.patients_view_with_completeness     FROM anon;
REVOKE ALL ON public.daily_recaps_with_labels            FROM anon;
REVOKE ALL ON public.daily_recaps_search_view            FROM anon;
REVOKE ALL ON public.package_tracking_view               FROM anon;
REVOKE ALL ON public.package_tracking_frontend           FROM anon;
REVOKE ALL ON public.owner_today_available_slots         FROM anon;
REVOKE ALL ON public.owner_today_available_slots_with_name FROM anon;
REVOKE ALL ON public.therapist_daily_status_base         FROM anon;

-- ---------------------------------------------------------------------------
-- 4. Tabel tanpa RLS.
-- ---------------------------------------------------------------------------
ALTER TABLE public._subj_units ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._subj_units FROM anon, authenticated;
