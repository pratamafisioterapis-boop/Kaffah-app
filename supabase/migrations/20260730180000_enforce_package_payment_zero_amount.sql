-- Bug: "Package" sempat tersimpan sebagai payment_method untuk sesi pertama
-- pembelian paket (amount > 0), padahal per aturan bisnis "Package" hanya
-- boleh dipakai untuk sesi ke-2 dst pada paket multi-sesi (amount harus 0).
-- 15 baris historis yang salah sudah dibersihkan (payment_method dikosongkan
-- kembali untuk diisi ulang manual oleh staff).
--
-- Constraint ini mencegah kombinasi payment_method='Package' + amount>0
-- tersimpan lagi ke depannya, baik lewat auto-fill client maupun input
-- manual staff.

ALTER TABLE public.daily_recaps
  ADD CONSTRAINT chk_package_payment_zero_amount
  CHECK (NOT (payment_method = 'Package' AND COALESCE(amount, 0) > 0));
