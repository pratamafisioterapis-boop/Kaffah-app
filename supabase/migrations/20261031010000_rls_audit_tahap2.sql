-- AUDIT RLS Oktober 2026 — TAHAP 2: tabel tanpa clinic_id yang dibatasi lewat relasi.
--
-- Terbukti (simulasi): invoice_records 1.419 baris terbaca oleh pasien portal;
-- payroll_records 26 baris gaji terbaca oleh owner klinik LAIN.
-- Data sudah dicek bersih: daily_recap_id terisi di semua invoice (0 kosong, 0 yatim);
-- physiotherapist_id di payroll valid semua (0 yatim).
-- Rollback: supabase/manual/rollback_rls_audit_2026-10.sql

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2.1 invoice_records: hanya staf klinik yang sama (lewat daily_recaps.clinic_id).
--     Role therapist ikut diizinkan karena modal invoice dipakai juga di alur rekap harian.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS allow_all_invoice_records ON public.invoice_records;
CREATE POLICY invoice_records_clinic_staff ON public.invoice_records FOR ALL TO authenticated
  USING (
    (SELECT get_my_role()) = 'super_admin'
    OR (
      (SELECT get_my_role()) IN ('owner', 'admin', 'therapist')
      AND EXISTS (
        SELECT 1 FROM public.daily_recaps r
        WHERE r.id = invoice_records.daily_recap_id
          AND r.clinic_id = (SELECT get_my_clinic_id())
      )
    )
  )
  WITH CHECK (
    (SELECT get_my_role()) = 'super_admin'
    OR (
      (SELECT get_my_role()) IN ('owner', 'admin', 'therapist')
      AND EXISTS (
        SELECT 1 FROM public.daily_recaps r
        WHERE r.id = invoice_records.daily_recap_id
          AND r.clinic_id = (SELECT get_my_clinic_id())
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2.2 payroll_records: owner/admin hanya untuk terapis di klinik yang sama.
--     Policy "Therapists can view own payroll" (terapis melihat gajinya sendiri) tidak diubah.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Owners and admins can manage payroll" ON public.payroll_records;
CREATE POLICY payroll_records_clinic_staff ON public.payroll_records FOR ALL TO authenticated
  USING (
    (SELECT get_my_role()) = 'super_admin'
    OR (
      (SELECT get_my_role()) IN ('owner', 'admin')
      AND EXISTS (
        SELECT 1 FROM public.physiotherapists p
        WHERE p.id = payroll_records.physiotherapist_id
          AND p.clinic_id = (SELECT get_my_clinic_id())
      )
    )
  )
  WITH CHECK (
    (SELECT get_my_role()) = 'super_admin'
    OR (
      (SELECT get_my_role()) IN ('owner', 'admin')
      AND EXISTS (
        SELECT 1 FROM public.physiotherapists p
        WHERE p.id = payroll_records.physiotherapist_id
          AND p.clinic_id = (SELECT get_my_clinic_id())
      )
    )
  );

COMMIT;
