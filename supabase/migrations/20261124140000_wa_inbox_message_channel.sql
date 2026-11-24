-- Jalur nomor tempat pesan masuk/keluar: 'waba' (nomor resmi via Watzap) atau
-- 'bablast' (nomor WA Web Kimmy via Bablast). Aditif: baris lama otomatis 'waba'.
ALTER TABLE public.wa_inbox_messages
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'waba';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wa_inbox_messages_channel_check'
  ) THEN
    ALTER TABLE public.wa_inbox_messages
      ADD CONSTRAINT wa_inbox_messages_channel_check CHECK (channel IN ('waba', 'bablast'));
  END IF;
END $$;
