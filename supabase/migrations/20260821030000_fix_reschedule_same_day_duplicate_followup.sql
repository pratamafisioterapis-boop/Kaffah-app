-- Bug: rescheduling the same appointment a second time on the same day fails
-- with "Gagal reschedule".
--
-- Contoh nyata: appointment Syahrani (Sabtu 22 Agustus, jam 09:00) awalnya
-- terapis Adi, di-reschedule ke Annisa jam 09:00 hari itu juga (21 Agustus).
-- Saat dicoba diubah balik ke Adi jam 09:00 di hari yang sama, update gagal.
--
-- Root cause (dikonfirmasi lewat reproduksi langsung di DB):
-- handle_reschedule_whatsapp() (trigger AFTER UPDATE ON appointments) selalu
-- melakukan plain INSERT ke follow_up_queue untuk notifikasi WA ke pasien
-- (follow_up_type = 'reschedule_appointment'), memakai scheduled_date =
-- CURRENT_DATE. Tabel follow_up_queue punya unique index
-- (patient_id, follow_up_type, scheduled_date, source_id). Reschedule pertama
-- di hari itu berhasil insert baris ini. Reschedule KEDUA pada appointment
-- yang sama, di hari yang sama, mencoba insert baris dengan key identik --
-- melanggar unique constraint -- dan karena tidak ada exception handler di
-- fungsi ini, seluruh UPDATE ke appointments ikut gagal (rollback), padahal
-- slot barunya sendiri sebenarnya valid & tersedia.
--
-- Fix: ganti INSERT itu jadi INSERT ... ON CONFLICT (patient_id,
-- follow_up_type, scheduled_date, source_id) DO UPDATE, supaya reschedule
-- kedua (dst) di hari yang sama menimpa notifikasi WA yang masih pending
-- dengan info jadwal terbaru (dan reset status ke 'pending' kalau
-- sebelumnya sudah terkirim/gagal), bukan gagal total.

CREATE OR REPLACE FUNCTION public.handle_reschedule_whatsapp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$DECLARE
    v_old_therapist_phone text;
    v_new_therapist_phone text;
    v_new_therapist_name text;
    v_patient_name text;

    v_patient_phone text;
    v_patient_nickname text;
    v_wa_enabled boolean;
    v_template text;
    v_message text;

    v_hari_old text;
    v_tanggal_old text;
    v_jam_old text;

    v_hari_new text;
    v_tanggal_new text;
    v_jam_new text;
BEGIN

    -- hanya jalan kalau ada perubahan jadwal / terapis
    IF NEW.appointment_date = OLD.appointment_date
       AND NEW.therapist_id = OLD.therapist_id THEN
        RETURN NEW;
    END IF;

    -- =========================
    -- AMBIL NAMA PASIEN
    -- =========================
    IF NEW.patient_id IS NOT NULL THEN
    SELECT full_name
    INTO v_patient_name
    FROM patients
    WHERE id = NEW.patient_id;
ELSE
    v_patient_name := NEW.guest_name;
END IF;

    -- =========================
    -- NOMOR TERAPIS
    -- =========================
    SELECT phone INTO v_old_therapist_phone
    FROM physiotherapists
    WHERE id = OLD.therapist_id;

    SELECT phone, name INTO v_new_therapist_phone, v_new_therapist_name
    FROM physiotherapists
    WHERE id = NEW.therapist_id;

    -- =========================
    -- FORMAT TANGGAL LAMA
    -- =========================
    v_hari_old := CASE EXTRACT(DOW FROM OLD.appointment_date)
        WHEN 0 THEN 'Minggu'
        WHEN 1 THEN 'Senin'
        WHEN 2 THEN 'Selasa'
        WHEN 3 THEN 'Rabu'
        WHEN 4 THEN 'Kamis'
        WHEN 5 THEN 'Jumat'
        WHEN 6 THEN 'Sabtu'
    END;

    v_tanggal_old := to_char(OLD.appointment_date, 'DD Mon YYYY');
    v_jam_old := to_char(OLD.appointment_date, 'HH24:MI');

    -- =========================
    -- FORMAT TANGGAL BARU
    -- =========================
    v_hari_new := CASE EXTRACT(DOW FROM NEW.appointment_date)
        WHEN 0 THEN 'Minggu'
        WHEN 1 THEN 'Senin'
        WHEN 2 THEN 'Selasa'
        WHEN 3 THEN 'Rabu'
        WHEN 4 THEN 'Kamis'
        WHEN 5 THEN 'Jumat'
        WHEN 6 THEN 'Sabtu'
    END;

    v_tanggal_new := to_char(NEW.appointment_date, 'DD Mon YYYY');
    v_jam_new := to_char(NEW.appointment_date, 'HH24:MI');

    -- =========================
    -- PESAN KE PASIEN (baru): sebelum ini reschedule hanya memberi tahu
    -- terapis lewat follow_up_queue di bawah, pasien tidak pernah menerima
    -- notifikasi apapun saat jadwalnya diubah. Dilewati kalau perubahan ini
    -- sebenarnya pembatalan (sudah ditangani alur cancel tersendiri).
    -- =========================
    IF NEW.status <> 'cancelled' AND OLD.status <> 'cancelled' THEN

        IF NEW.patient_id IS NOT NULL THEN
            SELECT phone INTO v_patient_phone
            FROM patients WHERE id = NEW.patient_id;

            SELECT COALESCE(NULLIF(nickname, ''), full_name) INTO v_patient_nickname
            FROM patients WHERE id = NEW.patient_id;
        ELSE
            v_patient_phone := NULL;
            v_patient_nickname := NEW.guest_name;
        END IF;

        IF v_patient_phone IS NULL OR v_patient_phone = '' THEN
            v_patient_phone := NEW.guest_phone;
        END IF;

        SELECT enabled INTO v_wa_enabled
        FROM wa_settings
        WHERE clinic_id = NEW.clinic_id
        LIMIT 1;

        IF COALESCE(v_wa_enabled, false) = true
           AND v_patient_phone IS NOT NULL
           AND v_patient_phone <> '' THEN

            SELECT template_text
            INTO v_template
            FROM wa_templates
            WHERE category = 'reschedule_appointment'
              AND is_enabled = true
              AND clinic_id = NEW.clinic_id
            ORDER BY updated_at DESC NULLS LAST
            LIMIT 1;

            IF v_template IS NULL THEN
                v_template :=
                'Halo [nickname], jadwal fisioterapi Anda telah kami reschedule.' || E'\n\n' ||
                'Jadwal sebelumnya: [hari_lama], [tanggal_lama] pukul [jam_lama]' || E'\n' ||
                'Jadwal baru: [hari_booking], [tanggal] pukul [jam]' || E'\n\n' ||
                'Mohon konfirmasi kehadiran Anda sesuai jadwal terbaru ya. Jika ada kendala, silakan hubungi kami kembali.' || E'\n\n' ||
                'Terima kasih 🙏';
            END IF;

            v_message := v_template;
            v_message := replace(v_message, '[nickname]', COALESCE(v_patient_nickname, 'Kak'));
            v_message := replace(v_message, '[nama]', COALESCE(v_patient_nickname, 'Kak'));
            v_message := replace(v_message, '[tanggal]', v_tanggal_new);
            v_message := replace(v_message, '[jam]', v_jam_new);
            v_message := replace(v_message, '[hari_booking]', v_hari_new);
            v_message := replace(v_message, '[hari]', v_hari_new);
            v_message := replace(v_message, '[tanggal_lama]', v_tanggal_old);
            v_message := replace(v_message, '[jam_lama]', v_jam_old);
            v_message := replace(v_message, '[hari_lama]', v_hari_old);
            v_message := replace(v_message, '[sapaan]', '');
            v_message := replace(v_message, '[terapis]', COALESCE(v_new_therapist_name, 'Terapis Kami'));
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
                'reschedule_appointment',
                NEW.id,
                'appointments',
                v_message,
                CURRENT_DATE,
                CURRENT_TIME,
                'pending',
                NEW.clinic_id,
                NEW.guest_name,
                NEW.guest_phone
            )
            -- Appointment yang sama bisa di-reschedule lebih dari sekali di
            -- hari yang sama (patient_id, follow_up_type, scheduled_date,
            -- source_id identik) -- timpa notifikasi WA lama dengan info
            -- jadwal terbaru alih-alih gagal insert & membatalkan seluruh
            -- reschedule.
            ON CONFLICT (patient_id, follow_up_type, scheduled_date, source_id)
            DO UPDATE SET
                phone_number    = EXCLUDED.phone_number,
                message_content = EXCLUDED.message_content,
                scheduled_time  = EXCLUDED.scheduled_time,
                status          = 'pending',
                clinic_id       = EXCLUDED.clinic_id,
                guest_name      = EXCLUDED.guest_name,
                guest_phone     = EXCLUDED.guest_phone,
                sent_at         = NULL,
                failed_reason   = NULL,
                updated_at      = NOW();
        END IF;
    END IF;

    -- =========================
    -- CASE 1: TERAPIS SAMA → RESCHEDULE
    -- =========================
    IF OLD.therapist_id = NEW.therapist_id THEN

        IF v_new_therapist_phone IS NOT NULL THEN
            INSERT INTO follow_up_queue (
                phone_number,
                follow_up_type,
                source_id,
                source_table,
                message_content,
                scheduled_date,
                scheduled_time,
                status
            ) VALUES (
                v_new_therapist_phone,
                'reschedule_appointment',
                NEW.id,
                'appointments',
                '🔄 RESCHEDULE APPOINTMENT' || E'\n\n' ||
                'Pasien: ' || v_patient_name || E'\n' ||
                'Tanggal: ' || v_hari_new || ', ' || v_tanggal_new || E'\n' ||
                'Jam: ' || v_jam_new,
                CURRENT_DATE,
                CURRENT_TIME,
                'pending'
            );
        END IF;

    ELSE
    -- =========================
    -- CASE 2: TERAPIS BERBEDA
    -- =========================

        -- ❌ CANCEL KE TERAPIS LAMA (PAKAI DATA LAMA)
        IF v_old_therapist_phone IS NOT NULL THEN
            INSERT INTO follow_up_queue (
                phone_number,
                follow_up_type,
                source_id,
                source_table,
                message_content,
                scheduled_date,
                scheduled_time,
                status
            ) VALUES (
                v_old_therapist_phone,
                'cancel_appointment',
                NEW.id,
                'appointments',
                '❌ APPOINTMENT DIBATALKAN' || E'\n\n' ||
                'Pasien: ' || v_patient_name || E'\n' ||
                'Tanggal: ' || v_hari_old || ', ' || v_tanggal_old || E'\n' ||
                'Jam: ' || v_jam_old,
                CURRENT_DATE,
                CURRENT_TIME,
                'pending'
            );
        END IF;

        -- ✅ BOOKING BARU KE TERAPIS BARU (PAKAI DATA BARU)
        IF v_new_therapist_phone IS NOT NULL THEN
            INSERT INTO follow_up_queue (
                phone_number,
                follow_up_type,
                source_id,
                source_table,
                message_content,
                scheduled_date,
                scheduled_time,
                status
            ) VALUES (
                v_new_therapist_phone,
                'booking_appointment_therapist',
                NEW.id,
                'appointments',
                '📢 APPOINTMENT BARU' || E'\n\n' ||
                'Pasien: ' || v_patient_name || E'\n' ||
                'Tanggal: ' || v_hari_new || ', ' || v_tanggal_new || E'\n' ||
                'Jam: ' || v_jam_new,
                CURRENT_DATE,
                CURRENT_TIME,
                'pending'
            );
        END IF;

    END IF;

    -- =========================
    -- KIRIM LANGSUNG
    -- =========================
    PERFORM process_booking_whatsapp_auto();

    RETURN NEW;
END;
$function$;
