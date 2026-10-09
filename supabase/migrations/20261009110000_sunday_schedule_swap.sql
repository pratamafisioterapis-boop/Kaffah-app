-- Tukar jadwal hari Minggu antar terapis (klinik dengan therapist_leave_request_enabled).
-- Alur: terapis A (jadwal masuk Minggu itu) memilih terapis B (libur Minggu itu)
--   1) B wajib menerima / menolak (status pending_substitute -> pending_owner / rejected)
--   2) Owner menyetujui / menolak (pending_owner -> approved / rejected)
-- Saat disetujui: A mendapat libur seharian di tanggal itu, B mendapat jam kerja
-- tambahan (therapist_extra_shifts) sebesar jam kerja A; slot booking dibuat ulang otomatis.

CREATE TABLE IF NOT EXISTS public.therapist_sunday_swap_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL DEFAULT public.get_my_clinic_id() REFERENCES public.clinics(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.physiotherapists(id) ON DELETE CASCADE,
  therapist_name text,
  substitute_id uuid NOT NULL REFERENCES public.physiotherapists(id) ON DELETE CASCADE,
  substitute_name text,
  substitute_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  swap_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending_substitute'
    CHECK (status IN ('pending_substitute', 'pending_owner', 'approved', 'rejected')),
  rejected_by text CHECK (rejected_by IN ('substitute', 'owner')),
  requested_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  substitute_responded_at timestamptz,
  substitute_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_name text,
  review_note text,
  reviewed_at timestamptz,
  time_off_id uuid REFERENCES public.therapist_time_off(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sunday_swap_is_sunday CHECK (EXTRACT(DOW FROM swap_date) = 0),
  CONSTRAINT sunday_swap_time_range CHECK (end_time > start_time),
  CONSTRAINT sunday_swap_different CHECK (therapist_id <> substitute_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS sunday_swap_one_active_per_day
  ON public.therapist_sunday_swap_requests (therapist_id, swap_date)
  WHERE status IN ('pending_substitute', 'pending_owner', 'approved');
CREATE INDEX IF NOT EXISTS sunday_swap_clinic_status
  ON public.therapist_sunday_swap_requests (clinic_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS sunday_swap_substitute
  ON public.therapist_sunday_swap_requests (substitute_user_id, status);

-- extra shift hasil tukar jadwal ikut terhapus bila request dihapus
ALTER TABLE public.therapist_extra_shifts
  ADD COLUMN IF NOT EXISTS sunday_swap_id uuid REFERENCES public.therapist_sunday_swap_requests(id) ON DELETE CASCADE;

ALTER TABLE public.therapist_sunday_swap_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sunday_swap_select" ON public.therapist_sunday_swap_requests;
CREATE POLICY "sunday_swap_select" ON public.therapist_sunday_swap_requests
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'super_admin'
    OR requested_by = auth.uid()
    OR substitute_user_id = auth.uid()
    OR (clinic_id = get_my_clinic_id() AND get_my_role() = 'owner')
  );

DROP POLICY IF EXISTS "sunday_swap_delete_own_pending" ON public.therapist_sunday_swap_requests;
CREATE POLICY "sunday_swap_delete_own_pending" ON public.therapist_sunday_swap_requests
  FOR DELETE TO authenticated
  USING (requested_by = auth.uid() AND status IN ('pending_substitute', 'pending_owner'));
-- Tanpa policy INSERT/UPDATE: lewat RPC di bawah.

-- Apakah terapis libur (tidak bertugas) di tanggal itu?
CREATE OR REPLACE FUNCTION public.therapist_is_off_on(p_therapist_id uuid, p_date date)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    NOT EXISTS (
      SELECT 1 FROM public.therapist_time_off tto
      WHERE tto.therapist_id = p_therapist_id
        AND tto.leave_type <> 'weekly_off'
        AND p_date BETWEEN tto.start_date AND tto.end_date
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.therapist_time_off tto
        WHERE tto.therapist_id = p_therapist_id
          AND tto.leave_type = 'weekly_off'
          AND tto.start_time IS NULL
          AND p_date BETWEEN tto.start_date AND tto.end_date
      )
      OR NOT EXISTS (
        SELECT 1 FROM public.therapist_schedules s
        WHERE s.therapist_id = p_therapist_id AND s.is_active
          AND s.day_of_week = EXTRACT(DOW FROM p_date)::int
      )
    );
$$;
REVOKE ALL ON FUNCTION public.therapist_is_off_on(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.therapist_is_off_on(uuid, date) TO authenticated;

-- Calon pengganti: rekan satu klinik yang libur di tanggal itu.
CREATE OR REPLACE FUNCTION public.sunday_swap_candidates(p_date date)
RETURNS TABLE (id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.name
  FROM public.physiotherapists p
  WHERE p.clinic_id = get_my_clinic_id()
    AND p.is_active IS NOT FALSE
    AND p.user_id IS NOT NULL
    AND p.user_id <> auth.uid()
    AND public.therapist_is_off_on(p.id, p_date)
    AND NOT EXISTS (
      SELECT 1 FROM public.therapist_sunday_swap_requests r
      WHERE r.substitute_id = p.id AND r.swap_date = p_date
        AND r.status IN ('pending_substitute', 'pending_owner', 'approved')
    )
  ORDER BY p.name;
$$;
REVOKE ALL ON FUNCTION public.sunday_swap_candidates(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sunday_swap_candidates(date) TO authenticated;

-- Terapis A mengajukan tukar jadwal.
CREATE OR REPLACE FUNCTION public.create_sunday_swap_request(
  p_substitute_id uuid,
  p_date date,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me public.physiotherapists%ROWTYPE;
  v_sub public.physiotherapists%ROWTYPE;
  v_id uuid;
BEGIN
  SELECT * INTO v_me FROM public.physiotherapists WHERE user_id = auth.uid() LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Akun Anda bukan terapis'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = v_me.clinic_id AND c.therapist_leave_request_enabled) THEN
    RAISE EXCEPTION 'Fitur tukar jadwal tidak aktif di klinik ini';
  END IF;
  IF EXTRACT(DOW FROM p_date) <> 0 THEN RAISE EXCEPTION 'Tukar jadwal hanya untuk hari Minggu'; END IF;
  IF p_date < current_date THEN RAISE EXCEPTION 'Tanggal sudah lewat'; END IF;
  IF v_me.work_start_time IS NULL OR v_me.work_end_time IS NULL THEN
    RAISE EXCEPTION 'Jam kerja Anda belum diatur, hubungi owner';
  END IF;
  IF public.therapist_is_off_on(v_me.id, p_date) THEN
    RAISE EXCEPTION 'Anda tidak punya jadwal masuk di tanggal itu';
  END IF;

  SELECT * INTO v_sub FROM public.physiotherapists WHERE id = p_substitute_id;
  IF NOT FOUND OR v_sub.clinic_id <> v_me.clinic_id OR v_sub.user_id IS NULL OR v_sub.is_active IS FALSE THEN
    RAISE EXCEPTION 'Terapis pengganti tidak valid';
  END IF;
  IF NOT public.therapist_is_off_on(v_sub.id, p_date) THEN
    RAISE EXCEPTION 'Terapis pengganti tidak libur di tanggal itu';
  END IF;

  INSERT INTO public.therapist_sunday_swap_requests
    (clinic_id, therapist_id, therapist_name, substitute_id, substitute_name, substitute_user_id,
     swap_date, start_time, end_time, notes, requested_by)
  VALUES
    (v_me.clinic_id, v_me.id, v_me.name, v_sub.id, v_sub.name, v_sub.user_id,
     p_date, v_me.work_start_time, v_me.work_end_time, NULLIF(btrim(COALESCE(p_notes, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_sunday_swap_request(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sunday_swap_request(uuid, date, text) TO authenticated;

-- Terapis pengganti menerima / menolak.
CREATE OR REPLACE FUNCTION public.respond_sunday_swap_request(
  p_request_id uuid,
  p_accept boolean,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.therapist_sunday_swap_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.therapist_sunday_swap_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pengajuan tidak ditemukan'; END IF;
  IF v_req.substitute_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Hanya terapis pengganti yang bisa menjawab permintaan ini';
  END IF;
  IF v_req.status <> 'pending_substitute' THEN RAISE EXCEPTION 'Permintaan sudah dijawab'; END IF;
  IF p_accept AND v_req.swap_date < current_date THEN RAISE EXCEPTION 'Tanggal sudah lewat'; END IF;
  IF p_accept AND NOT public.therapist_is_off_on(v_req.substitute_id, v_req.swap_date) THEN
    RAISE EXCEPTION 'Anda tidak lagi libur di tanggal itu';
  END IF;

  UPDATE public.therapist_sunday_swap_requests
    SET status = CASE WHEN p_accept THEN 'pending_owner' ELSE 'rejected' END,
        rejected_by = CASE WHEN p_accept THEN NULL ELSE 'substitute' END,
        substitute_responded_at = now(),
        substitute_note = NULLIF(btrim(COALESCE(p_note, '')), '')
    WHERE id = p_request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.respond_sunday_swap_request(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_sunday_swap_request(uuid, boolean, text) TO authenticated;

-- Owner menyetujui / menolak (setelah terapis pengganti setuju).
CREATE OR REPLACE FUNCTION public.review_sunday_swap_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.therapist_sunday_swap_requests%ROWTYPE;
  v_role text := get_my_role();
  v_reviewer_name text;
  v_capacity integer;
  v_time_off_id uuid;
BEGIN
  SELECT * INTO v_req FROM public.therapist_sunday_swap_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pengajuan tidak ditemukan'; END IF;
  IF NOT (v_role = 'super_admin' OR (v_role = 'owner' AND v_req.clinic_id = get_my_clinic_id())) THEN
    RAISE EXCEPTION 'Hanya owner yang bisa meninjau tukar jadwal';
  END IF;
  IF v_req.status <> 'pending_owner' THEN
    RAISE EXCEPTION 'Pengajuan belum disetujui terapis pengganti atau sudah ditinjau';
  END IF;

  SELECT COALESCE(
           (SELECT u.full_name FROM public.users u WHERE u.id = auth.uid()),
           'Owner')
    INTO v_reviewer_name;

  IF p_approve THEN
    IF v_req.swap_date < current_date THEN RAISE EXCEPTION 'Tanggal tukar jadwal sudah lewat'; END IF;
    IF NOT public.therapist_is_off_on(v_req.substitute_id, v_req.swap_date) THEN
      RAISE EXCEPTION 'Terapis pengganti sudah tidak libur di tanggal itu';
    END IF;

    SELECT COALESCE(MAX(capacity), 1) INTO v_capacity
      FROM public.therapist_schedules WHERE therapist_id = v_req.therapist_id AND is_active;

    INSERT INTO public.therapist_extra_shifts
      (therapist_id, shift_date, start_time, end_time, capacity, slot_duration_minutes, sunday_swap_id)
    VALUES
      (v_req.substitute_id, v_req.swap_date, v_req.start_time, v_req.end_time, v_capacity,
       public.habitual_slot_minutes(v_req.substitute_id), v_req.id);

    INSERT INTO public.therapist_time_off
      (therapist_id, start_date, end_date, start_time, end_time, reason, leave_type, created_by)
    VALUES
      (v_req.therapist_id, v_req.swap_date, v_req.swap_date, NULL, NULL,
       'Tukar jadwal Minggu dengan ' || COALESCE(v_req.substitute_name, 'rekan'), 'other', auth.uid())
    RETURNING id INTO v_time_off_id;
  END IF;

  UPDATE public.therapist_sunday_swap_requests
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        rejected_by = CASE WHEN p_approve THEN NULL ELSE 'owner' END,
        reviewed_by = auth.uid(),
        reviewed_by_name = v_reviewer_name,
        reviewed_at = now(),
        review_note = NULLIF(btrim(COALESCE(p_note, '')), ''),
        time_off_id = v_time_off_id
    WHERE id = p_request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.review_sunday_swap_request(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_sunday_swap_request(uuid, boolean, text) TO authenticated;

-- Push notifikasi
--   insert                       -> terapis pengganti (wajib acc)
--   pending_substitute->pending_owner -> owner (+ pemohon diberi kabar)
--   ditolak pengganti            -> pemohon
--   keputusan owner              -> pemohon + pengganti
CREATE OR REPLACE FUNCTION public.notify_sunday_swap_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner RECORD;
  v_date text := to_char(NEW.swap_date, 'DD-MM-YYYY');
  v_who text := COALESCE(NULLIF(NEW.therapist_name, ''), 'Terapis');
  v_sub text := COALESCE(NULLIF(NEW.substitute_name, ''), 'rekan');
  v_url text := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-push-notification';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.substitute_user_id IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(url := v_url, headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'user_id', NEW.substitute_user_id,
            'title', '🔄 Permintaan Tukar Jadwal',
            'body', v_who || ' meminta Anda menggantikan jadwal masuk hari Minggu ' || v_date
              || ' (' || to_char(NEW.start_time, 'HH24:MI') || '–' || to_char(NEW.end_time, 'HH24:MI') || '). Mohon konfirmasi.',
            'url', '/therapist/leave?tab=sunday'));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'pending_owner' THEN
      FOR v_owner IN SELECT u.id FROM public.users u WHERE u.role = 'owner' AND u.clinic_id = NEW.clinic_id LOOP
        BEGIN
          PERFORM net.http_post(url := v_url, headers := '{"Content-Type": "application/json"}'::jsonb,
            body := jsonb_build_object(
              'user_id', v_owner.id,
              'title', '🔄 Pengajuan Tukar Jadwal',
              'body', v_who || ' tukar jadwal Minggu ' || v_date || ' dengan ' || v_sub
                || ' (sudah disetujui ' || v_sub || '). Menunggu persetujuan Anda.',
              'url', '/owner/physiotherapist-management?tab=timeoff'));
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END LOOP;
      BEGIN
        PERFORM net.http_post(url := v_url, headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'user_id', NEW.requested_by,
            'title', '👍 ' || v_sub || ' Bersedia Menggantikan',
            'body', v_sub || ' menerima tukar jadwal Minggu ' || v_date || '. Menunggu persetujuan owner.',
            'url', '/therapist/leave?tab=sunday'));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    ELSIF NEW.status = 'rejected' AND NEW.rejected_by = 'substitute' THEN
      BEGIN
        PERFORM net.http_post(url := v_url, headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'user_id', NEW.requested_by,
            'title', '❌ Tukar Jadwal Ditolak ' || v_sub,
            'body', v_sub || ' tidak bisa menggantikan Minggu ' || v_date || '.'
              || CASE WHEN NEW.substitute_note IS NOT NULL THEN ' Catatan: ' || NEW.substitute_note ELSE '' END
              || ' Silakan pilih terapis lain.',
            'url', '/therapist/leave?tab=sunday'));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    ELSIF NEW.status IN ('approved', 'rejected') THEN
      BEGIN
        PERFORM net.http_post(url := v_url, headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'user_id', NEW.requested_by,
            'title', CASE WHEN NEW.status = 'approved' THEN '✅ Tukar Jadwal Disetujui' ELSE '❌ Tukar Jadwal Ditolak Owner' END,
            'body', 'Tukar jadwal Minggu ' || v_date || ' dengan ' || v_sub
              || CASE WHEN NEW.status = 'approved' THEN ' disetujui. Anda libur di tanggal itu.' ELSE ' ditolak.' END
              || CASE WHEN NEW.review_note IS NOT NULL THEN ' Catatan: ' || NEW.review_note ELSE '' END,
            'url', '/therapist/leave?tab=sunday'));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
      IF NEW.substitute_user_id IS NOT NULL THEN
        BEGIN
          PERFORM net.http_post(url := v_url, headers := '{"Content-Type": "application/json"}'::jsonb,
            body := jsonb_build_object(
              'user_id', NEW.substitute_user_id,
              'title', CASE WHEN NEW.status = 'approved' THEN '✅ Jadwal Minggu Anda Dikonfirmasi' ELSE 'ℹ️ Tukar Jadwal Dibatalkan' END,
              'body', CASE WHEN NEW.status = 'approved'
                THEN 'Anda bertugas menggantikan ' || v_who || ' pada Minggu ' || v_date
                  || ' (' || to_char(NEW.start_time, 'HH24:MI') || '–' || to_char(NEW.end_time, 'HH24:MI') || ').'
                ELSE 'Owner menolak tukar jadwal Minggu ' || v_date || '. Anda tetap libur.' END,
              'url', '/therapist/leave?tab=sunday'));
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_sunday_swap_request ON public.therapist_sunday_swap_requests;
CREATE TRIGGER trg_notify_sunday_swap_request
  AFTER INSERT OR UPDATE OF status ON public.therapist_sunday_swap_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_sunday_swap_request();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'therapist_sunday_swap_requests'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.therapist_sunday_swap_requests;
  END IF;
END $$;
