-- Kaffah Physiotherapy: kwitansi tetap terkirim di luar jendela 24 jam lewat template Meta.
--
-- Sebelumnya invoice_wa_dispatch hanya memakai waba_send_file_url (pesan non-template), yang ditolak Meta
-- bila pasien tidak membalas klinik dalam 24 jam terakhir; aplikasi lalu memblokir pengiriman.
--
-- Sekarang (HANYA klinik Kaffah, dan hanya bila klien menandai p_template_ok = true):
--   * jendela 24 jam terbuka  -> jalur lama: waba_send_file_url dengan caption bebas.
--   * jendela tertutup/tidak diketahui -> template WABA 'kwitansi' (header DOCUMENT) lewat
--     waba_send_message_template; PDF dikirim sebagai parameter.header_url dan nama file sebagai
--     parameter.filename. filename BELUM tercantum di dokumentasi WatZap, tetapi terbukti diteruskan
--     ke WhatsApp (uji 22 Nov 2026). Bila WatZap menolaknya, status pengiriman menjadi 'gagal' dengan alasan.
--
-- Klinik lain tidak berubah (p_template_ok diabaikan). Balasan template WatZap berformat sama dengan balasan
-- kirim file (status "200" + wamid), jadi invoice_wa_resolve_one tidak perlu diubah.
--
-- Jendela dianggap terbuka hanya bila pesan masuk terakhir pasien < 23 jam lalu (margin 1 jam; salah memilih
-- template hanya menambah biaya, salah memilih file membuat pesan hilang diam-diam).
--
-- Rollback: supabase/manual/rollback_kaffah_invoice_template_fallback.sql

BEGIN;

-- Ganti tanda tangan fungsi (tambah parameter) tanpa meninggalkan overload yang ambigu.
DROP FUNCTION IF EXISTS public.invoice_wa_dispatch(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.invoice_wa_dispatch(
  p_recap_id uuid,
  p_phone text,
  p_caption text,
  p_file_url text,
  p_filename text DEFAULT 'invoice.pdf',
  p_template_ok boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_kaffah   constant uuid := 'bfdc3fd8-a052-4753-a5b7-229930b3237a';
  c_template constant text := 'kwitansi';
  v_clinic uuid;
  v_role text := COALESCE((SELECT get_my_role()), '');
  v_key text;
  v_number_key text;
  v_phone text;
  v_req bigint;
  v_id bigint;
  v_open boolean := false;
  v_via text := 'file';
BEGIN
  SELECT clinic_id INTO v_clinic FROM public.daily_recaps WHERE id = p_recap_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recap tidak ditemukan.'; END IF;

  IF auth.uid() IS NULL
     OR v_role NOT IN ('owner', 'admin', 'clinic_admin', 'therapist', 'super_admin')
     OR (v_role <> 'super_admin' AND v_clinic IS DISTINCT FROM (SELECT get_my_clinic_id())) THEN
    RAISE EXCEPTION 'Anda tidak berhak mengirim invoice ini.';
  END IF;

  IF coalesce(p_file_url, '') = '' THEN RAISE EXCEPTION 'URL file invoice kosong.'; END IF;

  SELECT api_key, number_key INTO v_key, v_number_key
    FROM public.wa_settings WHERE clinic_id = v_clinic LIMIT 1;
  IF v_key IS NULL THEN RAISE EXCEPTION 'API WhatsApp belum diatur untuk klinik ini.'; END IF;

  v_phone := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  IF v_phone LIKE '0%' THEN v_phone := '62' || substr(v_phone, 2); END IF;
  IF length(v_phone) < 9 THEN RAISE EXCEPTION 'Nomor WhatsApp pasien tidak valid.'; END IF;

  -- Pilih jalur: template hanya untuk Kaffah, hanya bila diizinkan klien, dan hanya bila jendela tidak terbukti terbuka.
  IF v_clinic = c_kaffah AND coalesce(p_template_ok, false) THEN
    SELECT coalesce(max(last_inbound_at) > now() - interval '23 hours', false) INTO v_open
      FROM public.wa_inbox_conversations
     WHERE clinic_id = v_clinic AND wa_id = v_phone;
    IF NOT v_open THEN v_via := 'template'; END IF;
  END IF;

  -- timeout 30 dtk: bawaan pg_net hanya 5 dtk, sedangkan Watzap bisa membalas ~3,5 dtk atau lebih lambat;
  -- timeout pendek mencatat "gagal" walau pesan sebenarnya terkirim.
  IF v_via = 'template' THEN
    v_req := net.http_post(
      url := 'https://api.watzap.id/v1/waba_send_message_template',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'api_key', v_key,
        'phone_no', v_phone,
        'template_name', c_template,
        'template_language', 'id',
        'parameter', jsonb_build_array(jsonb_build_object(
          'header_url', p_file_url,
          'filename', p_filename
        ))
      ),
      timeout_milliseconds := 30000
    );
  ELSE
    v_req := net.http_post(
      url := 'https://api.watzap.id/v1/waba_send_file_url',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'api_key', v_key,
        'number_key', COALESCE(v_number_key, 'ALL'),
        'phone_no', v_phone,
        'url', p_file_url,
        'filename', p_filename,
        'caption', COALESCE(p_caption, '')
      ),
      timeout_milliseconds := 30000
    );
  END IF;

  INSERT INTO public.invoice_wa_sends (recap_id, clinic_id, phone, request_id)
  VALUES (p_recap_id, v_clinic, v_phone, v_req)
  RETURNING id INTO v_id;

  UPDATE public.daily_recaps
     SET invoice_wa_status = 'mengirim', invoice_wa_sent_at = now()
   WHERE id = p_recap_id;

  RETURN json_build_object('send_id', v_id, 'request_id', v_req, 'via', v_via);
END;
$$;
REVOKE ALL ON FUNCTION public.invoice_wa_dispatch(uuid, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invoice_wa_dispatch(uuid, text, text, text, text, boolean) TO authenticated;

COMMIT;
