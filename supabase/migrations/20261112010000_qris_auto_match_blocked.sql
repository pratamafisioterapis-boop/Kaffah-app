-- Transaksi QRIS yang dilepas manual oleh admin tidak boleh dicocokkan otomatis lagi.
ALTER TABLE public.qris_report_transactions
  ADD COLUMN IF NOT EXISTS auto_match_blocked boolean NOT NULL DEFAULT false;
