-- ════════════════════════════════════════════════════════════════════════════
-- Inbox WhatsApp (via Watzap) — jalankan MANUAL di Supabase → SQL Editor.
--
-- URUTAN:
--   BAGIAN A  → buat tabel inbox + kolom pengaktif.   (jalankan SEKARANG)
--   BAGIAN B  → cek hasil.                              (jalankan setelah A)
--   BAGIAN C  → aktifkan untuk Kaffah + putar ulang pesan uji.
--               JALANKAN HANYA SETELAH Claude mengabari fungsi sudah di-deploy.
--
-- Aman dijalankan ulang (IF NOT EXISTS / cek keberadaan). Tidak ada DROP.
-- Bagian A dibungkus BEGIN/COMMIT: kalau ada error, tidak ada yang tersimpan.
-- ════════════════════════════════════════════════════════════════════════════


-- ───────────────────────────── BAGIAN A ─────────────────────────────────────
BEGIN;

CREATE TABLE IF NOT EXISTS public.wa_conversations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  wa_id            text NOT NULL,                 -- nomor format 62xxxxxxxx
  contact_name     text,                          -- nama profil WhatsApp
  patient_id       uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  last_message_at  timestamptz,
  last_inbound_at  timestamptz,                   -- dasar jendela 24 jam
  last_preview     text,
  unread_count     integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, wa_id)
);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_clinic_last
  ON public.wa_conversations (clinic_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.wa_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  conversation_id  uuid NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  direction        text NOT NULL CHECK (direction IN ('in', 'out')),
  wa_message_id    text UNIQUE,
  msg_type         text NOT NULL DEFAULT 'text',
  body             text,
  template_name    text,
  media_id         text,
  media_path       text,                          -- path di bucket wa-media
  media_mime       text,
  status           text NOT NULL DEFAULT 'received'
                   CHECK (status IN ('received','queued','sent','delivered','read','failed')),
  error_code       text,
  error_message    text,
  queue_id         uuid,
  broadcast_id     uuid,
  sent_by          uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  status_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_wa_messages_conv_created
  ON public.wa_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wa_messages_clinic ON public.wa_messages (clinic_id);

-- RLS: pesan pasien bisa memuat data kesehatan → hanya owner/admin klinik itu
-- (dan super_admin). Penulisan hanya lewat Edge Function (service role),
-- kecuali reset unread_count oleh staf (dijaga trigger di bawah).
ALTER TABLE public.wa_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_messages      ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wa_conversations' AND policyname='clinic_isolated_wa_conversations') THEN
    CREATE POLICY clinic_isolated_wa_conversations ON public.wa_conversations FOR SELECT
      USING (get_my_role() = 'super_admin'
             OR (get_my_role() IN ('owner', 'admin') AND clinic_id = get_my_clinic_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wa_conversations' AND policyname='clinic_update_wa_conversations') THEN
    CREATE POLICY clinic_update_wa_conversations ON public.wa_conversations FOR UPDATE
      USING (get_my_role() IN ('owner', 'admin') AND clinic_id = get_my_clinic_id())
      WITH CHECK (get_my_role() IN ('owner', 'admin') AND clinic_id = get_my_clinic_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wa_messages' AND policyname='clinic_isolated_wa_messages') THEN
    CREATE POLICY clinic_isolated_wa_messages ON public.wa_messages FOR SELECT
      USING (get_my_role() = 'super_admin'
             OR (get_my_role() IN ('owner', 'admin') AND clinic_id = get_my_clinic_id()));
  END IF;
END $$;

-- Staf yang login hanya boleh mengubah unread_count/nama/tautan pasien; kolom
-- sistem (klinik, nomor, waktu pesan) dikunci. Service role & postgres bebas.
CREATE OR REPLACE FUNCTION public.wa_conversations_staff_update_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
     OR NEW.wa_id IS DISTINCT FROM OLD.wa_id
     OR NEW.last_inbound_at IS DISTINCT FROM OLD.last_inbound_at
     OR NEW.last_message_at IS DISTINCT FROM OLD.last_message_at THEN
    RAISE EXCEPTION 'Kolom ini hanya bisa diubah oleh sistem';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_wa_conversations_staff_update_guard') THEN
    CREATE TRIGGER trg_wa_conversations_staff_update_guard
      BEFORE UPDATE ON public.wa_conversations
      FOR EACH ROW EXECUTE FUNCTION public.wa_conversations_staff_update_guard();
  END IF;
END $$;

-- Realtime: pesan baru muncul tanpa refresh.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_conversations;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Bucket privat untuk gambar/dokumen/voice note pasien; folder pertama = clinic_id.
INSERT INTO storage.buckets (id, name, public)
VALUES ('wa-media', 'wa-media', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='wa_media_staff_read') THEN
    CREATE POLICY wa_media_staff_read ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'wa-media'
        AND (
          get_my_role() = 'super_admin'
          OR (get_my_role() IN ('owner', 'admin')
              AND (storage.foldername(name))[1] = get_my_clinic_id()::text)
        )
      );
  END IF;
END $$;

-- Mencocokkan nomor pengirim ke data pasien. patients.phone sering berformat
-- bebas ("0812-345-678"), jadi dibersihkan ke digit lalu 0xx/8xx → 62xx.
CREATE OR REPLACE FUNCTION public.wa_find_patient(p_clinic_id uuid, p_wa_id text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.id
  FROM public.patients p
  WHERE p.clinic_id = p_clinic_id
    AND p.phone IS NOT NULL
    AND (
      CASE
        WHEN regexp_replace(p.phone, '\D', '', 'g') LIKE '0%'
          THEN '62' || substr(regexp_replace(p.phone, '\D', '', 'g'), 2)
        WHEN regexp_replace(p.phone, '\D', '', 'g') LIKE '8%'
          THEN '62' || regexp_replace(p.phone, '\D', '', 'g')
        ELSE regexp_replace(p.phone, '\D', '', 'g')
      END
    ) = p_wa_id
  ORDER BY p.created_at DESC
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.wa_find_patient(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_find_patient(uuid, text) TO service_role;

-- Pengaktif inbox per klinik (default mati).
ALTER TABLE public.wa_settings
  ADD COLUMN IF NOT EXISTS inbox_enabled boolean NOT NULL DEFAULT false;

COMMIT;


-- ───────────────────────────── BAGIAN B (cek) ───────────────────────────────
-- Semua kolom "ok" harus true.
SELECT
  to_regclass('public.wa_conversations') IS NOT NULL                                   AS tabel_percakapan_ok,
  to_regclass('public.wa_messages') IS NOT NULL                                        AS tabel_pesan_ok,
  (SELECT count(*) FROM pg_policies
    WHERE tablename IN ('wa_conversations','wa_messages')) = 3                         AS rls_3_policy_ok,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.wa_messages'::regclass)     AS rls_aktif_ok,
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'wa-media' AND NOT public)         AS bucket_privat_ok,
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_wa_conversations_staff_update_guard') AS trigger_ok,
  (SELECT count(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
    AND tablename IN ('wa_messages','wa_conversations')) = 2                           AS realtime_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wa_settings' AND column_name = 'inbox_enabled')                AS kolom_inbox_ok;


-- ─────────────── BAGIAN C (JALANKAN SETELAH CLAUDE MENGABARI) ───────────────
-- Aktifkan inbox khusus klinik Kaffah, lalu putar ulang 4 pesan uji
-- (teks, gambar, dokumen, voice note) dari penangkap supaya muncul di inbox.
-- Putar ulang aman: pesan yang sama tidak akan ganda (dicek lewat ID pesan).
--
-- UPDATE public.wa_settings SET inbox_enabled = true
--  WHERE clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a';
--
-- SELECT net.http_post(
--          url  := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/wa-watzap-webhook?token=' || c.token,
--          body := r.body::jsonb)
--   FROM public.wa_watzap_raw r
--   JOIN public.wa_watzap_config c ON c.clinic_id = r.clinic_id
--  WHERE r.id IN (2, 3, 4, 5);
