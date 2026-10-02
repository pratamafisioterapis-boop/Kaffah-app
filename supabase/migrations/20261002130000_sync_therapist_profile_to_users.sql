-- Pindah Akun membaca public.users, sedangkan kartu terapis membaca
-- public.physiotherapists. Edit profil terapis tidak ikut memperbarui users
-- sehingga nama/email bisa berbeda (mis. Alma). Sinkronkan otomatis.
CREATE OR REPLACE FUNCTION public.sync_therapist_profile_to_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    PERFORM set_config('app.trusted_role_change', 'on', true);
    UPDATE public.users
    SET full_name = coalesce(nullif(NEW.name, ''), full_name),
        email = coalesce(nullif(NEW.email, ''), email),
        updated_at = now()
    WHERE id = NEW.user_id
      AND lower(coalesce(role, '')) IN ('therapist', 'physiotherapist')
      AND (full_name IS DISTINCT FROM coalesce(nullif(NEW.name, ''), full_name)
           OR email IS DISTINCT FROM coalesce(nullif(NEW.email, ''), email));
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_therapist_profile_to_users ON public.physiotherapists;
CREATE TRIGGER trg_sync_therapist_profile_to_users
AFTER INSERT OR UPDATE OF name, email, user_id ON public.physiotherapists
FOR EACH ROW EXECUTE FUNCTION public.sync_therapist_profile_to_users();

-- Backfill data yang sudah tidak sinkron.
SELECT set_config('app.trusted_role_change', 'on', true);
UPDATE public.users u
SET full_name = coalesce(nullif(p.name, ''), u.full_name),
    email = coalesce(nullif(p.email, ''), u.email),
    updated_at = now()
FROM public.physiotherapists p
WHERE p.user_id = u.id
  AND lower(coalesce(u.role, '')) IN ('therapist', 'physiotherapist');
