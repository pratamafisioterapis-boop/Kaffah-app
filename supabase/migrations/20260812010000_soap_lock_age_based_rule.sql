-- Opt-in per-therapist "SOAP menunggak lama" (age-of-oldest-unfilled-SOAP)
-- lock rule, requested by the clinic owner after noticing some therapists
-- deliberately keep their total unfilled-SOAP count just under the lock
-- threshold (e.g. staying at 19 when the threshold is 20), even on days
-- with open booking slots where they could have caught up.
--
-- This documents a change already applied directly to the production
-- Supabase project (dqkejdamagvlhqvxaqej) via the Supabase MCP tools, since
-- this repo does not otherwise track schema/function migrations for that
-- project. Kept here so the history of what was deployed is recorded in git.
--
-- The new rule is independent of the existing count-based threshold: once
-- enabled for a therapist (via the "Kunci jika SOAP menunggak lama" toggle
-- in TherapistSoapLockManager.jsx), their calendar locks the moment the
-- oldest still-unfilled SOAP note is older than soap_lock_max_age_days
-- (default 4), regardless of how many total SOAP notes are unfilled.
-- Staying just under a count threshold no longer helps once a single note
-- ages out. It's opt-in per therapist (not a clinic-wide default) so the
-- owner can target it at specific therapists without suddenly changing
-- behavior for everyone.
--
-- Existing owner/admin and therapist push notifications (real-time on
-- lock/unlock, nightly batch, period-end, etc.) all read the locked flag
-- from get_therapist_soap_lock_status(), so they automatically cover
-- age-triggered locks too without any changes on their end.

ALTER TABLE public.physiotherapists
  ADD COLUMN IF NOT EXISTS soap_lock_age_rule_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS soap_lock_max_age_days integer NOT NULL DEFAULT 4;

-- Age (in days) of the oldest still-unfilled SOAP in the period, using the
-- same "counts once 60 minutes past start_time" cutoff as
-- get_therapist_unfilled_soap_count_in_period. NULL when nothing is unfilled.
CREATE OR REPLACE FUNCTION public.get_therapist_oldest_unfilled_soap_age_days(p_therapist_id uuid, p_period_start date, p_period_end date)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select floor(extract(epoch from (now() - min(coalesce(dr.start_time, dr.recap_date::timestamptz) + interval '60 minutes'))) / 86400)::int
  from daily_recaps dr
  where dr.therapist_id = p_therapist_id
    and dr.recap_date >= p_period_start
    and dr.recap_date <= least(p_period_end, current_date)
    and coalesce(dr.start_time, dr.recap_date::timestamptz) + interval '60 minutes' <= now()
    and not exists (
      select 1 from medical_records mr where mr.daily_recap_id = dr.id
    );
$function$;

-- Return type is changing (new output columns), so the old signatures must
-- be dropped before recreating. get_clinic_therapists_soap_lock_status
-- depends on get_therapist_soap_lock_status, so drop it first.
DROP FUNCTION IF EXISTS public.get_clinic_therapists_soap_lock_status(uuid);
DROP FUNCTION IF EXISTS public.get_therapist_soap_lock_status(uuid);

CREATE FUNCTION public.get_therapist_soap_lock_status(p_therapist_id uuid)
 RETURNS TABLE(
   therapist_id uuid,
   locked boolean,
   unfilled_count integer,
   threshold_count integer,
   period_start date,
   period_end date,
   rule_source text,
   age_rule_enabled boolean,
   max_age_days integer,
   oldest_unfilled_age_days integer,
   age_rule_triggered boolean
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_therapist physiotherapists%rowtype;
  v_settings soap_lock_settings%rowtype;
  v_threshold integer;
  v_period_start date;
  v_period_end date;
  v_count integer;
  v_source text;
  v_clinic_enabled boolean;
  v_age_enabled boolean;
  v_max_age integer;
  v_oldest_age integer;
  v_age_triggered boolean;
  v_count_locked boolean;
BEGIN
  SELECT * INTO v_therapist FROM physiotherapists WHERE id = p_therapist_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT p_therapist_id, false, 0, 0, NULL::date, NULL::date, 'not_found'::text, false, NULL::integer, NULL::integer, false;
    RETURN;
  END IF;

  SELECT gtpr.period_start, gtpr.period_end INTO v_period_start, v_period_end
    FROM get_therapist_period_range(p_therapist_id) gtpr;

  v_age_enabled := COALESCE(v_therapist.soap_lock_age_rule_enabled, false);
  v_max_age := COALESCE(v_therapist.soap_lock_max_age_days, 4);

  IF v_therapist.soap_lock_exempt THEN
    RETURN QUERY SELECT p_therapist_id, false, 0, 0, v_period_start, v_period_end, 'exempt'::text, v_age_enabled, v_max_age, NULL::integer, false;
    RETURN;
  END IF;

  SELECT * INTO v_settings FROM soap_lock_settings WHERE clinic_id = v_therapist.clinic_id;
  v_clinic_enabled := COALESCE(v_settings.enabled, false);

  IF v_therapist.soap_lock_custom_enabled THEN
    v_threshold := COALESCE(v_therapist.soap_lock_threshold_count, 5);
    v_source := 'custom';
  ELSE
    v_threshold := COALESCE(v_settings.threshold_count, 5);
    v_source := CASE WHEN v_clinic_enabled THEN 'clinic' ELSE 'disabled' END;
  END IF;

  -- Count is always informational, regardless of enforcement being on.
  v_count := get_therapist_unfilled_soap_count_in_period(p_therapist_id, v_period_start, v_period_end);

  IF v_age_enabled THEN
    v_oldest_age := get_therapist_oldest_unfilled_soap_age_days(p_therapist_id, v_period_start, v_period_end);
  ELSE
    v_oldest_age := NULL;
  END IF;
  v_age_triggered := v_age_enabled AND v_oldest_age IS NOT NULL AND v_oldest_age >= v_max_age;

  IF v_therapist.soap_lock_manual_unlock THEN
    RETURN QUERY SELECT p_therapist_id, false, v_count, v_threshold, v_period_start, v_period_end, 'manual_unlock'::text, v_age_enabled, v_max_age, v_oldest_age, v_age_triggered;
    RETURN;
  END IF;

  -- Count-based enforcement only fires when the rule that applies is
  -- actually active: a custom per-therapist rule is always active, the
  -- clinic default rule only applies when the clinic has enabled it.
  v_count_locked := (v_therapist.soap_lock_custom_enabled OR v_clinic_enabled) AND (v_count >= v_threshold);

  -- Age-based enforcement is a separate opt-in lever: it can lock a
  -- therapist even when neither the clinic default nor a custom count
  -- threshold is active for them.
  IF v_age_triggered AND NOT v_count_locked THEN
    v_source := 'age';
  END IF;

  RETURN QUERY SELECT p_therapist_id, (v_count_locked OR v_age_triggered), v_count, v_threshold, v_period_start, v_period_end, v_source, v_age_enabled, v_max_age, v_oldest_age, v_age_triggered;
END;
$function$;

CREATE FUNCTION public.get_clinic_therapists_soap_lock_status(p_clinic_id uuid)
 RETURNS TABLE(
   therapist_id uuid,
   locked boolean,
   unfilled_count integer,
   threshold_count integer,
   period_start date,
   period_end date,
   rule_source text,
   age_rule_enabled boolean,
   max_age_days integer,
   oldest_unfilled_age_days integer,
   age_rule_triggered boolean
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select gls.*
  from physiotherapists p
  cross join lateral get_therapist_soap_lock_status(p.id) gls
  where p.clinic_id = p_clinic_id;
$function$;

-- Re-evaluate and push the real-time lock/unlock notification whenever the
-- new age-rule fields change too, same as the existing count-based fields.
CREATE OR REPLACE FUNCTION public.trg_physio_soap_lock_notify()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF (NEW.soap_lock_custom_enabled IS DISTINCT FROM OLD.soap_lock_custom_enabled)
     OR (NEW.soap_lock_threshold_count IS DISTINCT FROM OLD.soap_lock_threshold_count)
     OR (NEW.soap_lock_manual_unlock IS DISTINCT FROM OLD.soap_lock_manual_unlock)
     OR (NEW.soap_lock_exempt IS DISTINCT FROM OLD.soap_lock_exempt)
     OR (NEW.soap_lock_age_rule_enabled IS DISTINCT FROM OLD.soap_lock_age_rule_enabled)
     OR (NEW.soap_lock_max_age_days IS DISTINCT FROM OLD.soap_lock_max_age_days) THEN
    PERFORM notify_single_therapist_soap_lock(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;
