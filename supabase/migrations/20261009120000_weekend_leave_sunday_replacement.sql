-- Izin di hari Sabtu/Minggu (seharian maupun jam tertentu): jadwal pengganti
-- hanya boleh jatuh di hari Minggu. Berlaku untuk pengajuan baru; data lama
-- tidak divalidasi ulang (NOT VALID).

CREATE OR REPLACE FUNCTION public.leave_replacement_sunday_ok(p_leave_date date, p_shifts jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN EXTRACT(DOW FROM p_leave_date) NOT IN (0, 6) THEN true
    WHEN jsonb_typeof(p_shifts) <> 'array' THEN true
    ELSE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_shifts) AS s
      WHERE EXTRACT(DOW FROM (s->>'date')::date) <> 0
    )
  END;
$fn$;

DO $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_request_weekend_replacement_sunday'
  ) THEN
    ALTER TABLE public.therapist_leave_requests
      ADD CONSTRAINT leave_request_weekend_replacement_sunday
      CHECK (public.leave_replacement_sunday_ok(leave_date, replacement_shifts)) NOT VALID;
  END IF;
END;
$fn$;
