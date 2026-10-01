-- Owner must be able to edit admin accounts (name, phone, avatar_url) in their
-- own clinic. Without this policy the UPDATE matched 0 rows silently, so the
-- uploaded profile photo never reached users.avatar_url.
DROP POLICY IF EXISTS "Owner update clinic admins" ON public.users;
CREATE POLICY "Owner update clinic admins" ON public.users
  FOR UPDATE
  USING (
    get_my_role() = 'owner'
    AND clinic_id = get_my_clinic_id()
    AND role IN ('admin', 'clinic_admin')
  )
  WITH CHECK (
    get_my_role() = 'owner'
    AND clinic_id = get_my_clinic_id()
    AND role IN ('admin', 'clinic_admin')
  );
