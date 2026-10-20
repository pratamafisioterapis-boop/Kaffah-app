-- Reminder H-10 (jadwal besok) untuk terapis dihapus.
-- Hentikan cron yang memanggilnya, hapus fungsinya, dan batalkan antrean pending.
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    FOR r IN SELECT jobid FROM cron.job
             WHERE command ILIKE '%send_reminder_therapist_h10%'
                OR command ILIKE '%send_reminder_therapist_queue%'
    LOOP
      PERFORM cron.unschedule(r.jobid);
    END LOOP;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.send_reminder_therapist_h10();
DROP FUNCTION IF EXISTS public.send_reminder_therapist_queue();

UPDATE public.follow_up_queue
SET status = 'cancelled', failed_reason = 'WA terapis dinonaktifkan'
WHERE status = 'pending'
  AND follow_up_type = 'reminder_therapist_h10';
