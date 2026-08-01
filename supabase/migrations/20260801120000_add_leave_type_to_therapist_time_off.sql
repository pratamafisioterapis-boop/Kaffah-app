-- Add leave_type to distinguish annual leave (cuti tahunan) from other time-off reasons
ALTER TABLE public.therapist_time_off
  ADD COLUMN IF NOT EXISTS leave_type text NOT NULL DEFAULT 'other';

ALTER TABLE public.therapist_time_off
  DROP CONSTRAINT IF EXISTS therapist_time_off_leave_type_check;

ALTER TABLE public.therapist_time_off
  ADD CONSTRAINT therapist_time_off_leave_type_check
  CHECK (leave_type IN ('annual', 'sick', 'training', 'personal', 'weekly_off', 'other'));

-- Backfill existing rows heuristically from the free-text reason column
UPDATE public.therapist_time_off
SET leave_type = CASE
  WHEN reason ILIKE 'Libur%' THEN 'weekly_off'
  WHEN reason ILIKE 'Sakit%' THEN 'sick'
  WHEN reason ILIKE 'Training%' THEN 'training'
  WHEN reason ILIKE 'Izin Pribadi%' THEN 'personal'
  ELSE 'other'
END
WHERE leave_type = 'other';

CREATE INDEX IF NOT EXISTS idx_therapist_time_off_leave_type ON public.therapist_time_off (therapist_id, leave_type);
