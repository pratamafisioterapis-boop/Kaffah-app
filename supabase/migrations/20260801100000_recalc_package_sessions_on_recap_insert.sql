-- Bug: package_tracking.sessions_used/sessions_remaining are cached columns,
-- only refreshed by recalculate_package_sessions(). That function is called
-- from trg_after_package_created (AFTER UPDATE on daily_recaps) and from the
-- delete trigger, but never from an AFTER INSERT trigger — even though
-- auto_assign_package_on_insert() (BEFORE INSERT) can set package_tracking_id
-- on a brand-new recap. So a freshly-linked recap doesn't get counted against
-- its package until some later, unrelated UPDATE happens to touch that row.
-- This left the cached counter behind reality for a while, which is part of
-- why the Widianingsih package looked "not yet full" and kept auto-assigning
-- new recaps into it after one of its sessions got silently unlinked.
--
-- Fix: add the missing AFTER INSERT counterpart so the counter is always
-- accurate immediately, the same way it already is for updates and deletes.

CREATE OR REPLACE FUNCTION public.after_recap_insert_package()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.package_tracking_id IS NOT NULL THEN
        PERFORM recalculate_package_sessions(
            NEW.package_tracking_id,
            NEW.recap_date
        );
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_after_package_created_on_insert ON public.daily_recaps;
CREATE TRIGGER trg_after_package_created_on_insert
    AFTER INSERT ON public.daily_recaps
    FOR EACH ROW
    WHEN (NEW.package_tracking_id IS NOT NULL)
    EXECUTE FUNCTION public.after_recap_insert_package();
