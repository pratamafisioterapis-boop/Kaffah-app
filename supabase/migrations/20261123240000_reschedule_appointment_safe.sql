-- Reschedule atomik untuk AI WhatsApp: kunci -> cek bentrok -> pindah dalam satu transaksi.
--
-- Sebelumnya AI mengecek slot (check_slot_availability) lalu meng-update appointments dalam dua langkah
-- terpisah, sehingga dua permintaan ke slot yang sama dalam hitungan milidetik bisa sama-sama lolos.
-- Fungsi ini memakai advisory lock per (terapis, tanggal WITA). create_appointment_safe memakai kunci
-- yang sama, jadi booking baru dan reschedule saling menunggu, bukan saling menimpa.
--
-- Aman: hanya satu kunci per transaksi (tanpa risiko deadlock), lock_timeout 5 detik (tidak menggantung),
-- hanya service_role yang boleh memanggil, dan semua galat berupa RAISE EXCEPTION dengan pesan jelas.

CREATE OR REPLACE FUNCTION public.reschedule_appointment_safe(
  p_appointment_id uuid,
  p_clinic_id uuid,
  p_therapist_id uuid,
  p_start timestamp with time zone,
  p_duration_minutes integer DEFAULT NULL,
  p_action_by_name text DEFAULT NULL,
  p_action_by_role text DEFAULT NULL
) RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_appt record;
  v_duration integer;
  v_therapist_clinic uuid;
BEGIN
  -- Jangan menggantung bila kunci dipegang transaksi lain terlalu lama.
  PERFORM set_config('lock_timeout', '5s', true);

  SELECT clinic_id INTO v_therapist_clinic FROM physiotherapists WHERE id = p_therapist_id;
  IF v_therapist_clinic IS NULL OR v_therapist_clinic IS DISTINCT FROM p_clinic_id THEN
    RAISE EXCEPTION 'Terapis tidak ditemukan di klinik ini';
  END IF;

  -- Kunci per (terapis, tanggal WITA tujuan); sama dengan yang dipakai create_appointment_safe.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_therapist_id::text || '|' || to_char(p_start AT TIME ZONE 'Asia/Makassar', 'YYYY-MM-DD'), 0)
  );

  SELECT id, clinic_id, status, is_homecare, duration_minutes
  INTO v_appt
  FROM appointments
  WHERE id = p_appointment_id AND clinic_id = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jadwal tidak ditemukan';
  END IF;
  IF v_appt.status IN ('cancelled', 'completed', 'no_show', 'rejected') THEN
    RAISE EXCEPTION 'Jadwal sudah % dan tidak bisa dipindah', v_appt.status;
  END IF;
  IF coalesce(v_appt.is_homecare, false) THEN
    RAISE EXCEPTION 'Jadwal home care tidak dipindah lewat jalur ini';
  END IF;
  IF p_start < now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'Tanggal baru tidak boleh di masa lalu';
  END IF;

  v_duration := coalesce(p_duration_minutes, v_appt.duration_minutes, 60);
  IF v_duration < 15 OR v_duration > 240 THEN
    RAISE EXCEPTION 'Durasi tidak valid';
  END IF;

  -- Jadwal ini sendiri dikecualikan agar geser jam di hari yang sama tidak dianggap bentrok dengan dirinya.
  IF NOT check_slot_availability(p_therapist_id, p_start, v_duration, p_appointment_id) THEN
    RAISE EXCEPTION 'Slot sudah di-booking atau bentrok';
  END IF;

  -- Sama dengan reschedule di aplikasi: status 'rescheduled'; rekap harian dan konfirmasi WA lewat trigger.
  UPDATE appointments
  SET appointment_date = p_start,
      therapist_id = p_therapist_id,
      duration_minutes = v_duration,
      status = 'rescheduled',
      action_by_name = p_action_by_name,
      action_by_role = p_action_by_role,
      updated_at = now()
  WHERE id = p_appointment_id AND clinic_id = p_clinic_id;

  RETURN p_appointment_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.reschedule_appointment_safe(uuid, uuid, uuid, timestamptz, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_safe(uuid, uuid, uuid, timestamptz, integer, text, text) TO service_role;

-- Booking baru memakai kunci yang sama sebelum cek bentrok (hanya menambah satu baris; tidak mengubah logika lain).
DO $mig$
DECLARE
  d text;
  d2 text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'create_appointment_safe';

  IF d LIKE '%pg_advisory_xact_lock%' THEN
    RETURN; -- sudah diterapkan
  END IF;

  d2 := replace(
    d,
    E'  IF NOT p_allow_overlap THEN\n',
    E'  IF NOT p_allow_overlap THEN\n    PERFORM set_config(''lock_timeout'', ''5s'', true);\n    PERFORM pg_advisory_xact_lock(\n      hashtextextended(p_therapist_id::text || ''|'' || to_char(p_appointment_date AT TIME ZONE ''Asia/Makassar'', ''YYYY-MM-DD''), 0)\n    );\n'
  );

  IF d2 = d THEN
    RAISE EXCEPTION 'pola yang diganti tidak ditemukan; create_appointment_safe tidak diubah';
  END IF;

  EXECUTE d2;
END
$mig$;
