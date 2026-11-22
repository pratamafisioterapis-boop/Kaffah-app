-- Jeda bertahap AI (mode live): pesan pertama = delay_seconds (3 menit), setelah AI membalas sekali = delay2_seconds, dua kali atau lebih = delay3_seconds.
ALTER TABLE public.wa_ai_settings ADD COLUMN IF NOT EXISTS delay2_seconds integer NOT NULL DEFAULT 120;
ALTER TABLE public.wa_ai_settings ADD COLUMN IF NOT EXISTS delay3_seconds integer NOT NULL DEFAULT 60;
