-- One-off data correction: daily_recaps row for Kalfari Donal Yosua Pangkey's
-- 2 Juni 2026 visit (id 3905a578-7686-48d9-9859-b0d60c68b715) had therapist_id
-- pointing to Annisa Septiyani, while its own linked appointment
-- (2bc953af-c411-458e-8e84-d8f5e007482d, never rescheduled) has always had
-- Alma Ramadhanty as therapist_id.
--
-- This is NOT the same bug as 20260810070000 (stale therapist_name on
-- reschedule). Audit history on this row shows its patient identity
-- (patient_id/actual_patient_id/full_name) was swapped back and forth
-- between Kalfari Donal Yosua Pangkey and a different patient, Herni Hastopo
-- (who shares the same day's receipt_number "INV/KFF/2026-06-02/RM00320"),
-- on 2026-06-08 and again on 2026-06-25 -- outside of any reschedule flow
-- covered by the appointments triggers. therapist_id got updated to Annisa's
-- id during that identity swap (Annisa is Herni Hastopo's actual therapist)
-- but was never reverted when the row's patient identity was swapped back to
-- Kalfari on 2026-06-25, while therapist_name (coincidentally still "Alma")
-- was left untouched by that same write. The exact code path that performed
-- this identity swap is still unidentified (not the shared-package trigger,
-- not the admin DailyRecapModal save path, both checked) -- flagging for
-- follow-up if this pattern is seen again.
--
-- This migration only restores this one known-bad row to match its
-- appointment's therapist. It intentionally does not attempt a generic
-- backfill, since (per investigation) this is currently the only
-- daily_recaps row in the clinic's history whose therapist_id disagrees
-- with its own linked appointment's therapist_id for the same patient.

UPDATE daily_recaps
SET therapist_id = 'd8792c93-ecd4-4a31-bde9-42c2a68888c1', -- Alma Ramadhanty E P, S.Tr.Kes,Ftr
    therapist_name = 'Alma Ramadhanty E P, S.Tr.Kes,Ftr',
    updated_at = NOW()
WHERE id = '3905a578-7686-48d9-9859-b0d60c68b715'
  AND appointment_id = '2bc953af-c411-458e-8e84-d8f5e007482d';
