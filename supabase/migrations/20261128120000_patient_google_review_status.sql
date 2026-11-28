-- Status ajakan review Google per pasien (Kaffah). AI wa-ai-reply menandai 'link_sent' saat mengirim link review;
-- admin menandai 'reviewed' secara manual setelah memastikan review benar-benar masuk di Google
-- (Google tidak menyediakan cara memverifikasinya otomatis, klik link bukan bukti).
-- AI tidak mengirim link lagi bila status 'reviewed', atau 'link_sent' dalam 90 hari terakhir.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS google_review_status text,
  ADD COLUMN IF NOT EXISTS google_review_link_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_review_marked_at timestamptz;

ALTER TABLE public.patients
  DROP CONSTRAINT IF EXISTS patients_google_review_status_check;
ALTER TABLE public.patients
  ADD CONSTRAINT patients_google_review_status_check
  CHECK (google_review_status IS NULL OR google_review_status IN ('link_sent', 'reviewed'));

COMMENT ON COLUMN public.patients.google_review_status IS 'NULL = belum diminta, link_sent = link review dikirim AI, reviewed = admin memastikan sudah mengisi review Google.';
