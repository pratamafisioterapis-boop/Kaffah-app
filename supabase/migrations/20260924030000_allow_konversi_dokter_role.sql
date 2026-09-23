-- public.users.role's CHECK constraint didn't include the dedicated
-- 'konversi_dokter' role, so handle_new_user()'s insert (which runs inside
-- the same transaction as the auth.users insert) aborted with a constraint
-- violation, surfacing to the client as "Database error creating new user".
alter table public.users drop constraint users_role_check;
alter table public.users add constraint users_role_check
  check (role = ANY (ARRAY['owner'::text, 'admin'::text, 'therapist'::text, 'physiotherapist'::text, 'patient'::text, 'clinic_admin'::text, 'super_admin'::text, 'konversi_dokter'::text]));
