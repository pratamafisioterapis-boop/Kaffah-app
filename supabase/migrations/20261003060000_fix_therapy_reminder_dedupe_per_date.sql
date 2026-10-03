-- Bug: pasien dengan appointment yang di-reschedule (status 'rescheduled') tidak
-- muncul di Follow Up Management > Pengingat Terapi pada hari jadwal barunya.
--
-- Contoh: khofiful walidani, booking awal 30 Sep 19:00 (therapy_reminder dibuat
-- 30 Sep), di-reschedule ke 3 Okt 13:30. Pada 3 Okt generate_therapy_reminder_today()
-- tidak membuat baris baru karena NOT EXISTS hanya mengecek (source_id,
-- follow_up_type) TANPA tanggal -- reminder lama (30 Sep) dianggap sudah ada.
--
-- Fix: dedupe per scheduled_date = CURRENT_DATE. Unique index
-- (patient_id, follow_up_type, scheduled_date, source_id) tetap menjaga duplikat.

CREATE OR REPLACE FUNCTION public.generate_therapy_reminder_today()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_now_wita text := TO_CHAR(NOW() AT TIME ZONE 'Asia/Makassar', 'HH24:MI');
BEGIN
    INSERT INTO follow_up_queue (
        clinic_id, patient_id, phone_number, follow_up_type, source_id, source_table,
        message_content, status, scheduled_date, scheduled_time, guest_name, guest_phone
    )
    SELECT
        COALESCE(ph.clinic_id, (SELECT id FROM clinics LIMIT 1)),
        a.patient_id,
        COALESCE(p.phone, a.guest_phone),
        CASE WHEN a.is_homecare THEN 'therapy_reminder_homecare' ELSE 'therapy_reminder' END,
        a.id,
        'appointments',
        render_follow_up_message(wt.template_text, a.id, 'appointments'),
        'pending',
        CURRENT_DATE,
        COALESCE((wsc.timing_value->>'send_time')::time, '07:00'::time),
        a.guest_name,
        a.guest_phone
    FROM appointments a
    LEFT JOIN patients p ON p.id = a.patient_id
    LEFT JOIN physiotherapists ph ON ph.id = a.therapist_id
    LEFT JOIN wa_schedule_config wsc
        ON wsc.clinic_id = COALESCE(ph.clinic_id, (SELECT id FROM clinics LIMIT 1))
        AND wsc.category = CASE WHEN a.is_homecare THEN 'therapy_reminder_homecare' ELSE 'therapy_reminder' END
    LEFT JOIN LATERAL (
        SELECT template_text
        FROM wa_templates
        WHERE category = CASE WHEN a.is_homecare THEN 'therapy_reminder_homecare' ELSE 'therapy_reminder' END
          AND is_enabled = true
          AND clinic_id = COALESCE(ph.clinic_id, (SELECT id FROM clinics LIMIT 1))
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 1
    ) wt ON true
    WHERE
        a.status IN ('confirmed', 'rescheduled')
        AND a.appointment_date::date = CURRENT_DATE
        AND COALESCE(p.phone, a.guest_phone) IS NOT NULL
        AND (a.patient_id IS NULL OR p.status = 'aktif')
        AND COALESCE(wsc.is_enabled, true) = true
        AND COALESCE(wsc.timing_value->>'time', '07:00') = v_now_wita
        AND NOT EXISTS (
            SELECT 1
            FROM follow_up_queue fq
            WHERE fq.source_id = a.id
            AND fq.scheduled_date = CURRENT_DATE
            AND fq.follow_up_type = CASE WHEN a.is_homecare THEN 'therapy_reminder_homecare' ELSE 'therapy_reminder' END
        )
    ON CONFLICT (patient_id, follow_up_type, scheduled_date, source_id) DO NOTHING;
END;
$function$;
