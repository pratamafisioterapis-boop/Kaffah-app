-- Owner/admin push notifications for therapist SOAP completion.
--
-- This documents changes already applied directly to the production Supabase
-- project (dqkejdamagvlhqvxaqej) via the Supabase MCP tools, since this repo
-- does not otherwise track schema/function migrations for that project. Kept
-- here so the history of what was deployed is recorded in git.
--
-- Summary:
--   1. "Belum terisi" (unfilled SOAP) now only counts once the appointment's
--      start_time + 60 minutes has passed, instead of the instant the visit
--      row exists. Shared by the SOAP-lock feature, the nightly therapist
--      reminder, and the owner/admin notifications below.
--   2. New per-therapist bookkeeping columns on physiotherapists to dedupe
--      notifications (period-close checkpoint, realtime tracker baseline).
--   3. notify_owner_soap_period_complete(): checkpoint that runs on the 28th
--      and pushes to owner/admin for any therapist whose just-closed period
--      has zero unfilled SOAP. Scoped to the clinic tied to
--      pratama.fisioterapis@gmail.com.
--   4. notify_owner_soap_unfilled_realtime(): polls every 5 minutes and
--      pushes to owner/admin whenever a therapist's unfilled count for the
--      CURRENT period changes (up or down), including reaching zero. Same
--      clinic scope as (3).
--   5. notify_single_therapist_soap_lock(): extended to also push to
--      owner/admin (with therapist name + unfilled count) when a therapist's
--      booking calendar locks/unlocks due to SOAP backlog. This function is
--      shared across all clinics (pre-existing behavior), so this push now
--      reaches every clinic's owner/admin, not just one clinic.
--   6. pg_cron jobs: the period-complete checkpoint fires at 07:00 WITA
--      (23:00 UTC previous day) on the 28th of every month; the realtime
--      tracker fires every 5 minutes.

-- 1) Shared "unfilled SOAP" definition: only counts once 60 minutes have
--    passed since the appointment's start_time (falls back to midnight of
--    recap_date when start_time isn't set yet, which stays in the future for
--    not-yet-started sessions and so never counts prematurely).
CREATE OR REPLACE FUNCTION public.get_therapist_unfilled_soap_count_in_period(p_therapist_id uuid, p_period_start date, p_period_end date)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::int
  from daily_recaps dr
  where dr.therapist_id = p_therapist_id
    and dr.recap_date >= p_period_start
    and dr.recap_date <= least(p_period_end, current_date)
    and coalesce(dr.start_time, dr.recap_date::timestamptz) + interval '60 minutes' <= now()
    and not exists (
      select 1 from medical_records mr where mr.daily_recap_id = dr.id
    );
$function$;

-- 2) Dedup/baseline columns.
ALTER TABLE public.physiotherapists
  ADD COLUMN IF NOT EXISTS last_soap_period_complete_notified_at date,
  ADD COLUMN IF NOT EXISTS last_notified_unfilled_count integer,
  ADD COLUMN IF NOT EXISTS last_notified_unfilled_period_end date;

-- 3) Monthly period-close checkpoint (owner/admin push).
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
  -- Scope to the clinic this feature was requested for, then notify everyone
  -- with an owner/admin role there (not just the specific login that asked,
  -- since that login is a therapist account with its own separate SOAP work,
  -- not the one that should receive owner-level completion pushes).
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
      SELECT id FROM users WHERE role IN ('owner', 'admin') AND clinic_id = v_clinic_id
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

-- 4) Realtime tracker for the in-progress period (owner/admin push).
CREATE OR REPLACE FUNCTION public.notify_owner_soap_unfilled_realtime()
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_clinic_id uuid;
  rec RECORD;
  owner_user RECORD;
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
      p.last_notified_unfilled_count AS prev_count,
      p.last_notified_unfilled_period_end AS prev_period_end,
      gtpr.period_end,
      get_therapist_unfilled_soap_count_in_period(p.id, gtpr.period_start, gtpr.period_end) AS unfilled_count,
      (
        SELECT count(*) FROM daily_recaps dr
        WHERE dr.therapist_id = p.id
          AND dr.recap_date BETWEEN gtpr.period_start AND gtpr.period_end
      ) AS total_recaps
    FROM physiotherapists p
    CROSS JOIN LATERAL get_therapist_period_range(p.id, CURRENT_DATE) gtpr
    WHERE p.clinic_id = v_clinic_id
      AND p.is_active IS TRUE
  LOOP
    -- New period started since we last checked: rebaseline silently, no notif.
    IF rec.prev_period_end IS DISTINCT FROM rec.period_end THEN
      UPDATE physiotherapists
        SET last_notified_unfilled_count = rec.unfilled_count,
            last_notified_unfilled_period_end = rec.period_end
        WHERE id = rec.therapist_id;
      CONTINUE;
    END IF;

    CONTINUE WHEN rec.unfilled_count IS NOT DISTINCT FROM rec.prev_count;
    CONTINUE WHEN rec.unfilled_count = 0 AND rec.total_recaps = 0;

    FOR owner_user IN
      SELECT id FROM users WHERE role IN ('owner', 'admin') AND clinic_id = v_clinic_id
    LOOP
      PERFORM net.http_post(
        url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-push-notification',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'user_id', owner_user.id,
          'title', CASE WHEN rec.unfilled_count = 0
                        THEN '✅ SOAP Lengkap: ' || rec.therapist_name
                        ELSE '📋 SOAP Belum Terisi: ' || rec.therapist_name END,
          'body', CASE WHEN rec.unfilled_count = 0
                       THEN rec.therapist_name || ' sudah melengkapi semua SOAP periode berjalan.'
                       ELSE rec.therapist_name || ' — sisa ' || rec.unfilled_count || ' SOAP belum diisi.' END,
          'url', '/owner/medical-records'
        )
      );
    END LOOP;

    UPDATE physiotherapists
      SET last_notified_unfilled_count = rec.unfilled_count
      WHERE id = rec.therapist_id;
  END LOOP;
END;
$function$;

-- 5) Lock/unlock notifications now also push to owner/admin (previously only
--    wrote a row into the unused `notifications` table). Therapist-side push
--    already existed via send-therapist-notifications and is unchanged.
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

    INSERT INTO notifications (user_id, appointment_id, title, message, type)
    SELECT
      u.id,
      NULL,
      '🔒 Jadwal Terapis Terkunci',
      COALESCE(v_therapist_name, 'Terapis') || ' — jadwal booking terkunci karena ' ||
        COALESCE(v_unfilled_count, 0) || ' SOAP belum diisi.',
      'SOAP_LOCKED'
    FROM users u
    WHERE u.role IN ('owner', 'admin')
      AND u.clinic_id = v_clinic_id;

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

    INSERT INTO notifications (user_id, appointment_id, title, message, type)
    SELECT
      u.id,
      NULL,
      '✅ Jadwal Terapis Terbuka Kembali',
      COALESCE(v_therapist_name, 'Terapis') || ' sudah melengkapi SOAP-nya, jadwal booking kini terbuka kembali.',
      'SOAP_UNLOCKED'
    FROM users u
    WHERE u.role IN ('owner', 'admin')
      AND u.clinic_id = v_clinic_id;

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

-- 6) pg_cron schedules.
SELECT cron.schedule(
  'notify-owner-soap-period-complete',
  '0 23 27 * *', -- 23:00 UTC on the 27th = 07:00 WITA on the 28th
  $$ SELECT public.notify_owner_soap_period_complete(); $$
);

SELECT cron.schedule(
  'notify-owner-soap-unfilled-realtime',
  '*/5 * * * *',
  $$ SELECT public.notify_owner_soap_unfilled_realtime(); $$
);
