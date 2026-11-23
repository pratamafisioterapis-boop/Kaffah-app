-- Kaffah Physiotherapy: kirim Surat Keterangan Fisioterapi & Resume Medis lewat WhatsApp.
--
-- Alur:
--   * Pasien chat ke klinik < 23 jam lalu  -> kirim PDF langsung (waba_send_file_url), nama file benar.
--   * Selain itu                           -> kirim template Meta (surat_keterangan_fisioterapi /
--     resume_medis_fisioterapi) berisi tombol "Kirim Dokumen". Saat pasien menekan tombol, webhook
--     memanggil clinical_doc_on_button(): jendela 24 jam terbuka, PDF dikirim lewat waba_send_file_url.
--
-- Template memuat variabel waktu (pagi/siang/sore/malam, WITA), nickname, dan tanggal.
-- Hanya klinik Kaffah. Status dilacak di clinical_doc_deliveries dan diselesaikan di server
-- (balasan WatZap dibaca dari pg_net), dengan cron tiap menit sebagai jaring pengaman.
--
-- Rollback: supabase/manual/rollback_kaffah_clinical_doc_delivery.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.clinical_doc_deliveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       uuid NOT NULL,
  patient_id      uuid,
  doc_type        text NOT NULL CHECK (doc_type IN ('surat_keterangan', 'resume_medis')),
  phone           text NOT NULL,
  file_url        text NOT NULL,
  filename        text NOT NULL,
  doc_date        date,
  via             text NOT NULL CHECK (via IN ('file', 'template')),
  status          text NOT NULL DEFAULT 'mengirim'
                  CHECK (status IN ('mengirim', 'menunggu_tombol', 'mengirim_dokumen', 'terkirim', 'gagal', 'kedaluwarsa')),
  request_id      bigint,
  file_request_id bigint,
  wamid           text,
  detail          text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  button_at       timestamptz,
  resolved_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_cdd_wamid ON public.clinical_doc_deliveries (wamid) WHERE wamid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cdd_phone_wait ON public.clinical_doc_deliveries (clinic_id, phone, created_at DESC)
  WHERE status IN ('mengirim', 'menunggu_tombol');
CREATE INDEX IF NOT EXISTS idx_cdd_open ON public.clinical_doc_deliveries (created_at)
  WHERE status IN ('mengirim', 'mengirim_dokumen', 'menunggu_tombol');

-- Hanya diakses lewat fungsi SECURITY DEFINER di bawah.
ALTER TABLE public.clinical_doc_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinical_doc_deliveries FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Pembantu kecil
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clinical_doc_caption(p_doc_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_doc_type
    WHEN 'resume_medis' THEN
      E'Berikut *Resume Medis Fisioterapi* Anda.\n\nDokumen ini bersifat rahasia dan hanya untuk Anda.\n\nTerima kasih telah mempercayakan pemulihan di *Kaffah Physiotherapy*.\nSemoga lekas membaik dan sehat selalu.\n\n*Salam Sehat,*\nKaffah Physiotherapy'
    ELSE
      E'Berikut *Surat Keterangan Fisioterapi* Anda.\n\nTerima kasih telah mempercayakan pemulihan di *Kaffah Physiotherapy*.\nSemoga lekas membaik dan sehat selalu.\n\n*Salam Sehat,*\nKaffah Physiotherapy'
  END;
$$;

CREATE OR REPLACE FUNCTION public.clinical_doc_tanggal_id(p_date date)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT extract(day FROM p_date)::int::text || ' ' ||
         (ARRAY['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'])[extract(month FROM p_date)::int] ||
         ' ' || extract(year FROM p_date)::int::text;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Penyelesai satu pengiriman (internal): baca balasan WatZap dari pg_net, tetapkan status.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clinical_doc_resolve_one(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
  r record;
  body jsonb;
  v_req bigint;
  v_found boolean;
  v_ok boolean;
  v_msg text;
BEGIN
  SELECT * INTO d FROM public.clinical_doc_deliveries WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Menunggu tombol terlalu lama (pasien tidak menekan dalam 7 hari).
  IF d.status = 'menunggu_tombol' THEN
    IF d.created_at < now() - interval '7 days' THEN
      UPDATE public.clinical_doc_deliveries
         SET status = 'kedaluwarsa', resolved_at = now(), detail = 'Pasien tidak menekan tombol dalam 7 hari'
       WHERE id = d.id;
      RETURN 'kedaluwarsa';
    END IF;
    RETURN d.status;
  END IF;

  IF d.status NOT IN ('mengirim', 'mengirim_dokumen') THEN RETURN d.status; END IF;

  v_req := CASE WHEN d.status = 'mengirim' THEN d.request_id ELSE d.file_request_id END;
  SELECT status_code, content, error_msg INTO r FROM net._http_response WHERE id = v_req;
  v_found := FOUND;

  IF NOT v_found THEN
    IF d.created_at < now() - interval '10 minutes' AND coalesce(d.button_at, d.created_at) < now() - interval '10 minutes' THEN
      UPDATE public.clinical_doc_deliveries
         SET status = 'gagal', resolved_at = now(), detail = 'Respons Watzap tidak ditemukan (kedaluwarsa)'
       WHERE id = d.id;
      RETURN 'gagal';
    END IF;
    RETURN d.status;
  END IF;

  BEGIN
    body := r.content::jsonb;
  EXCEPTION WHEN others THEN
    body := NULL;
  END;

  v_ok := (r.status_code = 200 AND body->>'status' = '200');

  IF NOT v_ok THEN
    v_msg := left(coalesce(body->>'message', r.error_msg, left(r.content, 200), 'HTTP ' || coalesce(r.status_code::text, '?')), 300);
    UPDATE public.clinical_doc_deliveries
       SET status = 'gagal', detail = v_msg, resolved_at = now()
     WHERE id = d.id;
    RETURN 'gagal';
  END IF;

  IF d.status = 'mengirim' AND d.via = 'template' THEN
    -- Template diterima WatZap; sekarang menunggu pasien menekan "Kirim Dokumen".
    UPDATE public.clinical_doc_deliveries
       SET status = 'menunggu_tombol', wamid = body->>'wamid'
     WHERE id = d.id;
    RETURN 'menunggu_tombol';
  END IF;

  UPDATE public.clinical_doc_deliveries
     SET status = 'terkirim', resolved_at = now(),
         wamid = coalesce(wamid, body->>'wamid')
   WHERE id = d.id;
  RETURN 'terkirim';
END;
$$;
REVOKE ALL ON FUNCTION public.clinical_doc_resolve_one(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.clinical_doc_resolve_pending()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  n integer := 0;
BEGIN
  FOR s IN
    SELECT id FROM public.clinical_doc_deliveries
     WHERE status IN ('mengirim', 'mengirim_dokumen', 'menunggu_tombol')
       AND created_at > now() - interval '8 days'
     ORDER BY created_at
  LOOP
    PERFORM public.clinical_doc_resolve_one(s.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.clinical_doc_resolve_pending() FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Kirim dokumen (dipanggil browser). Server memilih jalur: file langsung atau template + tombol.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clinical_doc_send(
  p_doc_type   text,
  p_patient_id uuid,
  p_phone      text,
  p_file_url   text,
  p_filename   text,
  p_doc_date   date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_kaffah constant uuid := 'bfdc3fd8-a052-4753-a5b7-229930b3237a';
  v_clinic uuid := (SELECT get_my_clinic_id());
  v_role text := COALESCE((SELECT get_my_role()), '');
  v_key text;
  v_number_key text;
  v_phone text;
  v_open boolean := false;
  v_via text;
  v_req bigint;
  v_id uuid;
  v_nick text;
  v_date date := COALESCE(p_doc_date, (now() AT TIME ZONE 'Asia/Makassar')::date);
  v_hour int := extract(hour FROM (now() AT TIME ZONE 'Asia/Makassar'))::int;
  v_waktu text;
  v_template text;
BEGIN
  IF auth.uid() IS NULL
     OR v_role NOT IN ('owner', 'admin', 'clinic_admin', 'therapist', 'super_admin') THEN
    RAISE EXCEPTION 'Anda tidak berhak mengirim dokumen ini.';
  END IF;
  IF v_clinic IS DISTINCT FROM c_kaffah THEN
    RAISE EXCEPTION 'Pengiriman dokumen lewat template hanya tersedia untuk Kaffah Physiotherapy.';
  END IF;
  IF p_doc_type NOT IN ('surat_keterangan', 'resume_medis') THEN
    RAISE EXCEPTION 'Jenis dokumen tidak dikenal.';
  END IF;
  IF coalesce(p_file_url, '') = '' THEN RAISE EXCEPTION 'URL file dokumen kosong.'; END IF;

  SELECT api_key, number_key INTO v_key, v_number_key
    FROM public.wa_settings WHERE clinic_id = v_clinic LIMIT 1;
  IF v_key IS NULL THEN RAISE EXCEPTION 'API WhatsApp belum diatur untuk klinik ini.'; END IF;

  v_phone := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  IF v_phone LIKE '0%' THEN v_phone := '62' || substr(v_phone, 2); END IF;
  IF length(v_phone) < 9 THEN RAISE EXCEPTION 'Nomor WhatsApp pasien tidak valid.'; END IF;

  SELECT coalesce(max(last_inbound_at) > now() - interval '23 hours', false) INTO v_open
    FROM public.wa_inbox_conversations
   WHERE clinic_id = v_clinic AND wa_id = v_phone;
  v_via := CASE WHEN v_open THEN 'file' ELSE 'template' END;

  IF v_via = 'file' THEN
    v_req := net.http_post(
      url := 'https://api.watzap.id/v1/waba_send_file_url',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'api_key', v_key,
        'number_key', COALESCE(v_number_key, 'ALL'),
        'phone_no', v_phone,
        'url', p_file_url,
        'filename', p_filename,
        'caption', public.clinical_doc_caption(p_doc_type)
      ),
      timeout_milliseconds := 30000
    );
  ELSE
    -- Sapaan: nickname pasien (sudah memuat sapaan, mis. "Bu Endang"), cadangan nama lengkap.
    SELECT COALESCE(NULLIF(btrim(nickname), ''), NULLIF(btrim(full_name), ''), 'Kak')
      INTO v_nick FROM public.patients WHERE id = p_patient_id;
    v_nick := COALESCE(v_nick, 'Kak');
    v_waktu := CASE WHEN v_hour < 11 THEN 'pagi' WHEN v_hour < 15 THEN 'siang' WHEN v_hour < 18 THEN 'sore' ELSE 'malam' END;
    v_template := CASE p_doc_type WHEN 'resume_medis' THEN 'resume_medis_fisioterapi' ELSE 'surat_keterangan_fisioterapi' END;

    v_req := net.http_post(
      url := 'https://api.watzap.id/v1/waba_send_message_template',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'api_key', v_key,
        'phone_no', v_phone,
        'template_name', v_template,
        'template_language', 'id',
        'parameter', jsonb_build_array(jsonb_build_object(
          'waktu', v_waktu,
          'nickname', v_nick,
          'tanggal', public.clinical_doc_tanggal_id(v_date)
        ))
      ),
      timeout_milliseconds := 30000
    );
  END IF;

  INSERT INTO public.clinical_doc_deliveries
    (clinic_id, patient_id, doc_type, phone, file_url, filename, doc_date, via, request_id, created_by)
  VALUES
    (v_clinic, p_patient_id, p_doc_type, v_phone, p_file_url, p_filename, v_date, v_via, v_req, auth.uid())
  RETURNING id INTO v_id;

  RETURN json_build_object('id', v_id, 'via', v_via);
END;
$$;
REVOKE ALL ON FUNCTION public.clinical_doc_send(text, uuid, text, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clinical_doc_send(text, uuid, text, text, text, date) TO authenticated;

-- Dipanggil browser untuk memperbarui satu pengiriman.
CREATE OR REPLACE FUNCTION public.clinical_doc_resolve(p_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid;
  v_status text;
  v_detail text;
  v_via text;
BEGIN
  SELECT clinic_id INTO v_clinic FROM public.clinical_doc_deliveries WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pengiriman tidak ditemukan.'; END IF;
  IF auth.uid() IS NULL OR v_clinic IS DISTINCT FROM (SELECT get_my_clinic_id()) THEN
    RAISE EXCEPTION 'Tidak berhak.';
  END IF;
  v_status := public.clinical_doc_resolve_one(p_id);
  SELECT detail, via INTO v_detail, v_via FROM public.clinical_doc_deliveries WHERE id = p_id;
  RETURN json_build_object('status', v_status, 'detail', v_detail, 'via', v_via);
END;
$$;
REVOKE ALL ON FUNCTION public.clinical_doc_resolve(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clinical_doc_resolve(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Pasien menekan "Kirim Dokumen" (dipanggil webhook sebagai service role).
-- Pencocokan: wamid template yang dibalas (context.id); cadangan: nomor pasien + kiriman template
-- yang masih menunggu. Mengembalikan id pengiriman, atau NULL bila tidak ada yang cocok.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clinical_doc_on_button(
  p_clinic_id  uuid,
  p_context_id text,
  p_phone      text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  v_key text;
  v_number_key text;
  v_req bigint;
  v_doc_id uuid;
  s record;
  d record;
BEGIN
  IF v_phone LIKE '0%' THEN v_phone := '62' || substr(v_phone, 2); END IF;

  -- Pastikan kiriman template yang baru saja diterima sudah punya wamid.
  FOR s IN
    SELECT id FROM public.clinical_doc_deliveries
     WHERE clinic_id = p_clinic_id AND phone = v_phone AND status = 'mengirim'
       AND created_at > now() - interval '1 hour'
  LOOP
    PERFORM public.clinical_doc_resolve_one(s.id);
  END LOOP;

  IF coalesce(p_context_id, '') <> '' THEN
    SELECT id INTO v_doc_id FROM public.clinical_doc_deliveries
     WHERE clinic_id = p_clinic_id AND via = 'template' AND wamid = p_context_id
       AND status IN ('menunggu_tombol', 'terkirim')
     LIMIT 1;
  END IF;
  IF v_doc_id IS NULL THEN
    SELECT id INTO v_doc_id FROM public.clinical_doc_deliveries
     WHERE clinic_id = p_clinic_id AND via = 'template' AND phone = v_phone
       AND status = 'menunggu_tombol' AND created_at > now() - interval '7 days'
     ORDER BY created_at DESC
     LIMIT 1;
  END IF;
  IF v_doc_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO d FROM public.clinical_doc_deliveries WHERE id = v_doc_id;

  SELECT api_key, number_key INTO v_key, v_number_key
    FROM public.wa_settings WHERE clinic_id = p_clinic_id LIMIT 1;
  IF v_key IS NULL THEN RETURN NULL; END IF;

  v_req := net.http_post(
    url := 'https://api.watzap.id/v1/waba_send_file_url',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'api_key', v_key,
      'number_key', COALESCE(v_number_key, 'ALL'),
      'phone_no', d.phone,
      'url', d.file_url,
      'filename', d.filename,
      'caption', public.clinical_doc_caption(d.doc_type)
    ),
    timeout_milliseconds := 30000
  );

  UPDATE public.clinical_doc_deliveries
     SET status = 'mengirim_dokumen', file_request_id = v_req, button_at = now(), resolved_at = NULL, detail = NULL
   WHERE id = d.id;

  RETURN d.id;
END;
$$;
REVOKE ALL ON FUNCTION public.clinical_doc_on_button(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clinical_doc_on_button(uuid, text, text) TO service_role;

COMMIT;

-- Jaring pengaman tiap menit (idempotent: nama sama = memperbarui jadwal).
SELECT cron.schedule('clinical-doc-resolve', '* * * * *', $$SELECT public.clinical_doc_resolve_pending()$$);
