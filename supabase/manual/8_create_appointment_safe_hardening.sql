-- JALANKAN MANUAL di Supabase Dashboard > SQL Editor (CREATE OR REPLACE FUNCTION
-- lewat tool MCP sempat timeout, lewat dashboard berhasil).
--
-- Pengerasan create_appointment_safe untuk pemanggil TANPA LOGIN (booking publik
-- /booking). Sebelumnya anon bebas mengisi:
--   * p_allow_overlap  -> melewati cek bentrok jadwal
--   * p_status, p_is_manual, p_action_by*  -> memalsukan status / pelaku
--   * p_clinic_id yang tidak sesuai klinik terapis, atau NULL -> dipaksa ke
--     klinik pertama (`SELECT id FROM clinics LIMIT 1`; ada 8 klinik)
--   * teks tanpa batas panjang, tanggal di masa lalu, durasi sangat panjang
--
-- Perilaku untuk user LOGIN (admin/owner/terapis) tidak berubah, kecuali:
--   * fungsi kini memakai SET search_path = public
--   * jika p_clinic_id NULL, klinik diambil dari terapis (bukan klinik pertama)
--
-- Yang dikirim halaman publik saat ini (SmartBookingPage, ClinicBookingPage):
-- clinicId, status 'confirmed', guest_*, patientId (opsional); tanpa action_by,
-- tanpa p_allow_overlap. Semuanya tetap diterima.

CREATE OR REPLACE FUNCTION public.create_appointment_safe(
  p_therapist_id uuid,
  p_appointment_date timestamp with time zone,
  p_duration_minutes integer,
  p_patient_id uuid DEFAULT NULL::uuid,
  p_status text DEFAULT 'confirmed'::text,
  p_clinic_id uuid DEFAULT NULL::uuid,
  p_notes text DEFAULT NULL::text,
  p_service_id uuid DEFAULT NULL::uuid,
  p_guest_name text DEFAULT NULL::text,
  p_guest_phone text DEFAULT NULL::text,
  p_is_homecare boolean DEFAULT false,
  p_allow_overlap boolean DEFAULT false,
  p_action_by uuid DEFAULT NULL::uuid,
  p_action_by_name text DEFAULT NULL::text,
  p_action_by_role text DEFAULT NULL::text,
  p_is_manual boolean DEFAULT false,
  p_guest_complaint text DEFAULT NULL::text,
  p_guest_age smallint DEFAULT NULL::smallint,
  p_guest_gender text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
    p_action_by_name := NULL;
    p_action_by_role := NULL;

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
$fn$;

-- ---------------------------------------------------------------------------
-- UJI SETELAH DIJALANKAN (semuanya di-rollback, aman). Ganti <THERAPIST_ID> dan
-- <CLINIC_ID> dengan id terapis dan klinik yang sesuai, <OTHER_CLINIC_ID>
-- dengan id klinik lain. Hasil yang diharapkan ada di komentar.
--
-- BEGIN; SET LOCAL ROLE anon;
--   -- a) klinik tidak cocok dengan terapis -> ERROR 'Terapis tidak terdaftar di klinik ini'
--   SELECT public.create_appointment_safe('<THERAPIST_ID>', now() + interval '2 days', 60,
--     NULL, 'confirmed', '<OTHER_CLINIC_ID>', NULL, NULL, 'Tes', '0800', false, false);
-- ROLLBACK;
--
-- BEGIN; SET LOCAL ROLE anon;
--   -- b) tanggal lampau -> ERROR 'Tanggal booking tidak boleh di masa lalu'
--   SELECT public.create_appointment_safe('<THERAPIST_ID>', now() - interval '3 days', 60,
--     NULL, 'confirmed', '<CLINIC_ID>', NULL, NULL, 'Tes', '0800', false, false);
-- ROLLBACK;
--
-- Uji nyata di aplikasi: buka /booking, buat booking baru (harus berhasil),
-- lalu coba booking slot yang sudah terisi (harus ditolak "Slot sudah di-booking").
--
-- ROLLBACK FUNGSI (jika ada masalah): definisi lama = isi fungsi di atas tanpa
-- blok `SELECT clinic_id INTO v_therapist_clinic ...` dan `IF auth.uid() IS NULL
-- THEN ... END IF;`, tanpa `SET search_path`, dan dengan fallback klinik
-- `SELECT id INTO v_final_clinic_id FROM clinics LIMIT 1`.
