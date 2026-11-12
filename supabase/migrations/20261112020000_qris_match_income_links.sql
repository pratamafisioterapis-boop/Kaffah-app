-- Transaksi laporan QRIS bisa menutup pemasukan lain-lain admin (mis. tips, tapping,
-- kinesiotape) selain recap pasien: satu scan untuk terapi + barang, atau pembayaran yang
-- murni pemasukan lain. Disimpan sebagai daftar id admin_income (tanpa FK, sama seperti
-- extra_recap_ids yang berupa array). matched_recap_id boleh kosong bila hanya pemasukan lain.
ALTER TABLE public.qris_report_transactions
  ADD COLUMN IF NOT EXISTS extra_income_ids uuid[] NOT NULL DEFAULT '{}';
