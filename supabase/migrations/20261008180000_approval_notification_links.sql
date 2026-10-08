-- Notifikasi pengajuan terapis -> owner: push SOAP template kini membuka tab
-- "Template Subjective" di pengaturan (sebelumnya hanya /owner/settings), dan
-- tabel pengajuan didaftarkan ke realtime agar lonceng owner langsung terisi.

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
          'url', '/owner/settings?tab=subjective_template'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['therapist_leave_requests', 'therapist_shift_swap_requests', 'soap_template_change_requests'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;
