-- Penangkap webhook Watzap (tahap 1): menyimpan payload mentah pesan masuk
-- supaya bentuk datanya bisa dilihat sebelum parser ditulis.
-- Kedua tabel RLS-nya aktif tanpa policy: hanya Edge Function (service role)
-- yang bisa membaca/menulis; browser tidak punya akses sama sekali.

CREATE TABLE IF NOT EXISTS public.wa_watzap_config (
  clinic_id  uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,      -- dipakai sebagai ?token= pada URL webhook
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_watzap_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_watzap_config FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.wa_watzap_raw (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clinic_id    uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  received_at  timestamptz NOT NULL DEFAULT now(),
  content_type text,
  body         text
);
ALTER TABLE public.wa_watzap_raw ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_watzap_raw FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_wa_watzap_raw_received ON public.wa_watzap_raw (received_at DESC);
