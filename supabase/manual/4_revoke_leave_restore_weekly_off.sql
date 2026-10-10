-- Bagian migrasi 20261012100000_leave_revoke_restore_weekly_off.sql yang BELUM terpasang di database
-- (kolom weekly_off_snapshot dan fungsi review_therapist_leave_request sudah terpasang).
-- Fungsi ini berisi statement DELETE, jadi tool otomatis membatalkannya: jalankan di SQL Editor
-- dashboard Supabase.

-- Pembatalan: libur izin dihapus (trigger memulihkan dari catatan waiver), lalu libur dari
-- salinan dipulihkan bila belum kembali. Mengembalikan jumlah booking aktif di tanggal pengganti.
CREATE OR REPLACE FUNCTION public.revoke_therapist_leave_request(
  p_request_id uuid,
  p_note text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_req public.therapist_leave_requests%ROWTYPE;
  v_role text := get_my_role();
  v_name text;
  v_booked integer := 0;
  v_off jsonb;
  v_date date;
BEGIN
  SELECT * INTO v_req FROM public.therapist_leave_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan tidak ditemukan';
  END IF;

  IF v_role = 'super_admin' OR (v_role = 'owner' AND v_req.clinic_id = get_my_clinic_id()) THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Hanya owner yang dapat membatalkan izin yang sudah disetujui';
  END IF;

  IF v_req.status <> 'approved' THEN
    RAISE EXCEPTION 'Hanya izin yang berstatus disetujui yang dapat dibatalkan';
  END IF;

  SELECT COALESCE(
           (SELECT u.full_name FROM public.users u WHERE u.id = auth.uid()),
           'Owner')
    INTO v_name;

  -- Booking aktif yang masih menempel di jadwal pengganti (dihitung sebelum dihapus).
  SELECT COUNT(*) INTO v_booked
    FROM public.appointments a
    JOIN public.therapist_extra_shifts e
      ON e.leave_request_id = v_req.id
     AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::date = e.shift_date
     AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time >= e.start_time
     AND (a.appointment_date AT TIME ZONE 'Asia/Makassar')::time < e.end_time
   WHERE a.therapist_id = v_req.therapist_id
     AND a.status IN ('confirmed', 'pending', 'scheduled', 'rescheduled');

  -- Jadwal masuk pengganti dulu (trigger membuat ulang slot tiap tanggal), lalu libur.
  DELETE FROM public.therapist_extra_shifts WHERE leave_request_id = v_req.id;

  IF v_req.time_off_id IS NOT NULL THEN
    DELETE FROM public.therapist_time_off WHERE id = v_req.time_off_id;
  END IF;

  -- Libur Senin / Selasa yang dibatalkan saat izin Minggu disetujui: pulihkan dari salinan
  -- bila trigger belum memulihkannya (catatan waiver tidak ada).
  IF v_req.weekly_off_snapshot IS NOT NULL THEN
    FOR v_off IN SELECT * FROM jsonb_array_elements(v_req.weekly_off_snapshot) LOOP
      v_date := (v_off->>'date')::date;
      CONTINUE WHEN v_date < current_date;
      IF NOT EXISTS (
        SELECT 1 FROM public.therapist_time_off tto
        WHERE tto.therapist_id = v_req.therapist_id
          AND tto.leave_type = 'weekly_off' AND tto.start_time IS NULL
          AND v_date BETWEEN tto.start_date AND tto.end_date
      ) THEN
        INSERT INTO public.therapist_time_off
          (therapist_id, start_date, end_date, start_time, end_time, reason, leave_type, created_by)
        VALUES
          (v_req.therapist_id, v_date, v_date, NULL, NULL,
           COALESCE(NULLIF(v_off->>'reason', ''), 'Libur'), 'weekly_off',
           NULLIF(v_off->>'created_by', '')::uuid);
      END IF;
      DELETE FROM public.therapist_weekly_off_waivers
        WHERE therapist_id = v_req.therapist_id AND off_date = v_date;
    END LOOP;
  END IF;

  UPDATE public.therapist_leave_requests
    SET status = 'rejected',
        revoked_at = now(),
        revoked_by = auth.uid(),
        revoked_by_name = v_name,
        revoke_note = NULLIF(btrim(COALESCE(p_note, '')), ''),
        time_off_id = NULL
    WHERE id = p_request_id;

  RETURN v_booked;
END;
$fn$;

REVOKE ALL ON FUNCTION public.revoke_therapist_leave_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_therapist_leave_request(uuid, text) TO authenticated;
