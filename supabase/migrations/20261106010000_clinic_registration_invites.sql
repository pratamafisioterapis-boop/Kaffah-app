-- Link registrasi klinik Clinara (sekali pakai), dibuat oleh super admin.
-- Pendaftaran publik di landing page dimatikan; klinik baru hanya bisa
-- mendaftar lewat /register?token=... yang valid. Token dikonsumsi atomik
-- oleh edge function register-clinic (service role), sehingga satu link
-- hanya bisa dipakai satu kali.

CREATE TABLE IF NOT EXISTS public.clinic_registration_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE
    DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  label text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  used_at timestamptz,
  used_clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL
);

ALTER TABLE public.clinic_registration_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_manage_registration_invites" ON public.clinic_registration_invites;
CREATE POLICY "super_admin_manage_registration_invites"
  ON public.clinic_registration_invites
  FOR ALL
  TO authenticated
  USING ((SELECT get_my_role()) = 'super_admin')
  WITH CHECK ((SELECT get_my_role()) = 'super_admin');

REVOKE ALL ON public.clinic_registration_invites FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_registration_invites TO authenticated;
