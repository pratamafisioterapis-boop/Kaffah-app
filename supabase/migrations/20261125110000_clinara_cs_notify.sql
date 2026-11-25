-- Laporan ke Telegram saat routine CS mengubah tiket (PR terisi atau pekerjaan selesai).
-- Routine tidak memegang kunci service, jadi database yang memanggil clinara-cs
-- (pola yang sama dengan notify_ai_handoff_revision; autentikasi x-cron-token).
BEGIN;

CREATE OR REPLACE FUNCTION public.notify_cs_ticket_changed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF (NEW.pr_url IS NOT NULL AND NEW.pr_url IS DISTINCT FROM OLD.pr_url)
     OR (NEW.status = 'selesai' AND OLD.status IN ('disetujui', 'dikerjakan')) THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/clinara-cs',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-token', (SELECT token FROM public.wa_ai_cron_secret LIMIT 1)
        ),
        body := jsonb_build_object('action', 'ticket_changed', 'ticket_id', NEW.id)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.notify_cs_ticket_changed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cs_ticket_changed ON public.clinara_cs_tickets;
CREATE TRIGGER trg_cs_ticket_changed
AFTER UPDATE OF status, pr_url ON public.clinara_cs_tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_cs_ticket_changed();

COMMIT;
