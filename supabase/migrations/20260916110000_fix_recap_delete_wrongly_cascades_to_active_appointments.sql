-- Bug: trg_delete_appointment_when_recap_deleted (AFTER DELETE ON daily_recaps)
-- was written as a blocklist -- it skipped the cascade delete only when the
-- appointment's status was cancelled/no_show/rejected, and deleted the
-- appointment for every OTHER status, including 'rescheduled' and
-- 'confirmed'.
--
-- trg_appointment_update_recap legitimately DELETEs the daily_recaps row
-- whenever an appointment is rescheduled to a future date (the nightly
-- generate_today_daily_recaps() job recreates it on the correct day). That
-- legitimate delete fired this trigger, which then saw status = 'rescheduled'
-- (not in the cancelled/no_show/rejected list) and deleted the appointment
-- itself -- exactly the "pasien hilang setelah reschedule" bug, confirmed via
-- audit_logs for appointment 822265fe-a579-45fc-94ed-4c31f680a543 (patient
-- Rizkyka rumengan, therapist Alma) on 2026-09-17, and for 53 other
-- appointments going back to April 2026.
--
-- Fix: invert the condition to an allowlist -- only cascade-delete the
-- appointment when its status actually IS cancelled/no_show/rejected.

CREATE OR REPLACE FUNCTION public.trg_delete_appointment_when_recap_deleted()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_status text;
BEGIN

    -- ambil status appointment
    SELECT status INTO v_status
    FROM appointments
    WHERE id = OLD.appointment_id;

    -- hanya cascade delete kalau appointment memang cancelled/no_show/rejected
    IF v_status IN ('cancelled', 'no_show', 'rejected') THEN
        IF OLD.appointment_id IS NOT NULL THEN
            DELETE FROM appointments
            WHERE id = OLD.appointment_id;
        END IF;
    END IF;

    RETURN OLD;
END;
$function$;
