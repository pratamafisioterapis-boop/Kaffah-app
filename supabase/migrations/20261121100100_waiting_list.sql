-- Waiting list: pasien yang jadwalnya penuh dan minta dikabari bila ada slot kosong.
-- Diisi oleh AI WhatsApp (source 'ai_whatsapp') atau admin manual; admin mengingatkan pasien dari aplikasi.

BEGIN;

CREATE TABLE IF NOT EXISTS public.waiting_list (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id        uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name      text NOT NULL,
  phone             text NOT NULL,                       -- format 08...
  conversation_id   uuid REFERENCES public.wa_inbox_conversations(id) ON DELETE SET NULL,
  preferred_date    date,                                -- null = tanggal bebas
  time_from         time,                                -- batas awal jam (mis. "di atas jam 11")
  time_to           time,                                -- batas akhir jam (opsional)
  time_label        text CHECK (time_label IN ('pagi', 'siang', 'sore', 'malam', 'bebas')),
  therapist_gender  text NOT NULL DEFAULT 'any' CHECK (therapist_gender IN ('female', 'male', 'any')),
  notes             text,
  status            text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'booked', 'cancelled')),
  source            text NOT NULL DEFAULT 'manual',
  notified_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waiting_list_clinic_status
  ON public.waiting_list (clinic_id, status, preferred_date);
CREATE INDEX IF NOT EXISTS waiting_list_clinic_phone
  ON public.waiting_list (clinic_id, phone);

ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;

-- Owner/admin klinik yang sama; penulisan oleh AI memakai service role.
CREATE POLICY waiting_list_staff ON public.waiting_list FOR ALL TO authenticated
  USING (
    (SELECT get_my_role()) = 'super_admin'
    OR ((SELECT get_my_role()) IN ('owner', 'admin') AND clinic_id = (SELECT get_my_clinic_id()))
  )
  WITH CHECK (
    (SELECT get_my_role()) = 'super_admin'
    OR ((SELECT get_my_role()) IN ('owner', 'admin') AND clinic_id = (SELECT get_my_clinic_id()))
  );

COMMIT;
