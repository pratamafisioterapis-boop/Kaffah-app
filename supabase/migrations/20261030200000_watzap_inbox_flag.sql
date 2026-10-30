-- Pengaktif inbox WhatsApp (via Watzap) per klinik. Default mati; diaktifkan
-- per klinik setelah webhook Watzap terdaftar. Prasyarat: tabel inbox dari
-- 20261029200000_wa_cloud_api.sql dan wa_watzap_config dari
-- 20261030100000_watzap_webhook_capture.sql.
ALTER TABLE public.wa_settings
  ADD COLUMN IF NOT EXISTS inbox_enabled boolean NOT NULL DEFAULT false;
