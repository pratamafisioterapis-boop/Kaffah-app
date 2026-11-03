-- Rekonsiliasi QRIS: izinkan beberapa unggahan PDF per hari (admin pagi & admin sore).
-- Transaksi tetap unik per RRN (uq_qris_report_transactions_rrn), jadi transaksi yang
-- sudah ada di PDF sore tidak tercatat dua kali ketika PDF malam diunggah.

ALTER TABLE public.qris_report_uploads
  DROP CONSTRAINT IF EXISTS qris_report_uploads_clinic_id_report_date_key;

ALTER TABLE public.qris_report_uploads
  ADD COLUMN IF NOT EXISTS new_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS report_generated_at timestamptz;

-- Unggahan lama: semua transaksinya dianggap baru.
UPDATE public.qris_report_uploads SET new_count = total_count WHERE new_count = 0;

CREATE INDEX IF NOT EXISTS idx_qris_report_uploads_clinic_date
  ON public.qris_report_uploads(clinic_id, report_date);
CREATE INDEX IF NOT EXISTS idx_qris_report_transactions_clinic_date
  ON public.qris_report_transactions(clinic_id, trx_date);
