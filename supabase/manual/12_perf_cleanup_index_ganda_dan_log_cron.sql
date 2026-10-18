-- Jalankan lewat SQL Editor di dashboard Supabase (berisi DROP/DELETE,
-- sehingga tidak dijalankan lewat tool migrasi otomatis).
-- Aman diulang: semua memakai IF EXISTS / pengecekan.

-- 1) Index ganda (advisor: duplicate_index). Yang dipertahankan adalah
--    index yang memang dipakai planner (idx_scan terbesar).
--    appointments: pertahankan idx_appointments_active_date_therapist
DROP INDEX IF EXISTS public.idx_appointments_active_date;
--    therapist_schedules: pertahankan idx_ts_day_active
DROP INDEX IF EXISTS public.idx_therapist_schedules_day;
--    therapist_slots: pertahankan idx_tsl_schedule
DROP INDEX IF EXISTS public.idx_therapist_slots_schedule;
DROP INDEX IF EXISTS public.idx_therapist_slots_schedule_id;
--    system_settings: primary key (key) sudah unik
DROP INDEX IF EXISTS public.system_settings_key_unique;
--    daily_recaps: dua constraint UNIQUE (appointment_id); pertahankan
--    unique_appointment_recap
ALTER TABLE public.daily_recaps DROP CONSTRAINT IF EXISTS daily_recaps_appointment_id_key;

-- 2) Log pg_cron: ~900 ribu baris sejak Januari (170 MB) karena 6 job jalan
--    tiap menit dan lognya tidak pernah dibersihkan. Simpan 7 hari terakhir.
DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';

--    Bersihkan otomatis tiap hari pukul 03:17 UTC.
SELECT cron.schedule(
  'purge-cron-job-run-details',
  '17 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$
);

-- 3) (Opsional, jalankan terpisah — tidak bisa di dalam transaksi)
--    Kembalikan ruang disk setelah DELETE besar di atas:
-- VACUUM FULL cron.job_run_details;
