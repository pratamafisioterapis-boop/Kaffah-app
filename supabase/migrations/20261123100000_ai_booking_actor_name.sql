-- Notifikasi "NEW APPOINTMENT" menulis "By <action_by_name>" (default "System").
-- Booking online publik tetap "System" (nama dikosongkan paksa). Booking dari service role
-- (AI WhatsApp) sekarang boleh membawa nama pelaku ("AI Agent") supaya terbaca di notifikasi.
-- Satu-satunya perubahan dari versi sebelumnya: pengosongan p_action_by_name / p_action_by_role
-- tidak berlaku bila pemanggil service_role. p_action_by tetap dikosongkan.
CREATE OR REPLACE FUNCTION public.create_appointment_safe(p_therapist_id uuid, p_appointment_date timestamp with time zone, p_duration_minutes integer, p_patient_id uuid DEFAULT NULL::uuid, p_status text DEFAULT 'confirmed'::text, p_clinic_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_service_id uuid DEFAULT NULL::uuid, p_guest_name text DEFAULT NULL::text, p_guest_phone text DEFAULT NULL::text, p_is_homecare boolean DEFAULT false, p_allow_overlap boolean DEFAULT false, p_action_by uuid DEFAULT NULL::uuid, p_action_by_name text DEFAULT NULL::text, p_action_by_role text DEFAULT NULL::text, p_is_manual boolean DEFAULT false, p_guest_complaint text DEFAULT NULL::text, p_guest_age smallint DEFAULT NULL::smallint, p_guest_gender text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_id uuid;
  v_slot_start time;
  v_slot_end time;
  v_final_clinic_id uuid;
  v_therapist_clinic uuid;
  v_date date;
  v_time time;
  v_real_duration integer;
BEGIN

  SELECT clinic_id INTO v_therapist_clinic
  FROM physiotherapists
  WHERE id = p_therapist_id;

  -- Pemanggil tanpa login (booking publik): paksa nilai aman.
  IF auth.uid() IS NULL THEN
    IF v_therapist_clinic IS NULL THEN
      RAISE EXCEPTION 'Terapis tidak ditemukan';
    END IF;
    IF p_clinic_id IS DISTINCT FROM v_therapist_clinic THEN
      RAISE EXCEPTION 'Terapis tidak terdaftar di klinik ini';
    END IF;

    p_allow_overlap  := false;
    p_is_manual      := false;
    p_status         := 'confirmed';
    p_action_by      := NULL;
    -- Nama pelaku hanya boleh dibawa service_role (AI WhatsApp); booking publik tetap "System".
    IF coalesce(auth.role(), '') <> 'service_role' THEN
      p_action_by_name := NULL;
      p_action_by_role := NULL;
    END IF;

    IF p_appointment_date < now() - interval '15 minutes' THEN
      RAISE EXCEPTION 'Tanggal booking tidak boleh di masa lalu';
    END IF;
    IF p_appointment_date > now() + interval '180 days' THEN
      RAISE EXCEPTION 'Tanggal booking terlalu jauh';
    END IF;
    IF p_duration_minutes > 240 THEN
      RAISE EXCEPTION 'Durasi booking tidak valid';
    END IF;

    IF length(coalesce(p_notes, '')) > 1000
       OR length(coalesce(p_guest_complaint, '')) > 1000
       OR length(coalesce(p_guest_name, '')) > 120
       OR length(coalesce(p_guest_phone, '')) > 30
       OR length(coalesce(p_guest_gender, '')) > 20 THEN
      RAISE EXCEPTION 'Data booking terlalu panjang';
    END IF;

    IF p_patient_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM patients WHERE id = p_patient_id AND clinic_id = p_clinic_id
    ) THEN
      RAISE EXCEPTION 'Pasien tidak ditemukan di klinik ini';
    END IF;
  END IF;

  IF is_therapist_soap_locked(p_therapist_id) THEN
    RAISE EXCEPTION 'Jadwal terapis ini terkunci karena dokumentasi SOAP belum lengkap. Lengkapi SOAP yang tertunda terlebih dahulu, atau minta owner membuka kunci sementara.';
  END IF;

  v_date := p_appointment_date::date;
  v_time := p_appointment_date::time;

  PERFORM generate_slots_for_date(v_date);

  SELECT start_time, end_time
  INTO v_slot_start, v_slot_end
  FROM therapist_schedules
  WHERE therapist_id = p_therapist_id
    AND day_of_week = EXTRACT(ISODOW FROM v_date)
    AND is_active = true
    AND start_time <= v_time
    AND end_time > v_time
  LIMIT 1;

  v_real_duration := p_duration_minutes;

  IF v_real_duration < 60 THEN
    RAISE EXCEPTION 'Durasi minimal 60 menit';
  END IF;

  IF NOT p_allow_overlap THEN
    IF NOT check_slot_availability(
      p_therapist_id,
      p_appointment_date,
      v_real_duration
    ) THEN
      RAISE EXCEPTION 'Slot sudah di-booking atau bentrok';
    END IF;
  END IF;

  IF p_clinic_id IS NOT NULL THEN
    v_final_clinic_id := p_clinic_id;
  ELSE
    v_final_clinic_id := coalesce(v_therapist_clinic, (SELECT id FROM clinics LIMIT 1));
  END IF;

  INSERT INTO appointments (
    patient_id,
    therapist_id,
    clinic_id,
    appointment_date,
    duration_minutes,
    status,
    notes,
    service_id,
    guest_name,
    guest_phone,
    is_homecare,
    action_by,
    action_by_name,
    action_by_role,
    is_manual,
    guest_complaint,
    guest_age,
    guest_gender,
    created_at,
    updated_at
  )
  VALUES (
    p_patient_id,
    p_therapist_id,
    v_final_clinic_id,
    p_appointment_date,
    v_real_duration,
    p_status,
    p_notes,
    p_service_id,
    p_guest_name,
    p_guest_phone,
    p_is_homecare,
    p_action_by,
    p_action_by_name,
    p_action_by_role,
    p_is_manual,
    p_guest_complaint,
    p_guest_age,
    p_guest_gender,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;

END;
$function$;
