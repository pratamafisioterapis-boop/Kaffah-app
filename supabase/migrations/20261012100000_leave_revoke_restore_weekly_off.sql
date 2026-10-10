-- Pembatalan izin hari Minggu harus mengembalikan libur mingguan (Senin / Selasa) terapis.
--
-- Sebelumnya pengembalian hanya bergantung pada catatan therapist_weekly_off_waivers yang diisi
-- trigger. Bila catatan itu tidak ada, libur tidak kembali padahal kartu menyatakan sudah kembali.
-- Sekarang libur Senin / Selasa yang ada saat izin disetujui juga disimpan (salinan) di
-- pengajuan itu sendiri; saat persetujuan dibatalkan, libur dipulihkan dari catatan waiver
-- ATAU dari salinan ini.

ALTER TABLE public.therapist_leave_requests
  ADD COLUMN IF NOT EXISTS weekly_off_snapshot jsonb;

-- Persetujuan: simpan salinan libur mingguan Senin / Selasa setelah izin Minggu seharian,
-- diambil sebelum trigger aturan Minggu menghapusnya.
CREATE OR REPLACE FUNCTION public.review_therapist_leave_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_req public.therapist_leave_requests%ROWTYPE;
  v_role text := get_my_role();
  v_time_off_id uuid;
  v_reviewer_name text;
  v_label text;
  v_shift jsonb;
  v_capacity integer;
  v_slot_minutes integer;
  v_snapshot jsonb;
BEGIN
  SELECT * INTO v_req FROM public.therapist_leave_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan tidak ditemukan';
  END IF;

  IF v_role = 'super_admin' OR (v_role = 'owner' AND v_req.clinic_id = get_my_clinic_id()) THEN
    NULL;
  ELSIF public.is_my_clinic_head_therapist(v_req.clinic_id) THEN
    IF v_req.requested_by = auth.uid() THEN
      RAISE EXCEPTION 'Pengajuan Anda sendiri harus ditinjau oleh owner';
    END IF;
  ELSE
    RAISE EXCEPTION 'Tidak punya akses untuk meninjau pengajuan ini';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Pengajuan sudah ditinjau';
  END IF;

  SELECT COALESCE(
           (SELECT p.name FROM public.physiotherapists p WHERE p.user_id = auth.uid() LIMIT 1),
           (SELECT u.full_name FROM public.users u WHERE u.id = auth.uid()),
           'Owner')
    INTO v_reviewer_name;

  IF p_approve THEN
    v_label := CASE v_req.leave_type
      WHEN 'annual' THEN 'Cuti'
      WHEN 'sick' THEN 'Sakit'
      WHEN 'training' THEN 'Training'
      WHEN 'personal' THEN 'Izin Pribadi'
      WHEN 'organization' THEN 'Kegiatan Organisasi'
      WHEN 'event' THEN 'Event'
      ELSE 'Lainnya'
    END;

    SELECT COALESCE(MAX(capacity), 1) INTO v_capacity
      FROM public.therapist_schedules WHERE therapist_id = v_req.therapist_id AND is_active;

    v_slot_minutes := public.habitual_slot_minutes(v_req.therapist_id);

    FOR v_shift IN SELECT * FROM jsonb_array_elements(v_req.replacement_shifts) LOOP
      CONTINUE WHEN (v_shift->>'date')::date < current_date;
      INSERT INTO public.therapist_extra_shifts
        (therapist_id, shift_date, start_time, end_time, capacity, slot_duration_minutes, leave_request_id)
      VALUES
        (v_req.therapist_id, (v_shift->>'date')::date, (v_shift->>'start_time')::time,
         (v_shift->>'end_time')::time, v_capacity, v_slot_minutes, v_req.id);
    END LOOP;

    -- Salinan libur mingguan Senin / Selasa setelah izin Minggu seharian (sebelum trigger menghapusnya).
    IF EXTRACT(DOW FROM v_req.leave_date) = 0 AND v_req.start_time IS NULL THEN
      SELECT jsonb_agg(jsonb_build_object(
               'date', tto.start_date, 'reason', tto.reason, 'created_by', tto.created_by)
             ORDER BY tto.start_date)
        INTO v_snapshot
        FROM public.therapist_time_off tto
        WHERE tto.therapist_id = v_req.therapist_id
          AND tto.leave_type = 'weekly_off' AND tto.start_time IS NULL
          AND tto.start_date = tto.end_date
          AND tto.start_date BETWEEN v_req.leave_date + 1 AND v_req.leave_date + 2
          AND tto.start_date >= current_date;
    END IF;

    INSERT INTO public.therapist_time_off
      (therapist_id, start_date, end_date, start_time, end_time, reason, leave_type, created_by)
    VALUES
      (v_req.therapist_id, v_req.leave_date, v_req.leave_date, v_req.start_time, v_req.end_time,
       CASE WHEN COALESCE(btrim(v_req.notes), '') = '' THEN v_label ELSE v_label || ' - ' || btrim(v_req.notes) END,
       CASE WHEN v_req.leave_type IN ('organization', 'event') THEN 'other' ELSE v_req.leave_type END,
       auth.uid())
    RETURNING id INTO v_time_off_id;
  END IF;

  UPDATE public.therapist_leave_requests
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        reviewed_by = auth.uid(),
        reviewed_by_name = v_reviewer_name,
        reviewed_at = now(),
        review_note = NULLIF(btrim(COALESCE(p_note, '')), ''),
        time_off_id = v_time_off_id,
        weekly_off_snapshot = v_snapshot
    WHERE id = p_request_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.review_therapist_leave_request(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_therapist_leave_request(uuid, boolean, text) TO authenticated;

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
