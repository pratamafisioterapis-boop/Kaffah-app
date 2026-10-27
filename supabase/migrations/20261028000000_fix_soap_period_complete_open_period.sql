-- Fix: notify_owner_soap_period_complete() announced "SOAP Lengkap" for
-- therapists whose period had not closed yet.
--
-- The checkpoint evaluates get_therapist_period_range(p.id, CURRENT_DATE - 1)
-- for every therapist. For the default 28 -> 27 cycle that is the period that
-- just closed, but for a calendar-month cycle (1 -> 31) it is the period still
-- in progress, so on the 28th such a therapist got a "periode 01 Oct - 31 Oct"
-- push before the period had ended and was marked as notified for it.
--
-- Now only periods whose period_end is already behind us are announced.
--
-- Applied directly to the production Supabase project (dqkejdamagvlhqvxaqej)
-- via the Supabase MCP tools; recorded here for history.

CREATE OR REPLACE FUNCTION public.notify_owner_soap_period_complete()
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_clinic_id uuid;
  rec RECORD;
  owner_user RECORD;
  v_period_label text;
BEGIN
  SELECT pu.clinic_id INTO v_clinic_id
  FROM auth.users au
  JOIN public.users pu ON pu.id = au.id
  WHERE au.email = 'pratama.fisioterapis@gmail.com';

  IF v_clinic_id IS NULL THEN
    RETURN;
  END IF;

  FOR rec IN
    SELECT
      p.id AS therapist_id,
      p.name AS therapist_name,
      gtpr.period_start,
      gtpr.period_end,
      (
        SELECT count(*) FROM daily_recaps dr
        WHERE dr.therapist_id = p.id
          AND dr.recap_date BETWEEN gtpr.period_start AND gtpr.period_end
      ) AS total_recaps,
      get_therapist_unfilled_soap_count_in_period(p.id, gtpr.period_start, gtpr.period_end) AS unfilled_count
    FROM physiotherapists p
    CROSS JOIN LATERAL get_therapist_period_range(p.id, CURRENT_DATE - 1) gtpr
    WHERE p.clinic_id = v_clinic_id
      AND p.is_active IS TRUE
      AND gtpr.period_end < CURRENT_DATE
      AND p.last_soap_period_complete_notified_at IS DISTINCT FROM gtpr.period_end
  LOOP
    CONTINUE WHEN rec.total_recaps = 0 OR rec.unfilled_count > 0;

    v_period_label := to_char(rec.period_start, 'DD Mon') || ' - ' || to_char(rec.period_end, 'DD Mon YYYY');

    FOR owner_user IN
      SELECT u.id FROM users u
      WHERE u.role IN ('owner', 'admin') AND u.clinic_id = v_clinic_id
        AND NOT EXISTS (
          SELECT 1 FROM fcm_tokens ft
          WHERE ft.user_id = u.id AND ft.notif_owner_soap_progress_enabled = false
        )
    LOOP
      PERFORM net.http_post(
        url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-push-notification',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'user_id', owner_user.id,
          'title', '✅ SOAP Lengkap: ' || rec.therapist_name,
          'body', rec.therapist_name || ' sudah melengkapi semua SOAP untuk periode ' || v_period_label || '.',
          'url', '/owner/medical-records'
        )
      );
    END LOOP;

    UPDATE physiotherapists
      SET last_soap_period_complete_notified_at = rec.period_end
      WHERE id = rec.therapist_id;
  END LOOP;
END;
$function$;

-- Undo the premature marker set on 2026-10-28 so the 01 - 31 Oct period is
-- announced when it actually closes (cron on 2026-10-31 23:00 UTC).
UPDATE public.physiotherapists
  SET last_soap_period_complete_notified_at = NULL
  WHERE name = 'Adi Pratama,S.Fis.,Ftr'
    AND last_soap_period_complete_notified_at = DATE '2026-10-31';
