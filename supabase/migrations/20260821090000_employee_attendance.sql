-- Employee attendance upload feature (admin panel)
-- Stores per-day check-in/check-out punches imported from attendance-machine
-- Excel exports, plus per-department shift settings used to flag lateness.

CREATE TABLE IF NOT EXISTS public.employee_attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  physiotherapist_id uuid REFERENCES public.physiotherapists(id) ON DELETE SET NULL,
  employee_external_id text,
  employee_name text NOT NULL,
  department text,
  attendance_date date NOT NULL,
  check_in time,
  check_out time,
  raw_punches jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'present', -- present | late | no_checkout | absent
  late_minutes integer NOT NULL DEFAULT 0,
  source_file_name text,
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, employee_name, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_employee_attendance_clinic_date
  ON public.employee_attendance_records (clinic_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_employee_attendance_physiotherapist
  ON public.employee_attendance_records (physiotherapist_id);

CREATE TABLE IF NOT EXISTS public.employee_attendance_shift_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  department text NOT NULL,
  expected_check_in time NOT NULL DEFAULT '08:00',
  grace_minutes integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, department)
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employee_attendance_records_updated_at ON public.employee_attendance_records;
CREATE TRIGGER trg_employee_attendance_records_updated_at
  BEFORE UPDATE ON public.employee_attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_employee_attendance_shift_settings_updated_at ON public.employee_attendance_shift_settings;
CREATE TRIGGER trg_employee_attendance_shift_settings_updated_at
  BEFORE UPDATE ON public.employee_attendance_shift_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.employee_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_attendance_shift_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access employee_attendance_records"
  ON public.employee_attendance_records
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "owner_admin_manage_employee_attendance_records"
  ON public.employee_attendance_records
  FOR ALL
  USING (
    get_my_role() = 'super_admin'
    OR (get_my_role() = ANY (ARRAY['owner','admin']) AND clinic_id = get_my_clinic_id())
  )
  WITH CHECK (
    get_my_role() = 'super_admin'
    OR (get_my_role() = ANY (ARRAY['owner','admin']) AND clinic_id = get_my_clinic_id())
  );

CREATE POLICY "Service role full access employee_attendance_shift_settings"
  ON public.employee_attendance_shift_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "owner_admin_manage_employee_attendance_shift_settings"
  ON public.employee_attendance_shift_settings
  FOR ALL
  USING (
    get_my_role() = 'super_admin'
    OR (get_my_role() = ANY (ARRAY['owner','admin']) AND clinic_id = get_my_clinic_id())
  )
  WITH CHECK (
    get_my_role() = 'super_admin'
    OR (get_my_role() = ANY (ARRAY['owner','admin']) AND clinic_id = get_my_clinic_id())
  );
