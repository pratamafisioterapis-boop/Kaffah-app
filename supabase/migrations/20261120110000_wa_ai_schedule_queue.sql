-- Asisten AI WhatsApp tahap 2: jam aktif yang bisa diatur, jeda tunggu admin, antrean + penjadwal.
-- Tetap aman: AI masih mati (enabled=false) sampai dinyalakan manual.

BEGIN;

-- Jeda tunggu admin kini sampai 1 jam (antrean + cron, bukan tidur di fungsi edge).
ALTER TABLE public.wa_ai_settings DROP CONSTRAINT IF EXISTS wa_ai_settings_delay_seconds_check;
ALTER TABLE public.wa_ai_settings
  ADD CONSTRAINT wa_ai_settings_delay_seconds_check CHECK (delay_seconds BETWEEN 0 AND 3600);
ALTER TABLE public.wa_ai_settings ALTER COLUMN delay_seconds SET DEFAULT 300;
UPDATE public.wa_ai_settings SET delay_seconds = 300 WHERE delay_seconds = 120 AND enabled = false;

ALTER TABLE public.wa_ai_settings
  -- both: jam buka tunggu admin diam; jam tutup balas. closed_only: hanya jam tutup.
  -- silent_only: kapan pun tunggu admin diam.
  ADD COLUMN IF NOT EXISTS ai_mode text NOT NULL DEFAULT 'both'
    CHECK (ai_mode IN ('both', 'closed_only', 'silent_only')),
  ADD COLUMN IF NOT EXISTS closed_delay_seconds integer NOT NULL DEFAULT 0
    CHECK (closed_delay_seconds BETWEEN 0 AND 3600),
  -- Jam operasional (WITA) per hari: 0=Minggu ... 6=Sabtu, [buka, tutup]; null = tutup seharian.
  ADD COLUMN IF NOT EXISTS business_hours jsonb NOT NULL DEFAULT
    '{"1":["09:00","21:00"],"2":["09:00","21:00"],"3":["09:00","21:00"],"4":["09:00","21:00"],"5":["09:00","21:00"],"6":["09:00","17:00"],"0":["09:00","17:00"]}'::jsonb;

-- Antrean balasan yang menunggu jatuh tempo.
CREATE TABLE IF NOT EXISTS public.wa_ai_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.wa_inbox_conversations(id) ON DELETE CASCADE,
  message_id      uuid NOT NULL,
  due_at          timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done')),
  attempts        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS wa_ai_queue_message_uniq ON public.wa_ai_queue (message_id);
CREATE INDEX IF NOT EXISTS wa_ai_queue_due ON public.wa_ai_queue (status, due_at);

-- Token rahasia penjadwal (hanya terbaca service role): cron mengirimnya, fungsi mencocokkan.
CREATE TABLE IF NOT EXISTS public.wa_ai_cron_secret (
  id    boolean PRIMARY KEY DEFAULT true CHECK (id),
  token text NOT NULL
);
INSERT INTO public.wa_ai_cron_secret (token)
VALUES (replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.wa_ai_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_ai_cron_secret ENABLE ROW LEVEL SECURITY;
-- Tanpa kebijakan: hanya service role yang bisa membaca/menulis.

-- Penyapu tiap menit: memproses balasan yang sudah jatuh tempo.
SELECT cron.schedule(
  'wa-ai-sweep',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/wa-ai-reply',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-token', (select token from public.wa_ai_cron_secret limit 1)
      ),
      body := '{"sweep": true}'::jsonb
    ) as request_id;
  $cron$
);

COMMIT;
