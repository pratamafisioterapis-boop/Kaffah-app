-- Push notification to pemilihjapar@gmail.com whenever a relawan account
-- adds new pemilih KTP data.
--
-- This documents a change already applied directly to the production
-- Supabase project (dqkejdamagvlhqvxaqej) via the Supabase MCP tools, since
-- this repo does not otherwise track schema/function migrations for that
-- project. Kept here so the history of what was deployed is recorded in git.
--
-- Summary:
--   Whenever a row is inserted into pemilih_data with sumber_data = 'relawan'
--   (i.e. submitted from the relawan KTP upload flow, RelawanUploadKTP.jsx),
--   notify_pemilih_admin_on_relawan_input() fires and pushes a notification
--   to the pemilih_admins account pemilihjapar@gmail.com via the existing
--   send-push-notification edge function. The notification body contains the
--   voter's name, address, and the name of the relawan who input the data
--   (looked up from pemilih_relawan.nama via petugas_input).
--
--   SECURITY DEFINER is required here (unlike the cron-only SOAP
--   notification functions in 20260729000000_soap_completion_owner_notifications.sql)
--   because this trigger fires synchronously inside a relawan's own
--   client-side INSERT into pemilih_data, which runs under the authenticated
--   role rather than postgres. The whole body is wrapped in an exception
--   handler so a notification failure (e.g. no FCM token, transient network
--   issue) never blocks the relawan's actual data save.

CREATE OR REPLACE FUNCTION public.notify_pemilih_admin_on_relawan_input()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_target_user_id uuid;
  v_relawan_nama text;
BEGIN
  BEGIN
    SELECT id INTO v_target_user_id
    FROM auth.users
    WHERE email = 'pemilihjapar@gmail.com';

    IF v_target_user_id IS NOT NULL THEN
      SELECT nama INTO v_relawan_nama
      FROM pemilih_relawan
      WHERE user_id = NEW.petugas_input;

      PERFORM net.http_post(
        url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-push-notification',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'user_id', v_target_user_id,
          'title', '🪪 Data Pemilih Baru dari Relawan',
          'body', 'Nama: ' || COALESCE(NEW.nama, '-') || E'\n' ||
                  'Alamat: ' || COALESCE(NEW.alamat, '-') || E'\n' ||
                  'Diinput oleh: ' || COALESCE(v_relawan_nama, 'Relawan'),
          'url', '/pemilih/data'
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_pemilih_admin_on_relawan_input failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_pemilih_admin_on_relawan_input ON public.pemilih_data;
CREATE TRIGGER trg_notify_pemilih_admin_on_relawan_input
AFTER INSERT ON public.pemilih_data
FOR EACH ROW
WHEN (NEW.sumber_data = 'relawan')
EXECUTE FUNCTION public.notify_pemilih_admin_on_relawan_input();
