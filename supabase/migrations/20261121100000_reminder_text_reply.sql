-- Balasan teks singkat ("insyaallah", "iya", "baik", ...) terhadap reminder terapi
-- dihitung sebagai Hadir. Klasifikasi teks dilakukan di database. Hanya mengisi bila
-- pasien belum punya balasan (klik Reschedule/Cancel tidak ditimpa).
-- Catatan: versi ini sudah terpasang di produksi; file ini menyamakan repo.
CREATE OR REPLACE FUNCTION public.record_reminder_text_reply(p_clinic_id uuid, p_phone text, p_text text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_phone text;
  v_text  text;
  v_today date := (now() AT TIME ZONE 'Asia/Makassar')::date;
  v_count integer;
BEGIN
  v_text := lower(regexp_replace(COALESCE(p_text, ''), '[^[:alnum:][:space:]]', ' ', 'g'));
  v_text := btrim(regexp_replace(v_text, '\s+', ' ', 'g'));
  IF v_text = '' OR length(v_text) > 60 THEN
    RETURN 0;
  END IF;

  IF v_text ~ '\m(tidak|nggak|ngga|enggak|gak|ga|batal|cancel|reschedule|ubah|ganti|undur|mundur|majukan|pindah|belum|telat|terlambat|maaf|berhalangan|jadwal ulang)\M' THEN
    RETURN 0;
  END IF;
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
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_reminder_text_reply(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_reminder_text_reply(uuid, text, text) TO service_role;
