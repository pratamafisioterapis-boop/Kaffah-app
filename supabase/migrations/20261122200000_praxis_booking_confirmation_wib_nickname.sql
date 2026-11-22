-- Praxis: pesan konfirmasi booking memakai jam WIB dan nama panggilan.
--
-- 1. Zona waktu database = Asia/Makassar (WITA), sedangkan Praxis beroperasi di WIB.
--    to_char(appointment_date, 'HH24:MI') menghasilkan jam WITA, jadi appointment 12:30 WIB
--    tertulis "13:30" di pesan. Khusus Praxis, jam / hari / tanggal kini dihitung di Asia/Jakarta.
-- 2. [nickname] jatuh ke nama lengkap bila nickname kosong atau sama dengan nama lengkap.
--    Khusus Praxis, dibuat nama panggilan dari umur + nama depan (sama dengan aturan
--    generateNickname di aplikasi), dengan melewati awalan "MUHAMMAD" dan variannya.
--
-- Klinik lain tidak berubah: v_local tetap jam di zona waktu sesi seperti sebelumnya.

CREATE OR REPLACE FUNCTION public.trg_booking_insert_whatsapp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$DECLARE
    c_praxis constant uuid := 'b25e8c29-6977-4e1b-b500-7629ec3aeb8a';
    v_wa_enabled boolean;
    v_patient_full_name text;
    v_patient_phone text;
    v_patient_name text;
    v_patient_gender text;
    v_patient_birth date;
    v_hari text;
    v_tanggal text;
    v_jam text;
    v_template text;
    v_message text;
    v_clinic_id uuid;
    v_clinic_name text;
    v_local timestamp;
BEGIN

    SELECT clinic_id INTO v_clinic_id
    FROM physiotherapists WHERE id = NEW.therapist_id;

    SELECT name INTO v_clinic_name
    FROM clinics WHERE id = v_clinic_id;

    IF NEW.patient_id IS NOT NULL THEN
        SELECT
            COALESCE(NULLIF(nickname, ''), full_name),
            full_name,
            gender,
            birth_date
        INTO v_patient_name, v_patient_full_name, v_patient_gender, v_patient_birth
        FROM patients
        WHERE id = NEW.patient_id;
    ELSE
        v_patient_name := NEW.guest_name;
        v_patient_full_name := NEW.guest_name;
    END IF;

    -- Praxis: nickname kosong / sama dengan nama lengkap -> buat nama panggilan.
    IF v_clinic_id = c_praxis
       AND NEW.patient_id IS NOT NULL
       AND v_patient_birth IS NOT NULL
       AND v_patient_gender IS NOT NULL
       AND upper(trim(COALESCE(v_patient_name, ''))) = upper(trim(COALESCE(v_patient_full_name, '')))
    THEN
        DECLARE
            v_age int := EXTRACT(YEAR FROM age(CURRENT_DATE, v_patient_birth));
            v_male boolean := v_patient_gender ILIKE 'L%';
            v_words text[] := regexp_split_to_array(trim(v_patient_full_name), '\s+');
            v_first text;
            v_prefix text;
        BEGIN
            v_first := v_words[1];
            IF upper(v_first) IN ('MUHAMMAD', 'MUHAMAD', 'MOHAMMAD', 'MOHAMAD', 'MOH', 'MOH.', 'MUHAMMED', 'MUHD', 'MUHD.', 'M', 'M.')
               AND array_length(v_words, 1) > 1 THEN
                v_first := v_words[2];
            END IF;

            v_prefix := CASE
                WHEN v_age <= 12 THEN 'An.'
                WHEN v_age <= 26 THEN 'Ka'
                WHEN v_age <= 39 THEN CASE WHEN v_male THEN 'Mas' ELSE 'Mba' END
                ELSE CASE WHEN v_male THEN 'Bapak' ELSE 'Ibu' END
            END;

            v_patient_name := v_prefix || ' ' || v_first;
        END;
    END IF;

    SELECT phone
    INTO v_patient_phone
    FROM patients
    WHERE id = NEW.patient_id;

    IF v_patient_phone IS NULL OR v_patient_phone = '' THEN
        v_patient_phone := NEW.guest_phone;
    END IF;

    -- Praxis memakai WIB; klinik lain tetap zona waktu sesi (perilaku lama).
    IF v_clinic_id = c_praxis THEN
        v_local := NEW.appointment_date AT TIME ZONE 'Asia/Jakarta';
    ELSE
        v_local := NEW.appointment_date AT TIME ZONE current_setting('TIMEZONE');
    END IF;

    v_hari := CASE EXTRACT(DOW FROM v_local)
        WHEN 0 THEN 'Minggu'
        WHEN 1 THEN 'Senin'
        WHEN 2 THEN 'Selasa'
        WHEN 3 THEN 'Rabu'
        WHEN 4 THEN 'Kamis'
        WHEN 5 THEN 'Jumat'
        WHEN 6 THEN 'Sabtu'
    END;

    v_tanggal := to_char(v_local, 'DD Mon YYYY');
    v_jam := to_char(v_local, 'HH24:MI');

    IF NEW.appointment_date < (NOW() AT TIME ZONE 'Asia/Makassar') THEN
        v_patient_phone := NULL;
    END IF;

    IF NEW.is_homecare = true THEN

        IF v_patient_phone IS NOT NULL AND v_patient_phone <> '' THEN

            SELECT template_text
            INTO v_template
            FROM wa_templates
            WHERE category = 'booking_appointment_homecare'
            AND is_enabled = true
            AND clinic_id = v_clinic_id
            ORDER BY updated_at DESC NULLS LAST
            LIMIT 1;

            IF v_template IS NULL THEN
                v_template :=
                'Terima kasih sudah melakukan booking layanan fisioterapi *homecare* di ' || COALESCE(v_clinic_name, 'klinik kami') || '.' || E'\n' ||
                'Kami konfirmasi bahwa terapis akan datang ke lokasi Anda pada:' || E'\n' ||
                '[hari_booking], [tanggal] pukul [jam]' || E'\n' ||
                'Mohon memastikan alamat dan lokasi dapat diakses dengan baik agar pelayanan berjalan lancar 🙏.' || E'\n\n' ||
                'Salam sehat,' || E'\n' ||
                COALESCE(v_clinic_name, '');
            END IF;

            v_message := v_template;
            v_message := replace(v_message, '[nickname]', v_patient_name);
            v_message := replace(v_message, '[nama]', v_patient_name);
            v_message := replace(v_message, '[tanggal]', v_tanggal);
            v_message := replace(v_message, '[jam]', v_jam);
            v_message := replace(v_message, '[hari_booking]', v_hari);
            v_message := replace(v_message, '[sapaan]', '');
            v_message := replace(v_message, '[terapis]', '');
            v_message := replace(v_message, '[layanan]', '');

            INSERT INTO follow_up_queue (
                patient_id,
                phone_number,
                follow_up_type,
                source_id,
                source_table,
                message_content,
                scheduled_date,
                scheduled_time,
                status,
                clinic_id,
                guest_name,
                guest_phone
            ) VALUES (
                NEW.patient_id,
                v_patient_phone,
                'booking_appointment_homecare',
                NEW.id,
                'appointments',
                v_message,
                CURRENT_DATE,
                CURRENT_TIME,
                'pending',
                v_clinic_id,
                NEW.guest_name,
                NEW.guest_phone
            );
        END IF;

        PERFORM process_booking_whatsapp_auto();
        RETURN NEW;
    END IF;

    SELECT template_text
    INTO v_template
    FROM wa_templates
    WHERE category = 'booking_appointment'
    AND is_enabled = true
    AND clinic_id = v_clinic_id
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_template IS NULL THEN
        v_template := 'Jadwal [nickname] pada [tanggal] jam [jam]';
    END IF;

    v_message := v_template;
    v_message := replace(v_message, '[nickname]', v_patient_name);
    v_message := replace(v_message, '[nama]', v_patient_name);
    v_message := replace(v_message, '[tanggal]', v_tanggal);
    v_message := replace(v_message, '[jam]', v_jam);
    v_message := replace(v_message, '[hari_booking]', v_hari);
    v_message := replace(v_message, '[sapaan]', '');
    v_message := replace(v_message, '[terapis]', '');
    v_message := replace(v_message, '[layanan]', '');

    SELECT enabled
    INTO v_wa_enabled
    FROM wa_settings
    WHERE clinic_id = v_clinic_id
    LIMIT 1;

    IF v_patient_phone IS NOT NULL
       AND v_patient_phone <> '' THEN

        INSERT INTO follow_up_queue (
            patient_id,
            phone_number,
            follow_up_type,
            source_id,
            source_table,
            message_content,
            scheduled_date,
            scheduled_time,
            status,
            clinic_id,
            guest_name,
            guest_phone
        ) VALUES (
            NEW.patient_id,
            v_patient_phone,
            'booking_appointment',
            NEW.id,
            'appointments',
            v_message,
            CURRENT_DATE,
            CURRENT_TIME,
            'pending',
            v_clinic_id,
            NEW.guest_name,
            NEW.guest_phone
        );

    END IF;

    PERFORM process_booking_whatsapp_auto();

    RETURN NEW;
END;$function$;

-- Perbaiki pesan Praxis yang masih pending dan jadwalnya belum lewat: jam WITA -> WIB.
UPDATE public.follow_up_queue f
SET message_content = regexp_replace(
      f.message_content,
      '\m' || to_char(a.appointment_date AT TIME ZONE 'Asia/Makassar', 'HH24:MI') || '\M',
      to_char(a.appointment_date AT TIME ZONE 'Asia/Jakarta', 'HH24:MI')
    )
FROM public.appointments a
WHERE f.source_id = a.id
  AND f.source_table = 'appointments'
  AND f.clinic_id = 'b25e8c29-6977-4e1b-b500-7629ec3aeb8a'
  AND f.follow_up_type IN ('booking_appointment', 'booking_appointment_homecare')
  AND f.status = 'pending'
  AND a.appointment_date > now();

-- Pesan pending yang memakai nama lengkap karena nickname = nama lengkap -> nama panggilan.
UPDATE public.follow_up_queue f
SET message_content = replace(
      f.message_content,
      p.full_name,
      (CASE
         WHEN age(CURRENT_DATE, p.birth_date) < interval '13 years' THEN 'An.'
         WHEN age(CURRENT_DATE, p.birth_date) < interval '27 years' THEN 'Ka'
         WHEN age(CURRENT_DATE, p.birth_date) < interval '40 years' THEN CASE WHEN p.gender ILIKE 'L%' THEN 'Mas' ELSE 'Mba' END
         ELSE CASE WHEN p.gender ILIKE 'L%' THEN 'Bapak' ELSE 'Ibu' END
       END) || ' ' ||
      CASE
        WHEN upper(split_part(trim(p.full_name), ' ', 1)) IN ('MUHAMMAD', 'MUHAMAD', 'MOHAMMAD', 'MOHAMAD', 'MOH', 'MOH.', 'MUHAMMED', 'MUHD', 'MUHD.', 'M', 'M.')
             AND split_part(trim(p.full_name), ' ', 2) <> ''
        THEN split_part(trim(p.full_name), ' ', 2)
        ELSE split_part(trim(p.full_name), ' ', 1)
      END
    )
FROM public.patients p
WHERE f.patient_id = p.id
  AND f.clinic_id = 'b25e8c29-6977-4e1b-b500-7629ec3aeb8a'
  AND f.follow_up_type IN ('booking_appointment', 'booking_appointment_homecare')
  AND f.status = 'pending'
  AND p.birth_date IS NOT NULL
  AND p.gender IS NOT NULL
  AND upper(trim(COALESCE(p.nickname, ''))) IN ('', upper(trim(p.full_name)));
