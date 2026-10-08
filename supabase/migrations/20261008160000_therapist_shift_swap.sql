-- Tukar shift terapis pada tanggal yang sama (fitur klinik dengan
-- clinics.therapist_leave_request_enabled, mis. Kaffah).
-- Terapis memilih tanggal + shift tujuan (jam kerja shift ditampilkan di form).
-- Setelah disetujui owner / terapis kepala, jam kerja tanggal itu diganti lewat
-- therapist_schedule_overrides (otomatis mengubah slot booking tanggal tsb).

CREATE TABLE IF NOT EXISTS public.therapist_shift_swap_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL DEFAULT public.get_my_clinic_id() REFERENCES public.clinics(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.physiotherapists(id) ON DELETE CASCADE,
  therapist_name text,
  swap_date date NOT NULL,
  from_shift_name text,
  from_start_time time,
  from_end_time time,
  to_shift_name text,
  to_start_time time NOT NULL,
  to_end_time time NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_name text,
  review_note text,
  reviewed_at timestamptz,
  override_id uuid REFERENCES public.therapist_schedule_overrides(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shift_swap_time_range CHECK (to_end_time > to_start_time)
);

CREATE UNIQUE INDEX IF NOT EXISTS therapist_shift_swap_one_active_per_day
  ON public.therapist_shift_swap_requests (therapist_id, swap_date)
  WHERE status IN ('pending', 'approved');
CREATE INDEX IF NOT EXISTS therapist_shift_swap_clinic_status
  ON public.therapist_shift_swap_requests (clinic_id, status, created_at DESC);

ALTER TABLE public.therapist_shift_swap_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shift_swap_select" ON public.therapist_shift_swap_requests;
CREATE POLICY "shift_swap_select" ON public.therapist_shift_swap_requests
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'super_admin'
    OR requested_by = auth.uid()
    OR (clinic_id = get_my_clinic_id() AND get_my_role() = 'owner')
    OR public.is_my_clinic_head_therapist(clinic_id)
  );

DROP POLICY IF EXISTS "shift_swap_insert" ON public.therapist_shift_swap_requests;
CREATE POLICY "shift_swap_insert" ON public.therapist_shift_swap_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('therapist', 'physiotherapist')
    AND requested_by = auth.uid()
    AND status = 'pending'
    AND clinic_id = get_my_clinic_id()
    AND EXISTS (
      SELECT 1 FROM public.physiotherapists p
      WHERE p.id = therapist_id AND p.user_id = auth.uid() AND p.clinic_id = clinic_id
    )
    AND EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = clinic_id AND c.therapist_leave_request_enabled
    )
  );

DROP POLICY IF EXISTS "shift_swap_delete_own_pending" ON public.therapist_shift_swap_requests;
CREATE POLICY "shift_swap_delete_own_pending" ON public.therapist_shift_swap_requests
  FOR DELETE TO authenticated
  USING (requested_by = auth.uid() AND status = 'pending');

CREATE OR REPLACE FUNCTION public.review_therapist_shift_swap_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.therapist_shift_swap_requests%ROWTYPE;
  v_role text := get_my_role();
  v_reviewer_name text;
  v_capacity integer;
  v_override_id uuid;
BEGIN
  SELECT * INTO v_req FROM public.therapist_shift_swap_requests WHERE id = p_request_id FOR UPDATE;
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
    IF v_req.swap_date < current_date THEN
      RAISE EXCEPTION 'Tanggal tukar shift sudah lewat';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.therapist_time_off tto
      WHERE tto.therapist_id = v_req.therapist_id
        AND tto.leave_type <> 'weekly_off'
        AND v_req.swap_date BETWEEN tto.start_date AND tto.end_date
        AND tto.start_time IS NULL
    ) THEN
      RAISE EXCEPTION 'Terapis sedang izin / cuti seharian di tanggal itu';
    END IF;

    SELECT COALESCE(MAX(capacity), 1) INTO v_capacity
      FROM public.therapist_schedules WHERE therapist_id = v_req.therapist_id AND is_active;

    INSERT INTO public.therapist_schedule_overrides
      (therapist_id, override_date, start_time, end_time, note, capacity, created_by)
    VALUES
      (v_req.therapist_id, v_req.swap_date, v_req.to_start_time, v_req.to_end_time,
       'Tukar shift' || COALESCE(': ' || NULLIF(btrim(v_req.to_shift_name), ''), ''),
       v_capacity, auth.uid())
    ON CONFLICT (therapist_id, override_date) DO UPDATE
      SET start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          note = EXCLUDED.note,
          capacity = EXCLUDED.capacity
    RETURNING id INTO v_override_id;
  END IF;

  UPDATE public.therapist_shift_swap_requests
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        reviewed_by = auth.uid(),
        reviewed_by_name = v_reviewer_name,
        reviewed_at = now(),
        review_note = NULLIF(btrim(COALESCE(p_note, '')), ''),
        override_id = v_override_id
    WHERE id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_therapist_shift_swap_request(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_therapist_shift_swap_request(uuid, boolean, text) TO authenticated;

-- Push notifikasi: pengajuan baru -> owner + terapis kepala; keputusan -> pemohon.
CREATE OR REPLACE FUNCTION public.notify_shift_swap_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target RECORD;
  v_date text := to_char(NEW.swap_date, 'DD-MM-YYYY');
  v_who text := COALESCE(NULLIF(NEW.therapist_name, ''), 'Terapis');
  v_to text := COALESCE(NULLIF(NEW.to_shift_name, ''), 'shift lain')
    || ' (' || to_char(NEW.to_start_time, 'HH24:MI') || '–' || to_char(NEW.to_end_time, 'HH24:MI') || ')';
BEGIN
  IF TG_OP = 'INSERT' THEN
    FOR v_target IN
      SELECT u.id, 'owner'::text AS kind FROM public.users u
        WHERE u.role = 'owner' AND u.clinic_id = NEW.clinic_id
      UNION
      SELECT p.user_id, 'head' FROM public.physiotherapists p
        WHERE p.is_head_therapist AND p.is_active IS NOT FALSE
          AND p.clinic_id = NEW.clinic_id AND p.user_id IS NOT NULL
          AND p.user_id <> NEW.requested_by
    LOOP
      BEGIN
        PERFORM net.http_post(
          url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-push-notification',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'user_id', v_target.id,
            'title', '🔁 Pengajuan Tukar Shift',
            'body', v_who || ' mengajukan tukar shift ke ' || v_to || ' pada ' || v_date || '. Menunggu persetujuan Anda.',
            'url', CASE WHEN v_target.kind = 'owner'
              THEN '/owner/physiotherapist-management?tab=timeoff'
              ELSE '/therapist/leave' END
          )
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-push-notification',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'user_id', NEW.requested_by,
          'title', CASE WHEN NEW.status = 'approved' THEN '✅ Tukar Shift Disetujui' ELSE '❌ Tukar Shift Ditolak' END,
          'body', 'Tukar shift ke ' || v_to || ' pada ' || v_date
            || CASE WHEN NEW.status = 'approved' THEN ' disetujui.' ELSE ' ditolak.' END
            || CASE WHEN NEW.review_note IS NOT NULL THEN ' Catatan: ' || NEW.review_note ELSE '' END,
          'url', '/therapist/leave'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_shift_swap_request ON public.therapist_shift_swap_requests;
CREATE TRIGGER trg_notify_shift_swap_request
  AFTER INSERT OR UPDATE OF status ON public.therapist_shift_swap_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_shift_swap_request();
