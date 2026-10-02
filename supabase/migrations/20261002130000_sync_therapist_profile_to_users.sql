-- Pindah Akun membaca public.users, sedangkan kartu terapis membaca
-- public.physiotherapists. Edit profil terapis tidak ikut memperbarui
-- users.full_name sehingga nama bisa berbeda (mis. Alma). Sinkronkan nama.
-- Email TIDAK disinkronkan: users.email = email login (auth.users), sedangkan
-- physiotherapists.email bisa berupa email tampilan yang berbeda.
CREATE OR REPLACE FUNCTION public.sync_therapist_profile_to_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NOT NULL AND coalesce(NEW.name, '') <> '' THEN
    PERFORM set_config('app.trusted_role_change', 'on', true);
    UPDATE public.users
    SET full_name = NEW.name,
        updated_at = now()
    WHERE id = NEW.user_id
      AND lower(coalesce(role, '')) IN ('therapist', 'physiotherapist')
      AND full_name IS DISTINCT FROM NEW.name;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_therapist_profile_to_users ON public.physiotherapists;
CREATE TRIGGER trg_sync_therapist_profile_to_users
AFTER INSERT OR UPDATE OF name, user_id ON public.physiotherapists
FOR EACH ROW EXECUTE FUNCTION public.sync_therapist_profile_to_users();

-- Backfill nama yang sudah tidak sinkron.
SELECT set_config('app.trusted_role_change', 'on', true);
UPDATE public.users u
SET full_name = p.name, updated_at = now()
FROM public.physiotherapists p
WHERE p.user_id = u.id
  AND coalesce(p.name, '') <> ''
  AND lower(coalesce(u.role, '')) IN ('therapist', 'physiotherapist')
  AND u.full_name IS DISTINCT FROM p.name;
