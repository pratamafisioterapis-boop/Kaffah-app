-- Fix inconsistent/duplicate-prone medical record number (No RM) generation.
--
-- Root cause: two different client-side functions generated the next RM
-- number by reading recent rows and incrementing in JS (read-then-write,
-- no locking). One of them did not even filter by clinic_id, risking a
-- clinic's next RM being derived from a different clinic's numbers. Neither
-- was safe under concurrent inserts.
--
-- A per-clinic uniqueness index on (clinic_id, medical_record_number)
-- already exists (see 20260704221204_make_medical_record_number_unique_per_clinic.sql),
-- so this migration adds the missing piece: a single atomic RPC that locks
-- per clinic (pg_advisory_xact_lock) and computes the next number
-- server-side, so both "add patient" entry points can share one safe
-- source of truth instead of two racy client-side implementations.

CREATE OR REPLACE FUNCTION public.generate_next_medical_record_number(p_clinic_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_number integer;
  v_next_number integer;
BEGIN
  IF p_clinic_id IS NULL THEN
    RAISE EXCEPTION 'clinic_id is required to generate a medical record number';
  END IF;

  -- Serialize concurrent callers for the same clinic so two simultaneous
  -- "add patient" requests can never compute the same next number.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_clinic_id::text, 0));

  SELECT COALESCE(MAX(NULLIF(regexp_replace(medical_record_number, '\D', '', 'g'), '')::integer), 0)
  INTO v_max_number
  FROM public.patients
  WHERE clinic_id = p_clinic_id
    AND medical_record_number ~ '^RM\d+$';

  v_next_number := v_max_number + 1;

  RETURN 'RM' || LPAD(v_next_number::text, 5, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.generate_next_medical_record_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_next_medical_record_number(uuid) TO authenticated;
