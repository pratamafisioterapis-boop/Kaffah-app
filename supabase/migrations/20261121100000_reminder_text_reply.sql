-- Balasan teks bebas ("insyaallah", "iya", "baik") terhadap reminder terapi
-- dihitung sebagai Hadir. Hanya mengisi bila pasien BELUM punya balasan
-- (klik tombol Reschedule/Cancel tidak ditimpa) dan hanya untuk reminder
-- terkirim hari ini pada nomor yang sama.
CREATE OR REPLACE FUNCTION public.record_reminder_text_reply(
  p_clinic_id uuid,
  p_phone     text
) RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_id    uuid;
  v_phone text;
BEGIN
  v_phone := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  IF v_phone = '' THEN RETURN NULL; END IF;
  IF v_phone LIKE '0%' THEN v_phone := '62' || substring(v_phone FROM 2); END IF;

  SELECT q.id INTO v_id
  FROM follow_up_queue q
  WHERE q.clinic_id = p_clinic_id
    AND q.follow_up_type = 'therapy_reminder'
    AND q.status IN ('completed', 'sent')
    AND q.scheduled_date = (now() AT TIME ZONE 'Asia/Makassar')::date
    AND q.patient_reply IS NULL
    AND (
      CASE
        WHEN regexp_replace(COALESCE(q.phone_number, q.guest_phone, ''), '[^0-9]', '', 'g') LIKE '0%'
          THEN '62' || substring(regexp_replace(COALESCE(q.phone_number, q.guest_phone, ''), '[^0-9]', '', 'g') FROM 2)
        ELSE regexp_replace(COALESCE(q.phone_number, q.guest_phone, ''), '[^0-9]', '', 'g')
      END
    ) = v_phone
  ORDER BY q.sent_at DESC NULLS LAST
  LIMIT 1;

  IF v_id IS NULL THEN RETURN NULL; END IF;

  UPDATE follow_up_queue
  SET patient_reply = 'hadir', patient_reply_at = now(), updated_at = now()
  WHERE id = v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_reminder_text_reply(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_reminder_text_reply(uuid, text) TO service_role;
