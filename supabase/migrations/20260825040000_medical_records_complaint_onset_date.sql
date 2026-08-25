-- Smart onset reminder: let admin/therapist record when the patient's
-- complaint/injury actually started (not just when it was examined), so the
-- therapist dashboard can remind them how long the patient has carried it.
ALTER TABLE public.medical_records_detailed
  ADD COLUMN IF NOT EXISTS complaint_onset_date date;

COMMENT ON COLUMN public.medical_records_detailed.complaint_onset_date IS
  'Tanggal perkiraan mulai terjadinya keluhan/cedera pasien (onset), digunakan untuk smart reminder durasi keluhan bagi terapis.';
