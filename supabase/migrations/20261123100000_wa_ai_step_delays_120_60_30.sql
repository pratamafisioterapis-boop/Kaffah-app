-- Jeda bertahap AI (mode live) menjadi 2 menit -> 1 menit -> 30 detik.
ALTER TABLE public.wa_ai_settings ALTER COLUMN delay_seconds SET DEFAULT 120;
ALTER TABLE public.wa_ai_settings ALTER COLUMN delay2_seconds SET DEFAULT 60;
ALTER TABLE public.wa_ai_settings ALTER COLUMN delay3_seconds SET DEFAULT 30;
UPDATE public.wa_ai_settings SET delay_seconds = 120, delay2_seconds = 60, delay3_seconds = 30, updated_at = now();
