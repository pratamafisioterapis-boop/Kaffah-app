-- Saklar AI per jalur di dashboard owner: Watzap (nomor resmi) dan Bablast (nomor Kimmy).
-- Jalur mati = AI tidak membalas dan tidak mengirim draf Telegram untuk pesan di jalur itu.
-- Aditif: default true, jadi perilaku sekarang tidak berubah sebelum owner menekan toggle.
ALTER TABLE public.wa_ai_settings
  ADD COLUMN IF NOT EXISTS ai_watzap_enabled  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_bablast_enabled boolean NOT NULL DEFAULT true;
