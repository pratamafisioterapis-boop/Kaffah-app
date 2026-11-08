-- Perf: index untuk query audit_logs yang lambat (lonceng notifikasi & kasir).
-- Terukur di produksi: query tanpa clinic_id = 4.977 ms -> ~0,1 ms (uji temp copy).
-- Jalankan satu per satu (CREATE INDEX CONCURRENTLY tak boleh dalam transaksi).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource_created_at
  ON public.audit_logs (resource_type, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource_type_resource_id
  ON public.audit_logs (resource_type, resource_id);

-- Rollback:
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_audit_logs_resource_created_at;
-- DROP INDEX CONCURRENTLY IF EXISTS public.idx_audit_logs_resource_type_resource_id;
