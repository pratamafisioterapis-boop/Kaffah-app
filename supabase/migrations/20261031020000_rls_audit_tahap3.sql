-- AUDIT RLS Oktober 2026 — TAHAP 3: policy "hanya cek peran" yang tidak membatasi klinik, serta
-- tulis terbuka untuk semua pengguna yang login pada tabel konfigurasi.
--
-- Pola masalah: "owner/admin" dari klinik MANA PUN bisa membaca/mengubah data klinik lain
-- (tabel multi-tenant). Peran yang diizinkan TIDAK diubah di sini; yang ditambahkan hanya batas klinik.
-- Rollback: supabase/manual/rollback_rls_audit_2026-10.sql
--
-- Pola yang dipakai:
--   STAF   = get_my_role() IN ('owner','admin','super_admin')
--   KLINIK = super_admin ATAU clinic_id = klinik pengguna

BEGIN;

-- Sisipkan clinic_id otomatis saat klien tidak mengisinya (pola yang sama dengan
-- therapist_leave_requests). Tanpa ini, WITH CHECK klinik akan menolak insert tanpa clinic_id.
ALTER TABLE public.expenses                  ALTER COLUMN clinic_id SET DEFAULT public.get_my_clinic_id();
ALTER TABLE public.expense_income_categories ALTER COLUMN clinic_id SET DEFAULT public.get_my_clinic_id();
ALTER TABLE public.clinic_images             ALTER COLUMN clinic_id SET DEFAULT public.get_my_clinic_id();
ALTER TABLE public.media_assets              ALTER COLUMN clinic_id SET DEFAULT public.get_my_clinic_id();
ALTER TABLE public.invoice_settings          ALTER COLUMN clinic_id SET DEFAULT public.get_my_clinic_id();
ALTER TABLE public.patient_info_options      ALTER COLUMN clinic_id SET DEFAULT public.get_my_clinic_id();
ALTER TABLE public.operational_options       ALTER COLUMN clinic_id SET DEFAULT public.get_my_clinic_id();
ALTER TABLE public.accounting_categories     ALTER COLUMN clinic_id SET DEFAULT public.get_my_clinic_id();
ALTER TABLE public.accounting_subcategories  ALTER COLUMN clinic_id SET DEFAULT public.get_my_clinic_id();

-- ───────────── expenses ─────────────
DROP POLICY IF EXISTS "Enable all access for admins and owners" ON public.expenses;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.expenses;
CREATE POLICY expenses_clinic_staff ON public.expenses FOR ALL TO authenticated
  USING ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())))
  WITH CHECK ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())));

-- ───────────── expense_income_categories ─────────────
DROP POLICY IF EXISTS "Enable all access for admins and owners" ON public.expense_income_categories;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.expense_income_categories;
CREATE POLICY expense_income_categories_read ON public.expense_income_categories FOR SELECT TO authenticated
  USING ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id()));
CREATE POLICY expense_income_categories_write ON public.expense_income_categories FOR ALL TO authenticated
  USING ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())))
  WITH CHECK ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())));

-- ───────────── financial_transactions (tanpa clinic_id: lewat klinik pembuatnya) ─────────────
-- created_by diisi otomatis dengan pengguna yang login bila klien tidak mengisinya.
ALTER TABLE public.financial_transactions ALTER COLUMN created_by SET DEFAULT auth.uid();
DROP POLICY IF EXISTS "Owner and admin can view transactions" ON public.financial_transactions;
CREATE POLICY financial_transactions_clinic_staff ON public.financial_transactions FOR ALL TO authenticated
  USING ((SELECT get_my_role()) = 'super_admin'
         OR ((SELECT get_my_role()) IN ('owner', 'admin')
             AND public.rls_clinic_of_user(financial_transactions.created_by) = (SELECT get_my_clinic_id())))
  WITH CHECK ((SELECT get_my_role()) = 'super_admin'
         OR ((SELECT get_my_role()) IN ('owner', 'admin')
             AND public.rls_clinic_of_user(financial_transactions.created_by) = (SELECT get_my_clinic_id())));

-- ───────────── invoice_settings (berisi rekening bank di invoice) ─────────────
DROP POLICY IF EXISTS "Allow authenticated users to read invoice settings" ON public.invoice_settings;
DROP POLICY IF EXISTS "Allow owners and admins to update invoice settings" ON public.invoice_settings;
DROP POLICY IF EXISTS clinic_isolated_invoice_settings ON public.invoice_settings;
CREATE POLICY invoice_settings_read ON public.invoice_settings FOR SELECT TO authenticated
  USING ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id()));
CREATE POLICY invoice_settings_write ON public.invoice_settings FOR ALL TO authenticated
  USING ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())))
  WITH CHECK ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())));

-- ───────────── media_assets (policy baca per klinik sudah ada dan dibiarkan) ─────────────
DROP POLICY IF EXISTS "Allow owners and admins to insert media assets" ON public.media_assets;
DROP POLICY IF EXISTS "Allow owners and admins to update media assets" ON public.media_assets;
DROP POLICY IF EXISTS "Allow owners and admins to delete media assets" ON public.media_assets;
CREATE POLICY media_assets_insert ON public.media_assets FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())));
CREATE POLICY media_assets_update ON public.media_assets FOR UPDATE TO authenticated
  USING ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())))
  WITH CHECK ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())));
CREATE POLICY media_assets_delete ON public.media_assets FOR DELETE TO authenticated
  USING ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())));

-- ───────────── patient_info_options ─────────────
DROP POLICY IF EXISTS "Admins and owners can manage options" ON public.patient_info_options;
DROP POLICY IF EXISTS "Authenticated users can view options" ON public.patient_info_options;
DROP POLICY IF EXISTS admin_owner_select_patient_info_options ON public.patient_info_options;
DROP POLICY IF EXISTS clinic_isolated_patient_info_options ON public.patient_info_options;
CREATE POLICY patient_info_options_read ON public.patient_info_options FOR SELECT TO authenticated
  USING ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id()));
CREATE POLICY patient_info_options_write ON public.patient_info_options FOR ALL TO authenticated
  USING ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())))
  WITH CHECK ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())));

-- ───────────── clinic_images (baca publik untuk logo tetap) ─────────────
DROP POLICY IF EXISTS "Authenticated users can upload images" ON public.clinic_images;
DROP POLICY IF EXISTS "Owners and admins can update images" ON public.clinic_images;
DROP POLICY IF EXISTS "Owners and admins can delete images" ON public.clinic_images;
CREATE POLICY clinic_images_insert ON public.clinic_images FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())));
CREATE POLICY clinic_images_update ON public.clinic_images FOR UPDATE TO authenticated
  USING ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())))
  WITH CHECK ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())));
CREATE POLICY clinic_images_delete ON public.clinic_images FOR DELETE TO authenticated
  USING ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())));

-- ───────────── services: katalog global tanpa clinic_id; kode klien tidak pernah menulis ─────────────
DROP POLICY IF EXISTS "Admin manage services" ON public.services;
CREATE POLICY services_write_super ON public.services FOR ALL TO authenticated
  USING ((SELECT get_my_role()) = 'super_admin')
  WITH CHECK ((SELECT get_my_role()) = 'super_admin');
-- Policy baca publik ("Public read services") dibiarkan: dipakai halaman publik.

-- ───────────── therapist_badges_master (baca publik tetap; tulis lewat klinik pemilik) ─────────────
DROP POLICY IF EXISTS "Owners manage badges" ON public.therapist_badges_master;
CREATE POLICY therapist_badges_master_write ON public.therapist_badges_master FOR ALL TO authenticated
  USING ((SELECT get_my_role()) = 'super_admin'
         OR ((SELECT get_my_role()) IN ('owner', 'admin')
             AND public.rls_clinic_of_user(therapist_badges_master.owner_id) = (SELECT get_my_clinic_id())))
  WITH CHECK ((SELECT get_my_role()) = 'super_admin'
         OR ((SELECT get_my_role()) IN ('owner', 'admin')
             AND public.rls_clinic_of_user(therapist_badges_master.owner_id) = (SELECT get_my_clinic_id())));

-- ───────────── tabel jadwal terapis: klinik lewat physiotherapists.clinic_id ─────────────
DROP POLICY IF EXISTS "Admin Manage Schedule Overrides" ON public.therapist_schedule_overrides;
CREATE POLICY therapist_schedule_overrides_write ON public.therapist_schedule_overrides FOR ALL TO authenticated
  USING ((SELECT get_my_role()) = 'super_admin'
         OR ((SELECT get_my_role()) IN ('owner', 'admin')
             AND EXISTS (SELECT 1 FROM public.physiotherapists p
                         WHERE p.id = therapist_schedule_overrides.therapist_id
                           AND p.clinic_id = (SELECT get_my_clinic_id()))))
  WITH CHECK ((SELECT get_my_role()) = 'super_admin'
         OR ((SELECT get_my_role()) IN ('owner', 'admin')
             AND EXISTS (SELECT 1 FROM public.physiotherapists p
                         WHERE p.id = therapist_schedule_overrides.therapist_id
                           AND p.clinic_id = (SELECT get_my_clinic_id()))));

DROP POLICY IF EXISTS "Manage slots" ON public.therapist_slots;
CREATE POLICY therapist_slots_write ON public.therapist_slots FOR ALL TO authenticated
  USING ((SELECT get_my_role()) = 'super_admin'
         OR ((SELECT get_my_role()) IN ('owner', 'admin')
             AND EXISTS (SELECT 1 FROM public.physiotherapists p
                         WHERE p.id = therapist_slots.therapist_id
                           AND p.clinic_id = (SELECT get_my_clinic_id()))))
  WITH CHECK ((SELECT get_my_role()) = 'super_admin'
         OR ((SELECT get_my_role()) IN ('owner', 'admin')
             AND EXISTS (SELECT 1 FROM public.physiotherapists p
                         WHERE p.id = therapist_slots.therapist_id
                           AND p.clinic_id = (SELECT get_my_clinic_id()))));

DROP POLICY IF EXISTS "Admin Manage TimeOff" ON public.therapist_time_off;
CREATE POLICY therapist_time_off_write ON public.therapist_time_off FOR ALL TO authenticated
  USING ((SELECT get_my_role()) = 'super_admin'
         OR ((SELECT get_my_role()) IN ('owner', 'admin')
             AND EXISTS (SELECT 1 FROM public.physiotherapists p
                         WHERE p.id = therapist_time_off.therapist_id
                           AND p.clinic_id = (SELECT get_my_clinic_id()))))
  WITH CHECK ((SELECT get_my_role()) = 'super_admin'
         OR ((SELECT get_my_role()) IN ('owner', 'admin')
             AND EXISTS (SELECT 1 FROM public.physiotherapists p
                         WHERE p.id = therapist_time_off.therapist_id
                           AND p.clinic_id = (SELECT get_my_clinic_id()))));

-- ───────────── konfigurasi per klinik yang dulu bisa ditulis oleh SIAPA PUN yang login ─────────────
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.accounting_categories;
DROP POLICY IF EXISTS "allow read categories" ON public.accounting_categories;
CREATE POLICY accounting_categories_read ON public.accounting_categories FOR SELECT TO authenticated
  USING ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id()));
CREATE POLICY accounting_categories_write ON public.accounting_categories FOR ALL TO authenticated
  USING ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())))
  WITH CHECK ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())));

DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.accounting_subcategories;
DROP POLICY IF EXISTS "allow read subcategories" ON public.accounting_subcategories;
CREATE POLICY accounting_subcategories_read ON public.accounting_subcategories FOR SELECT TO authenticated
  USING ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id()));
CREATE POLICY accounting_subcategories_write ON public.accounting_subcategories FOR ALL TO authenticated
  USING ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())))
  WITH CHECK ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())));

-- operational_options: dua policy BACA ("Allow public read ..." dan "Allow authenticated to select ...")
-- sengaja dibiarkan karena dipakai halaman publik; hanya TULIS yang dibatasi.
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.operational_options;
DROP POLICY IF EXISTS "Allow authenticated delete operational_options" ON public.operational_options;
DROP POLICY IF EXISTS "Allow authenticated insert operational_options" ON public.operational_options;
DROP POLICY IF EXISTS "Allow authenticated update operational_options" ON public.operational_options;
CREATE POLICY operational_options_write ON public.operational_options FOR ALL TO authenticated
  USING ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())))
  WITH CHECK ((SELECT get_my_role()) IN ('owner', 'admin', 'super_admin')
         AND ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id())));

COMMIT;
