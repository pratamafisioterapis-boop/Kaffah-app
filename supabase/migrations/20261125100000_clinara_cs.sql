-- Customer Service Clinara untuk klinik Praxis.
-- Staf Praxis mengajukan tiket permintaan perubahan; owner Clinara menyetujui lewat Telegram.
--  Jalur A (pengaturan): nilai di clinic_settings (hanya key daftar putih), berlaku seketika, tercatat & bisa dibatalkan.
--  Jalur B (kode khusus Praxis): cabang git -> PR -> persetujuan owner. Tabel ini hanya melacak statusnya.

BEGIN;

-- ---------------------------------------------------------------------------
-- Pengaturan per klinik (jalur A)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinic_setting_keys (
  key         text PRIMARY KEY,
  description text NOT NULL,
  value_type  text NOT NULL DEFAULT 'text' CHECK (value_type IN ('text', 'boolean', 'number', 'json'))
);

CREATE TABLE IF NOT EXISTS public.clinic_settings (
  clinic_id  uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  key        text NOT NULL REFERENCES public.clinic_setting_keys(key) ON UPDATE CASCADE,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clinic_id, key)
);

-- Key awal (tambah lewat tiket/migrasi; di luar daftar ini tidak bisa diubah).
INSERT INTO public.clinic_setting_keys (key, description, value_type) VALUES
  ('kwitansi.footer_text',   'Teks kaki pada kwitansi', 'text'),
  ('menu.hidden',            'Daftar path menu yang disembunyikan, mis. ["/admin/attendance"]', 'json')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Tiket CS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinara_cs_tickets (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clinic_id        uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  requester_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_name   text,
  subject          text NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 200),
  category         text CHECK (category IN ('A', 'B')),            -- A = pengaturan, B = kode
  status           text NOT NULL DEFAULT 'baru'
                   CHECK (status IN ('baru', 'menunggu_persetujuan', 'disetujui', 'dikerjakan', 'selesai', 'ditolak', 'dibatalkan')),
  plan             text,                                            -- rencana dari CS
  proposed_changes jsonb,                                           -- jalur A: [{"key":"...","value":...}]
  branch           text,
  pr_url           text,
  preview_url      text,
  tg_message_id    bigint,                                          -- pesan Telegram untuk reply persetujuan
  resolved_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clinara_cs_tickets_status ON public.clinara_cs_tickets (status, created_at);
CREATE INDEX IF NOT EXISTS clinara_cs_tickets_clinic ON public.clinara_cs_tickets (clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS clinara_cs_tickets_tg ON public.clinara_cs_tickets (tg_message_id) WHERE tg_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.clinara_cs_messages (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id   bigint NOT NULL REFERENCES public.clinara_cs_tickets(id) ON DELETE CASCADE,
  sender      text NOT NULL CHECK (sender IN ('staff', 'cs')),
  body        text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clinara_cs_messages_ticket ON public.clinara_cs_messages (ticket_id, created_at);

CREATE TABLE IF NOT EXISTS public.clinara_cs_audit (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id   bigint REFERENCES public.clinara_cs_tickets(id) ON DELETE SET NULL,
  clinic_id   uuid NOT NULL,
  key         text NOT NULL,
  old_value   jsonb,
  new_value   jsonb,
  reverted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Pengaman: matikan fitur dengan satu baris (enabled = false).
CREATE TABLE IF NOT EXISTS public.clinara_cs_config (
  clinic_id     uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  enabled       boolean NOT NULL DEFAULT true,
  max_per_day   int NOT NULL DEFAULT 10
);
INSERT INTO public.clinara_cs_config (clinic_id)
SELECT id FROM public.clinics WHERE id = 'b25e8c29-6977-4e1b-b500-7629ec3aeb8a'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.clinic_setting_keys  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinara_cs_tickets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinara_cs_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinara_cs_audit     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinara_cs_config    ENABLE ROW LEVEL SECURITY;

CREATE POLICY setting_keys_read ON public.clinic_setting_keys FOR SELECT TO authenticated USING (true);

-- Semua staf klinik boleh MEMBACA pengaturan klinik sendiri; menulis hanya via fungsi service role.
CREATE POLICY clinic_settings_read ON public.clinic_settings FOR SELECT TO authenticated
  USING ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id()));

-- Tiket: owner/admin klinik sendiri (membaca); pembuatan lewat fungsi edge (service role).
CREATE POLICY cs_tickets_read ON public.clinara_cs_tickets FOR SELECT TO authenticated
  USING (
    (SELECT get_my_role()) = 'super_admin'
    OR ((SELECT get_my_role()) IN ('owner', 'admin') AND clinic_id = (SELECT get_my_clinic_id()))
  );
CREATE POLICY cs_messages_read ON public.clinara_cs_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clinara_cs_tickets t
    WHERE t.id = ticket_id
      AND ((SELECT get_my_role()) = 'super_admin'
           OR ((SELECT get_my_role()) IN ('owner', 'admin') AND t.clinic_id = (SELECT get_my_clinic_id())))
  ));
CREATE POLICY cs_audit_read ON public.clinara_cs_audit FOR SELECT TO authenticated
  USING ((SELECT get_my_role()) = 'super_admin');
CREATE POLICY cs_config_read ON public.clinara_cs_config FOR SELECT TO authenticated
  USING ((SELECT get_my_role()) = 'super_admin' OR clinic_id = (SELECT get_my_clinic_id()));

-- Super admin (owner Clinara) boleh membalas dan memperbarui tiket dari aplikasi.
CREATE POLICY cs_tickets_super_write ON public.clinara_cs_tickets FOR UPDATE TO authenticated
  USING ((SELECT get_my_role()) = 'super_admin') WITH CHECK ((SELECT get_my_role()) = 'super_admin');
CREATE POLICY cs_messages_super_insert ON public.clinara_cs_messages FOR INSERT TO authenticated
  WITH CHECK ((SELECT get_my_role()) = 'super_admin' AND sender = 'cs');

-- ---------------------------------------------------------------------------
-- Jalur A: terapkan perubahan pengaturan dari sebuah tiket (hanya service role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clinara_cs_apply_settings(p_ticket_id bigint)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_t   public.clinara_cs_tickets%ROWTYPE;
  v_ch  jsonb;
  v_key text;
  v_old jsonb;
  n     int := 0;
BEGIN
  SELECT * INTO v_t FROM public.clinara_cs_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tiket tidak ditemukan'; END IF;
  IF v_t.category IS DISTINCT FROM 'A' OR jsonb_typeof(v_t.proposed_changes) <> 'array' THEN
    RAISE EXCEPTION 'Tiket ini bukan perubahan pengaturan';
  END IF;
  IF v_t.status NOT IN ('baru', 'menunggu_persetujuan', 'disetujui', 'dikerjakan') THEN
    RAISE EXCEPTION 'Status tiket % tidak bisa diterapkan', v_t.status;
  END IF;

  FOR v_ch IN SELECT * FROM jsonb_array_elements(v_t.proposed_changes) LOOP
    v_key := v_ch->>'key';
    IF NOT EXISTS (SELECT 1 FROM public.clinic_setting_keys WHERE key = v_key) THEN
      RAISE EXCEPTION 'Key % tidak ada di daftar putih', v_key;
    END IF;
    SELECT value INTO v_old FROM public.clinic_settings WHERE clinic_id = v_t.clinic_id AND key = v_key;
    INSERT INTO public.clinic_settings (clinic_id, key, value) VALUES (v_t.clinic_id, v_key, v_ch->'value')
    ON CONFLICT (clinic_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
    INSERT INTO public.clinara_cs_audit (ticket_id, clinic_id, key, old_value, new_value)
    VALUES (p_ticket_id, v_t.clinic_id, v_key, v_old, v_ch->'value');
    n := n + 1;
  END LOOP;

  UPDATE public.clinara_cs_tickets
     SET status = 'selesai', resolved_at = now(), updated_at = now() WHERE id = p_ticket_id;
  INSERT INTO public.clinara_cs_messages (ticket_id, sender, body)
  VALUES (p_ticket_id, 'cs', 'Perubahan sudah diterapkan dan langsung berlaku. Muat ulang aplikasi bila belum terlihat.');
  RETURN n;
END $$;

-- Batalkan semua perubahan pengaturan sebuah tiket (kembali ke nilai lama).
CREATE OR REPLACE FUNCTION public.clinara_cs_revert_settings(p_ticket_id bigint)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; n int := 0;
BEGIN
  FOR a IN SELECT * FROM public.clinara_cs_audit
            WHERE ticket_id = p_ticket_id AND reverted_at IS NULL ORDER BY id DESC LOOP
    IF a.old_value IS NULL THEN
      DELETE FROM public.clinic_settings WHERE clinic_id = a.clinic_id AND key = a.key;
    ELSE
      UPDATE public.clinic_settings SET value = a.old_value, updated_at = now()
       WHERE clinic_id = a.clinic_id AND key = a.key;
    END IF;
    UPDATE public.clinara_cs_audit SET reverted_at = now() WHERE id = a.id;
    n := n + 1;
  END LOOP;
  UPDATE public.clinara_cs_tickets SET status = 'dibatalkan', updated_at = now() WHERE id = p_ticket_id;
  INSERT INTO public.clinara_cs_messages (ticket_id, sender, body)
  VALUES (p_ticket_id, 'cs', 'Perubahan dibatalkan dan dikembalikan seperti semula.');
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.clinara_cs_apply_settings(bigint)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clinara_cs_revert_settings(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clinara_cs_apply_settings(bigint)  TO service_role;
GRANT EXECUTE ON FUNCTION public.clinara_cs_revert_settings(bigint) TO service_role;

COMMIT;
