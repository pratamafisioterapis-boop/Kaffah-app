-- JALANKAN MANUAL di Supabase Dashboard > SQL Editor (berisi DROP POLICY, yang
-- ditolak oleh tool apply_migration). Jalankan SELURUH file sekaligus; urutannya
-- penting: policy pengganti dibuat dulu, baru policy longgar di-DROP.
--
-- Masalah (terbukti lewat uji role anon, SELECT saja):
--   * "Allow public read" (SELECT, true) berlaku untuk SEMUA bucket, sehingga
--     anon bisa melihat daftar objek bucket privat: patient-ktp (KTP pasien),
--     medical-record-attachments, mou-documents, pemilih-ktp, journal-documents.
--   * "Allow public upload" / "Allow public upload aj13hi_0" (INSERT, true)
--     membolehkan anon meng-upload ke bucket mana pun.
--   * "Allow anon storage", "fix_all_storage_invoice", "invoices_insert_public"
--     membolehkan anon/public ALL pada bucket invoices.
--
-- Bucket publik (images, clinic-assets, media-assets, therapist-photos,
-- remuneration-proofs, invoices) tetap bisa diakses lewat URL publik
-- (/storage/v1/object/public/...) karena endpoint itu tidak melewati RLS,
-- jadi link /r/:id (Resume Medis) dan gambar landing page tetap jalan.

BEGIN;

-- 1) Pengganti: user login boleh mengelola bucket invoices (upload dengan
--    upsert:true butuh INSERT + UPDATE + SELECT; SELECT sudah ada lewat
--    "Allow read invoices").
CREATE POLICY "invoices_authenticated_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'invoices')
  WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "invoices_authenticated_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'invoices');

-- 2) Hapus policy yang membuka akses ke anon / semua bucket.
DROP POLICY IF EXISTS "Allow public read"             ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload"           ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload aj13hi_0"  ON storage.objects;
DROP POLICY IF EXISTS "Allow anon storage"            ON storage.objects;
DROP POLICY IF EXISTS "fix_all_storage_invoice"       ON storage.objects;
DROP POLICY IF EXISTS "invoices_insert_public"        ON storage.objects;
DROP POLICY IF EXISTS "invoices_select_public"        ON storage.objects;

COMMIT;

-- 3) Verifikasi (harus kosong / 0 baris untuk bucket privat):
-- BEGIN; SET LOCAL ROLE anon;
--   SELECT bucket_id, count(*) FROM storage.objects
--   WHERE bucket_id IN ('patient-ktp','medical-record-attachments','pemilih-ktp',
--                       'mou-documents','journal-documents','invoices')
--   GROUP BY 1;
-- ROLLBACK;
--
-- 4) Tes manual setelahnya: (a) buat invoice PDF & Resume Medis dari aplikasi
--    (upload + upsert), (b) buka link /r/<id>, (c) buka foto KTP pasien dari
--    halaman pasien, (d) upload foto terapis / aset klinik.
--
-- Rollback (jika ada fitur rusak): buat ulang policy yang dibutuhkan, mis.
--   CREATE POLICY "fix_all_storage_invoice" ON storage.objects FOR ALL TO public
--     USING (bucket_id='invoices') WITH CHECK (bucket_id='invoices');
