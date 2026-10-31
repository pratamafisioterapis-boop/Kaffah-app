-- patients_booking_online: tautkan ke klinik agar staf hanya melihat data kliniknya sendiri.
--
-- Sebelumnya tabel ini tanpa clinic_id, sehingga setelah audit RLS Tahap 1 owner/admin klinik MANA PUN
-- masih membaca ke-21 barisnya (nama, telepon, email, riwayat medis).
--
-- Atribusi baris lama ke Kaffah didukung data:
--   - semua 21 baris dibuat 22 Feb – 20 Apr 2026, sebelum klinik kedua ada (Grand Physiocare: 4 Jul 2026)
--   - 17 dari 21 nomor telepon cocok dengan pasien Kaffah, 0 cocok dengan klinik lain
--   - tidak ada baris dalam 90 hari terakhir; tidak ada trigger/relasi/kode aktif yang memakai tabel ini
--
-- Rollback: supabase/manual/rollback_rls_audit_2026-10.sql (bagian patients_booking_online).

BEGIN;

ALTER TABLE public.patients_booking_online
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE;

UPDATE public.patients_booking_online
   SET clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
 WHERE clinic_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_patients_booking_online_clinic
  ON public.patients_booking_online (clinic_id);

-- Baca: owner/admin klinik yang sama (super_admin semua klinik).
DROP POLICY IF EXISTS patients_booking_online_staff_read ON public.patients_booking_online;
CREATE POLICY patients_booking_online_staff_read ON public.patients_booking_online FOR SELECT TO authenticated
  USING (
    (SELECT get_my_role()) = 'super_admin'
    OR ((SELECT get_my_role()) IN ('owner', 'admin')
        AND clinic_id = (SELECT get_my_clinic_id()))
  );

-- Isi: tetap terbuka untuk pengunjung (form booking publik), tetapi WAJIB menyebut klinik
-- (clinic_id harus ada di tabel clinics lewat foreign key). Baris tanpa klinik tidak bisa lagi masuk.
DROP POLICY IF EXISTS public_insert_booking_online ON public.patients_booking_online;
DROP POLICY IF EXISTS patients_booking_online_public_insert ON public.patients_booking_online;
CREATE POLICY patients_booking_online_public_insert ON public.patients_booking_online FOR INSERT TO anon, authenticated
  WITH CHECK (clinic_id IS NOT NULL);

COMMIT;
