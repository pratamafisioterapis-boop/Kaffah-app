-- Manual name-alias mapping for attendance import: lets an admin permanently
-- link an attendance-machine nickname ("dilla") to a physiotherapist
-- ("Nurfadilah, S.Ft.,Ftr") when the automatic word/prefix matcher in
-- src/utils/therapistNameMatch.js can't safely infer it (nickname spelling
-- differs too much from the formal name). Checked before the automatic
-- matcher on every future import.
CREATE TABLE IF NOT EXISTS public.attendance_employee_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  employee_name text NOT NULL,
  physiotherapist_id uuid NOT NULL REFERENCES public.physiotherapists(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, employee_name)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_aliases_clinic
  ON public.attendance_employee_aliases (clinic_id);

ALTER TABLE public.attendance_employee_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access attendance_employee_aliases"
  ON public.attendance_employee_aliases
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "owner_admin_manage_attendance_employee_aliases"
  ON public.attendance_employee_aliases
  FOR ALL
  USING (
    get_my_role() = 'super_admin'
    OR (get_my_role() = ANY (ARRAY['owner','admin']) AND clinic_id = get_my_clinic_id())
  )
  WITH CHECK (
    get_my_role() = 'super_admin'
    OR (get_my_role() = ANY (ARRAY['owner','admin']) AND clinic_id = get_my_clinic_id())
  );
