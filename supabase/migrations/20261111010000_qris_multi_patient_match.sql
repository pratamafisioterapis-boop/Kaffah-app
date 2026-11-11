-- Satu pembayaran QRIS bisa menutup beberapa pasien sekaligus (mis. kakak-adik atau
-- orang tua membayar dua sesi dalam satu scan). matched_recap_id tetap menyimpan
-- pasien pertama; pasien tambahan disimpan di extra_recap_ids.
ALTER TABLE public.qris_report_transactions
  ADD COLUMN IF NOT EXISTS extra_recap_ids uuid[] NOT NULL DEFAULT '{}';
