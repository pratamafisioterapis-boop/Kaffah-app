-- Bug: get_available_slots_with_status_by_date checked SOAP-lock status
-- before checking for a booked appointment, so a booked slot belonging to
-- a SOAP-locked therapist was reported as 'terkunci' instead of 'terisi'.
-- This made the "Kapasitas vs Permintaan" widget undercount Terisi
-- (booked appointments became invisible whenever their therapist was
-- SOAP-locked). Fix: check for an overlapping appointment first, so a
-- booked slot always reports 'terisi' regardless of SOAP-lock state;
-- 'terkunci' now only applies to locked slots that are not booked.

CREATE OR REPLACE FUNCTION public.get_available_slots_with_status_by_date(p_date date, p_clinic_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(therapist_id uuid, slot_start time without time zone, slot_end time without time zone, duration_minutes integer, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ts.therapist_id,
    ts.slot_start_time AS slot_start,
    ts.slot_end_time AS slot_end,
    ts.duration_minutes,

    CASE
      WHEN EXISTS (
        SELECT 1
        FROM therapist_time_off tto
        WHERE tto.therapist_id = ts.therapist_id
          AND p_date BETWEEN tto.start_date AND tto.end_date
      ) THEN 'cuti'

      WHEN EXISTS (
        SELECT 1
        FROM appointments a
        WHERE a.therapist_id = ts.therapist_id
          AND a.status IN ('confirmed', 'pending', 'scheduled', 'rescheduled')
          AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::date = p_date
          AND (
            (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time = ts.slot_start_time
            OR
            (
              (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time < ts.slot_end_time
              AND (
                (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time
                + (a.duration_minutes || ' minutes')::interval
              ) > ts.slot_start_time
              AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time <> ts.slot_start_time
              AND NOT EXISTS (
                SELECT 1
                FROM therapist_slots ts2
                WHERE ts2.therapist_id = ts.therapist_id
                  AND ts2.slot_date = p_date
                  AND ts2.is_available = true
                  AND ts2.slot_start_time = (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time
              )
            )
          )
      ) THEN 'terisi'

      WHEN is_therapist_soap_locked(ts.therapist_id) THEN 'terkunci'

      ELSE 'aktif'
    END AS status

  FROM therapist_slots ts
  JOIN physiotherapists p ON p.id = ts.therapist_id

  WHERE ts.slot_date = p_date
    AND ts.is_available = true
    AND p.is_active = true
    AND (p_clinic_id IS NULL OR p.clinic_id = p_clinic_id)

  ORDER BY ts.therapist_id, ts.slot_start_time;
END;
$function$;
