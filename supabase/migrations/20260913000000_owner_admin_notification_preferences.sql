-- Custom push notification preferences for owner/admin accounts.
--
-- Therapists already have per-device toggles on fcm_tokens
-- (notif_soap_enabled, notif_guest_enabled) consumed by the
-- send-therapist-notifications edge function. This adds the equivalent for
-- owner/admin: two toggles covering the SOAP-related pushes those roles
-- currently always receive unconditionally.
--
-- Applied directly to the production Supabase project (dqkejdamagvlhqvxaqej)
-- via the Supabase MCP tools, since this repo does not otherwise track
-- schema/function migrations for that project (see
-- 20260729000000_soap_completion_owner_notifications.sql). Kept here so the
-- history of what was deployed is recorded in git.

-- 1) New per-device preference columns, default enabled (opt-out).
ALTER TABLE public.fcm_tokens
  ADD COLUMN IF NOT EXISTS notif_owner_soap_progress_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_owner_soap_lock_enabled boolean DEFAULT true;

-- 2) Gate the "SOAP progress" pushes (period-close checkpoint + the every
--    15-minute end-of-workday checkpoint) on notif_owner_soap_progress_enabled.
--    Skip an owner/admin user only if they explicitly disabled it on every
--    device (any row still enabled/unset keeps them subscribed).
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

CREATE OR REPLACE FUNCTION public.notify_owner_soap_hday_checkpoint()
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_clinic_id uuid;
  rec RECORD;
  owner_user RECORD;
  v_dow text;
  v_closing text;
  v_closing_ts timestamptz;
  v_period_label text;
  v_total_recaps int;
  v_unfilled int;
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
      p.working_hours,
      gtpr.period_start,
      gtpr.period_end
    FROM physiotherapists p
    CROSS JOIN LATERAL get_therapist_period_range(p.id, CURRENT_DATE) gtpr
    WHERE p.clinic_id = v_clinic_id
      AND p.is_active IS TRUE
      AND gtpr.period_end = CURRENT_DATE
      AND p.last_soap_hday_notified_at IS DISTINCT FROM CURRENT_DATE
  LOOP
    v_dow := extract(dow FROM rec.period_end)::int::text;

    v_closing := NULL;
    IF (rec.working_hours -> v_dow ->> 'enabled') = 'true' THEN
      v_closing := rec.working_hours -> v_dow ->> 'end';
    END IF;

    IF v_closing IS NULL THEN
      SELECT s.operating_hours -> v_dow ->> 'end' INTO v_closing
      FROM appointment_settings s
      WHERE (s.operating_hours -> v_dow ->> 'enabled') = 'true'
      LIMIT 1;
    END IF;

    CONTINUE WHEN v_closing IS NULL;

    v_closing_ts := (rec.period_end::text || ' ' || v_closing)::timestamp AT TIME ZONE 'Asia/Makassar';

    CONTINUE WHEN now() < v_closing_ts;

    v_total_recaps := (
      SELECT count(*) FROM daily_recaps dr
      WHERE dr.therapist_id = rec.therapist_id
        AND dr.recap_date BETWEEN rec.period_start AND rec.period_end
    );

    CONTINUE WHEN v_total_recaps = 0;

    v_unfilled := get_therapist_unfilled_soap_count_in_period(rec.therapist_id, rec.period_start, rec.period_end);
    v_period_label := to_char(rec.period_start, 'DD Mon') || ' - ' || to_char(rec.period_end, 'DD Mon YYYY');

    FOR owner_user IN
      SELECT u.id FROM users u
      WHERE u.role IN ('owner', 'admin') AND u.clinic_id = v_clinic_id
        AND NOT EXISTS (
          SELECT 1 FROM fcm_tokens ft
          WHERE ft.user_id = u.id AND ft.notif_owner_soap_progress_enabled = false
        )
    LOOP
      IF v_unfilled = 0 THEN
        PERFORM net.http_post(
          url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-push-notification',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'user_id', owner_user.id,
            'title', '✅ SOAP Lengkap: ' || rec.therapist_name,
            'body', rec.therapist_name || ' sudah melengkapi semua SOAP untuk periode ' || v_period_label || ' (per akhir jam kerja hari ini).',
            'url', '/owner/medical-records'
          )
        );
      ELSE
        PERFORM net.http_post(
          url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-push-notification',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'user_id', owner_user.id,
            'title', '📋 SOAP Belum Terisi: ' || rec.therapist_name,
            'body', rec.therapist_name || ' — sisa ' || v_unfilled || ' SOAP belum diisi untuk periode ' || v_period_label || ' (per akhir jam kerja hari ini).',
            'url', '/owner/medical-records'
          )
        );
      END IF;
    END LOOP;

    UPDATE physiotherapists SET last_soap_hday_notified_at = CURRENT_DATE WHERE id = rec.therapist_id;
  END LOOP;
END;
$function$;

-- 3) Gate the SOAP lock/unlock push on notif_owner_soap_lock_enabled.
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
      SELECT u.id FROM users u
      WHERE u.role IN ('owner', 'admin') AND u.clinic_id = v_clinic_id
        AND NOT EXISTS (
          SELECT 1 FROM fcm_tokens ft
          WHERE ft.user_id = u.id AND ft.notif_owner_soap_lock_enabled = false
        )
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
      SELECT u.id FROM users u
      WHERE u.role IN ('owner', 'admin') AND u.clinic_id = v_clinic_id
        AND NOT EXISTS (
          SELECT 1 FROM fcm_tokens ft
          WHERE ft.user_id = u.id AND ft.notif_owner_soap_lock_enabled = false
        )
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
