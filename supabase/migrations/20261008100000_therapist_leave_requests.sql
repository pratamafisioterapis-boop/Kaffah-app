-- Pengajuan izin oleh terapis (seharian / jam tertentu) yang harus disetujui
-- owner atau terapis kepala. Saat mengajukan, terapis WAJIB menyertakan
-- jadwal pengganti (tanggal + rentang jam kerja pengganti).
--
-- 1) clinics.therapist_leave_request_enabled: fitur per klinik (default mati,
--    otomatis aktif untuk klinik bernama "Kaffah"). Super Admin dapat mengubahnya.
-- 2) therapist_leave_requests: antrean pengajuan. Baris therapist_time_off baru
--    dibuat setelah disetujui lewat RPC review_therapist_leave_request.
--    Jadwal pengganti disimpan di replacement_shifts; slot booking diubah saat
--    persetujuan oleh migrasi 20261008110000 (versi akhir RPC ada di sana).

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS therapist_leave_request_enabled boolean NOT NULL DEFAULT false;

UPDATE public.clinics SET therapist_leave_request_enabled = true WHERE name ILIKE '%kaffah%';

CREATE TABLE IF NOT EXISTS public.therapist_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL DEFAULT public.get_my_clinic_id() REFERENCES public.clinics(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.physiotherapists(id) ON DELETE CASCADE,
  therapist_name text,
  leave_date date NOT NULL,
  is_partial boolean NOT NULL DEFAULT false,
  start_time time,
  end_time time,
  leave_type text NOT NULL DEFAULT 'personal'
    CHECK (leave_type IN ('annual', 'sick', 'training', 'personal', 'other')),
  notes text,
  -- [{ "date": "2026-10-14", "start_time": "09:00", "end_time": "12:00" }, ...]
  replacement_shifts jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_name text,
  review_note text,
  reviewed_at timestamptz,
  time_off_id uuid REFERENCES public.therapist_time_off(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_request_partial_times CHECK (
    (is_partial = false AND start_time IS NULL AND end_time IS NULL)
    OR (is_partial = true AND start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  ),
  CONSTRAINT leave_request_needs_replacement CHECK (
    jsonb_typeof(replacement_shifts) = 'array' AND jsonb_array_length(replacement_shifts) >= 1
  )
);

CREATE INDEX IF NOT EXISTS therapist_leave_requests_clinic_status
  ON public.therapist_leave_requests (clinic_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS therapist_leave_requests_therapist
  ON public.therapist_leave_requests (therapist_id, leave_date DESC);

ALTER TABLE public.therapist_leave_requests ENABLE ROW LEVEL SECURITY;

-- Terapis kepala di klinik yang sama (user saat ini).
CREATE OR REPLACE FUNCTION public.is_my_clinic_head_therapist(p_clinic_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.physiotherapists p
    WHERE p.user_id = auth.uid()
      AND p.is_head_therapist
      AND p.is_active IS NOT FALSE
      AND p.clinic_id = p_clinic_id
  );
$$;
REVOKE ALL ON FUNCTION public.is_my_clinic_head_therapist(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_my_clinic_head_therapist(uuid) TO authenticated;

DROP POLICY IF EXISTS "leave_requests_select" ON public.therapist_leave_requests;
CREATE POLICY "leave_requests_select" ON public.therapist_leave_requests
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'super_admin'
    OR requested_by = auth.uid()
    OR (clinic_id = get_my_clinic_id() AND get_my_role() = 'owner')
    OR public.is_my_clinic_head_therapist(clinic_id)
  );

DROP POLICY IF EXISTS "leave_requests_insert" ON public.therapist_leave_requests;
CREATE POLICY "leave_requests_insert" ON public.therapist_leave_requests
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

-- Terapis boleh membatalkan pengajuannya selama masih pending.
DROP POLICY IF EXISTS "leave_requests_delete_own_pending" ON public.therapist_leave_requests;
CREATE POLICY "leave_requests_delete_own_pending" ON public.therapist_leave_requests
  FOR DELETE TO authenticated
  USING (requested_by = auth.uid() AND status = 'pending');

-- Owner / super admin / terapis kepala (klinik yang sama) menyetujui atau menolak.
-- Terapis kepala tidak boleh menyetujui pengajuannya sendiri.
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
      ELSE 'Lainnya'
    END;
    INSERT INTO public.therapist_time_off
      (therapist_id, start_date, end_date, start_time, end_time, reason, leave_type, created_by)
    VALUES
      (v_req.therapist_id, v_req.leave_date, v_req.leave_date, v_req.start_time, v_req.end_time,
       CASE WHEN COALESCE(btrim(v_req.notes), '') = '' THEN v_label ELSE v_label || ' - ' || btrim(v_req.notes) END,
       v_req.leave_type, auth.uid())
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

REVOKE ALL ON FUNCTION public.review_therapist_leave_request(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_therapist_leave_request(uuid, boolean, text) TO authenticated;

-- Jika izin yang sudah disetujui dibatalkan lewat penghapusan time_off oleh
-- owner, request tetap tercatat (time_off_id menjadi NULL via ON DELETE SET NULL).

-- Push notifikasi: pengajuan baru -> owner + terapis kepala klinik;
-- keputusan -> terapis pemohon. Gagal kirim tidak membatalkan transaksi.
CREATE OR REPLACE FUNCTION public.notify_leave_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target RECORD;
  v_date text;
  v_who text;
  v_scope text;
BEGIN
  v_date := to_char(NEW.leave_date, 'DD-MM-YYYY');
  v_who := COALESCE(NULLIF(NEW.therapist_name, ''), 'Terapis');
  v_scope := CASE WHEN NEW.is_partial
    THEN 'pukul ' || to_char(NEW.start_time, 'HH24:MI') || '–' || to_char(NEW.end_time, 'HH24:MI')
    ELSE 'seharian' END;

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
            'title', '🗓️ Pengajuan Izin Terapis',
            'body', v_who || ' mengajukan izin ' || v_scope || ' pada ' || v_date || '. Menunggu persetujuan Anda.',
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
          'title', CASE WHEN NEW.status = 'approved' THEN '✅ Izin Disetujui' ELSE '❌ Izin Ditolak' END,
          'body', 'Izin ' || v_scope || ' pada ' || v_date
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

DROP TRIGGER IF EXISTS trg_notify_leave_request ON public.therapist_leave_requests;
CREATE TRIGGER trg_notify_leave_request
  AFTER INSERT OR UPDATE OF status ON public.therapist_leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_leave_request();
