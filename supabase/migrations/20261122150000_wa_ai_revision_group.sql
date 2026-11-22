-- Grup Telegram terpisah untuk revisi jawaban AI (didaftarkan owner dengan /grup_revisi di grup itu).
ALTER TABLE public.wa_ai_settings ADD COLUMN IF NOT EXISTS revision_chat_id text;
