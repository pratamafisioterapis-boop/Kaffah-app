-- WhatsApp Cloud API (Meta) langsung, tanpa BSP.
--
-- Fitur: kirim pesan + status, inbox pesan masuk, manajemen template,
-- broadcast. Semua tabel diisolasi per klinik (clinic_id) dengan pola RLS
-- yang sama seperti tabel lain (get_my_clinic_id / get_my_role).
--
-- Token akses Meta TIDAK pernah dikirim ke browser: disimpan di
-- wa_meta_credentials yang RLS-nya aktif tanpa policy sama sekali, sehingga
-- hanya Edge Function (service role) yang bisa membaca/menulisnya.

-- ───────────────────────── Akun & kredensial ─────────────────────────

CREATE TABLE IF NOT EXISTS public.wa_meta_accounts (
  clinic_id         uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  waba_id           text NOT NULL,
  phone_number_id   text NOT NULL UNIQUE,
  display_phone     text,
  verified_name     text,
  quality_rating    text,
  name_status       text,
  enabled           boolean NOT NULL DEFAULT true,
  connected_at      timestamptz,
  last_checked_at   timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_meta_credentials (
  clinic_id     uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  access_token  text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_meta_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_meta_credentials FROM anon, authenticated;

-- ───────────────────────── Percakapan & pesan ─────────────────────────

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
  queue_id         uuid,                          -- follow_up_queue.id bila berasal dari antrean
  broadcast_id     uuid,
  sent_by          uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  status_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_wa_messages_conv_created
  ON public.wa_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wa_messages_clinic ON public.wa_messages (clinic_id);

-- ───────────────────────── Template ─────────────────────────

CREATE TABLE IF NOT EXISTS public.wa_meta_templates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name              text NOT NULL,
  language          text NOT NULL DEFAULT 'id',
  category          text NOT NULL DEFAULT 'UTILITY',
  status            text NOT NULL DEFAULT 'PENDING',
  meta_template_id  text,
  components        jsonb NOT NULL DEFAULT '[]'::jsonb,
  rejected_reason   text,
  synced_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, name, language)
);

-- ───────────────────────── Broadcast ─────────────────────────

CREATE TABLE IF NOT EXISTS public.wa_broadcasts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name           text NOT NULL,
  template_name  text NOT NULL,
  language       text NOT NULL DEFAULT 'id',
  status         text NOT NULL DEFAULT 'running'
                 CHECK (status IN ('running','completed','cancelled')),
  total          integer NOT NULL DEFAULT 0,
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz
);

CREATE TABLE IF NOT EXISTS public.wa_broadcast_recipients (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id   uuid NOT NULL REFERENCES public.wa_broadcasts(id) ON DELETE CASCADE,
  clinic_id      uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  phone          text NOT NULL,
  patient_id     uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  params         jsonb NOT NULL DEFAULT '[]'::jsonb,   -- nilai {{1}}, {{2}}, ...
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','sent','delivered','read','failed')),
  wa_message_id  text,
  error_message  text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broadcast_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_wa_broadcast_recipients_status
  ON public.wa_broadcast_recipients (broadcast_id, status);

-- ───────────────────────── RLS ─────────────────────────
-- Pesan pasien bisa memuat data kesehatan: hanya owner/admin/super_admin.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'wa_meta_accounts','wa_conversations','wa_messages',
    'wa_meta_templates','wa_broadcasts','wa_broadcast_recipients'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS clinic_isolated_%I ON public.%I', t, t);
  END LOOP;
END $$;

-- Akun: dibaca staf klinik, ditulis hanya lewat Edge Function (service role).
CREATE POLICY clinic_isolated_wa_meta_accounts ON public.wa_meta_accounts
  FOR SELECT
  USING (
    get_my_role() = 'super_admin'
    OR (get_my_role() IN ('owner', 'admin') AND clinic_id = get_my_clinic_id())
  );

-- Percakapan/pesan/rekap broadcast: baca untuk staf; tulis hanya lewat Edge
-- Function, kecuali reset unread_count yang boleh dilakukan staf.
CREATE POLICY clinic_isolated_wa_conversations ON public.wa_conversations
  FOR SELECT
  USING (
    get_my_role() = 'super_admin'
    OR (get_my_role() IN ('owner', 'admin') AND clinic_id = get_my_clinic_id())
  );
DROP POLICY IF EXISTS clinic_update_wa_conversations ON public.wa_conversations;
CREATE POLICY clinic_update_wa_conversations ON public.wa_conversations
  FOR UPDATE
  USING (get_my_role() IN ('owner', 'admin') AND clinic_id = get_my_clinic_id())
  WITH CHECK (get_my_role() IN ('owner', 'admin') AND clinic_id = get_my_clinic_id());

CREATE POLICY clinic_isolated_wa_messages ON public.wa_messages
  FOR SELECT
  USING (
    get_my_role() = 'super_admin'
    OR (get_my_role() IN ('owner', 'admin') AND clinic_id = get_my_clinic_id())
  );

CREATE POLICY clinic_isolated_wa_meta_templates ON public.wa_meta_templates
  FOR SELECT
  USING (
    get_my_role() = 'super_admin'
    OR (get_my_role() IN ('owner', 'admin') AND clinic_id = get_my_clinic_id())
  );

CREATE POLICY clinic_isolated_wa_broadcasts ON public.wa_broadcasts
  FOR SELECT
  USING (
    get_my_role() = 'super_admin'
    OR (get_my_role() IN ('owner', 'admin') AND clinic_id = get_my_clinic_id())
  );

CREATE POLICY clinic_isolated_wa_broadcast_recipients ON public.wa_broadcast_recipients
  FOR SELECT
  USING (
    get_my_role() = 'super_admin'
    OR (get_my_role() IN ('owner', 'admin') AND clinic_id = get_my_clinic_id())
  );

-- Staf hanya boleh mengubah unread_count lewat UPDATE; kolom lain dikunci.
CREATE OR REPLACE FUNCTION public.wa_conversations_staff_update_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- service role / postgres (Edge Function) bebas mengubah apa pun.
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
-- (idempoten: aman bila sudah dibuat lewat supabase/manual/11_inbox_whatsapp_watzap.sql)
DROP TRIGGER IF EXISTS trg_wa_conversations_staff_update_guard ON public.wa_conversations;
CREATE TRIGGER trg_wa_conversations_staff_update_guard
  BEFORE UPDATE ON public.wa_conversations
  FOR EACH ROW EXECUTE FUNCTION public.wa_conversations_staff_update_guard();

-- ───────────────────────── Realtime ─────────────────────────

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

-- ───────────────────────── Storage media ─────────────────────────
-- Bucket privat; folder pertama = clinic_id.

INSERT INTO storage.buckets (id, name, public)
VALUES ('wa-media', 'wa-media', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS wa_media_staff_read ON storage.objects;
CREATE POLICY wa_media_staff_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'wa-media'
    AND (
      get_my_role() = 'super_admin'
      OR (
        get_my_role() IN ('owner', 'admin')
        AND (storage.foldername(name))[1] = get_my_clinic_id()::text
      )
    )
  );

-- ───────────────────────── Pencocokan nomor → pasien ─────────────────────────
-- patients.phone sering berformat bebas ("0812-345-678", "+62 812…"), jadi
-- dibersihkan ke digit lalu dinormalkan 0xx / 8xx → 62xx sebelum dibandingkan.
-- Hanya dipanggil Edge Function (service role).

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
