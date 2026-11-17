-- Gabungkan policy RLS PERMISSIVE yang tumpang tindih pada 4 tabel yang paling sering dibaca
-- dashboard (appointments, clinics, physiotherapists, users).
--
-- Latar: advisor performa Supabase melaporkan "multiple_permissive_policies" (454 temuan). Tiap
-- policy permissive yang berlaku untuk role+aksi yang sama dievaluasi untuk SETIAP baris lalu
-- di-OR-kan, jadi query ke tabel panas membayar beberapa predikat sekaligus.
--
-- Prinsip: perubahan ini HARUS setara secara semantik. Hasil gabungan = OR dari predikat lama
-- (USING di-OR dengan USING, WITH CHECK di-OR dengan WITH CHECK). Tidak ada akses yang
-- ditambah atau dikurangi. Predikat tetap memakai (SELECT fn()) seperti aslinya.
-- Rollback: supabase/manual/rollback_rls_merge_hot_tables.sql
-- Tidak disentuh: policy service_role (melewati RLS), policy anon (public_insert_appointments_
-- old_clinic_only, public_read_active_physiotherapists_old_clinic) karena menggabungkannya ke
-- policy {public} akan melebarkan akses untuk role authenticated.

BEGIN;

-- ============ appointments ============
-- "Therapists Manage Own Appointments" (ALL) + clinic_isolated_appointments (ALL) -> satu policy ALL.
DROP POLICY "Therapists Manage Own Appointments" ON public.appointments;
DROP POLICY clinic_isolated_appointments ON public.appointments;
CREATE POLICY appointments_access ON public.appointments
  FOR ALL TO public
  USING (
    (therapist_id IN ( SELECT physiotherapists.id FROM physiotherapists
                       WHERE (physiotherapists.user_id = ( SELECT auth.uid() AS uid))))
    OR ((( SELECT get_my_role() AS get_my_role) = 'super_admin'::text)
        OR (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id)))
  )
  WITH CHECK (
    (therapist_id IN ( SELECT physiotherapists.id FROM physiotherapists
                       WHERE (physiotherapists.user_id = ( SELECT auth.uid() AS uid))))
    OR ((( SELECT get_my_role() AS get_my_role) = 'super_admin'::text)
        OR (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id)))
  );

-- ============ clinics ============
-- super_admin ALL dipecah per aksi. SELECT-nya sudah tercakup clinic_members_read_own_clinic
-- (id = clinic saya OR role = super_admin, untuk authenticated); untuk anon get_my_role() = NULL
-- (auth.uid() NULL) sehingga predikat super_admin selalu false -> tidak ada perubahan perilaku.
DROP POLICY super_admin_manage_all_clinics ON public.clinics;
DROP POLICY owner_manage_own_clinic ON public.clinics;
CREATE POLICY super_admin_insert_clinics ON public.clinics
  FOR INSERT TO public
  WITH CHECK ((( SELECT get_my_role() AS get_my_role) = 'super_admin'::text));
CREATE POLICY super_admin_delete_clinics ON public.clinics
  FOR DELETE TO public
  USING ((( SELECT get_my_role() AS get_my_role) = 'super_admin'::text));
CREATE POLICY clinics_update ON public.clinics
  FOR UPDATE TO public
  USING (
    (( SELECT get_my_role() AS get_my_role) = 'super_admin'::text)
    OR ((( SELECT get_my_role() AS get_my_role) = ANY (ARRAY['owner'::text, 'admin'::text, 'clinic_admin'::text]))
        AND (id = ( SELECT get_my_clinic_id() AS get_my_clinic_id)))
  )
  WITH CHECK (
    (( SELECT get_my_role() AS get_my_role) = 'super_admin'::text)
    OR ((( SELECT get_my_role() AS get_my_role) = ANY (ARRAY['owner'::text, 'admin'::text, 'clinic_admin'::text]))
        AND (id = ( SELECT get_my_clinic_id() AS get_my_clinic_id)))
  );

-- ============ physiotherapists ============
-- owner_admin_manage_physiotherapists (ALL) dipecah per aksi. Bagian SELECT-nya
-- (super_admin OR (owner/admin AND clinic saya)) adalah himpunan bagian dari
-- clinic_isolated_physiotherapists_select (super_admin OR clinic saya), jadi tidak perlu diulang.
DROP POLICY owner_admin_manage_physiotherapists ON public.physiotherapists;
DROP POLICY "Therapists can view own profile" ON public.physiotherapists;
DROP POLICY clinic_isolated_physiotherapists_select ON public.physiotherapists;
DROP POLICY therapist_update_own_physiotherapist_profile ON public.physiotherapists;
CREATE POLICY physiotherapists_select ON public.physiotherapists
  FOR SELECT TO public
  USING (
    (( SELECT auth.uid() AS uid) = user_id)
    OR ((( SELECT get_my_role() AS get_my_role) = 'super_admin'::text)
        OR (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id)))
  );
CREATE POLICY physiotherapists_insert ON public.physiotherapists
  FOR INSERT TO public
  WITH CHECK (
    (( SELECT get_my_role() AS get_my_role) = 'super_admin'::text)
    OR ((( SELECT get_my_role() AS get_my_role) = ANY (ARRAY['owner'::text, 'admin'::text]))
        AND (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id)))
  );
CREATE POLICY physiotherapists_update ON public.physiotherapists
  FOR UPDATE TO public
  USING (
    (( SELECT auth.uid() AS uid) = user_id)
    OR (( SELECT get_my_role() AS get_my_role) = 'super_admin'::text)
    OR ((( SELECT get_my_role() AS get_my_role) = ANY (ARRAY['owner'::text, 'admin'::text]))
        AND (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id)))
  )
  WITH CHECK (
    (( SELECT auth.uid() AS uid) = user_id)
    OR (( SELECT get_my_role() AS get_my_role) = 'super_admin'::text)
    OR ((( SELECT get_my_role() AS get_my_role) = ANY (ARRAY['owner'::text, 'admin'::text]))
        AND (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id)))
  );
CREATE POLICY physiotherapists_delete ON public.physiotherapists
  FOR DELETE TO public
  USING (
    (( SELECT get_my_role() AS get_my_role) = 'super_admin'::text)
    OR ((( SELECT get_my_role() AS get_my_role) = ANY (ARRAY['owner'::text, 'admin'::text]))
        AND (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id)))
  );

-- ============ users ============
-- 3 policy SELECT -> 1; 3 policy UPDATE -> 1. Policy "Users can update own profile" tidak punya
-- WITH CHECK (artinya memakai USING), jadi cek gabungannya memakai (uid = id) untuk cabang itu.
DROP POLICY "Admins and owners can view all users" ON public.users;
DROP POLICY "Super admin view all users" ON public.users;
DROP POLICY "Users can view own profile" ON public.users;
CREATE POLICY users_select ON public.users
  FOR SELECT TO public
  USING (
    (( SELECT get_my_role() AS get_my_role) = ANY (ARRAY['admin'::text, 'owner'::text]))
    OR (( SELECT get_my_role() AS get_my_role) = 'super_admin'::text)
    OR (( SELECT auth.uid() AS uid) = id)
  );
DROP POLICY "Owner update clinic admins" ON public.users;
DROP POLICY "Super admin manage all users" ON public.users;
DROP POLICY "Users can update own profile" ON public.users;
CREATE POLICY users_update ON public.users
  FOR UPDATE TO public
  USING (
    ((( SELECT get_my_role() AS get_my_role) = 'owner'::text)
      AND (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id))
      AND (role = ANY (ARRAY['admin'::text, 'clinic_admin'::text])))
    OR (( SELECT get_my_role() AS get_my_role) = 'super_admin'::text)
    OR (( SELECT auth.uid() AS uid) = id)
  )
  WITH CHECK (
    ((( SELECT get_my_role() AS get_my_role) = 'owner'::text)
      AND (clinic_id = ( SELECT get_my_clinic_id() AS get_my_clinic_id))
      AND (role = ANY (ARRAY['admin'::text, 'clinic_admin'::text])))
    OR (( SELECT get_my_role() AS get_my_role) = 'super_admin'::text)
    OR (( SELECT auth.uid() AS uid) = id)
  );

COMMIT;
