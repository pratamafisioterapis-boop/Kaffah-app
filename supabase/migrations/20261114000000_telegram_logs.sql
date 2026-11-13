-- Log notifikasi Telegram (hanya dibaca/ditulis oleh service role lewat Edge
-- Function send-telegram). RLS aktif tanpa policy = tidak terbuka untuk klien.

CREATE TABLE IF NOT EXISTS public.telegram_logs (
  id         bigserial PRIMARY KEY,
  clinic_id  uuid NOT NULL,
  event      text NOT NULL,
  message    text NOT NULL,
  status     text NOT NULL CHECK (status IN ('sent', 'failed')),
  error      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS telegram_logs_created_at_idx
  ON public.telegram_logs (created_at DESC);
