-- One-off date-specific schedule overrides for a physiotherapist, distinct
-- from the recurring weekly template in therapist_schedules. Lets admins
-- record "on this specific date, this therapist's hours were X" without
-- touching (and having to remember to revert) the weekly template — used by
-- the attendance discipline check to pick the correct expected check-in for
-- a date that had a temporary shift swap.
CREATE TABLE IF NOT EXISTS public.therapist_schedule_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.physiotherapists(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  start_time time NOT NULL,
  end_time time,
  note text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (therapist_id, override_date)
);

CREATE INDEX IF NOT EXISTS idx_therapist_schedule_overrides_therapist_date
  ON public.therapist_schedule_overrides (therapist_id, override_date);

DROP TRIGGER IF EXISTS trg_therapist_schedule_overrides_updated_at ON public.therapist_schedule_overrides;
CREATE TRIGGER trg_therapist_schedule_overrides_updated_at
  BEFORE UPDATE ON public.therapist_schedule_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.therapist_schedule_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access therapist_schedule_overrides"
  ON public.therapist_schedule_overrides
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin Manage Schedule Overrides"
  ON public.therapist_schedule_overrides
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = ANY (ARRAY['owner','admin','super_admin'])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = ANY (ARRAY['owner','admin','super_admin'])
  ));

CREATE POLICY "clinic_read_schedule_overrides"
  ON public.therapist_schedule_overrides
  FOR SELECT
  USING (
    get_my_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM public.physiotherapists p
      WHERE p.id = therapist_schedule_overrides.therapist_id AND p.clinic_id = get_my_clinic_id()
    )
  );

CREATE POLICY "therapist_read_own_schedule_overrides"
  ON public.therapist_schedule_overrides
  FOR SELECT
  USING (
    therapist_id IN (SELECT id FROM public.physiotherapists WHERE user_id = auth.uid())
  );
