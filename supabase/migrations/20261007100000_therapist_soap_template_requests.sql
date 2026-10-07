-- Terapis boleh mengajukan perubahan template SOAP (Subjective / Objective)
-- per diagnosa, lalu owner yang menyetujui.
--
-- 1) clinics.therapist_soap_template_edit_enabled: fitur harus diaktifkan dulu
--    oleh Super Admin untuk klinik tertentu (default mati).
-- 2) soap_template_change_requests: antrean pengajuan. Template asli
--    (operational_options.subjective_template / objective_template) baru
--    berubah setelah owner menyetujui lewat RPC review_soap_template_request.

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS therapist_soap_template_edit_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.soap_template_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL DEFAULT public.get_my_clinic_id() REFERENCES public.clinics(id) ON DELETE CASCADE,
  diagnosis_id uuid NOT NULL REFERENCES public.operational_options(id) ON DELETE CASCADE,
  field text NOT NULL CHECK (field IN ('subjective_template', 'objective_template')),
  proposed_template text,
  previous_template text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by_name text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

-- Satu pengajuan pending per terapis per diagnosa+bagian (pengajuan baru menimpa).
CREATE UNIQUE INDEX IF NOT EXISTS soap_template_requests_one_pending
  ON public.soap_template_change_requests (requested_by, diagnosis_id, field)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS soap_template_requests_clinic_status
  ON public.soap_template_change_requests (clinic_id, status, created_at DESC);

ALTER TABLE public.soap_template_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "soap_template_requests_select" ON public.soap_template_change_requests;
CREATE POLICY "soap_template_requests_select" ON public.soap_template_change_requests
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'super_admin'
    OR requested_by = auth.uid()
    OR (clinic_id = get_my_clinic_id() AND get_my_role() = 'owner')
  );

DROP POLICY IF EXISTS "soap_template_requests_insert" ON public.soap_template_change_requests;
CREATE POLICY "soap_template_requests_insert" ON public.soap_template_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('therapist', 'physiotherapist')
    AND requested_by = auth.uid()
    AND status = 'pending'
    AND clinic_id = get_my_clinic_id()
    AND EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = clinic_id AND c.therapist_soap_template_edit_enabled
    )
    AND EXISTS (
      SELECT 1 FROM public.operational_options o
      WHERE o.id = diagnosis_id AND o.clinic_id = clinic_id AND o.category = 'diagnosa'
    )
  );

-- Terapis boleh merevisi / membatalkan pengajuannya selama masih pending.
DROP POLICY IF EXISTS "soap_template_requests_update_own_pending" ON public.soap_template_change_requests;
CREATE POLICY "soap_template_requests_update_own_pending" ON public.soap_template_change_requests
  FOR UPDATE TO authenticated
  USING (requested_by = auth.uid() AND status = 'pending')
  WITH CHECK (
    requested_by = auth.uid()
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = clinic_id AND c.therapist_soap_template_edit_enabled
    )
  );

DROP POLICY IF EXISTS "soap_template_requests_delete_own_pending" ON public.soap_template_change_requests;
CREATE POLICY "soap_template_requests_delete_own_pending" ON public.soap_template_change_requests
  FOR DELETE TO authenticated
  USING (requested_by = auth.uid() AND status = 'pending');

-- Owner (klinik yang sama) atau super admin menyetujui / menolak pengajuan.
CREATE OR REPLACE FUNCTION public.review_soap_template_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.soap_template_change_requests%ROWTYPE;
  v_role text := get_my_role();
BEGIN
  SELECT * INTO v_req FROM public.soap_template_change_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan tidak ditemukan';
  END IF;
  IF v_role IS DISTINCT FROM 'super_admin'
     AND NOT (v_role = 'owner' AND v_req.clinic_id = get_my_clinic_id()) THEN
    RAISE EXCEPTION 'Tidak punya akses untuk meninjau pengajuan ini';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Pengajuan sudah ditinjau';
  END IF;

  IF p_approve THEN
    IF v_req.field = 'objective_template' THEN
      UPDATE public.operational_options
        SET objective_template = NULLIF(btrim(COALESCE(v_req.proposed_template, '')), '')
        WHERE id = v_req.diagnosis_id AND clinic_id = v_req.clinic_id;
    ELSE
      UPDATE public.operational_options
        SET subjective_template = NULLIF(btrim(COALESCE(v_req.proposed_template, '')), '')
        WHERE id = v_req.diagnosis_id AND clinic_id = v_req.clinic_id;
    END IF;
  END IF;

  UPDATE public.soap_template_change_requests
    SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_note = NULLIF(btrim(COALESCE(p_note, '')), '')
    WHERE id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_soap_template_request(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.review_soap_template_request(uuid, boolean, text) TO authenticated;

-- Push notifikasi ke owner klinik saat ada pengajuan baru (atau pengajuan
-- pending yang direvisi terapis). Memakai edge function send-push-notification
-- seperti notifikasi SOAP owner lainnya; gagal kirim tidak membatalkan pengajuan.
CREATE OR REPLACE FUNCTION public.notify_owner_soap_template_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner RECORD;
  v_diagnosis text;
  v_requester text;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT label INTO v_diagnosis FROM public.operational_options WHERE id = NEW.diagnosis_id;
  v_requester := COALESCE(NULLIF(NEW.requested_by_name, ''), 'Terapis');

  FOR v_owner IN
    SELECT u.id FROM public.users u
    WHERE u.role = 'owner' AND u.clinic_id = NEW.clinic_id
  LOOP
    BEGIN
      PERFORM net.http_post(
        url := 'https://dqkejdamagvlhqvxaqej.supabase.co/functions/v1/send-push-notification',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'user_id', v_owner.id,
          'title', '📝 Pengajuan Template SOAP',
          'body', v_requester || ' mengajukan perubahan template '
            || CASE WHEN NEW.field = 'objective_template' THEN 'Objective' ELSE 'Subjective' END
            || ' untuk ' || COALESCE(v_diagnosis, 'diagnosa') || '. Menunggu persetujuan Anda.',
          'url', '/owner/settings'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_owner_soap_template_request ON public.soap_template_change_requests;
CREATE TRIGGER trg_notify_owner_soap_template_request
  AFTER INSERT OR UPDATE OF proposed_template ON public.soap_template_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_owner_soap_template_request();
