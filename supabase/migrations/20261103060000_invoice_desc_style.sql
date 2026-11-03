-- Deskripsi layanan di invoice per klinik. invoice_desc_style = 'tiered' memakai nama
-- Essential/Advanced Physiotherapy, Recovery Therapy dan "N-Session Package" (lihat
-- src/lib/kaffahInvoiceLine.js); invoice_desc_from membatasi agar hanya invoice yang terbit
-- sejak waktu itu (daily_recaps.invoice_created_at) yang berubah. NULL = tampilan lama.
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS invoice_desc_style text,
  ADD COLUMN IF NOT EXISTS invoice_desc_from timestamptz;
