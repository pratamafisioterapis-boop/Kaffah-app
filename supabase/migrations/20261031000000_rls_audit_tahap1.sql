-- AUDIT RLS Oktober 2026 — TAHAP 1: kebocoran data yang terbukti bisa dibaca oleh
-- SEMUA pengguna yang login (termasuk akun pasien portal).
--
-- Bukti simulasi sebelum perbaikan (pasien portal): system_settings 3 baris (berisi kunci API),
-- bsi_* 971 baris (mutasi bank), patients_booking_online 21, fcm_tokens 55.
-- Rollback: supabase/manual/rollback_rls_audit_2026-10.sql

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Fungsi bantu: klinik milik pengguna lain. SECURITY DEFINER agar tidak bergantung
-- pada RLS tabel users saat dipakai di dalam policy tabel lain.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rls_clinic_of_user(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clinic_id FROM public.users WHERE id = p_user_id
$$;
REVOKE ALL ON FUNCTION public.rls_clinic_of_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rls_clinic_of_user(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1.1 system_settings: berisi kunci API pihak ketiga. Tidak ada kode aplikasi yang memakainya
--     (0 referensi di src & functions), jadi ditutup penuh untuk klien (service role tetap bisa).
--     Kunci bablast_api_key dihapus atas permintaan pemilik (sudah tidak dipakai).
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM public.system_settings WHERE key = 'bablast_api_key';
DROP POLICY IF EXISTS authenticated_only_system_settings ON public.system_settings;
REVOKE ALL ON public.system_settings FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1.2 bsi_*: mutasi rekening bank Kaffah. Hanya owner Kaffah (dan super_admin).
--     Dipakai satu halaman saja (BSIMutasiReconciliation, rute owner).
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated can all bsi_debit_settlements" ON public.bsi_debit_settlements;
DROP POLICY IF EXISTS "Authenticated users can delete bsi_mutasi_transactions" ON public.bsi_mutasi_transactions;
DROP POLICY IF EXISTS "Authenticated users can insert bsi_mutasi_transactions" ON public.bsi_mutasi_transactions;
DROP POLICY IF EXISTS "Authenticated users can read bsi_mutasi_transactions" ON public.bsi_mutasi_transactions;
DROP POLICY IF EXISTS "Authenticated users can delete bsi_mutasi_uploads" ON public.bsi_mutasi_uploads;
DROP POLICY IF EXISTS "Authenticated users can insert bsi_mutasi_uploads" ON public.bsi_mutasi_uploads;
DROP POLICY IF EXISTS "Authenticated users can read bsi_mutasi_uploads" ON public.bsi_mutasi_uploads;
DROP POLICY IF EXISTS "authenticated can all bsi_reconciliation_checks" ON public.bsi_reconciliation_checks;

CREATE POLICY bsi_owner_kaffah ON public.bsi_debit_settlements FOR ALL TO authenticated
  USING (
    (SELECT get_my_role()) IN ('owner', 'super_admin')
    AND ((SELECT get_my_role()) = 'super_admin'
         OR (SELECT get_my_clinic_id()) = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid))
  WITH CHECK (
    (SELECT get_my_role()) IN ('owner', 'super_admin')
    AND ((SELECT get_my_role()) = 'super_admin'
         OR (SELECT get_my_clinic_id()) = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid));
CREATE POLICY bsi_owner_kaffah ON public.bsi_mutasi_transactions FOR ALL TO authenticated
  USING (
    (SELECT get_my_role()) IN ('owner', 'super_admin')
    AND ((SELECT get_my_role()) = 'super_admin'
         OR (SELECT get_my_clinic_id()) = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid))
  WITH CHECK (
    (SELECT get_my_role()) IN ('owner', 'super_admin')
    AND ((SELECT get_my_role()) = 'super_admin'
         OR (SELECT get_my_clinic_id()) = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid));
CREATE POLICY bsi_owner_kaffah ON public.bsi_mutasi_uploads FOR ALL TO authenticated
  USING (
    (SELECT get_my_role()) IN ('owner', 'super_admin')
    AND ((SELECT get_my_role()) = 'super_admin'
         OR (SELECT get_my_clinic_id()) = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid))
  WITH CHECK (
    (SELECT get_my_role()) IN ('owner', 'super_admin')
    AND ((SELECT get_my_role()) = 'super_admin'
         OR (SELECT get_my_clinic_id()) = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid));
CREATE POLICY bsi_owner_kaffah ON public.bsi_reconciliation_checks FOR ALL TO authenticated
  USING (
    (SELECT get_my_role()) IN ('owner', 'super_admin')
    AND ((SELECT get_my_role()) = 'super_admin'
         OR (SELECT get_my_clinic_id()) = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid))
  WITH CHECK (
    (SELECT get_my_role()) IN ('owner', 'super_admin')
    AND ((SELECT get_my_role()) = 'super_admin'
         OR (SELECT get_my_clinic_id()) = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'::uuid));

-- ─────────────────────────────────────────────────────────────────────────────
-- 1.3 fcm_tokens: token push semua pengguna terbaca & bisa dihapus siapa pun yang login.
--     - Tulis hanya milik sendiri.
--     - Baca/hapus: milik sendiri, atau staf (owner/admin/therapist) untuk pengguna KLINIK YANG SAMA
--       (dibutuhkan fungsi notify_single_therapist_soap_lock yang berjalan sebagai pemanggil).
--     - register_fcm_token: pendaftaran token + pembersihan token pengguna lain di perangkat
--       yang sama (dulu dilakukan klien dengan DELETE lintas pengguna).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_fcm_token(p_device_id text, p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Tidak terautentikasi';
  END IF;
  IF coalesce(p_device_id, '') = '' OR coalesce(p_token, '') = '' THEN
    RAISE EXCEPTION 'device_id dan token wajib diisi';
  END IF;

  -- Satu perangkat / satu token hanya boleh terikat ke satu pengguna.
  DELETE FROM public.fcm_tokens WHERE device_id = p_device_id AND user_id <> v_uid;
  DELETE FROM public.fcm_tokens WHERE token = p_token AND user_id <> v_uid;

  INSERT INTO public.fcm_tokens (user_id, device_id, token, updated_at)
  VALUES (v_uid, p_device_id, p_token, now())
  ON CONFLICT (user_id, device_id)
  DO UPDATE SET token = EXCLUDED.token, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.register_fcm_token(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_fcm_token(text, text) TO authenticated;

DROP POLICY IF EXISTS authenticated_only_fcm_tokens ON public.fcm_tokens;

CREATE POLICY fcm_tokens_select ON public.fcm_tokens FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT get_my_role()) = 'super_admin'
    OR ((SELECT get_my_role()) IN ('owner', 'admin', 'therapist')
        AND public.rls_clinic_of_user(fcm_tokens.user_id) = (SELECT get_my_clinic_id()))
  );
CREATE POLICY fcm_tokens_insert ON public.fcm_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY fcm_tokens_update ON public.fcm_tokens FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY fcm_tokens_delete ON public.fcm_tokens FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT get_my_role()) = 'super_admin'
    OR ((SELECT get_my_role()) IN ('owner', 'admin', 'therapist')
        AND public.rls_clinic_of_user(fcm_tokens.user_id) = (SELECT get_my_clinic_id()))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 1.4 patients_booking_online: nama, telepon, email, riwayat medis. Pengisian tetap terbuka
--     (policy public_insert_booking_online tidak diubah); membaca hanya staf.
--     (createOnlinePatient tidak dipakai di mana pun di kode saat ini.)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated users to read patients_booking_online" ON public.patients_booking_online;
CREATE POLICY patients_booking_online_staff_read ON public.patients_booking_online FOR SELECT TO authenticated
  USING ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 1.5 general_settings & appointment_settings: satu baris global tanpa clinic_id; kode klien hanya
--     MEMBACA. Baca tetap seperti semula; tulis hanya super_admin.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS authenticated_only_general_settings ON public.general_settings;
CREATE POLICY general_settings_read ON public.general_settings FOR SELECT TO authenticated
  USING (true);
CREATE POLICY general_settings_write_super ON public.general_settings FOR ALL TO authenticated
  USING ((SELECT get_my_role()) = 'super_admin')
  WITH CHECK ((SELECT get_my_role()) = 'super_admin');

DROP POLICY IF EXISTS "Auth modify settings" ON public.appointment_settings;
CREATE POLICY appointment_settings_write_super ON public.appointment_settings FOR ALL TO authenticated
  USING ((SELECT get_my_role()) = 'super_admin')
  WITH CHECK ((SELECT get_my_role()) = 'super_admin');
-- "Public read settings" (baca publik untuk halaman booking) sengaja dibiarkan.

COMMIT;
