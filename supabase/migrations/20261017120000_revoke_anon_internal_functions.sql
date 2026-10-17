-- Tinjauan fungsi SECURITY DEFINER yang masih bisa dipanggil `anon`
-- (advisor 0028). Hanya mencabut EXECUTE dari anon/PUBLIC untuk fungsi yang
-- terbukti bukan bagian dari alur tanpa login:
--   * tidak dipakai policy RLS, default kolom, atau view (dicek via pg_depend)
--   * tidak dipanggil halaman publik (booking, feedback, invoice, landing)
--   * pemanggil internal (fungsi SECURITY DEFINER lain, trigger, pg_cron)
--     berjalan sebagai pemilik fungsi sehingga tidak terpengaruh.
--
-- Sengaja TIDAK dicabut (dipakai anon/RLS, lihat manual/7_public_rpc_hardening.sql):
--   get_my_role, get_my_clinic_id, pemilih_dpc_kecamatan_id   -- dipakai policy RLS
--   create_appointment_safe, get_available_slots_with_status_by_date,
--   search_patient_for_booking, match_patient_for_new_registration,
--   get_patient_therapist_history_public                      -- halaman booking
--   get_clinic_by_host, get_clinic_pricelist, get_public_feedback -- landing klinik
--   get_feedback_link_info, submit_patient_feedback,
--   mark_feedback_google_review_clicked                       -- halaman feedback
--   get_public_invoice_url                                    -- halaman /i/:id
--   lookup_referral_reward, get_decree_signer_signature       -- sudah cek auth
--
-- Tanpa DROP; aman lewat apply_migration. Loop memakai pg_proc supaya semua
-- overload ikut tercakup.

-- 1. Fungsi cron/internal: hanya service_role (pg_cron berjalan sebagai postgres).
DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('auto_generate_next_target', 'carry_over_unmet_therapist_targets')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END
$do$;

-- 2. Fungsi yang hanya dipakai user login (admin/terapis/owner/pemilih).
DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'check_recurring_slot_conflicts', 'create_recurring_appointment_safe',
        'check_slot_availability', 'generate_next_medical_record_number',
        'get_active_therapist_target', 'get_clinic_therapists_soap_lock_status',
        'get_soap_deadline_notice', 'get_therapist_oldest_unfilled_soap_age_days',
        'get_therapist_overdue_daily_soap_count', 'get_therapist_period_range',
        'get_therapist_soap_lock_status', 'get_therapist_target_progress',
        'get_therapist_unfilled_soap_count_in_period', 'is_therapist_soap_locked',
        'cancel_pending_inventory_order', 'create_pending_inventory_order',
        'delete_inventory_stock_in', 'delete_inventory_stock_out',
        'update_inventory_stock_in', 'update_inventory_stock_out',
        'receive_pending_inventory_order', 'restock_inventory_item',
        'take_inventory_stock', 'mark_audit_log_read',
        'merge_accounting_subcategory', 'move_accounting_subcategory',
        'pemilih_create_dpc_account', 'pemilih_delete_dpc_account',
        'pemilih_reset_dpc_password', 'send_invoice_whatsapp'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END
$do$;

-- 3. Trigger function: tidak bisa dipanggil langsung lewat /rpc dan hak EXECUTE
--    tidak diperiksa saat trigger berjalan (hanya saat CREATE TRIGGER).
DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END
$do$;
