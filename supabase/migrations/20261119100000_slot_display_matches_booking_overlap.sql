-- Slot "kosong" di tampilan booking admin harus sama dengan aturan booking
-- (check_slot_availability): appointment aktif yang waktunya tumpang tindih dengan
-- slot membuat slot itu 'terisi'. Sebelumnya overlap diabaikan jika ada slot lain
-- yang dimulai tepat di jam appointment (mis. appointment 14:30 selama 90 menit
-- tidak memblokir slot 15:30-17:00), sehingga slot tampil kosong tetapi booking
-- ditolak "Slot sudah di-booking atau bentrok".
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
          AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time < ts.slot_end_time
          AND (
            (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time
            + (a.duration_minutes || ' minutes')::interval
          ) > ts.slot_start_time
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
