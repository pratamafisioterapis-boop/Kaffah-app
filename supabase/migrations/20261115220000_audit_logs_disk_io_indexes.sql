-- Kurangi Disk IO: audit_logs (218 MB, 84% barisnya UPDATE daily_recaps dengan
-- kolom `changes` jsonb besar) di-scan penuh/berulang oleh dua query.
--
-- 1) Lonceng notifikasi (DashboardTopbar.loadActivities) mencari recap yang
--    BARU selesai: resource_type='daily_recaps' AND action='UPDATE' AND
--    changes.new.status='completed' AND changes.old.status<>'completed'.
--    Hanya ~2.900 dari ~123.000 baris UPDATE yang cocok, tetapi Postgres
--    memakai index clinic_id lalu membaca + memfilter jsonb ribuan baris
--    (TOAST) di setiap muat ulang -> ~6.000 kali sehari x ~230 blok.
--    Partial index ini hanya berisi baris yang cocok sehingga query langsung
--    membaca ~20 baris terakhir.
CREATE INDEX IF NOT EXISTS idx_audit_logs_recap_completed_feed
  ON public.audit_logs (clinic_id, created_at DESC)
  WHERE resource_type = 'daily_recaps'
    AND action = 'UPDATE'
    AND (changes -> 'new' ->> 'status') = 'completed'
    AND (changes -> 'old' ->> 'status') <> 'completed';

-- 2) Daftar audit log tanpa filter (ORDER BY created_at DESC LIMIT n) tidak
--    punya index sehingga seq scan 218 MB (~6,4 detik, 26 ribu blok per call).
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs (created_at DESC);

ANALYZE public.audit_logs;
