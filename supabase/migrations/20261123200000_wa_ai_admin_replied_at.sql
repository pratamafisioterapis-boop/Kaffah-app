-- Waktu balasan admin pertama di WhatsApp (dari riwayat Watzap) untuk setiap pesan pasien yang
-- dibuatkan draf AI. Diisi oleh skor harian (wa-ai-reply dailyReport). Dipakai tab "Performa Admin"
-- di dashboard owner untuk membandingkan kecepatan admin (Sila / Dinda) dengan AI.
ALTER TABLE public.wa_ai_logs
  ADD COLUMN IF NOT EXISTS admin_replied_at timestamptz;

CREATE INDEX IF NOT EXISTS wa_ai_logs_clinic_mode_created
  ON public.wa_ai_logs (clinic_id, mode, created_at DESC);
