-- Pesan pasien yang tidak dibalas AI (handoff live) dikirim ke grup revisi AI lewat fungsi
-- wa-ai-revision-notify. Trigger tidak boleh pernah menggagalkan pencatatan log: semua galat ditelan.
CREATE OR REPLACE FUNCTION public.notify_ai_handoff_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.mode = 'live' AND NEW.outcome = 'handoff'
     AND (TG_OP = 'INSERT' OR OLD.outcome IS DISTINCT FROM 'handoff') THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/wa-ai-revision-notify',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-token', (SELECT token FROM public.wa_ai_cron_secret LIMIT 1)
        ),
        body := jsonb_build_object('log_id', NEW.id)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_ai_handoff_revision() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ai_handoff_revision ON public.wa_ai_logs;
CREATE TRIGGER trg_ai_handoff_revision
AFTER INSERT OR UPDATE OF outcome ON public.wa_ai_logs
FOR EACH ROW EXECUTE FUNCTION public.notify_ai_handoff_revision();
