-- Jenis izin baru "Kegiatan Organisasi" pada pengajuan izin terapis.
-- Jenis ini tidak wajib menyertakan jadwal pengganti (ditentukan peninjau);
-- jenis lain tetap wajib minimal 1 hari pengganti.
-- Saat disetujui, catatan di therapist_time_off memakai leave_type 'other'
-- dengan alasan "Kegiatan Organisasi - <catatan>" sehingga constraint dan
-- laporan yang sudah ada tidak berubah.

ALTER TABLE public.therapist_leave_requests
  DROP CONSTRAINT IF EXISTS therapist_leave_requests_leave_type_check;
ALTER TABLE public.therapist_leave_requests
  ADD CONSTRAINT therapist_leave_requests_leave_type_check
  CHECK (leave_type IN ('annual', 'sick', 'training', 'personal', 'organization', 'other'));

ALTER TABLE public.therapist_leave_requests
  DROP CONSTRAINT IF EXISTS leave_request_needs_replacement;
ALTER TABLE public.therapist_leave_requests
  ADD CONSTRAINT leave_request_needs_replacement CHECK (
    jsonb_typeof(replacement_shifts) = 'array'
    AND (leave_type = 'organization' OR jsonb_array_length(replacement_shifts) >= 1)
  );

CREATE OR REPLACE FUNCTION public.review_therapist_leave_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.therapist_leave_requests%ROWTYPE;
  v_role text := get_my_role();
  v_time_off_id uuid;
  v_reviewer_name text;
  v_label text;
  v_shift jsonb;
  v_capacity integer;
  v_slot_minutes integer;
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

    INSERT INTO public.therapist_time_off
      (therapist_id, start_date, end_date, start_time, end_time, reason, leave_type, created_by)
    VALUES
      (v_req.therapist_id, v_req.leave_date, v_req.leave_date, v_req.start_time, v_req.end_time,
       CASE WHEN COALESCE(btrim(v_req.notes), '') = '' THEN v_label ELSE v_label || ' - ' || btrim(v_req.notes) END,
       CASE WHEN v_req.leave_type = 'organization' THEN 'other' ELSE v_req.leave_type END,
       auth.uid())
    RETURNING id INTO v_time_off_id;
  END IF;

  UPDATE public.therapist_leave_requests
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        reviewed_by = auth.uid(),
        reviewed_by_name = v_reviewer_name,
        reviewed_at = now(),
        review_note = NULLIF(btrim(COALESCE(p_note, '')), ''),
        time_off_id = v_time_off_id
    WHERE id = p_request_id;
END;
$$;
