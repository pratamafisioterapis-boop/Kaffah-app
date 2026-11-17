-- Rollback untuk 20261117020000_merge_permissive_policies_hot_tables.sql
-- Mengembalikan policy asli (definisi diambil dari pg_policies sebelum migrasi).
BEGIN;
DROP POLICY IF EXISTS appointments_access ON public.appointments;
DROP POLICY IF EXISTS super_admin_insert_clinics ON public.clinics;
DROP POLICY IF EXISTS super_admin_delete_clinics ON public.clinics;
DROP POLICY IF EXISTS clinics_update ON public.clinics;
DROP POLICY IF EXISTS physiotherapists_select ON public.physiotherapists;
DROP POLICY IF EXISTS physiotherapists_insert ON public.physiotherapists;
DROP POLICY IF EXISTS physiotherapists_update ON public.physiotherapists;
DROP POLICY IF EXISTS physiotherapists_delete ON public.physiotherapists;
DROP POLICY IF EXISTS users_select ON public.users;
DROP POLICY IF EXISTS users_update ON public.users;

CREATE POLICY "Therapists Manage Own Appointments" ON public.appointments FOR ALL TO public
  USING (therapist_id IN ( SELECT physiotherapists.id FROM physiotherapists WHERE (physiotherapists.user_id = ( SELECT auth.uid() AS uid))))
  WITH CHECK (therapist_id IN ( SELECT physiotherapists.id FROM physiotherapists WHERE (physiotherapists.user_id = ( SELECT auth.uid() AS uid))));
CREATE POLICY clinic_isolated_appointments ON public.appointments FOR ALL TO public
  USING ((( SELECT get_my_role() AS get_my_role) = 'super_admin'::text) OR (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id)))
  WITH CHECK ((( SELECT get_my_role() AS get_my_role) = 'super_admin'::text) OR (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id)));

CREATE POLICY super_admin_manage_all_clinics ON public.clinics FOR ALL TO public
  USING ((( SELECT get_my_role() AS get_my_role) = 'super_admin'::text))
  WITH CHECK ((( SELECT get_my_role() AS get_my_role) = 'super_admin'::text));
CREATE POLICY owner_manage_own_clinic ON public.clinics FOR UPDATE TO public
  USING (((( SELECT get_my_role() AS get_my_role) = ANY (ARRAY['owner'::text, 'admin'::text, 'clinic_admin'::text])) AND (id = ( SELECT get_my_clinic_id() AS get_my_clinic_id))))
  WITH CHECK (((( SELECT get_my_role() AS get_my_role) = ANY (ARRAY['owner'::text, 'admin'::text, 'clinic_admin'::text])) AND (id = ( SELECT get_my_clinic_id() AS get_my_clinic_id))));

CREATE POLICY owner_admin_manage_physiotherapists ON public.physiotherapists FOR ALL TO public
  USING ((( SELECT get_my_role() AS get_my_role) = 'super_admin'::text) OR ((( SELECT get_my_role() AS get_my_role) = ANY (ARRAY['owner'::text, 'admin'::text])) AND (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id))))
  WITH CHECK ((( SELECT get_my_role() AS get_my_role) = 'super_admin'::text) OR ((( SELECT get_my_role() AS get_my_role) = ANY (ARRAY['owner'::text, 'admin'::text])) AND (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id))));
CREATE POLICY "Therapists can view own profile" ON public.physiotherapists FOR SELECT TO public
  USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY clinic_isolated_physiotherapists_select ON public.physiotherapists FOR SELECT TO public
  USING ((( SELECT get_my_role() AS get_my_role) = 'super_admin'::text) OR (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id)));
CREATE POLICY therapist_update_own_physiotherapist_profile ON public.physiotherapists FOR UPDATE TO public
  USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Admins and owners can view all users" ON public.users FOR SELECT TO public
  USING ((( SELECT get_my_role() AS get_my_role) = ANY (ARRAY['admin'::text, 'owner'::text])));
CREATE POLICY "Super admin view all users" ON public.users FOR SELECT TO public
  USING ((( SELECT get_my_role() AS get_my_role) = 'super_admin'::text));
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT TO public
  USING ((( SELECT auth.uid() AS uid) = id));
CREATE POLICY "Owner update clinic admins" ON public.users FOR UPDATE TO public
  USING (((( SELECT get_my_role() AS get_my_role) = 'owner'::text) AND (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id)) AND (role = ANY (ARRAY['admin'::text, 'clinic_admin'::text]))))
  WITH CHECK (((( SELECT get_my_role() AS get_my_role) = 'owner'::text) AND (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id)) AND (role = ANY (ARRAY['admin'::text, 'clinic_admin'::text]))));
CREATE POLICY "Super admin manage all users" ON public.users FOR UPDATE TO public
  USING ((( SELECT get_my_role() AS get_my_role) = 'super_admin'::text))
  WITH CHECK ((( SELECT get_my_role() AS get_my_role) = 'super_admin'::text));
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE TO public
  USING ((( SELECT auth.uid() AS uid) = id));
COMMIT;
