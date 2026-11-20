-- Mode "review": AI menyusun draf balasan untuk SETIAP pesan pasien dan mengirimnya ke Telegram
-- owner (bukan ke pasien). Tidak ada pesan ke pasien, tidak ada booking.
ALTER TABLE public.wa_ai_settings DROP CONSTRAINT IF EXISTS wa_ai_settings_mode_check;
ALTER TABLE public.wa_ai_settings
  ADD CONSTRAINT wa_ai_settings_mode_check CHECK (mode IN ('simulate', 'live', 'review'));
