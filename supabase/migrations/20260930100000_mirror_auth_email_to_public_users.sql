-- Email login (auth.users.email) dan salinannya di public.users.email bisa
-- berbeda (mis. update_auth_user hanya mengubah auth.users), sehingga Super
-- Admin menampilkan email yang tidak bisa dipakai login.
-- Fix: trigger di auth.users yang otomatis menyalin email ke public.users
-- lewat jalur apa pun (RPC, dashboard, admin API), plus backfill data lama.
CREATE OR REPLACE FUNCTION public.mirror_auth_email_to_public_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.users
  SET email = NEW.email,
      updated_at = now()
  WHERE id = NEW.id
    AND email IS DISTINCT FROM NEW.email;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.mirror_auth_email_to_public_users() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_mirror_auth_email_to_public_users ON auth.users;
CREATE TRIGGER trg_mirror_auth_email_to_public_users
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
WHEN (NEW.email IS DISTINCT FROM OLD.email)
EXECUTE FUNCTION public.mirror_auth_email_to_public_users();

-- Backfill: samakan email yang sudah terlanjur berbeda.
UPDATE public.users u
SET email = a.email,
    updated_at = now()
FROM auth.users a
WHERE a.id = u.id
  AND a.email IS NOT NULL
  AND u.email IS DISTINCT FROM a.email;
