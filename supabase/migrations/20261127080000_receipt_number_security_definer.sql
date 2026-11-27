-- Reschedule/booking ke hari ini gagal (409 daily_recaps_receipt_number_rcpt_uniq) untuk admin.
-- Penyebab: generate_monthly_receipt_number berjalan sebagai SECURITY INVOKER, sehingga MAX(receipt_number)
-- hanya melihat baris yang lolos RLS user. Nomor berikutnya jadi bentrok dengan kwitansi yang tak terlihat.
-- Perbaikan: jalankan sebagai definer agar seluruh nomor kwitansi terbaca.
ALTER FUNCTION public.generate_monthly_receipt_number(uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.trg_generate_receipt_number() SECURITY DEFINER SET search_path = public;
