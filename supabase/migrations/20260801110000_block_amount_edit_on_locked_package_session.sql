-- Bug: admin edited the 6 Jul 2026 recap for Endri Jatmiati (a free session
-- consuming her existing "Paket 1" package quota, amount_original = 0) and
-- accidentally typed Rp 530.000 into the nominal field. Because amount went
-- from 0 to >0 while the recap's package link had gone stale (the exact bug
-- fixed by updateDailyRecap() now stripping null package_tracking_id),
-- create_package_on_recap_update() saw an amount>0 edit with no currently
-- valid package link and spun up a brand-new phantom "Paket 1" purchase for
-- it, and the freed slot on her real package got silently claimed by a later
-- visit — the same failure shape as the earlier Widianingsih case.
--
-- The FK-nulling half of this is already fixed at the application layer.
-- This migration closes the other half at the database layer: a recap that
-- is already linked to a package with a stored amount of 0 (i.e. it's a
-- package-quota session, not the purchase transaction) must never have its
-- amount edited away from 0 while still linked. This is enforced server-side
-- so no UI, script, or future edit path can silently corrupt package/billing
-- data this way again. Recaps that were never linked to a package, or whose
-- own amount was already nonzero (the actual purchase recap), are untouched.

CREATE OR REPLACE FUNCTION public.block_amount_edit_on_package_session()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.package_tracking_id IS NOT NULL
       AND COALESCE(OLD.amount_original, OLD.amount, 0) = 0
       AND COALESCE(NEW.amount_original, NEW.amount, 0) <> 0
    THEN
        RAISE EXCEPTION 'Sesi ini adalah bagian dari kuota paket (nominal Rp 0) dan tidak bisa diubah nominalnya selama masih tertaut ke paket.';
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_block_amount_edit_on_package_session ON public.daily_recaps;
CREATE TRIGGER trg_block_amount_edit_on_package_session
    BEFORE UPDATE ON public.daily_recaps
    FOR EACH ROW
    EXECUTE FUNCTION public.block_amount_edit_on_package_session();
