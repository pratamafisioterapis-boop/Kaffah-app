-- Desain kwitansi per klinik. invoice_layout = 'modern' memakai InvoiceTemplateModern
-- ("Minimal Bersih"); invoice_layout_from membatasi agar hanya invoice yang terbit sejak waktu
-- itu (daily_recaps.invoice_created_at, bila kosong created_at) yang memakai desain baru.
-- NULL = desain lama.
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS invoice_layout text,
  ADD COLUMN IF NOT EXISTS invoice_layout_from timestamptz;
