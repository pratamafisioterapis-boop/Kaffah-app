-- Pasien yang SUDAH konfirmasi hadir lewat chat sebelum pengingat pagi terkirim ("hari ini jadwal saya terapi ya",
-- "siap, insyaallah datang") tidak perlu dikirimi template pengingat terapi lagi.
--  * Baris follow_up_queue 'therapy_reminder' hari ini yang masih 'pending' untuk nomor itu -> 'cancelled' (dicatat hadir).
--  * Untuk jadwal hari ini yang barisnya BELUM dibuat generator (pesan masuk sebelum jam generate), dipasang baris
--    'cancelled' agar generate_therapy_reminder_today (NOT EXISTS per tanggal) tidak membuatnya.
--  * Hanya pesan yang jelas berarti hadir: lolos penyaring lama (bukan penolak/ragu), memuat kata niat/jadwal
--    (jadwal, terapi, datang, hadir, siap, insyaallah, otw, ditunggu, noted), dan bukan pertanyaan ("?").
--  * Balasan sesudah pengingat terkirim tetap dicatat 'hadir' seperti sebelumnya.
CREATE OR REPLACE FUNCTION public.record_reminder_text_reply(
  p_clinic_id uuid,
  p_phone     text,
  p_text      text
) RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_phone text;
  v_text  text;
  v_today date := (now() AT TIME ZONE 'Asia/Makassar')::date;
  v_count integer := 0;
  v_skipped integer := 0;
  v_placeholder integer := 0;
BEGIN
  v_text := lower(regexp_replace(COALESCE(p_text, ''), '[^[:alnum:][:space:]]', ' ', 'g'));
  v_text := btrim(regexp_replace(v_text, '\s+', ' ', 'g'));
  IF v_text = '' OR length(v_text) > 60 THEN
    RETURN 0;
  END IF;

  -- Kata penolak/ragu: bukan konfirmasi hadir.
  IF v_text ~ '\m(tidak|nggak|ngga|enggak|gak|ga|batal|cancel|reschedule|ubah|ganti|undur|mundur|majukan|pindah|belum|telat|terlambat|maaf|berhalangan|jadwal ulang)\M' THEN
    RETURN 0;
  END IF;
  -- Kata yang menandakan akan datang / mengiyakan.
  IF v_text !~ '\m(baik|baiklah|ok|oke|okey|okay|siap|sip|iya|ya|yaa|hadir|noted|insyaallah|insya|insyaa|inshaallah|in sya|terima kasih|terimakasih|makasih|trims|otw|datang|ditunggu)\M' THEN
    RETURN 0;
  END IF;

  v_phone := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  IF v_phone LIKE '0%' THEN
    v_phone := '62' || substring(v_phone FROM 2);
  END IF;
  IF v_phone = '' THEN
    RETURN 0;
  END IF;

  -- Satu nomor bisa dipakai beberapa pasien: semua reminder hari ini untuk nomor itu yang
  -- belum dibalas ikut ditandai hadir.
  UPDATE follow_up_queue q
  SET patient_reply = 'hadir',
      patient_reply_at = now(),
      updated_at = now()
  WHERE q.clinic_id = p_clinic_id
    AND q.follow_up_type = 'therapy_reminder'
    AND q.status IN ('completed', 'sent')
    AND q.scheduled_date = v_today
    AND q.patient_reply IS NULL
    AND (
      CASE
        WHEN regexp_replace(COALESCE(q.phone_number, q.guest_phone, ''), '[^0-9]', '', 'g') LIKE '0%'
          THEN '62' || substring(regexp_replace(COALESCE(q.phone_number, q.guest_phone, ''), '[^0-9]', '', 'g') FROM 2)
        ELSE regexp_replace(COALESCE(q.phone_number, q.guest_phone, ''), '[^0-9]', '', 'g')
      END
    ) = v_phone;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Pasien sudah menyatakan hadir SEBELUM pengingat terkirim: lewati pengingatnya.
  IF COALESCE(p_text, '') !~ '\?'
     AND v_text ~ '\m(jadwal|terapi|terapinya|datang|hadir|siap|insyaallah|insya|insyaa|inshaallah|in sya|otw|ditunggu|noted)\M' THEN
    UPDATE follow_up_queue q
    SET status = 'cancelled',
        failed_reason = 'Dilewati: pasien sudah konfirmasi hadir via WhatsApp sebelum pengingat',
        patient_reply = 'hadir',
        patient_reply_at = now(),
        updated_at = now()
    WHERE q.clinic_id = p_clinic_id
      AND q.follow_up_type = 'therapy_reminder'
      AND q.status = 'pending'
      AND q.scheduled_date = v_today
      AND (
        CASE
          WHEN regexp_replace(COALESCE(q.phone_number, q.guest_phone, ''), '[^0-9]', '', 'g') LIKE '0%'
            THEN '62' || substring(regexp_replace(COALESCE(q.phone_number, q.guest_phone, ''), '[^0-9]', '', 'g') FROM 2)
          ELSE regexp_replace(COALESCE(q.phone_number, q.guest_phone, ''), '[^0-9]', '', 'g')
        END
      ) = v_phone;
    GET DIAGNOSTICS v_skipped = ROW_COUNT;

    -- Jadwal hari ini milik nomor ini yang barisnya belum dibuat generator: pasang baris 'cancelled'.
    INSERT INTO follow_up_queue (
      clinic_id, patient_id, phone_number, follow_up_type, source_id, source_table,
      message_content, status, failed_reason, patient_reply, patient_reply_at,
      scheduled_date, scheduled_time, guest_name, guest_phone
    )
    SELECT p_clinic_id, a.patient_id, COALESCE(p.phone, a.guest_phone), 'therapy_reminder', a.id, 'appointments',
           '(dilewati)', 'cancelled', 'Dilewati: pasien sudah konfirmasi hadir via WhatsApp sebelum pengingat',
           'hadir', now(), v_today, '07:30', a.guest_name, a.guest_phone
    FROM appointments a
    LEFT JOIN patients p ON p.id = a.patient_id
    WHERE a.clinic_id = p_clinic_id
      AND a.status IN ('confirmed', 'rescheduled')
      AND COALESCE(a.is_homecare, false) = false
      AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::date = v_today
      AND (
        CASE
          WHEN regexp_replace(COALESCE(p.phone, a.guest_phone, ''), '[^0-9]', '', 'g') LIKE '0%'
            THEN '62' || substring(regexp_replace(COALESCE(p.phone, a.guest_phone, ''), '[^0-9]', '', 'g') FROM 2)
          ELSE regexp_replace(COALESCE(p.phone, a.guest_phone, ''), '[^0-9]', '', 'g')
        END
      ) = v_phone
      AND NOT EXISTS (
        SELECT 1 FROM follow_up_queue fq
        WHERE fq.source_id = a.id AND fq.follow_up_type = 'therapy_reminder' AND fq.scheduled_date = v_today
      )
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_placeholder = ROW_COUNT;
  END IF;

  RETURN v_count + v_skipped + v_placeholder;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_reminder_text_reply(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_reminder_text_reply(uuid, text, text) TO service_role;
