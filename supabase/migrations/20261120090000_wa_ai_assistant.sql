-- Asisten AI balasan WhatsApp: pengaturan, log, dan penanda serah-terima ke admin.
--
-- AI MATI secara default (enabled=false) dan mode default 'simulate' (menyusun balasan &
-- booking tanpa mengirim / menulis). Perubahan ini aman dijalankan sebelum fungsi di-deploy.

BEGIN;

CREATE TABLE IF NOT EXISTS public.wa_ai_settings (
  clinic_id      uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  enabled        boolean NOT NULL DEFAULT false,
  -- simulate: hanya mencatat balasan/booking rencana ke wa_ai_logs.
  -- live: mengirim balasan ke pasien dan membuat booking sungguhan.
  mode           text NOT NULL DEFAULT 'simulate' CHECK (mode IN ('simulate', 'live')),
  -- AI baru membalas bila admin belum membalas sampai sekian detik (0 = langsung).
  delay_seconds  integer NOT NULL DEFAULT 180 CHECK (delay_seconds BETWEEN 0 AND 150),
  -- Bila tidak kosong, AI hanya melayani nomor-nomor ini (uji terbatas), format 62812...
  test_phones    text[] NOT NULL DEFAULT '{}',
  updated_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_ai_logs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id          uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  conversation_id    uuid REFERENCES public.wa_inbox_conversations(id) ON DELETE CASCADE,
  inbound_message_id uuid,
  mode               text NOT NULL,
  outcome            text NOT NULL,          -- replied | simulated | handoff | skipped | error
  skip_reason        text,
  reply_text         text,
  handoff_reason     text,
  handoff_priority   text,
  planned_actions    jsonb NOT NULL DEFAULT '[]'::jsonb,
  appointment_id     uuid,
  error_message      text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Satu pesan masuk diproses sekali (webhook bisa terkirim ganda).
CREATE UNIQUE INDEX IF NOT EXISTS wa_ai_logs_inbound_uniq
  ON public.wa_ai_logs (inbound_message_id) WHERE inbound_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS wa_ai_logs_clinic_created
  ON public.wa_ai_logs (clinic_id, created_at DESC);

ALTER TABLE public.wa_inbox_conversations
  ADD COLUMN IF NOT EXISTS ai_paused          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_handoff         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_handoff_reason  text,
  ADD COLUMN IF NOT EXISTS ai_handoff_priority text,
  ADD COLUMN IF NOT EXISTS ai_handoff_at      timestamptz;

ALTER TABLE public.wa_ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_ai_logs     ENABLE ROW LEVEL SECURITY;

-- Owner/admin klinik yang sama boleh melihat & mengubah pengaturan dan melihat log.
-- Penulisan log hanya oleh service role (fungsi edge).
CREATE POLICY wa_ai_settings_staff ON public.wa_ai_settings FOR ALL TO authenticated
  USING (
    (SELECT get_my_role()) = 'super_admin'
    OR ((SELECT get_my_role()) IN ('owner', 'admin') AND clinic_id = (SELECT get_my_clinic_id()))
  )
  WITH CHECK (
    (SELECT get_my_role()) = 'super_admin'
    OR ((SELECT get_my_role()) IN ('owner', 'admin') AND clinic_id = (SELECT get_my_clinic_id()))
  );

CREATE POLICY wa_ai_logs_staff_read ON public.wa_ai_logs FOR SELECT TO authenticated
  USING (
    (SELECT get_my_role()) = 'super_admin'
    OR ((SELECT get_my_role()) IN ('owner', 'admin') AND clinic_id = (SELECT get_my_clinic_id()))
  );

-- Baris pengaturan awal untuk klinik yang sudah memakai inbox Watzap: tetap MATI.
INSERT INTO public.wa_ai_settings (clinic_id)
SELECT clinic_id FROM public.wa_watzap_config
ON CONFLICT (clinic_id) DO NOTHING;

COMMIT;
