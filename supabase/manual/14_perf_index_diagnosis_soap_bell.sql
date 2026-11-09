-- Perf: dua index untuk query yang jalan di setiap pembukaan dashboard.
-- Terukur di produksi (tabel asli):
--   daily_recaps.diagnosis urut terbaru : 844 ms -> 11,6 ms (index-only scan)
--   lonceng SOAP (medical_records)      : 415 ms -> 6,8 ms (index parsial)
-- Jalankan satu per satu (CONCURRENTLY tak boleh dalam transaksi).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_recaps_clinic_created_diag
  ON public.daily_recaps (clinic_id, created_at DESC) INCLUDE (diagnosis);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medical_records_clinic_soap_pending
  ON public.medical_records (clinic_id, created_at DESC)
  WHERE filled_by_admin_id IS NULL AND daily_recap_id IS NOT NULL;

-- Rollback:
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_daily_recaps_clinic_created_diag;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_medical_records_clinic_soap_pending;
