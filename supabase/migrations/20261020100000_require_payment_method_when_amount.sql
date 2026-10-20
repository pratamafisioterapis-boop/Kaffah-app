-- Nominal > 0 wajib punya metode pembayaran (kecuali pasien Free).
-- Berlaku juga untuk Recovery di luar paket: saat di-flag, payment_method=NULL dan
-- amount=0 (recovery_outside_package_apply), jadi baru kena aturan ini begitu nominal terisi.
-- NOT VALID: baris lama yang bermasalah (mis. nominal terisi tanpa metode) tidak menggagalkan
-- migrasi, tetapi INSERT/UPDATE baru langsung dicek. Jalankan VALIDATE CONSTRAINT setelah
-- data lama dilengkapi (lihat query di bawah).
ALTER TABLE public.daily_recaps
  DROP CONSTRAINT IF EXISTS daily_recaps_amount_requires_payment_method;

ALTER TABLE public.daily_recaps
  ADD CONSTRAINT daily_recaps_amount_requires_payment_method
  CHECK (
    COALESCE(amount, 0) <= 0
    OR NULLIF(btrim(COALESCE(payment_method, '')), '') IS NOT NULL
    OR special_type = 'free'
  ) NOT VALID;

-- Daftar recap lama yang harus dilengkapi admin:
--   SELECT id, recap_date, patient_id, amount
--   FROM public.daily_recaps
--   WHERE COALESCE(amount, 0) > 0
--     AND NULLIF(btrim(COALESCE(payment_method, '')), '') IS NULL
--     AND special_type IS DISTINCT FROM 'free';
-- Setelah kosong:
--   ALTER TABLE public.daily_recaps VALIDATE CONSTRAINT daily_recaps_amount_requires_payment_method;
