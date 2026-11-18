-- Bukti bayar (debit/transfer) untuk barang di recap sesi paket.
ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS goods_payment_proof_path text;
