-- Jam kerja (shift) tetap per terapis, terpisah dari jadwal slot booking
-- (therapist_schedules). Contoh: Shift Pagi 09:00-17:00, Shift Siang 13:00-21:00.
-- Dipakai form pengajuan izin (fitur klinik Kaffah, lihat
-- clinics.therapist_leave_request_enabled): izin seharian otomatis memakai
-- jam shift ini, izin sebagian dibatasi di dalam jam shift.
-- Kosong = belum diatur; form izin kembali memakai baris jadwal mingguan.

ALTER TABLE public.physiotherapists
  ADD COLUMN IF NOT EXISTS work_shift_name text,
  ADD COLUMN IF NOT EXISTS work_start_time time,
  ADD COLUMN IF NOT EXISTS work_end_time time;

ALTER TABLE public.physiotherapists
  DROP CONSTRAINT IF EXISTS physiotherapists_work_shift_range;
ALTER TABLE public.physiotherapists
  ADD CONSTRAINT physiotherapists_work_shift_range CHECK (
    (work_start_time IS NULL AND work_end_time IS NULL)
    OR (work_start_time IS NOT NULL AND work_end_time IS NOT NULL AND work_end_time > work_start_time)
  );
