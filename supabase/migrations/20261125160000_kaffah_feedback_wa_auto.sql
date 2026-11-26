-- Kaffah Physiotherapy: kuesioner feedback dikirim OTOMATIS ke WhatsApp pasien 2 menit setelah kwitansi.
--
-- Aturan:
--   * Pemicu: baris baru di invoice_wa_sends (kwitansi dikirim lewat aplikasi). Kwitansi manual (wa.me) tidak memicu.
--   * Hanya pasien yang BELUM pernah mengisi kuesioner (tidak ada patient_feedback_links.responded_at untuk pasien itu).
--   * Maks. 1 kuesioner per pasien per 20 jam (kwitansi ganda di hari yang sama tidak menggandakan pesan).
--   * Kwitansi harus berstatus 'terkirim'; bila 'gagal' kuesioner dilewati.
--   * Jendela 24 jam terbuka (pesan masuk pasien < 23 jam) -> teks bebas berisi link (gratis).
--     Jendela tertutup -> template Meta 'kaffah_kuesioner_pasca_terapi_v2' (tombol URL kaffahphysio.id/feedback/{{1}}; token dikirim lewat
--     parameter 'url_suffix', terbukti lewat uji 26 Nov 2026).
--   * Sapaan memakai WITA (Asia/Makassar). Nama = nickname pasien, cadangan nama lengkap.
--
-- Keandalan: antrean di database + cron tiap menit (tidak bergantung browser). Penolakan eksplisit Watzap dicoba ulang
-- (2, 5, 15 menit; maks. 4 percobaan). Bila balasan Watzap hilang/ambigu, TIDAK dicoba ulang (mencegah pesan ganda).
-- Pemicu dibungkus penangkap galat: kegagalan antrean tidak pernah menggagalkan pengiriman kwitansi.
--
-- SAKELAR: fitur MATI saat migrasi ini dijalankan. Aktifkan setelah template disetujui Meta dan diuji:
--   UPDATE public.feedback_wa_config SET enabled = true WHERE clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a';
--
-- Rollback: supabase/manual/rollback_kaffah_feedback_wa_auto.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.feedback_wa_config (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  enabled   boolean NOT NULL DEFAULT false
);
ALTER TABLE public.feedback_wa_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feedback_wa_config FROM PUBLIC, anon, authenticated;

INSERT INTO public.feedback_wa_config (clinic_id, enabled)
VALUES ('bfdc3fd8-a052-4753-a5b7-229930b3237a', false)
ON CONFLICT (clinic_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.feedback_wa_queue (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clinic_id   uuid NOT NULL,
  patient_id  uuid,
  recap_id    uuid NOT NULL UNIQUE,
  link_id     uuid,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  reason      text,
  via         text,
  attempts    integer NOT NULL DEFAULT 0,
  due_at      timestamptz NOT NULL,
  request_id  bigint,
  wamid       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz,
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_feedback_wa_queue_due ON public.feedback_wa_queue (due_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_feedback_wa_queue_sending ON public.feedback_wa_queue (id) WHERE status = 'sending';
CREATE INDEX IF NOT EXISTS idx_feedback_wa_queue_patient ON public.feedback_wa_queue (patient_id, created_at DESC);
ALTER TABLE public.feedback_wa_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feedback_wa_queue FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Pemicu: kwitansi dikirim -> masukkan ke antrean (jatuh tempo 2 menit).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.feedback_wa_enqueue_from_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient uuid;
BEGIN
  BEGIN
    IF EXISTS (SELECT 1 FROM public.feedback_wa_config WHERE clinic_id = NEW.clinic_id AND enabled) THEN
      SELECT patient_id INTO v_patient FROM public.daily_recaps WHERE id = NEW.recap_id;
      INSERT INTO public.feedback_wa_queue (clinic_id, patient_id, recap_id, due_at)
      VALUES (NEW.clinic_id, v_patient, NEW.recap_id, now() + interval '2 minutes')
      ON CONFLICT (recap_id) DO NOTHING;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'feedback_wa_enqueue_from_invoice: %', SQLERRM; -- jangan pernah menggagalkan kwitansi
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.feedback_wa_enqueue_from_invoice() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_feedback_wa_enqueue ON public.invoice_wa_sends;
CREATE TRIGGER trg_feedback_wa_enqueue
  AFTER INSERT ON public.invoice_wa_sends
  FOR EACH ROW EXECUTE FUNCTION public.feedback_wa_enqueue_from_invoice();

-- ─────────────────────────────────────────────────────────────────────────────
-- Penyelesai satu pengiriman: baca balasan Watzap dari pg_net.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.feedback_wa_resolve_one(p_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q record;
  r record;
  body jsonb;
  v_detail text;
  v_wamid text;
BEGIN
  SELECT * INTO q FROM public.feedback_wa_queue WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF q.status <> 'sending' THEN RETURN q.status; END IF;

  SELECT status_code, content, error_msg INTO r FROM net._http_response WHERE id = q.request_id;

  IF NOT FOUND THEN
    IF q.sent_at < now() - interval '10 minutes' THEN
      -- Ambigu: pesan mungkin sudah terkirim. Jangan coba ulang (mencegah pesan ganda).
      UPDATE public.feedback_wa_queue
         SET status = 'failed', reason = 'Respons Watzap tidak ditemukan (kedaluwarsa)', resolved_at = now()
       WHERE id = q.id;
      RETURN 'failed';
    END IF;
    RETURN 'sending';
  END IF;

  BEGIN
    body := r.content::jsonb;
  EXCEPTION WHEN others THEN
    body := NULL;
  END;

  IF r.status_code = 200 AND body->>'status' = '200' THEN
    v_wamid := body->>'wamid';
    UPDATE public.feedback_wa_queue
       SET status = 'sent', wamid = v_wamid, reason = NULL, resolved_at = now()
     WHERE id = q.id;
    RETURN 'sent';
  END IF;

  v_detail := left(coalesce(body->>'message', r.error_msg, left(r.content, 200), 'HTTP ' || coalesce(r.status_code::text, '?')), 300);

  IF q.attempts < 4 THEN
    -- Ditolak secara eksplisit: coba lagi dengan jeda 2 / 5 / 15 menit.
    UPDATE public.feedback_wa_queue
       SET status = 'pending', reason = v_detail,
           due_at = now() + ((ARRAY[2, 5, 15])[LEAST(q.attempts, 3)] || ' minutes')::interval
     WHERE id = q.id;
    RETURN 'pending';
  END IF;

  UPDATE public.feedback_wa_queue
     SET status = 'failed', reason = v_detail, resolved_at = now()
   WHERE id = q.id;
  RETURN 'failed';
END;
$$;
REVOKE ALL ON FUNCTION public.feedback_wa_resolve_one(bigint) FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Proses satu antrean yang jatuh tempo: validasi -> pilih jalur -> kirim.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.feedback_wa_process_one(p_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_template constant text := 'kaffah_kuesioner_pasca_terapi_v2';
  c_domain   constant text := 'https://kaffahphysio.id';
  q record;
  v_inv text;
  v_inv_at timestamptz;
  v_key text;
  v_number_key text;
  v_phone text;
  v_nick text;
  v_token text;
  v_link uuid;
  v_hour int := extract(hour FROM (now() AT TIME ZONE 'Asia/Makassar'))::int;
  v_waktu text;
  v_open boolean := false;
  v_req bigint;
  v_via text;
  v_body jsonb;
BEGIN
  SELECT * INTO q FROM public.feedback_wa_queue WHERE id = p_id FOR UPDATE SKIP LOCKED;
  IF NOT FOUND OR q.status <> 'pending' OR q.due_at > now() THEN RETURN NULL; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.feedback_wa_config WHERE clinic_id = q.clinic_id AND enabled) THEN
    UPDATE public.feedback_wa_queue SET status = 'skipped', reason = 'fitur dimatikan', resolved_at = now() WHERE id = q.id;
    RETURN 'skipped';
  END IF;

  IF q.patient_id IS NULL THEN
    UPDATE public.feedback_wa_queue SET status = 'skipped', reason = 'tanpa data pasien', resolved_at = now() WHERE id = q.id;
    RETURN 'skipped';
  END IF;

  -- Kwitansi harus sudah terkirim (kuesioner menyusul kwitansi, bukan mendahuluinya).
  SELECT status, created_at INTO v_inv, v_inv_at
    FROM public.invoice_wa_sends WHERE recap_id = q.recap_id ORDER BY id DESC LIMIT 1;
  IF v_inv = 'mengirim' THEN
    IF v_inv_at > now() - interval '15 minutes' THEN
      UPDATE public.feedback_wa_queue SET due_at = now() + interval '1 minute' WHERE id = q.id;
      RETURN 'pending';
    END IF;
    UPDATE public.feedback_wa_queue SET status = 'skipped', reason = 'kwitansi tidak terselesaikan', resolved_at = now() WHERE id = q.id;
    RETURN 'skipped';
  ELSIF v_inv IS DISTINCT FROM 'terkirim' THEN
    UPDATE public.feedback_wa_queue SET status = 'skipped', reason = 'kwitansi gagal terkirim', resolved_at = now() WHERE id = q.id;
    RETURN 'skipped';
  END IF;

  -- Sudah pernah mengisi -> tidak perlu dikirim lagi.
  IF EXISTS (SELECT 1 FROM public.patient_feedback_links
              WHERE clinic_id = q.clinic_id AND patient_id = q.patient_id AND responded_at IS NOT NULL) THEN
    UPDATE public.feedback_wa_queue SET status = 'skipped', reason = 'pasien sudah mengisi', resolved_at = now() WHERE id = q.id;
    RETURN 'skipped';
  END IF;

  -- Maks. 1 pesan kuesioner per pasien per 20 jam.
  IF EXISTS (SELECT 1 FROM public.feedback_wa_queue
              WHERE patient_id = q.patient_id AND id <> q.id
                AND status IN ('sending', 'sent') AND sent_at > now() - interval '20 hours') THEN
    UPDATE public.feedback_wa_queue SET status = 'skipped', reason = 'sudah dikirim hari ini', resolved_at = now() WHERE id = q.id;
    RETURN 'skipped';
  END IF;

  SELECT api_key, number_key INTO v_key, v_number_key FROM public.wa_settings WHERE clinic_id = q.clinic_id LIMIT 1;
  IF v_key IS NULL THEN
    UPDATE public.feedback_wa_queue SET status = 'failed', reason = 'API WhatsApp belum diatur', resolved_at = now() WHERE id = q.id;
    RETURN 'failed';
  END IF;

  SELECT regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'),
         COALESCE(NULLIF(btrim(nickname), ''), NULLIF(btrim(full_name), ''), 'Kak')
    INTO v_phone, v_nick FROM public.patients WHERE id = q.patient_id;
  IF v_phone LIKE '0%' THEN v_phone := '62' || substr(v_phone, 2); END IF;
  IF v_phone IS NULL OR length(v_phone) < 9 THEN
    UPDATE public.feedback_wa_queue SET status = 'skipped', reason = 'nomor WhatsApp tidak valid', resolved_at = now() WHERE id = q.id;
    RETURN 'skipped';
  END IF;

  -- Pakai ulang link yang belum diisi milik pasien; bila belum ada, buat baru.
  SELECT id, token INTO v_link, v_token FROM public.patient_feedback_links
   WHERE clinic_id = q.clinic_id AND patient_id = q.patient_id AND responded_at IS NULL
   ORDER BY created_at DESC LIMIT 1;
  IF v_link IS NULL THEN
    v_token := replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.patient_feedback_links (clinic_id, token, patient_id, patient_name)
    VALUES (q.clinic_id, v_token,  q.patient_id, v_nick)
    RETURNING id INTO v_link;
  END IF;

  v_waktu := CASE WHEN v_hour < 11 THEN 'pagi' WHEN v_hour < 15 THEN 'siang' WHEN v_hour < 18 THEN 'sore' ELSE 'malam' END;

  SELECT coalesce(max(last_inbound_at) > now() - interval '23 hours', false) INTO v_open
    FROM public.wa_inbox_conversations WHERE clinic_id = q.clinic_id AND wa_id = v_phone;
  v_via := CASE WHEN v_open THEN 'text' ELSE 'template' END;

  IF v_via = 'text' THEN
    v_body := jsonb_build_object(
      'api_key', v_key,
      'phone_no', v_phone,
      'message', 'Selamat ' || v_waktu || ' ' || v_nick || E' 🙏\n\n'
        || E'Agar layanan kami terus lebih baik, mohon bantu isi kuesioner kepuasan singkat (± 2 menit) tentang terapi hari ini.\n\n'
        || E'Masukan Anda sangat berarti bagi kami.\n\n'
        || E'🔗 ' || c_domain || '/feedback/' || v_token || E'\n\n'
        || E'Salam Sehat,\n*Kaffah Physiotherapy*'
    );
    IF v_number_key IS NOT NULL AND v_number_key <> 'ALL' THEN
      v_body := v_body || jsonb_build_object('number_key', v_number_key);
    END IF;
    v_req := net.http_post(
      url := 'https://api.watzap.id/v1/waba_send_message',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := v_body,
      timeout_milliseconds := 30000
    );
  ELSE
    v_req := net.http_post(
      url := 'https://api.watzap.id/v1/waba_send_message_template',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'api_key', v_key,
        'phone_no', v_phone,
        'template_name', c_template,
        'template_language', 'id',
        'parameter', jsonb_build_array(jsonb_build_object(
          'waktu', v_waktu,
          'nama_panggilan', v_nick,
          'url_suffix', v_token
        ))
      ),
      timeout_milliseconds := 30000
    );
  END IF;

  UPDATE public.feedback_wa_queue
     SET status = 'sending', via = v_via, link_id = v_link, request_id = v_req,
         attempts = attempts + 1, sent_at = now(), reason = NULL
   WHERE id = q.id;
  RETURN 'sending';
END;
$$;
REVOKE ALL ON FUNCTION public.feedback_wa_process_one(bigint) FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Cron tiap menit: selesaikan yang 'sending', lalu kirim yang jatuh tempo. Satu galat tidak menghentikan yang lain.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.feedback_wa_run()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  n integer := 0;
BEGIN
  FOR s IN SELECT id FROM public.feedback_wa_queue WHERE status = 'sending' ORDER BY id LIMIT 50 LOOP
    BEGIN
      PERFORM public.feedback_wa_resolve_one(s.id);
    EXCEPTION WHEN others THEN
      RAISE WARNING 'feedback_wa_resolve_one %: %', s.id, SQLERRM;
    END;
  END LOOP;

  FOR s IN SELECT id FROM public.feedback_wa_queue
            WHERE status = 'pending' AND due_at <= now() AND created_at > now() - interval '2 days'
            ORDER BY due_at LIMIT 20 LOOP
    BEGIN
      PERFORM public.feedback_wa_process_one(s.id);
      n := n + 1;
    EXCEPTION WHEN others THEN
      RAISE WARNING 'feedback_wa_process_one %: %', s.id, SQLERRM;
      UPDATE public.feedback_wa_queue
         SET due_at = now() + interval '5 minutes', reason = left(SQLERRM, 300),
             attempts = attempts + 1,
             status = CASE WHEN attempts + 1 >= 5 THEN 'failed' ELSE 'pending' END
       WHERE id = s.id AND status = 'pending';
    END;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.feedback_wa_run() FROM PUBLIC, anon, authenticated;

COMMIT;

SELECT cron.schedule('feedback-wa-run', '* * * * *', $$SELECT public.feedback_wa_run()$$);
