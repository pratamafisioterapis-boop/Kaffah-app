-- AI WhatsApp: tahan pengingat terapi pagi (template Meta) untuk jadwal yang pasiennya minta reschedule,
-- tanpa mengubah jadwalnya. Dipanggil AI lewat alat hold_reminder (service_role).
--  * Baris follow_up_queue 'therapy_reminder' yang masih pending untuk jadwal itu -> 'cancelled'.
--  * Bila belum ada baris dan jadwalnya hari ini: pasang baris 'cancelled' agar generator tidak membuatnya lagi
--    (generate_therapy_reminder_today memakai NOT EXISTS + ON CONFLICT per tanggal).
--  * Bila jadwal kemudian dipindah ke tanggal lain, pengingat tanggal baru dibuat seperti biasa.
CREATE OR REPLACE FUNCTION public.hold_reminder_for_appointment(p_appointment_id uuid, p_clinic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_appt record;
  v_date date;
  v_held integer := 0;
  v_inserted integer := 0;
BEGIN
  SELECT a.id, a.patient_id, a.guest_name, a.guest_phone, a.status, a.is_homecare, a.appointment_date,
         COALESCE(p.phone, a.guest_phone) AS phone, ph.clinic_id AS therapist_clinic
  INTO v_appt
  FROM appointments a
  LEFT JOIN patients p ON p.id = a.patient_id
  LEFT JOIN physiotherapists ph ON ph.id = a.therapist_id
  WHERE a.id = p_appointment_id AND a.clinic_id = p_clinic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jadwal tidak ditemukan';
  END IF;
  IF v_appt.status IN ('cancelled', 'completed', 'no_show', 'rejected') THEN
    RAISE EXCEPTION 'Jadwal sudah % dan tidak perlu ditahan pengingatnya', v_appt.status;
  END IF;
  IF coalesce(v_appt.is_homecare, false) THEN
    RAISE EXCEPTION 'Jadwal home care ditangani admin';
  END IF;

  v_date := (v_appt.appointment_date AT TIME ZONE 'Asia/Makassar')::date;

  UPDATE follow_up_queue
  SET status = 'cancelled',
      failed_reason = 'Ditahan: pasien minta reschedule via WhatsApp (AI)',
      updated_at = now()
  WHERE source_id = p_appointment_id
    AND source_table = 'appointments'
    AND follow_up_type = 'therapy_reminder'
    AND status = 'pending';
  GET DIAGNOSTICS v_held = ROW_COUNT;

  IF v_held = 0
     AND v_date = (now() AT TIME ZONE 'Asia/Makassar')::date
     AND v_appt.phone IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM follow_up_queue fq
       WHERE fq.source_id = p_appointment_id AND fq.follow_up_type = 'therapy_reminder' AND fq.scheduled_date = v_date
     ) THEN
    INSERT INTO follow_up_queue (
      clinic_id, patient_id, phone_number, follow_up_type, source_id, source_table,
      message_content, status, failed_reason, scheduled_date, scheduled_time, guest_name, guest_phone
    ) VALUES (
      COALESCE(v_appt.therapist_clinic, p_clinic_id), v_appt.patient_id, v_appt.phone, 'therapy_reminder',
      p_appointment_id, 'appointments', '(ditahan)', 'cancelled',
      'Ditahan: pasien minta reschedule via WhatsApp (AI)', v_date, '07:00', v_appt.guest_name, v_appt.guest_phone
    ) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('held', v_held, 'placeholder', v_inserted, 'date', v_date);
END;
$function$;

REVOKE ALL ON FUNCTION public.hold_reminder_for_appointment(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hold_reminder_for_appointment(uuid, uuid) TO service_role;
