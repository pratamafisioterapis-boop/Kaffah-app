-- Rollback migrasi 20261122220000 (fallback template kwitansi Kaffah).
-- Mengembalikan invoice_wa_dispatch ke versi 5 parameter (hanya waba_send_file_url).
-- Klien baru mengirim p_template_ok; setelah rollback, rilis klien harus ikut dikembalikan
-- (atau hapus argumen p_template_ok dari pemanggilan rpc di InvoiceModal.jsx).

BEGIN;

DROP FUNCTION IF EXISTS public.invoice_wa_dispatch(uuid, text, text, text, text, boolean);

CREATE OR REPLACE FUNCTION public.invoice_wa_dispatch(
  p_recap_id uuid,
  p_phone text,
  p_caption text,
  p_file_url text,
  p_filename text DEFAULT 'invoice.pdf'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic uuid;
  v_role text := COALESCE((SELECT get_my_role()), '');
  v_key text;
  v_number_key text;
  v_phone text;
  v_req bigint;
  v_id bigint;
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

  INSERT INTO public.invoice_wa_sends (recap_id, clinic_id, phone, request_id)
  VALUES (p_recap_id, v_clinic, v_phone, v_req)
  RETURNING id INTO v_id;

  UPDATE public.daily_recaps
     SET invoice_wa_status = 'mengirim', invoice_wa_sent_at = now()
   WHERE id = p_recap_id;

  RETURN json_build_object('send_id', v_id, 'request_id', v_req);
END;
$$;
REVOKE ALL ON FUNCTION public.invoice_wa_dispatch(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invoice_wa_dispatch(uuid, text, text, text, text) TO authenticated;

COMMIT;
