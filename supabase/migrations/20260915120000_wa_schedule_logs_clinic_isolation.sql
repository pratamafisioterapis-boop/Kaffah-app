-- wa_schedule_logs had no clinic_id column and its only RLS policy allowed
-- any authenticated user to read/write every row ("authenticated_only_..."),
-- so the WhatsApp riwayat page leaked every clinic's message history to
-- every other clinic. Add clinic scoping, backfill existing rows, make the
-- writers that populate this table set clinic_id, and isolate it with RLS
-- the same way patients/appointments/etc. already are.

ALTER TABLE public.wa_schedule_logs
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE;

-- Backfill: rows tied to a patient inherit that patient's clinic.
UPDATE public.wa_schedule_logs w
SET clinic_id = p.clinic_id
FROM public.patients p
WHERE w.patient_id = p.id
  AND w.clinic_id IS NULL;

-- Backfill: therapist reminders (no patient_id) matched by phone against
-- physiotherapists, using the same 0-prefix -> 62 normalization the
-- generator function uses.
UPDATE public.wa_schedule_logs w
SET clinic_id = ph.clinic_id
FROM public.physiotherapists ph
WHERE w.clinic_id IS NULL
  AND w.phone_number = (
    CASE WHEN ph.phone LIKE '0%' THEN '62' || SUBSTRING(ph.phone FROM 2) ELSE ph.phone END
  );

-- Backfill: anything else, best-effort match against follow_up_queue by
-- phone number (which already carries clinic_id).
UPDATE public.wa_schedule_logs w
SET clinic_id = fq.clinic_id
FROM public.follow_up_queue fq
WHERE w.clinic_id IS NULL
  AND w.phone_number = fq.phone_number;

CREATE INDEX IF NOT EXISTS idx_wa_schedule_logs_clinic_id ON public.wa_schedule_logs(clinic_id);

-- Replace the "any authenticated user" policy with clinic isolation.
DROP POLICY IF EXISTS authenticated_only_wa_schedule_logs ON public.wa_schedule_logs;

CREATE POLICY clinic_isolated_wa_schedule_logs ON public.wa_schedule_logs
  FOR ALL
  USING (get_my_role() = 'super_admin' OR clinic_id = get_my_clinic_id())
  WITH CHECK (get_my_role() = 'super_admin' OR clinic_id = get_my_clinic_id());

-- Fix the writer that still produces new cross-clinic-blind rows.
CREATE OR REPLACE FUNCTION public.send_reminder_therapist_h10()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    rec RECORD;
BEGIN

    FOR rec IN

    WITH slot_data AS (
        SELECT
            ts.therapist_id,
            TO_CHAR(ts.slot_start_time, 'HH24:MI') AS jam,
            CASE
                WHEN a.id IS NULL THEN 'aktif'
                ELSE 'terisi'
            END AS status
        FROM therapist_slots ts
        LEFT JOIN appointments a
            ON a.therapist_id = ts.therapist_id
            AND DATE(a.appointment_date) = ts.slot_date
            AND TO_CHAR(a.appointment_date, 'HH24:MI') = TO_CHAR(ts.slot_start_time, 'HH24:MI')
            AND a.status IN ('confirmed', 'booked', 'rescheduled')
        WHERE ts.slot_date = CURRENT_DATE + 1
    ),

    appointment_data AS (
        SELECT
            ph.id AS therapist_id,
            ph.clinic_id,

            CASE
                WHEN ph.phone LIKE '0%' THEN '62' || SUBSTRING(ph.phone FROM 2)
                ELSE ph.phone
            END AS phone_number,

            ph.name,

            CASE
                WHEN ph.name ILIKE '%Nurfadilah%' THEN 'Dilah'
                WHEN ph.name ILIKE '%Fahri%' THEN 'Fahri'
                WHEN ph.name ILIKE '%Annisa%' THEN 'Annisa'
                WHEN ph.name ILIKE '%Adi Pratama%' THEN 'Adi'
                ELSE SPLIT_PART(ph.name, ' ', 1)
            END AS therapist_name_short,

            a.appointment_date,
            TO_CHAR(a.appointment_date, 'HH24:MI') AS jam,

            COALESCE(p.full_name, a.guest_name) AS patient_name,

            a.patient_id,

            ROW_NUMBER() OVER (
                PARTITION BY ph.id
                ORDER BY a.appointment_date
            ) AS row_num

        FROM appointments a

        LEFT JOIN patients p
            ON a.patient_id = p.id

        LEFT JOIN physiotherapists ph
            ON a.therapist_id = ph.id

        WHERE DATE(a.appointment_date) = CURRENT_DATE + 1
        AND a.status IN ('confirmed', 'booked', 'rescheduled')
    ),

    grouped AS (
        SELECT
            therapist_id,
            clinic_id,
            phone_number,
            therapist_name_short,

            STRING_AGG(
                row_num || '. ' || jam || ' – ' || patient_name,
                E'\n'
                ORDER BY jam
            ) AS jadwal,

            STRING_AGG(
                CASE
                    WHEN patient_id IS NULL THEN patient_name
                END,
                ', '
            ) FILTER (
                WHERE patient_id IS NULL
            ) AS pasien_baru

        FROM appointment_data

        GROUP BY
            therapist_id,
            clinic_id,
            phone_number,
            therapist_name_short
    ),

    slot_grouped AS (
        SELECT
            therapist_id,

            STRING_AGG(
                jam,
                ', '
                ORDER BY jam
            ) FILTER (
                WHERE status = 'aktif'
            ) AS slot_kosong,

            COUNT(*) FILTER (
                WHERE status = 'aktif'
            ) AS jumlah_kosong

        FROM slot_data

        GROUP BY therapist_id
    ),

    soap_status AS (
        SELECT
            g.therapist_id,
            gls.unfilled_count,
            gls.period_days
        FROM grouped g
        CROSS JOIN LATERAL get_therapist_soap_lock_status(g.therapist_id) gls
    ),

    final_data AS (
        SELECT
            g.therapist_id,
            g.clinic_id,
            g.phone_number,

            '🌿 *Reminder Terapi Besok*' || E'\n\n' ||
            'Assalamu’alaikum, Physio ' || g.therapist_name_short || ' 😊' || E'\n\n' ||
            'Semoga hari ini berjalan dengan baik dan penuh keberkahan 🤲' || E'\n' ||
            'Berikut jadwal terapi Anda untuk besok:' || E'\n\n' ||

            '🗓 *Jadwal:*' || E'\n' ||
            g.jadwal || E'\n\n' ||

            '✨ Catatan:' || E'\n' ||
            '- Pasien baru: ' || COALESCE(g.pasien_baru, '-') || E'\n\n' ||

            CASE
                WHEN ss.unfilled_count > 0 THEN
                    '📝 *Info SOAP:*' || E'\n' ||
                    'Ada ' || ss.unfilled_count || ' SOAP yang belum diisi dalam ' || ss.period_days || ' hari terakhir. Yuk dilengkapi ya, biar dokumentasinya rapi 🙏' || E'\n\n'
                ELSE ''
            END ||

            CASE
                WHEN sg.jumlah_kosong = 0 THEN
                    'MasyaAllah, jadwal besok sudah penuh 🙌 Terima kasih atas dedikasinya 🤲' || E'\n\n'

                ELSE
                    'Masih ada slot tersedia di jam: ' || sg.slot_kosong || E'\n' ||
                    'Mohon disesuaikan kembali persiapan untuk slot yang masih tersedia ya 😊' || E'\n\n'
            END ||

            'Jaga kondisi fisik dan istirahat yang cukup ya 💙' || E'\n' ||
            'Semoga setiap terapi yang dilakukan menjadi jalan kesembuhan bagi pasien dan menjadi ladang pahala untuk kita semua 🤲' || E'\n\n' ||
            'Semangat bertugas 💪' || E'\n' ||
            COALESCE(c.name, '')

            AS message_text

        FROM grouped g

        LEFT JOIN slot_grouped sg
            ON g.therapist_id = sg.therapist_id

        LEFT JOIN soap_status ss
            ON ss.therapist_id = g.therapist_id

        LEFT JOIN clinics c
            ON c.id = g.clinic_id

        WHERE g.jadwal IS NOT NULL
    )

    SELECT *
    FROM final_data fd

    WHERE NOT EXISTS (
        SELECT 1
        FROM wa_schedule_logs w
        WHERE w.phone_number = fd.phone_number
        AND DATE(w.sent_at) = CURRENT_DATE
        AND w.category = 'reminder_therapist_h10'
        AND w.clinic_id = fd.clinic_id
    )

    LOOP

        INSERT INTO follow_up_queue (
            clinic_id,
            source_id,
            phone_number,
            follow_up_type,
            source_table,
            message_content,
            status,
            scheduled_date,
            scheduled_time,
            created_at,
            updated_at
        )
        VALUES (
            rec.clinic_id,
            rec.therapist_id,
            rec.phone_number,
            'reminder_therapist_h10',
            'appointments',
            rec.message_text,
            'pending',
            CURRENT_DATE,
            CURRENT_TIME,
            NOW(),
            NOW()
        );

        -- log anti duplicate
        INSERT INTO wa_schedule_logs (
            clinic_id,
            category,
            phone_number,
            message_content,
            status,
            created_at,
            sent_at
        )
        VALUES (
            rec.clinic_id,
            'reminder_therapist_h10',
            rec.phone_number,
            rec.message_text,
            'sent',
            NOW(),
            NOW()
        );

    END LOOP;

END;
$function$;

-- The two legacy follow-up processors also wrote to wa_schedule_logs
-- without clinic_id, even though follow_up_queue already carries it.
CREATE OR REPLACE FUNCTION public.process_pending_followups_test()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT *
        FROM follow_up_queue
        WHERE status = 'pending'
        AND scheduled_date <= CURRENT_DATE
    LOOP

        -- Update status jadi sent
        UPDATE follow_up_queue
        SET status = 'sent',
            sent_at = NOW()
        WHERE id = rec.id;

        -- Insert ke log
        INSERT INTO wa_schedule_logs (
            clinic_id,
            category,
            patient_id,
            phone_number,
            status,
            created_at,
            sent_at
        )
        VALUES (
            rec.clinic_id,
            rec.follow_up_type,
            rec.patient_id,
            rec.phone_number,
            'sent',
            NOW(),
            NOW()
        );

    END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_pending_followups_auto_old()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    rec RECORD;
    v_request_id bigint;
    v_response record;
    v_api_key text;
BEGIN

    SELECT api_key
    INTO v_api_key
    FROM wa_settings
    LIMIT 1;

    FOR rec IN
        SELECT *
        FROM follow_up_queue
        WHERE status = 'pending'
        AND scheduled_date <= CURRENT_DATE
    LOOP

        BEGIN

            SELECT net.http_post(
                url := 'https://api.watzap.id/v1/waba_send_message',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json'
                ),
                body := jsonb_build_object(
                    'api_key', v_api_key,
                    'phone_no', rec.phone_number,
                    'message', rec.message_content
                )
            )
            INTO v_request_id;

            PERFORM pg_sleep(3);

            SELECT *
            INTO v_response
            FROM net._http_response
            WHERE id = v_request_id;

            IF v_response.status_code = 200 THEN

                UPDATE follow_up_queue
                SET status = 'sent',
                    sent_at = now()
                WHERE id = rec.id;

                INSERT INTO wa_schedule_logs (
                    clinic_id,
                    category,
                    patient_id,
                    phone_number,
                    message_content,
                    status,
                    created_at,
                    sent_at
                )
                VALUES (
                    rec.clinic_id,
                    rec.follow_up_type,
                    rec.patient_id,
                    rec.phone_number,
                    rec.message_content,
                    'sent',
                    now(),
                    now()
                );

            ELSE

                UPDATE follow_up_queue
                SET status = 'failed'
                WHERE id = rec.id;

                INSERT INTO wa_schedule_logs (
                    clinic_id,
                    category,
                    patient_id,
                    phone_number,
                    message_content,
                    status,
                    error_message,
                    created_at
                )
                VALUES (
                    rec.clinic_id,
                    rec.follow_up_type,
                    rec.patient_id,
                    rec.phone_number,
                    rec.message_content,
                    'failed',
                    v_response.content,
                    now()
                );

            END IF;

        EXCEPTION WHEN OTHERS THEN

            UPDATE follow_up_queue
            SET status = 'failed'
            WHERE id = rec.id;

            INSERT INTO wa_schedule_logs (
                clinic_id,
                category,
                patient_id,
                phone_number,
                message_content,
                status,
                error_message,
                created_at
            )
            VALUES (
                rec.clinic_id,
                rec.follow_up_type,
                rec.patient_id,
                rec.phone_number,
                rec.message_content,
                'failed',
                SQLERRM,
                now()
            );

        END;

    END LOOP;

END;
$function$;
