-- Bukti surat dokter untuk pengajuan izin bertipe Sakit.
-- Bucket privat; path: {clinic_id}/{auth user id terapis}/{uuid}.{ext}
--  * terapis hanya boleh mengunggah / melihat / menghapus berkas di folder miliknya,
--  * owner, admin, super admin, dan terapis kepala klinik yang sama boleh melihat.
-- Pengajuan Sakit baru wajib menyertakan proof_path (trigger, hanya saat INSERT
-- agar pengajuan lama tetap bisa ditinjau).

ALTER TABLE public.therapist_leave_requests
  ADD COLUMN IF NOT EXISTS proof_path text;

CREATE OR REPLACE FUNCTION public.leave_request_require_sick_proof()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW.leave_type = 'sick' AND (NEW.proof_path IS NULL OR btrim(NEW.proof_path) = '') THEN
    RAISE EXCEPTION 'Pengajuan izin sakit wajib menyertakan bukti surat dokter.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_leave_request_sick_proof ON public.therapist_leave_requests;
CREATE TRIGGER trg_leave_request_sick_proof
  BEFORE INSERT ON public.therapist_leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.leave_request_require_sick_proof();

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('leave-proofs', 'leave-proofs', false, 5242880)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS leave_proofs_therapist_write ON storage.objects;
CREATE POLICY leave_proofs_therapist_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'leave-proofs'
    AND get_my_role() IN ('therapist', 'physiotherapist')
    AND (storage.foldername(name))[1] = get_my_clinic_id()::text
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS leave_proofs_therapist_own ON storage.objects;
CREATE POLICY leave_proofs_therapist_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'leave-proofs'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS leave_proofs_therapist_delete ON storage.objects;
CREATE POLICY leave_proofs_therapist_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'leave-proofs'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS leave_proofs_reviewer_read ON storage.objects;
CREATE POLICY leave_proofs_reviewer_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'leave-proofs'
    AND (
      get_my_role() = 'super_admin'
      OR (
        (storage.foldername(name))[1] = get_my_clinic_id()::text
        AND (
          get_my_role() IN ('owner', 'admin')
          OR public.is_my_clinic_head_therapist(get_my_clinic_id())
        )
      )
    )
  );
