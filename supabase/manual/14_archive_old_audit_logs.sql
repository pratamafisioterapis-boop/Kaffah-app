-- Arsip audit_logs yang lebih tua dari 90 hari (±110 ribu baris, ±111 MB).
-- JALANKAN MANUAL di SQL Editor, di luar jam klinik, LANGKAH DEMI LANGKAH.
-- Tidak dipasang sebagai migration karena menghapus data dan cukup berat.
--
-- Kenapa aman: lonceng notifikasi hanya butuh ~50 aktivitas terbaru. Satu-satunya
-- fitur yang membaca log lama adalah penentuan kasir (src/lib/recapCashier.js dan
-- migration auto_cashier), jadi langkah 2 mengisi daily_recaps.cashier_id dulu
-- supaya laporan lama tidak berubah setelah log dihapus.
-- Data tidak hilang: semua baris disalin dulu ke public.audit_logs_archive.

-- ===== Langkah 1: tabel arsip (hanya admin database yang bisa baca) =====
CREATE TABLE IF NOT EXISTS public.audit_logs_archive
  (LIKE public.audit_logs INCLUDING DEFAULTS);
ALTER TABLE public.audit_logs_archive
  ADD CONSTRAINT audit_logs_archive_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_logs_archive ENABLE ROW LEVEL SECURITY;  -- tanpa policy: tertutup untuk API
CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_resource
  ON public.audit_logs_archive (resource_type, resource_id);

-- ===== Langkah 2: isi kasir recap lama yang masih kosong (dari jejak audit) =====
-- Sama dengan backfill di 20261114240000_cashier_first_admin_save.sql; idempotent.
UPDATE public.daily_recaps r
   SET cashier_id = x.uid
  FROM (
    SELECT DISTINCT ON (a.resource_id) a.resource_id::uuid AS rid, a.user_id AS uid
    FROM public.audit_logs a
    JOIN public.users u ON u.id = a.user_id AND u.role = 'admin' AND COALESCE(u.is_active, true)
    WHERE a.resource_type = 'daily_recaps' AND a.action = 'UPDATE'
      AND NULLIF(btrim(COALESCE(a.changes->'new'->>'payment_method', '')), '') IS NOT NULL
      AND COALESCE(NULLIF(a.changes->'new'->>'amount', '')::numeric, 0) > 0
    ORDER BY a.resource_id, a.created_at
  ) x
 WHERE r.id = x.rid
   AND r.cashier_id IS NULL
   AND r.clinic_id IN (SELECT clinic_id FROM public.cash_ledger_config)
   AND COALESCE(r.revenue_date, r.recap_date) >= (SELECT c.start_date FROM public.cash_ledger_config c WHERE c.clinic_id = r.clinic_id);

-- ===== Langkah 3: salin baris lama ke arsip =====
INSERT INTO public.audit_logs_archive
SELECT * FROM public.audit_logs
WHERE created_at < now() - interval '90 days'
ON CONFLICT (id) DO NOTHING;

-- Cek: dua angka ini harus sama sebelum lanjut ke langkah 4.
SELECT (SELECT count(*) FROM public.audit_logs WHERE created_at < now() - interval '90 days') AS di_audit_logs,
       (SELECT count(*) FROM public.audit_logs_archive)                                        AS di_arsip;

-- ===== Langkah 4: hapus dari audit_logs, per 10.000 baris =====
-- Ulangi sampai hasilnya 0 baris (agar IO tidak melonjak sekaligus).
DELETE FROM public.audit_logs
WHERE id IN (
  SELECT a.id FROM public.audit_logs a
  JOIN public.audit_logs_archive z ON z.id = a.id
  WHERE a.created_at < now() - interval '90 days'
  LIMIT 10000
);

-- ===== Langkah 5 (opsional): rapikan statistik =====
-- Ruang bekas baris terhapus dipakai ulang oleh Postgres; ukuran file baru
-- mengecil hanya dengan VACUUM FULL (mengunci tabel beberapa detik-menit).
VACUUM (ANALYZE) public.audit_logs;
