-- Mode tanda tangan invoice "admin" (Cashier) bisa dibatasi berlaku mulai waktu tertentu.
-- Invoice yang sudah terbit sebelum waktu itu (daily_recaps.invoice_created_at lebih awal)
-- tetap tampil dengan tanda tangan Physiotherapist; yang baru memakai Cashier.
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS invoice_signer_from timestamptz;
