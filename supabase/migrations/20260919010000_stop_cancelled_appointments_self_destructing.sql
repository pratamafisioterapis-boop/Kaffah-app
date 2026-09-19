-- Bug: cancelling an appointment made it vanish from the DB entirely instead
-- of staying visible (with a red "cancelled" badge) like every appointment
-- list in the app expects.
--
-- Root cause, confirmed by tracing the trigger chain that fires on a plain
-- `UPDATE appointments SET status = 'cancelled' ...`:
--
--   1. trg_appointment_update_recap (AFTER UPDATE ON appointments) sees
--      NEW.status IN ('cancelled','no_show','rejected') and deletes the
--      linked daily_recaps row -- intentional, a cancelled visit shouldn't
--      keep a recap.
--   2. That DELETE fires trg_delete_appointment_when_recap_deleted (AFTER
--      DELETE ON daily_recaps), which reads the appointment's status --
--      already 'cancelled' from step 1 -- and, because 'cancelled' is in
--      its cascade list, immediately DELETEs the appointment row itself.
--
-- So the exact status update that's supposed to mark an appointment
-- cancelled (and keep it visible, per admin/owner/therapist appointment
-- views) hard-deletes it a moment later, every time it had a daily_recaps
-- row linked. Confirmed live: patient "Karsilah" (2026-09-19, ~10:00)
-- cancelled via the admin appointment detail modal and disappeared
-- completely from the booking grid.
--
-- Fix: a daily_recaps row being deleted -- for any reason -- must never
-- cascade into hard-deleting the appointment it was generated from.
-- Cancelled/no_show/rejected appointments are terminal-but-historical
-- records; every list in the app (admin, owner, therapist) already relies
-- on them staying in the table so they can render with a "cancelled"
-- style. Explicit appointment deletion (the separate "Hapus" action) goes
-- through `DELETE FROM appointments` directly and is unaffected by this
-- change.
CREATE OR REPLACE FUNCTION public.trg_delete_appointment_when_recap_deleted()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- No-op: a daily_recaps row being removed (e.g. because its appointment
    -- was cancelled) must never cascade into deleting the appointment
    -- itself. Appointments are only ever removed via an explicit delete on
    -- the appointments table.
    RETURN OLD;
END;
$function$;
