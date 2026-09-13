-- Stop auto-sending "Follow Up Rutin" (follow_up_type = 'follow_up') messages via
-- the every-minute cron job. Queue generation (generate_follow_up_daily) stays
-- active so items still populate for the admin to review; only the automatic
-- dispatch to Watzap is disabled. Admins now trigger sends manually per item
-- from the Follow Up Management UI, which calls send_follow_up_whatsapp() directly.
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'send_follow_up_queue';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(v_jobid, active => false);
  END IF;
END $$;
