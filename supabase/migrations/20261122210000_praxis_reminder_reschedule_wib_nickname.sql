-- Praxis: pengingat sesi & pesan reschedule memakai jam WIB dan nama panggilan.
--
-- Zona waktu database = Asia/Makassar (WITA), Praxis di WIB, sehingga jam di pesan
-- pasien Praxis selisih +1 jam. Perbaikan sama seperti konfirmasi booking
-- (20261122200000), kini juga untuk:
--   * render_follow_up_message  (isi pesan pengingat / template teks)
--   * send_follow_up_whatsapp, process_booking_whatsapp_auto (parameter template WABA
--     therapy_reminder & booking_appointment)
--   * handle_reschedule_whatsapp (pesan reschedule)
-- Klinik lain tidak berubah: clinic_local() tetap memakai zona waktu sesi.

CREATE OR REPLACE FUNCTION public.clinic_local(p_ts timestamptz, p_clinic uuid)
 RETURNS timestamp
 LANGUAGE sql
 STABLE
AS $function$
  SELECT p_ts AT TIME ZONE CASE
    WHEN p_clinic = 'b25e8c29-6977-4e1b-b500-7629ec3aeb8a'::uuid THEN 'Asia/Jakarta'
    ELSE current_setting('TIMEZONE')
  END
$function$;

-- Nama panggilan. Non-Praxis: persis perilaku lama COALESCE(nickname, fallback).
-- Praxis: nickname kosong / sama dengan nama lengkap -> umur + nama depan
-- (awalan "Muhammad" dan variannya dilewati), sama dengan aturan generateNickname.
CREATE OR REPLACE FUNCTION public.praxis_call_name(p_patient uuid, p_fallback text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  r record;
  v_words text[];
  v_first text;
  v_age int;
  v_male boolean;
BEGIN
  IF p_patient IS NULL THEN
    RETURN p_fallback;
  END IF;

  SELECT nickname, full_name, gender, birth_date, clinic_id INTO r
  FROM patients WHERE id = p_patient;

  IF NOT FOUND THEN
    RETURN p_fallback;
  END IF;

  IF r.clinic_id = 'b25e8c29-6977-4e1b-b500-7629ec3aeb8a'::uuid
     AND r.birth_date IS NOT NULL AND r.gender IS NOT NULL
     AND COALESCE(trim(r.full_name), '') <> ''
     AND upper(trim(COALESCE(r.nickname, ''))) IN ('', upper(trim(r.full_name)))
  THEN
    v_words := regexp_split_to_array(trim(r.full_name), '\s+');
    v_first := v_words[1];
    IF upper(v_first) IN ('MUHAMMAD','MUHAMAD','MOHAMMAD','MOHAMAD','MOH','MOH.','MUHAMMED','MUHD','MUHD.','M','M.')
       AND array_length(v_words, 1) > 1 THEN
      v_first := v_words[2];
    END IF;
    v_age := EXTRACT(YEAR FROM age(CURRENT_DATE, r.birth_date));
    v_male := r.gender ILIKE 'L%';
    RETURN CASE
      WHEN v_age <= 12 THEN 'An.'
      WHEN v_age <= 26 THEN 'Ka'
      WHEN v_age <= 39 THEN CASE WHEN v_male THEN 'Mas' ELSE 'Mba' END
      ELSE CASE WHEN v_male THEN 'Bapak' ELSE 'Ibu' END
    END || ' ' || v_first;
  END IF;

  RETURN COALESCE(r.nickname, p_fallback);
END;
$function$;

-- Tambal fungsi yang sudah ada (idempoten: dilewati bila sudah ditambal).
DO $patch$
DECLARE
  r record;
  def text;
  newdef text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('render_follow_up_message', 'send_follow_up_whatsapp',
                        'process_booking_whatsapp_auto', 'handle_reschedule_whatsapp')
  LOOP
    def := pg_get_functiondef(r.oid);
    IF def LIKE '%clinic_local(%' THEN
      CONTINUE;
    END IF;
    newdef := def;

    IF r.proname = 'handle_reschedule_whatsapp' THEN
      newdef := replace(newdef, 'EXTRACT(DOW FROM OLD.appointment_date)', 'EXTRACT(DOW FROM public.clinic_local(OLD.appointment_date, OLD.clinic_id))');
      newdef := replace(newdef, 'EXTRACT(DOW FROM NEW.appointment_date)', 'EXTRACT(DOW FROM public.clinic_local(NEW.appointment_date, NEW.clinic_id))');
      newdef := replace(newdef, 'to_char(OLD.appointment_date,', 'to_char(public.clinic_local(OLD.appointment_date, OLD.clinic_id),');
      newdef := replace(newdef, 'to_char(NEW.appointment_date,', 'to_char(public.clinic_local(NEW.appointment_date, NEW.clinic_id),');
      newdef := replace(newdef,
        'SELECT COALESCE(NULLIF(nickname, ''''), full_name) INTO v_patient_nickname
            FROM patients WHERE id = NEW.patient_id;',
        'SELECT COALESCE(NULLIF(public.praxis_call_name(NEW.patient_id, NULL), ''''), full_name) INTO v_patient_nickname
            FROM patients WHERE id = NEW.patient_id;');
    ELSE
      -- a.appointment_date (join appointments a) -> jam/hari/tanggal sesuai zona klinik
      newdef := regexp_replace(newdef, '\ma\.appointment_date\M', 'public.clinic_local(a.appointment_date, a.clinic_id)', 'g');
      -- nama panggilan
      newdef := regexp_replace(newdef,
        'COALESCE\(\s*p\.nickname,\s*a\.guest_name\s*(,\s*''Kak''\s*)?\)',
        'COALESCE(public.praxis_call_name(p.id, a.guest_name)\1)', 'g');
      newdef := replace(newdef, 'NULLIF(btrim(p.nickname), '''')', 'NULLIF(btrim(public.praxis_call_name(p.id, NULL)), '''')');
    END IF;

    IF newdef = def THEN
      RAISE EXCEPTION 'Tambalan % tidak mengubah apa pun', r.proname;
    END IF;
    EXECUTE newdef;
  END LOOP;
END
$patch$;
