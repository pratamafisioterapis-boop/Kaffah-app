-- Persist the resolved "expected check-in" and its source alongside status,
-- so already-saved attendance rows can be recalculated (and show what
-- changed) when a therapist's schedule/override/alias changes later.
ALTER TABLE public.employee_attendance_records
  ADD COLUMN IF NOT EXISTS expected_check_in time,
  ADD COLUMN IF NOT EXISTS expected_source text;
