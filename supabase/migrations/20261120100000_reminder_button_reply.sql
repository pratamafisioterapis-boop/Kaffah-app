-- Reminder terapi dengan tombol Quick Reply (Hadir / Reschedule / Cancel).
--
-- Alur yang sudah berjalan: cron generate_therapy_reminder_today() mengisi
-- follow_up_queue, lalu send_therapy_reminder() memanggil send_follow_up_whatsapp()
-- yang mengirim template WABA lewat Watzap (pg_net). Migration ini:
--   1. menambah kolom untuk menyimpan ID pesan (wamid) dan balasan tombol pasien,
--   2. mengganti template reminder ke `reminder_terapi_konfirmasi` (punya 3 tombol),
--   3. mengambil wamid dari respons Watzap supaya balasan bisa dikaitkan ke jadwal,
--   4. menyediakan record_reminder_reply() yang dipanggil webhook saat tombol diklik.
--
-- Tipe lain (booking, follow_up, ulang tahun, homecare) TIDAK diubah.
-- Rollback: kembalikan v_template_name therapy_reminder ke 'pengingat_terapi'
-- (template lama tetap Approved di Meta, jadi aman dipakai kembali).

-- ───────────────────────── 1. Kolom baru ─────────────────────────
ALTER TABLE public.follow_up_queue
  ADD COLUMN IF NOT EXISTS wa_message_id    text,
  ADD COLUMN IF NOT EXISTS patient_reply    text,
  ADD COLUMN IF NOT EXISTS patient_reply_at timestamptz;

ALTER TABLE public.follow_up_queue
  DROP CONSTRAINT IF EXISTS follow_up_queue_patient_reply_check;
ALTER TABLE public.follow_up_queue
  ADD CONSTRAINT follow_up_queue_patient_reply_check
  CHECK (patient_reply IS NULL OR patient_reply IN ('hadir', 'reschedule', 'cancel'));

CREATE INDEX IF NOT EXISTS idx_follow_up_queue_wa_message_id
  ON public.follow_up_queue (wa_message_id)
  WHERE wa_message_id IS NOT NULL;

-- ───────────────────────── 2. Kirim memakai template baru ─────────────────────────
-- Sama dengan versi sebelumnya, kecuali blok therapy_reminder:
--   - template: reminder_terapi_konfirmasi
--   - full_name = sapaan: nickname -> full_name -> guest_name -> 'Kak'
--     (nickname pasien sudah memuat sapaan; guest_name biasanya sudah memuat sapaan)
CREATE OR REPLACE FUNCTION public.send_follow_up_whatsapp(p_queue_id uuid)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_queue RECORD;
    v_api_key text;
    v_wa_clinic_id uuid;
    formatted_phone text;
    v_request_id bigint;
    v_nickname text;
    v_birth_date date;
    v_usia text;
    v_tanggal text;
    v_full_name text;
    v_jam text;
    v_template_name text;
BEGIN

    SELECT * INTO v_queue FROM follow_up_queue WHERE id = p_queue_id;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Queue not found');
    END IF;

    IF v_queue.status <> 'pending' THEN
        RETURN json_build_object('success', false, 'message', 'Status not pending');
    END IF;

    IF v_queue.phone_number IS NULL OR trim(v_queue.phone_number) = '' THEN
        UPDATE follow_up_queue SET status = 'failed', failed_reason = 'Empty phone' WHERE id = p_queue_id;
        RETURN json_build_object('success', false, 'message', 'Empty phone');
    END IF;

    SELECT id, api_key
    INTO v_wa_clinic_id, v_api_key
    FROM wa_settings
    WHERE clinic_id = v_queue.clinic_id
    LIMIT 1;

    IF v_api_key IS NULL THEN
        UPDATE follow_up_queue
        SET status = 'failed', failed_reason = 'API key tidak ditemukan untuk klinik ini'
        WHERE id = p_queue_id;
        RETURN json_build_object('success', false, 'message', 'API key tidak ditemukan untuk klinik ini');
    END IF;

    formatted_phone := regexp_replace(v_queue.phone_number, '[^0-9]', '', 'g');

    IF formatted_phone LIKE '0%' THEN
        formatted_phone := '62' || substring(formatted_phone FROM 2);
    END IF;

    v_template_name := NULL;

    IF v_queue.follow_up_type = 'therapy_reminder' THEN
        v_template_name := 'reminder_terapi_konfirmasi';
    ELSIF v_queue.follow_up_type = 'birthday_greeting' THEN
        v_template_name := 'ucapan_ulang_tahun';
    ELSIF v_queue.follow_up_type = 'booking_appointment' THEN
        v_template_name := 'booking_appointment';
    ELSIF v_queue.follow_up_type = 'follow_up' THEN
        v_template_name := 'follow_up';
    END IF;

    IF v_queue.follow_up_type = 'therapy_reminder' THEN
        SELECT
            COALESCE(
                NULLIF(btrim(p.nickname), ''),
                NULLIF(btrim(p.full_name), ''),
                NULLIF(btrim(a.guest_name), ''),
                'Kak'
            ),
            TO_CHAR(a.appointment_date, 'HH24:MI')
        INTO v_full_name, v_jam
        FROM appointments a
        LEFT JOIN patients p ON p.id = a.patient_id
        WHERE a.id = v_queue.source_id;
    END IF;

    IF v_queue.follow_up_type = 'booking_appointment' THEN
        SELECT
            COALESCE(p.nickname, a.guest_name, 'Kak'),
            CASE EXTRACT(DOW FROM a.appointment_date)
                WHEN 0 THEN 'Minggu' WHEN 1 THEN 'Senin' WHEN 2 THEN 'Selasa'
                WHEN 3 THEN 'Rabu' WHEN 4 THEN 'Kamis' WHEN 5 THEN 'Jumat' WHEN 6 THEN 'Sabtu'
            END || ', ' || TO_CHAR(a.appointment_date, 'DD Mon YYYY'),
            TO_CHAR(a.appointment_date, 'HH24:MI')
        INTO v_full_name, v_tanggal, v_jam
        FROM appointments a
        LEFT JOIN patients p ON p.id = a.patient_id
        WHERE a.id = v_queue.source_id;
    END IF;

    IF v_queue.follow_up_type = 'follow_up' THEN
        SELECT COALESCE(p.nickname, p.full_name, 'Kak')
        INTO v_full_name
        FROM patients p
        WHERE p.id = v_queue.patient_id;
    END IF;

    IF v_queue.follow_up_type = 'birthday_greeting' THEN
        SELECT nickname, birth_date INTO v_nickname, v_birth_date
        FROM patients WHERE id = v_queue.patient_id;
        v_usia := EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_birth_date))::int::text;
        v_tanggal := TO_CHAR(CURRENT_DATE + INTERVAL '1 month', 'DD Mon YYYY');
    END IF;

    IF v_template_name IS NOT NULL THEN

        IF v_queue.follow_up_type = 'birthday_greeting' THEN
            SELECT net.http_post(
                url := 'https://api.watzap.id/v1/waba_send_message_template',
                headers := jsonb_build_object('Content-Type', 'application/json'),
                body := jsonb_build_object(
                    'api_key', v_api_key, 'phone_no', formatted_phone,
                    'template_name', v_template_name, 'template_language', 'id',
                    'parameter', jsonb_build_array(jsonb_build_object(
                        'full_name', COALESCE(v_nickname, 'Sahabat'),
                        'usia', v_usia, 'tanggal', v_tanggal
                    ))
                )
            ) INTO v_request_id;

        ELSIF v_queue.follow_up_type = 'therapy_reminder' THEN
            SELECT net.http_post(
                url := 'https://api.watzap.id/v1/waba_send_message_template',
                headers := jsonb_build_object('Content-Type', 'application/json'),
                body := jsonb_build_object(
                    'api_key', v_api_key, 'phone_no', formatted_phone,
                    'template_name', v_template_name, 'template_language', 'id',
                    'parameter', jsonb_build_array(jsonb_build_object(
                        'full_name', COALESCE(v_full_name, 'Kak'),
                        'jam', COALESCE(v_jam, '')
                    ))
                )
            ) INTO v_request_id;

        ELSIF v_queue.follow_up_type = 'booking_appointment' THEN
            SELECT net.http_post(
                url := 'https://api.watzap.id/v1/waba_send_message_template',
                headers := jsonb_build_object('Content-Type', 'application/json'),
                body := jsonb_build_object(
                    'api_key', v_api_key, 'phone_no', formatted_phone,
                    'template_name', v_template_name, 'template_language', 'id',
                    'parameter', jsonb_build_array(jsonb_build_object(
                        'full_name', COALESCE(v_full_name, 'Kak'),
                        'tanggal', COALESCE(v_tanggal, ''),
                        'jam', COALESCE(v_jam, '')
                    ))
                )
            ) INTO v_request_id;

        ELSIF v_queue.follow_up_type = 'follow_up' THEN
            SELECT net.http_post(
                url := 'https://api.watzap.id/v1/waba_send_message_template',
                headers := jsonb_build_object('Content-Type', 'application/json'),
                body := jsonb_build_object(
                    'api_key', v_api_key, 'phone_no', formatted_phone,
                    'template_name', v_template_name, 'template_language', 'id',
                    'parameter', jsonb_build_array(jsonb_build_object(
                        'full_name', COALESCE(v_full_name, 'Kak')
                    ))
                )
            ) INTO v_request_id;

        ELSE
            SELECT net.http_post(
                url := 'https://api.watzap.id/v1/waba_send_message_template',
                headers := jsonb_build_object('Content-Type', 'application/json'),
                body := jsonb_build_object(
                    'api_key', v_api_key, 'phone_no', formatted_phone,
                    'template_name', v_template_name, 'template_language', 'id'
                )
            ) INTO v_request_id;
        END IF;

    ELSE

        SELECT net.http_post(
            url := 'https://api.watzap.id/v1/waba_send_message',
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := jsonb_build_object(
                'api_key', v_api_key,
                'phone_no', formatted_phone,
                'message', v_queue.message_content
            )
        ) INTO v_request_id;

    END IF;

    UPDATE follow_up_queue
    SET status = 'completed', sent_at = now(), failed_reason = NULL,
        watzap_request_id = v_request_id, watzap_checked_at = NULL
    WHERE id = p_queue_id;

    RETURN json_build_object('success', true, 'request_id', v_request_id);

END;
$function$;

-- ───────────────────────── 3. Simpan wamid dari respons Watzap ─────────────────────────
-- Sama dengan versi sebelumnya; pada respons sukses, wamid ikut disimpan.
CREATE OR REPLACE FUNCTION public.reconcile_watzap_responses()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'net'
AS $function$
DECLARE
  rec record;
  v_failed integer := 0;
BEGIN
  FOR rec IN
    SELECT q.id, r.status_code, r.content, r.error_msg
    FROM follow_up_queue q
    JOIN net._http_response r ON r.id = q.watzap_request_id
    WHERE q.watzap_request_id IS NOT NULL
      AND q.watzap_checked_at IS NULL
  LOOP
    IF rec.status_code IS DISTINCT FROM 200
       OR rec.content ~* 'fatal_error'
       OR rec.content ~* '"status"\s*:\s*false' THEN
      UPDATE follow_up_queue
      SET status = 'failed',
          failed_reason = left(
            'Watzap menolak: ' || coalesce(nullif(rec.content, ''), rec.error_msg, 'HTTP ' || coalesce(rec.status_code::text, '?')),
            500),
          watzap_checked_at = now(),
          updated_at = now()
      WHERE id = rec.id;
      v_failed := v_failed + 1;
    ELSE
      UPDATE follow_up_queue
      SET watzap_checked_at = now(),
          wa_message_id = COALESCE(
            wa_message_id,
            substring(rec.content FROM '"wamid"\s*:\s*"([^"]+)"')
          )
      WHERE id = rec.id;
    END IF;
  END LOOP;
  RETURN v_failed;
END;
$function$;

-- ───────────────────────── 4. Catat balasan tombol pasien ─────────────────────────
-- Dipanggil webhook (service role) saat pasien menekan Hadir / Reschedule / Cancel.
-- Pencocokan: (1) wamid reminder yang dibalas (context.id), (2) cadangan: nomor
-- pasien + reminder terkirim hari ini. Klik berikutnya menimpa klik sebelumnya.
-- Hanya mencatat; TIDAK mengubah jadwal appointment.
CREATE OR REPLACE FUNCTION public.record_reminder_reply(
  p_clinic_id  uuid,
  p_context_id text,
  p_phone      text,
  p_reply      text
) RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_id    uuid;
  v_phone text;
BEGIN
  IF p_reply IS NULL OR p_reply NOT IN ('hadir', 'reschedule', 'cancel') THEN
    RETURN NULL;
  END IF;

  IF p_context_id IS NOT NULL AND p_context_id <> '' THEN
    SELECT id INTO v_id
    FROM follow_up_queue
    WHERE clinic_id = p_clinic_id
      AND follow_up_type = 'therapy_reminder'
      AND wa_message_id = p_context_id
    LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    v_phone := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
    IF v_phone LIKE '0%' THEN
      v_phone := '62' || substring(v_phone FROM 2);
    END IF;

    SELECT q.id INTO v_id
    FROM follow_up_queue q
    WHERE q.clinic_id = p_clinic_id
      AND q.follow_up_type = 'therapy_reminder'
      AND q.status IN ('completed', 'sent')
      AND q.scheduled_date = CURRENT_DATE
      AND (
        CASE
          WHEN regexp_replace(COALESCE(q.phone_number, q.guest_phone, ''), '[^0-9]', '', 'g') LIKE '0%'
            THEN '62' || substring(regexp_replace(COALESCE(q.phone_number, q.guest_phone, ''), '[^0-9]', '', 'g') FROM 2)
          ELSE regexp_replace(COALESCE(q.phone_number, q.guest_phone, ''), '[^0-9]', '', 'g')
        END
      ) = v_phone
    ORDER BY q.sent_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE follow_up_queue
  SET patient_reply = p_reply,
      patient_reply_at = now(),
      updated_at = now()
  WHERE id = v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_reminder_reply(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_reminder_reply(uuid, text, text, text) TO service_role;
