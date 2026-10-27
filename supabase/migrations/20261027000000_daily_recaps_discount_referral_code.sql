-- Kode referral wajib untuk diskon tertentu (mis. "Meranti trail run") di rekap harian.
ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS discount_referral_code text;
