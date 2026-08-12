-- Fix: saving a therapist's SOAP-lock override (Kecualikan dari kunci /
-- Gunakan aturan khusus / Buka kunci manual, in
-- src/components/owner/TherapistSoapLockManager.jsx) from the owner account
-- failed with:
--   "new row violates row-level security policy for table notifications"
--
-- This documents a change already applied directly to the production
-- Supabase project (dqkejdamagvlhqvxaqej) via the Supabase MCP tools, since
-- this repo does not otherwise track schema/function migrations for that
-- project. Kept here so the history of what was deployed is recorded in git.
--
-- Root cause:
--   Saving the override does a client-side UPDATE on `physiotherapists`
--   under the owner's own session. When that update flips a therapist's
--   SOAP-lock status (locked <-> unlocked), the AFTER UPDATE trigger
--   trg_notify_soap_lock_on_physio_update -> trg_physio_soap_lock_notify()
--   calls notify_single_therapist_soap_lock(), which still had a leftover
--   `INSERT INTO notifications (...)` statement dating from before push
--   notifications were introduced (see item 5 in
--   20260729000000_soap_completion_owner_notifications.sql, which already
--   flagged the `notifications` table as unused but didn't remove these
--   two inserts).
--
--   Neither trg_physio_soap_lock_notify() nor
--   notify_single_therapist_soap_lock() is SECURITY DEFINER, so that insert
--   runs with the privileges of whoever triggered it -- the owner's own
--   authenticated session, not the postgres/service role. The `notifications`
--   table has row-level security enabled but has zero policies defined, so
--   every insert into it is denied for every role. The app doesn't even
--   read from `notifications` (the dashboard's notification bell in
--   DashboardLayout.jsx reads from `audit_logs` instead), so this insert
--   was dead code that only served to break the owner's save whenever a
--   lock-status flip occurred.
--
-- Fix:
--   Remove the two `INSERT INTO notifications` statements from
--   notify_single_therapist_soap_lock(). The actual owner/admin
--   notification is unaffected -- it already happens via the
--   send-push-notification net.http_post call immediately below each
--   removed insert.

CREATE OR REPLACE FUNCTION public.notify_single_therapist_soap_lock(p_therapist_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_locked boolean;
  v_unfilled_count integer;
  v_prev boolean;
  v_therapist_name text;
  v_clinic_id uuid;
  owner_user RECORD;
BEGIN
  SELECT locked, unfilled_count INTO v_locked, v_unfilled_count
    FROM get_therapist_soap_lock_status(p_therapist_id) LIMIT 1;

  SELECT last_soap_lock_notified, name, clinic_id
    INTO v_prev, v_therapist_name, v_clinic_id
    FROM physiotherapists WHERE id = p_therapist_id;

  IF v_locked IS TRUE AND COALESCE(v_prev, false) IS NOT TRUE THEN
    PERFORM net.http_post(
      url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-therapist-notifications',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('therapist_id', p_therapist_id, 'event', 'locked')
    );

    FOR owner_user IN
      SELECT id FROM users WHERE role IN ('owner', 'admin') AND clinic_id = v_clinic_id
    LOOP
      PERFORM net.http_post(
        url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-push-notification',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'user_id', owner_user.id,
          'title', '🔒 Jadwal Terkunci: ' || COALESCE(v_therapist_name, 'Terapis'),
          'body', COALESCE(v_therapist_name, 'Terapis') || ' — jadwal booking terkunci karena ' ||
            COALESCE(v_unfilled_count, 0) || ' SOAP belum diisi.',
          'url', '/owner/physiotherapist-management'
        )
      );
    END LOOP;

  ELSIF v_locked IS NOT TRUE AND COALESCE(v_prev, false) IS TRUE THEN
    PERFORM net.http_post(
      url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-therapist-notifications',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('therapist_id', p_therapist_id, 'event', 'unlocked')
    );

    FOR owner_user IN
      SELECT id FROM users WHERE role IN ('owner', 'admin') AND clinic_id = v_clinic_id
    LOOP
      PERFORM net.http_post(
        url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-push-notification',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'user_id', owner_user.id,
          'title', '✅ Jadwal Terbuka: ' || COALESCE(v_therapist_name, 'Terapis'),
          'body', COALESCE(v_therapist_name, 'Terapis') || ' sudah melengkapi SOAP-nya, jadwal booking kini terbuka kembali.',
          'url', '/owner/physiotherapist-management'
        )
      );
    END LOOP;
  END IF;

  UPDATE physiotherapists SET last_soap_lock_notified = COALESCE(v_locked, false) WHERE id = p_therapist_id;
END;
$function$;
