-- Bug: menonaktifkan profil terapis milik owner (physiotherapists.user_id = owner)
-- ikut menonaktifkan users.is_active si owner lewat trigger sync, sehingga owner
-- tidak bisa login ("Akun Anda telah dinonaktifkan").
-- Fix: sinkronisasi status login hanya berlaku untuk akun ber-role 'therapist'.
CREATE OR REPLACE FUNCTION public.sync_therapist_login_active_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    PERFORM set_config('app.trusted_role_change', 'on', true);

    UPDATE public.users
    SET is_active = NEW.is_active,
        updated_at = now()
    WHERE id = NEW.user_id
      AND lower(coalesce(role, '')) = 'therapist';
  END IF;

  RETURN NEW;
END;
$function$;

-- Pulihkan login owner yang terlanjur dinonaktifkan oleh bug di atas.
SELECT set_config('app.trusted_role_change', 'on', true);
UPDATE public.users u
SET is_active = true, updated_at = now()
WHERE u.is_active = false
  AND lower(coalesce(u.role, '')) = 'owner'
  AND EXISTS (SELECT 1 FROM public.physiotherapists p WHERE p.user_id = u.id);
