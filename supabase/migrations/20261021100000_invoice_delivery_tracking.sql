-- Pelacakan pengiriman invoice WhatsApp (khusus klinik yang mengaktifkan invoice_gate_enabled, saat ini Kaffah).
--
-- Catatan: pengiriman lampiran (waba_send_file_url) TIDAK tercatat di log pesan Watzap (statusnya tidak bisa dicek),
-- jadi jalur otomatis memakai pesan teks berisi link invoice /i/<id> (waba_send_message).
--
-- Masalah: respons "sukses" dari Watzap hanya berarti permintaan DITERIMA; Meta bisa menolak beberapa detik
-- kemudian (mis. 131047 Re-engagement message: pasien tidak membalas dalam 24 jam). Status akhir diambil dari
-- endpoint Watzap POST /v1/messages {action:'status', wamid}.
--
-- pg_net mengirim permintaan SETELAH transaksi selesai, jadi mengirim dan membaca respons tidak bisa dalam satu
-- fungsi. Alurnya: (1) invoice_wa_send -> id permintaan, (2) invoice_wa_finish_send membaca respons kirim (wamid),
-- (3) invoice_wa_start_check -> id, (4) invoice_wa_finish_check membaca status. Cron menyelesaikan yang tertinggal.
--
-- Nilai invoice_wa_status: NULL (belum), mengirim, menunggu (diterima WhatsApp, belum sampai),
-- delivered, read, dibuka (pasien membuka link), manual_menunggu (WA manual dibuka, belum dikonfirmasi),
-- terkirim_manual (dikonfirmasi admin), gagal, tidak_dikirim (alasan wajib); 'terkirim' = data lama (belum terverifikasi).

-- 1. Pengaturan per klinik -------------------------------------------------------------------------
ALTER TABLE public.soap_first_settings
  ADD COLUMN IF NOT EXISTS invoice_gate_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_gate_from timestamptz;

-- 2. Kolom pelacakan --------------------------------------------------------------------------------
ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS invoice_wa_wamid text,
  ADD COLUMN IF NOT EXISTS invoice_wa_detail text,
  ADD COLUMN IF NOT EXISTS invoice_wa_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_wa_send_req bigint,
  ADD COLUMN IF NOT EXISTS invoice_wa_check_req bigint,
  ADD COLUMN IF NOT EXISTS invoice_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_wa_alerted_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_skip_reason text;

-- 3. Penjelasan kode kesalahan Meta -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoice_wa_error_text(p_code int, p_error text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $fn$
  SELECT CASE p_code
    WHEN 131047 THEN 'Pasien belum membalas dalam 24 jam terakhir, sehingga WhatsApp tidak mengizinkan pesan otomatis.'
    WHEN 131026 THEN 'Nomor tujuan tidak dapat dikirimi pesan (kemungkinan tidak memakai WhatsApp).'
    ELSE COALESCE(NULLIF(btrim(p_error), ''), 'Pesan gagal terkirim.')
  END;
$fn$;

-- 4. Inti: baca respons KIRIM dan terapkan ke recap (tanpa pemeriksaan hak; dipakai wrapper dan cron) ------
CREATE OR REPLACE FUNCTION public.invoice_wa_finish_send_core(p_recap_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  d record;
  v_resp record;
  j jsonb;
  v_ok boolean := false;
  v_wamid text;
  v_detail text;
BEGIN
  SELECT * INTO d FROM daily_recaps WHERE id = p_recap_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('done', true, 'error', 'Recap tidak ditemukan'); END IF;
  IF d.invoice_wa_send_req IS NULL THEN
    RETURN jsonb_build_object('done', true, 'status', d.invoice_wa_status, 'detail', d.invoice_wa_detail, 'wamid', d.invoice_wa_wamid);
  END IF;

  SELECT * INTO v_resp FROM net._http_response WHERE id = d.invoice_wa_send_req;
  IF NOT FOUND THEN
    IF d.invoice_wa_sent_at IS NOT NULL AND d.invoice_wa_sent_at < now() - interval '90 seconds' THEN
      v_detail := 'Tidak ada respons dari Watzap. Kirim ulang atau gunakan link manual.';
    ELSE
      RETURN jsonb_build_object('done', false);
    END IF;
  ELSE
    BEGIN
      j := v_resp.content::jsonb;
    EXCEPTION WHEN others THEN
      j := NULL;
    END;
    IF v_resp.error_msg IS NOT NULL THEN
      v_detail := 'Watzap tidak dapat dihubungi: ' || v_resp.error_msg;
    ELSIF j IS NULL THEN
      v_detail := 'Respons Watzap tidak dikenali.';
    ELSIF j ->> 'ack' = 'successfully' OR j ->> 'status' = '200' THEN
      v_ok := true;
      v_wamid := NULLIF(j ->> 'wamid', '');
    ELSE
      v_detail := COALESCE(NULLIF(btrim(j ->> 'message'), ''), 'Watzap menolak pengiriman') || ' (kode ' || COALESCE(j ->> 'status', '?') || ')';
    END IF;
  END IF;

  UPDATE daily_recaps SET
    invoice_wa_status = CASE WHEN v_ok THEN 'menunggu' ELSE 'gagal' END,
    invoice_wa_wamid = v_wamid,
    invoice_wa_detail = CASE WHEN v_ok THEN NULL ELSE v_detail END,
    invoice_wa_send_req = NULL
  WHERE id = p_recap_id;

  RETURN jsonb_build_object('done', true, 'status', CASE WHEN v_ok THEN 'menunggu' ELSE 'gagal' END,
    'detail', CASE WHEN v_ok THEN NULL ELSE v_detail END, 'wamid', v_wamid);
END;
$fn$;

-- 5. Inti: terapkan respons STATUS Watzap ke recap --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoice_wa_apply_check(p_recap_id uuid, p_content text, p_error text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  j jsonb;
  v_ws text;
  v_code int;
  v_err text;
  v_new text;
  v_detail text;
  v_result record;
BEGIN
  BEGIN
    j := p_content::jsonb;
  EXCEPTION WHEN others THEN
    j := NULL;
  END;

  v_ws := j -> 'data' ->> 'status';
  IF p_error IS NOT NULL OR j IS NULL OR v_ws IS NULL THEN
    -- Gagal membaca status: biarkan status lama, catat waktu cek agar dicoba lagi nanti.
    UPDATE daily_recaps SET invoice_wa_checked_at = now(), invoice_wa_check_req = NULL WHERE id = p_recap_id;
    RETURN jsonb_build_object('done', true, 'unknown', true);
  END IF;

  v_err := j -> 'data' ->> 'error';
  BEGIN
    v_code := ((j -> 'data' -> 'status_history') -> -1 -> 'raw' -> 'errors' -> 0 ->> 'code')::int;
  EXCEPTION WHEN others THEN
    v_code := NULL;
  END;

  v_new := CASE v_ws WHEN 'failed' THEN 'gagal' WHEN 'read' THEN 'read' WHEN 'delivered' THEN 'delivered' ELSE 'menunggu' END;
  v_detail := CASE WHEN v_ws = 'failed' THEN invoice_wa_error_text(v_code, v_err) ELSE NULL END;

  UPDATE daily_recaps SET
    invoice_wa_status = CASE
      WHEN invoice_wa_status IN ('dibuka', 'read', 'terkirim_manual', 'tidak_dikirim', 'manual_menunggu') THEN invoice_wa_status
      ELSE v_new END,
    invoice_wa_detail = CASE
      WHEN invoice_wa_status IN ('dibuka', 'read', 'terkirim_manual', 'tidak_dikirim', 'manual_menunggu') THEN invoice_wa_detail
      ELSE v_detail END,
    invoice_wa_checked_at = now(),
    invoice_wa_check_req = NULL
  WHERE id = p_recap_id
  RETURNING invoice_wa_status, invoice_wa_detail INTO v_result;

  RETURN jsonb_build_object('done', true, 'wa_status', v_ws, 'code', v_code,
    'status', v_result.invoice_wa_status, 'detail', v_result.invoice_wa_detail);
END;
$fn$;

-- 6. RPC untuk aplikasi (admin/owner klinik yang sama) ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoice_wa_send(p_recap_id uuid, p_phone text, p_message text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_clinic uuid;
  v_key text;
  v_phone text;
  v_req bigint;
BEGIN
  SELECT d.clinic_id INTO v_clinic FROM daily_recaps d WHERE d.id = p_recap_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recap tidak ditemukan.'; END IF;
  IF v_clinic IS DISTINCT FROM get_my_clinic_id() OR COALESCE(get_my_role(), '') NOT IN ('admin', 'clinic_admin', 'owner', 'super_admin') THEN
    RAISE EXCEPTION 'Anda tidak berhak mengirim invoice ini.';
  END IF;

  SELECT s.api_key INTO v_key FROM wa_settings s WHERE s.clinic_id = v_clinic AND s.enabled LIMIT 1;
  IF v_key IS NULL THEN RAISE EXCEPTION 'API WhatsApp belum diatur untuk klinik ini.'; END IF;

  v_phone := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  IF v_phone LIKE '0%' THEN v_phone := '62' || substr(v_phone, 2); END IF;
  IF length(v_phone) < 9 THEN RAISE EXCEPTION 'Nomor WhatsApp pasien tidak valid.'; END IF;

  -- Pesan teks berisi link invoice (waba_send_message), bukan lampiran file: hanya pengiriman teks/template yang
  -- tercatat di log pesan Watzap, sehingga status akhirnya (failed/sent/delivered/read) bisa dicek.
  v_req := net.http_post(
    url := 'https://api.watzap.id/v1/waba_send_message',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('api_key', v_key, 'phone_no', v_phone, 'message', p_message)
  );

  UPDATE daily_recaps SET
    invoice_wa_status = 'mengirim',
    invoice_wa_sent_at = now(),
    invoice_wa_send_req = v_req,
    invoice_wa_wamid = NULL,
    invoice_wa_detail = NULL,
    invoice_wa_check_req = NULL
  WHERE id = p_recap_id;

  RETURN v_req;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.invoice_wa_finish_send(p_recap_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM daily_recaps d
    WHERE d.id = p_recap_id AND d.clinic_id = get_my_clinic_id()
      AND COALESCE(get_my_role(), '') IN ('admin', 'clinic_admin', 'owner', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Anda tidak berhak.';
  END IF;
  RETURN invoice_wa_finish_send_core(p_recap_id);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.invoice_wa_start_check(p_recap_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  d record;
  v_key text;
  v_req bigint;
BEGIN
  SELECT * INTO d FROM daily_recaps WHERE id = p_recap_id;
  IF NOT FOUND OR d.clinic_id IS DISTINCT FROM get_my_clinic_id()
     OR COALESCE(get_my_role(), '') NOT IN ('admin', 'clinic_admin', 'owner', 'super_admin') THEN
    RAISE EXCEPTION 'Anda tidak berhak.';
  END IF;
  IF d.invoice_wa_wamid IS NULL THEN RETURN NULL; END IF;

  SELECT s.api_key INTO v_key FROM wa_settings s WHERE s.clinic_id = d.clinic_id AND s.enabled LIMIT 1;
  IF v_key IS NULL THEN RETURN NULL; END IF;

  v_req := net.http_post(
    url := 'https://api.watzap.id/v1/messages',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('api_key', v_key, 'action', 'status', 'wamid', d.invoice_wa_wamid)
  );
  UPDATE daily_recaps SET invoice_wa_check_req = v_req, invoice_wa_checked_at = now() WHERE id = p_recap_id;
  RETURN v_req;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.invoice_wa_finish_check(p_recap_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  d record;
  v_resp record;
BEGIN
  SELECT * INTO d FROM daily_recaps WHERE id = p_recap_id;
  IF NOT FOUND OR d.clinic_id IS DISTINCT FROM get_my_clinic_id()
     OR COALESCE(get_my_role(), '') NOT IN ('admin', 'clinic_admin', 'owner', 'super_admin') THEN
    RAISE EXCEPTION 'Anda tidak berhak.';
  END IF;
  IF d.invoice_wa_check_req IS NULL THEN
    RETURN jsonb_build_object('done', true, 'status', d.invoice_wa_status, 'detail', d.invoice_wa_detail);
  END IF;
  SELECT * INTO v_resp FROM net._http_response WHERE id = d.invoice_wa_check_req;
  IF NOT FOUND THEN RETURN jsonb_build_object('done', false); END IF;
  RETURN invoice_wa_apply_check(p_recap_id, v_resp.content, v_resp.error_msg);
END;
$fn$;

-- Konfirmasi manual oleh admin: manual_menunggu (WA dibuka), terkirim_manual (sudah dikirim),
-- tidak_dikirim (alasan wajib).
CREATE OR REPLACE FUNCTION public.invoice_wa_set_manual(p_recap_id uuid, p_state text, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM daily_recaps d
    WHERE d.id = p_recap_id AND d.clinic_id = get_my_clinic_id()
      AND COALESCE(get_my_role(), '') IN ('admin', 'clinic_admin', 'owner', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Anda tidak berhak.';
  END IF;
  IF p_state NOT IN ('manual_menunggu', 'terkirim_manual', 'tidak_dikirim') THEN
    RAISE EXCEPTION 'Status tidak dikenal.';
  END IF;
  IF p_state = 'tidak_dikirim' AND char_length(btrim(COALESCE(p_note, ''))) < 5 THEN
    RAISE EXCEPTION 'Alasan tidak dikirim wajib diisi (minimal 5 karakter).';
  END IF;

  UPDATE daily_recaps SET
    invoice_wa_status = p_state,
    invoice_wa_sent_at = CASE WHEN p_state = 'terkirim_manual' THEN now() ELSE COALESCE(invoice_wa_sent_at, now()) END,
    invoice_wa_detail = CASE WHEN p_state = 'tidak_dikirim' THEN NULL ELSE invoice_wa_detail END,
    invoice_skip_reason = CASE WHEN p_state = 'tidak_dikirim' THEN btrim(p_note) ELSE invoice_skip_reason END
  WHERE id = p_recap_id;
END;
$fn$;

-- 7. Hak eksekusi ------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.invoice_wa_error_text(int, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoice_wa_finish_send_core(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoice_wa_apply_check(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoice_wa_send(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invoice_wa_finish_send(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invoice_wa_start_check(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invoice_wa_finish_check(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invoice_wa_set_manual(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invoice_wa_send(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_wa_finish_send(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_wa_start_check(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_wa_finish_check(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_wa_set_manual(uuid, text, text) TO authenticated;

-- 8. Halaman publik /i/<id>: catat pembukaan pertama oleh pasien (bukan staf yang sedang login) ---------------
-- Pembukaan link = bukti pasien menerima invoice. Dipanggil dari JS halaman (bot pratinjau tidak menjalankan JS).
CREATE OR REPLACE FUNCTION public.get_public_invoice_url(p_recap_id uuid)
RETURNS TABLE(invoice_url text, clinic_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    UPDATE daily_recaps dr SET
      invoice_opened_at = now(),
      invoice_wa_status = CASE
        WHEN dr.invoice_wa_status IS NULL OR dr.invoice_wa_status IN ('mengirim', 'menunggu', 'manual_menunggu', 'gagal') THEN 'dibuka'
        ELSE dr.invoice_wa_status END,
      invoice_wa_detail = CASE
        WHEN dr.invoice_wa_status IS NULL OR dr.invoice_wa_status IN ('mengirim', 'menunggu', 'manual_menunggu', 'gagal') THEN NULL
        ELSE dr.invoice_wa_detail END
    WHERE dr.id = p_recap_id AND dr.invoice_url IS NOT NULL AND dr.invoice_opened_at IS NULL
      AND dr.invoice_created_at IS NOT NULL;
  END IF;

  RETURN QUERY
  SELECT dr.invoice_url, c.name
  FROM daily_recaps dr
  LEFT JOIN physiotherapists p ON p.id = dr.therapist_id
  LEFT JOIN clinics c ON c.id = p.clinic_id
  WHERE dr.id = p_recap_id
    AND dr.invoice_url IS NOT NULL;
END;
$fn$;

-- 9. Cron tiap menit: selesaikan kirim/cek yang tertinggal, cek status 'menunggu', eskalasi ke owner ----------
CREATE OR REPLACE FUNCTION public.invoice_wa_refresh_pending()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  r record;
  v_key text;
  v_req bigint;
  v_resp record;
BEGIN
  -- a. Kirim yang belum diselesaikan klien (tab ditutup).
  FOR r IN
    SELECT id FROM daily_recaps
    WHERE invoice_wa_status = 'mengirim' AND invoice_wa_send_req IS NOT NULL
      AND invoice_wa_sent_at < now() - interval '20 seconds'
    LIMIT 20
  LOOP
    PERFORM invoice_wa_finish_send_core(r.id);
  END LOOP;

  -- b. Baca respons cek status yang diminta pada putaran sebelumnya.
  FOR r IN SELECT id, invoice_wa_check_req FROM daily_recaps WHERE invoice_wa_check_req IS NOT NULL LIMIT 30 LOOP
    SELECT * INTO v_resp FROM net._http_response WHERE id = r.invoice_wa_check_req;
    IF FOUND THEN
      PERFORM invoice_wa_apply_check(r.id, v_resp.content, v_resp.error_msg);
    ELSE
      -- Respons hilang/terlambat: lepaskan agar dicek ulang (invoice_wa_checked_at diisi saat permintaan dibuat).
      UPDATE daily_recaps SET invoice_wa_check_req = NULL, invoice_wa_checked_at = now()
      WHERE id = r.id AND (invoice_wa_checked_at IS NULL OR invoice_wa_checked_at < now() - interval '45 seconds');
    END IF;
  END LOOP;

  -- c. Minta cek status baru untuk yang masih 'menunggu' (diterima WhatsApp, belum delivered).
  FOR r IN
    SELECT d.id, d.clinic_id, d.invoice_wa_wamid FROM daily_recaps d
    WHERE d.invoice_wa_status = 'menunggu' AND d.invoice_wa_wamid IS NOT NULL AND d.invoice_wa_check_req IS NULL
      AND d.invoice_wa_sent_at > now() - interval '6 hours'
      AND (d.invoice_wa_checked_at IS NULL OR d.invoice_wa_checked_at < now() - interval '2 minutes')
    LIMIT 15
  LOOP
    SELECT s.api_key INTO v_key FROM wa_settings s WHERE s.clinic_id = r.clinic_id AND s.enabled LIMIT 1;
    IF v_key IS NOT NULL THEN
      v_req := net.http_post(
        url := 'https://api.watzap.id/v1/messages',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object('api_key', v_key, 'action', 'status', 'wamid', r.invoice_wa_wamid)
      );
      UPDATE daily_recaps SET invoice_wa_check_req = v_req, invoice_wa_checked_at = now() WHERE id = r.id;
    END IF;
  END LOOP;

  -- d. Eskalasi: invoice belum beres lebih dari 30 menit -> notifikasi ke owner (sekali per recap).
  FOR r IN
    SELECT d.id, d.clinic_id,
           COALESCE(NULLIF(btrim(d.full_name), ''), NULLIF(btrim(d.guest_name), ''), 'Pasien') AS patient_name
    FROM daily_recaps d
    JOIN soap_first_settings s ON s.clinic_id = d.clinic_id AND s.invoice_gate_enabled AND s.invoice_gate_from IS NOT NULL
    WHERE d.invoice_created_at >= s.invoice_gate_from
      AND d.invoice_created_at < now() - interval '30 minutes'
      AND d.invoice_created_at > now() - interval '2 days'
      AND d.invoice_wa_alerted_at IS NULL
      AND COALESCE(d.amount, 0) > 0
      AND d.payment_method IS NOT NULL AND d.payment_method <> 'Package'
      AND d.special_type IS DISTINCT FROM 'free'
      AND (d.invoice_wa_status IS NULL OR d.invoice_wa_status IN ('mengirim', 'menunggu', 'gagal', 'manual_menunggu'))
    LIMIT 20
  LOOP
    PERFORM soap_first_notify_owners(r.clinic_id, 'Invoice belum terkirim',
      'Invoice pasien ' || r.patient_name || ' belum terkonfirmasi sampai ke pasien lebih dari 30 menit.',
      '/owner/daily-recap');
    UPDATE daily_recaps SET invoice_wa_alerted_at = now() WHERE id = r.id;
  END LOOP;
END;
$fn$;

REVOKE ALL ON FUNCTION public.invoice_wa_refresh_pending() FROM PUBLIC, anon, authenticated;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoice-wa-refresh') THEN
    PERFORM cron.unschedule('invoice-wa-refresh');
  END IF;
  PERFORM cron.schedule('invoice-wa-refresh', '* * * * *', 'select public.invoice_wa_refresh_pending()');
END
$do$;

-- Aktivasi per klinik dilakukan terpisah saat aplikasi siap:
--   UPDATE public.soap_first_settings SET invoice_gate_enabled = true, invoice_gate_from = now()
--   WHERE clinic_id = '<id klinik>';
