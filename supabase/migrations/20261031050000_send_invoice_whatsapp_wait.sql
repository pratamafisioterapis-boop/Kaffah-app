-- send_invoice_whatsapp: tunggu respons Watzap sampai ~15 detik (dulu tetap 3 detik).
--
-- Balasan Watzap untuk kirim PDF kadang >3 detik (mis. 3,5 detik). Dengan pg_sleep(3) respons masih
-- kosong, aplikasi mengira gagal dan menampilkan badge merah padahal PDF sampai. Sekarang polling
-- tiap 0,5 detik; bila tetap kosong, kembalikan pending=true (bukan gagal).
--
-- Rollback: pulihkan versi sebelumnya (pg_sleep(3), tanpa loop).

CREATE OR REPLACE FUNCTION public.send_invoice_whatsapp(p_phone text, p_message text, p_file_base64 text, p_filename text DEFAULT 'invoice.pdf'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_api_key text;
    v_number_key text;
    v_clinic_id uuid;
    v_request_id bigint;
    v_response record;
    formatted_phone text;
    i int := 0;
BEGIN
    SELECT clinic_id INTO v_clinic_id FROM users WHERE id = auth.uid();

    SELECT api_key, number_key INTO v_api_key, v_number_key
    FROM wa_settings WHERE clinic_id = v_clinic_id LIMIT 1;

    IF v_api_key IS NULL THEN
        RETURN json_build_object('error', 'API KEY NULL');
    END IF;

    formatted_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
    IF formatted_phone LIKE '0%' THEN
        formatted_phone := '62' || substring(formatted_phone FROM 2);
    END IF;

    SELECT net.http_post(
        url := 'https://api.watzap.id/v1/waba_send_file_url',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
            'api_key', v_api_key,
            'number_key', COALESCE(v_number_key, 'ALL'),
            'phone_no', formatted_phone,
            'url', p_file_base64,
            'filename', p_filename,
            'caption', p_message
        )
    ) INTO v_request_id;

    -- Tunggu respons, maks ~15 detik (30 x 0,5 detik).
    WHILE i < 30 LOOP
        PERFORM pg_sleep(0.5);
        i := i + 1;
        SELECT * INTO v_response FROM net._http_response WHERE id = v_request_id;
        EXIT WHEN FOUND;
    END LOOP;

    IF v_response.id IS NULL THEN
        RETURN json_build_object('pending', true, 'request_id', v_request_id);
    END IF;

    RETURN json_build_object(
        'status', v_response.status_code,
        'content', v_response.content,
        'request_id', v_request_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$function$;
