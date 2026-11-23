-- Admin yang tidak aktif (users.is_active = false) tidak dibuatkan notifikasi sama sekali,
-- sehingga push FCM juga tidak dikirim. Admin aktif tidak terpengaruh.
CREATE OR REPLACE FUNCTION public.trg_skip_notifications_inactive_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = NEW.user_id
      AND u.role IN ('admin', 'clinic_admin')
      AND u.is_active IS FALSE
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.trg_skip_notifications_inactive_admin() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS aa_skip_notifications_inactive_admin ON public.notifications;
CREATE TRIGGER aa_skip_notifications_inactive_admin
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.trg_skip_notifications_inactive_admin();
