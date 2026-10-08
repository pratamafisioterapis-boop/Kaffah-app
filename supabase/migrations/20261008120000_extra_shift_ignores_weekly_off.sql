-- Klinik mencatat hari libur mingguan terapis sebagai therapist_time_off bertipe
-- 'weekly_off' (jadwal mingguan tetap aktif di semua hari). Hari libur itu justru
-- hari yang wajar dipakai untuk mengganti jam kerja, jadi slot pengganti
-- (therapist_extra_shifts) tidak boleh ikut tertutup oleh cuti 'weekly_off'.
-- Cuti lain (sakit, cuti tahunan, izin, dll.) tetap menutup slot pengganti.

CREATE OR REPLACE FUNCTION public.time_off_blocks_extra_slot(p_therapist_id uuid, p_date date, p_slot_start time, p_slot_end time)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM therapist_time_off tto
    WHERE tto.therapist_id = p_therapist_id
      AND tto.leave_type <> 'weekly_off'
      AND p_date BETWEEN tto.start_date AND tto.end_date
      AND (
        tto.start_time IS NULL OR tto.end_time IS NULL
        OR (p_slot_start < tto.end_time AND p_slot_end > tto.start_time)
      )
  );
$fn$;
REVOKE EXECUTE ON FUNCTION public.time_off_blocks_extra_slot(uuid, date, time, time) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.time_off_blocks_extra_slot(uuid, date, time, time) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.generate_extra_shift_slots(p_date date, p_therapist_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_shift record;
  v_cursor time;
  v_slot_end time;
  v_dur interval;
BEGIN
  FOR v_shift IN
    SELECT e.* FROM therapist_extra_shifts e
    JOIN physiotherapists p ON p.id = e.therapist_id
    WHERE e.therapist_id = p_therapist_id AND e.shift_date = p_date AND p.is_active = true
  LOOP
    v_dur := (v_shift.slot_duration_minutes || ' minutes')::interval;
    v_cursor := v_shift.start_time;
    WHILE v_cursor + v_dur <= v_shift.end_time LOOP
      v_slot_end := v_cursor + v_dur;
      INSERT INTO therapist_slots (therapist_id, slot_date, slot_start_time, slot_end_time, duration_minutes, capacity)
      SELECT p_therapist_id, p_date, v_cursor, v_slot_end, v_shift.slot_duration_minutes, v_shift.capacity
      WHERE NOT public.time_off_blocks_extra_slot(p_therapist_id, p_date, v_cursor, v_slot_end)
        AND NOT EXISTS (
          SELECT 1 FROM therapist_slots s
          WHERE s.therapist_id = p_therapist_id AND s.slot_date = p_date
            AND s.slot_start_time < v_slot_end AND s.slot_end_time > v_cursor
        );
      v_cursor := v_slot_end;
    END LOOP;
  END LOOP;
END;
$fn$;

-- Status slot: slot pengganti di hari libur mingguan tampil 'aktif', bukan 'cuti'.
CREATE OR REPLACE FUNCTION public.get_available_slots_with_status_by_date(p_date date, p_clinic_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(therapist_id uuid, slot_start time without time zone, slot_end time without time zone, duration_minutes integer, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
BEGIN
  RETURN QUERY
  SELECT
    ts.therapist_id,
    ts.slot_start_time AS slot_start,
    ts.slot_end_time AS slot_end,
    ts.duration_minutes,

    CASE
      WHEN public.time_off_blocks_slot(ts.therapist_id, p_date, ts.slot_start_time, ts.slot_end_time)
        AND NOT (
          EXISTS (
            SELECT 1 FROM therapist_extra_shifts es
            WHERE es.therapist_id = ts.therapist_id AND es.shift_date = p_date
              AND es.start_time <= ts.slot_start_time AND es.end_time >= ts.slot_end_time
          )
          AND NOT public.time_off_blocks_extra_slot(ts.therapist_id, p_date, ts.slot_start_time, ts.slot_end_time)
        )
      THEN 'cuti'

      WHEN (
        SELECT COUNT(*)
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
      ) >= COALESCE(ts.capacity, 1) THEN 'terisi'

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
$fn$;
