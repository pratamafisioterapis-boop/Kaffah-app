-- ROLLBACK audit RLS Oktober 2026 (Tahap 1-3).
--
-- Mengembalikan 46 policy ke definisi persis sebelum audit (diambil dari pg_policies
-- sebelum perubahan). Pakai hanya bila Tahap 1-3 menimbulkan masalah.
--
-- URUTAN: (1) hapus policy BARU dari Tahap 1-3 (bagian A), (2) buat ulang policy LAMA
-- (bagian B). Aman dijalankan dalam satu transaksi.
--
-- Catatan: kolom patients_booking_online.clinic_id (migrasi 20261031030000) sengaja DIBIARKAN saat rollback.
--
-- TIDAK bisa dipulihkan lewat skrip ini: baris `bablast_api_key` di system_settings
-- (sengaja dihapus atas permintaan pemilik karena tidak dipakai lagi).

BEGIN;

-- ───────────── A. Hapus policy baru ─────────────
DROP POLICY IF EXISTS bsi_owner_kaffah ON public.bsi_debit_settlements;
DROP POLICY IF EXISTS bsi_owner_kaffah ON public.bsi_mutasi_transactions;
DROP POLICY IF EXISTS bsi_owner_kaffah ON public.bsi_mutasi_uploads;
DROP POLICY IF EXISTS bsi_owner_kaffah ON public.bsi_reconciliation_checks;
DROP POLICY IF EXISTS fcm_tokens_select ON public.fcm_tokens;
DROP POLICY IF EXISTS fcm_tokens_insert ON public.fcm_tokens;
DROP POLICY IF EXISTS fcm_tokens_update ON public.fcm_tokens;
DROP POLICY IF EXISTS fcm_tokens_delete ON public.fcm_tokens;
DROP POLICY IF EXISTS patients_booking_online_staff_read ON public.patients_booking_online;
DROP POLICY IF EXISTS patients_booking_online_public_insert ON public.patients_booking_online;
DROP POLICY IF EXISTS general_settings_read ON public.general_settings;
DROP POLICY IF EXISTS general_settings_write_super ON public.general_settings;
DROP POLICY IF EXISTS appointment_settings_write_super ON public.appointment_settings;
DROP POLICY IF EXISTS invoice_records_clinic_staff ON public.invoice_records;
DROP POLICY IF EXISTS payroll_records_clinic_staff ON public.payroll_records;
DROP POLICY IF EXISTS expenses_clinic_staff ON public.expenses;
DROP POLICY IF EXISTS expense_income_categories_read ON public.expense_income_categories;
DROP POLICY IF EXISTS expense_income_categories_write ON public.expense_income_categories;
DROP POLICY IF EXISTS financial_transactions_clinic_staff ON public.financial_transactions;
DROP POLICY IF EXISTS invoice_settings_read ON public.invoice_settings;
DROP POLICY IF EXISTS invoice_settings_write ON public.invoice_settings;
DROP POLICY IF EXISTS media_assets_insert ON public.media_assets;
DROP POLICY IF EXISTS media_assets_update ON public.media_assets;
DROP POLICY IF EXISTS media_assets_delete ON public.media_assets;
DROP POLICY IF EXISTS patient_info_options_read ON public.patient_info_options;
DROP POLICY IF EXISTS patient_info_options_write ON public.patient_info_options;
DROP POLICY IF EXISTS clinic_images_insert ON public.clinic_images;
DROP POLICY IF EXISTS clinic_images_update ON public.clinic_images;
DROP POLICY IF EXISTS clinic_images_delete ON public.clinic_images;
DROP POLICY IF EXISTS services_write_super ON public.services;
DROP POLICY IF EXISTS therapist_badges_master_write ON public.therapist_badges_master;
DROP POLICY IF EXISTS therapist_schedule_overrides_write ON public.therapist_schedule_overrides;
DROP POLICY IF EXISTS therapist_slots_write ON public.therapist_slots;
DROP POLICY IF EXISTS therapist_time_off_write ON public.therapist_time_off;
DROP POLICY IF EXISTS accounting_categories_read ON public.accounting_categories;
DROP POLICY IF EXISTS accounting_categories_write ON public.accounting_categories;
DROP POLICY IF EXISTS accounting_subcategories_read ON public.accounting_subcategories;
DROP POLICY IF EXISTS accounting_subcategories_write ON public.accounting_subcategories;
DROP POLICY IF EXISTS operational_options_write ON public.operational_options;

-- Hak akses tabel yang dicabut di Tahap 1
GRANT ALL ON public.system_settings TO anon, authenticated;

-- ───────────── B. Buat ulang policy lama (46) ─────────────
CREATE POLICY "Enable all for authenticated users" ON public.accounting_categories AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY "allow read categories" ON public.accounting_categories AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Enable all for authenticated users" ON public.accounting_subcategories AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY "allow read subcategories" ON public.accounting_subcategories AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Auth modify settings" ON public.appointment_settings AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY "authenticated can all bsi_debit_settlements" ON public.bsi_debit_settlements AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Authenticated users can delete bsi_mutasi_transactions" ON public.bsi_mutasi_transactions AS PERMISSIVE FOR DELETE TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert bsi_mutasi_transactions" ON public.bsi_mutasi_transactions AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated users can read bsi_mutasi_transactions" ON public.bsi_mutasi_transactions AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can delete bsi_mutasi_uploads" ON public.bsi_mutasi_uploads AS PERMISSIVE FOR DELETE TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert bsi_mutasi_uploads" ON public.bsi_mutasi_uploads AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Authenticated users can read bsi_mutasi_uploads" ON public.bsi_mutasi_uploads AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "authenticated can all bsi_reconciliation_checks" ON public.bsi_reconciliation_checks AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Authenticated users can upload images" ON public.clinic_images AS PERMISSIVE FOR INSERT TO PUBLIC
  WITH CHECK ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY "Owners and admins can delete images" ON public.clinic_images AS PERMISSIVE FOR DELETE TO PUBLIC
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['owner'::text, 'admin'::text, 'super_admin'::text]))))));
CREATE POLICY "Owners and admins can update images" ON public.clinic_images AS PERMISSIVE FOR UPDATE TO PUBLIC
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['owner'::text, 'admin'::text, 'super_admin'::text]))))));
CREATE POLICY "Enable all access for admins and owners" ON public.expense_income_categories AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['owner'::text, 'admin'::text, 'super_admin'::text, 'clinic_admin'::text]))))));
CREATE POLICY "Enable read access for authenticated users" ON public.expense_income_categories AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY "Enable all access for admins and owners" ON public.expenses AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'owner'::text, 'clinic_admin'::text, 'super_admin'::text]))))));
CREATE POLICY "Enable read access for authenticated users" ON public.expenses AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY authenticated_only_fcm_tokens ON public.fcm_tokens AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((( SELECT auth.role() AS role) = 'authenticated'::text))
  WITH CHECK ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY "Owner and admin can view transactions" ON public.financial_transactions AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
CREATE POLICY authenticated_only_general_settings ON public.general_settings AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((( SELECT auth.role() AS role) = 'authenticated'::text))
  WITH CHECK ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY allow_all_invoice_records ON public.invoice_records AS PERMISSIVE FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Allow authenticated users to read invoice settings" ON public.invoice_settings AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY "Allow owners and admins to update invoice settings" ON public.invoice_settings AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['owner'::text, 'admin'::text, 'super_admin'::text]))))));
CREATE POLICY clinic_isolated_invoice_settings ON public.invoice_settings AS PERMISSIVE FOR ALL TO PUBLIC
  USING (((( SELECT get_my_role() AS get_my_role) = 'super_admin'::text) OR (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id))))
  WITH CHECK (((( SELECT get_my_role() AS get_my_role) = 'super_admin'::text) OR (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id))));
CREATE POLICY "Allow owners and admins to delete media assets" ON public.media_assets AS PERMISSIVE FOR DELETE TO PUBLIC
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['owner'::text, 'super_admin'::text, 'admin'::text]))))));
CREATE POLICY "Allow owners and admins to insert media assets" ON public.media_assets AS PERMISSIVE FOR INSERT TO PUBLIC
  WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['owner'::text, 'super_admin'::text, 'admin'::text]))))));
CREATE POLICY "Allow owners and admins to update media assets" ON public.media_assets AS PERMISSIVE FOR UPDATE TO PUBLIC
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['owner'::text, 'super_admin'::text, 'admin'::text]))))));
CREATE POLICY "Allow all for authenticated users" ON public.operational_options AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY "Allow authenticated delete operational_options" ON public.operational_options AS PERMISSIVE FOR DELETE TO PUBLIC
  USING ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY "Allow authenticated insert operational_options" ON public.operational_options AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Allow authenticated update operational_options" ON public.operational_options AS PERMISSIVE FOR UPDATE TO PUBLIC
  USING ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY "Admins and owners can manage options" ON public.patient_info_options AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'owner'::text, 'super_admin'::text]))))));
CREATE POLICY "Authenticated users can view options" ON public.patient_info_options AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
CREATE POLICY admin_owner_select_patient_info_options ON public.patient_info_options AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((EXISTS ( SELECT 1 FROM users u WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ANY (ARRAY['admin'::text, 'owner'::text]))))));
CREATE POLICY clinic_isolated_patient_info_options ON public.patient_info_options AS PERMISSIVE FOR ALL TO PUBLIC
  USING (((( SELECT get_my_role() AS get_my_role) = 'super_admin'::text) OR (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id))))
  WITH CHECK (((( SELECT get_my_role() AS get_my_role) = 'super_admin'::text) OR (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id))));
DROP POLICY IF EXISTS public_insert_booking_online ON public.patients_booking_online;
CREATE POLICY public_insert_booking_online ON public.patients_booking_online AS PERMISSIVE FOR INSERT TO PUBLIC
  WITH CHECK (true);
CREATE POLICY "Allow authenticated users to read patients_booking_online" ON public.patients_booking_online AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY "Owners and admins can manage payroll" ON public.payroll_records AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['owner'::text, 'super_admin'::text, 'admin'::text]))))));
CREATE POLICY "Admin manage services" ON public.services AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['admin'::text, 'owner'::text, 'super_admin'::text]))))));
CREATE POLICY authenticated_only_system_settings ON public.system_settings AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((( SELECT auth.role() AS role) = 'authenticated'::text))
  WITH CHECK ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY "Owners manage badges" ON public.therapist_badges_master AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['owner'::text, 'admin'::text, 'super_admin'::text]))))));
CREATE POLICY "Admin Manage Schedule Overrides" ON public.therapist_schedule_overrides AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['owner'::text, 'admin'::text, 'super_admin'::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['owner'::text, 'admin'::text, 'super_admin'::text]))))));
CREATE POLICY "Manage slots" ON public.therapist_slots AS PERMISSIVE FOR ALL TO PUBLIC
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['owner'::text, 'admin'::text, 'super_admin'::text, 'clinic_admin'::text]))))));
CREATE POLICY "Admin Manage TimeOff" ON public.therapist_time_off AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['owner'::text, 'admin'::text, 'super_admin'::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['owner'::text, 'admin'::text, 'super_admin'::text]))))));

COMMIT;
