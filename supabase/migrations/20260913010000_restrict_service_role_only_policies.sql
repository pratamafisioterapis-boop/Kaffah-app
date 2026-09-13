-- Security fix: several "Service role full access <table>" policies were
-- created with `USING (true) WITH CHECK (true)` but WITHOUT a `TO service_role`
-- clause. In Postgres, a policy with no explicit role list applies to
-- PUBLIC (i.e. every role, including `anon` and `authenticated`), not just
-- `service_role` as the policy name implies.
--
-- Since the backend service role already bypasses RLS entirely (it does not
-- need a permissive policy to read/write these tables), these policies were
-- pure liability: any signed-in user (and possibly anonymous callers,
-- depending on table GRANTs) could read and write EVERY row across EVERY
-- clinic in these tables, regardless of the more restrictive
-- clinic-scoped policies defined alongside them.
--
-- Affected tables: patient_feedback_links, patient_feedback_responses,
-- clinic_pricelist, employee_attendance_records,
-- employee_attendance_shift_settings, therapist_schedule_overrides,
-- attendance_employee_aliases.
--
-- Fix: pin each policy to `service_role` only, matching its stated intent.
-- This is a metadata-only change (no data is touched) and has no effect on
-- the service role's own access (it already bypasses RLS).

ALTER POLICY "Service role full access patient_feedback_links"
  ON public.patient_feedback_links
  TO service_role;

ALTER POLICY "Service role full access patient_feedback_responses"
  ON public.patient_feedback_responses
  TO service_role;

ALTER POLICY "Service role full access clinic_pricelist"
  ON public.clinic_pricelist
  TO service_role;

ALTER POLICY "Service role full access employee_attendance_records"
  ON public.employee_attendance_records
  TO service_role;

ALTER POLICY "Service role full access employee_attendance_shift_settings"
  ON public.employee_attendance_shift_settings
  TO service_role;

ALTER POLICY "Service role full access therapist_schedule_overrides"
  ON public.therapist_schedule_overrides
  TO service_role;

ALTER POLICY "Service role full access attendance_employee_aliases"
  ON public.attendance_employee_aliases
  TO service_role;
