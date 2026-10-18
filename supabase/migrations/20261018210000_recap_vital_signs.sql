-- Tanda-tanda vital per sesi (daily recap). Diisi admin saat rekap, tertaut ke SOAP
-- lewat medical_records.daily_recap_id (= recap_id di sini). Tidak memakai DROP.
CREATE TABLE IF NOT EXISTS public.recap_vital_signs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL DEFAULT (SELECT public.get_my_clinic_id()) REFERENCES public.clinics(id) ON DELETE CASCADE,
  recap_id uuid NOT NULL UNIQUE REFERENCES public.daily_recaps(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  systolic integer CHECK (systolic IS NULL OR systolic BETWEEN 30 AND 300),
  diastolic integer CHECK (diastolic IS NULL OR diastolic BETWEEN 20 AND 200),
  pulse integer CHECK (pulse IS NULL OR pulse BETWEEN 20 AND 250),
  spo2 numeric CHECK (spo2 IS NULL OR spo2 BETWEEN 50 AND 100),
  respiration integer CHECK (respiration IS NULL OR respiration BETWEEN 4 AND 80),
  temperature numeric CHECK (temperature IS NULL OR temperature BETWEEN 30 AND 45),
  weight numeric CHECK (weight IS NULL OR weight BETWEEN 1 AND 500),
  height numeric CHECK (height IS NULL OR height BETWEEN 30 AND 260),
  notes text,
  recorded_by uuid,
  recorded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recap_vital_signs_patient_idx ON public.recap_vital_signs (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS recap_vital_signs_clinic_idx ON public.recap_vital_signs (clinic_id);

ALTER TABLE public.recap_vital_signs ENABLE ROW LEVEL SECURITY;

CREATE POLICY recap_vital_signs_select ON public.recap_vital_signs
  FOR SELECT TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id())
    AND (SELECT public.get_my_role()) IN ('owner', 'super_admin', 'admin', 'clinic_admin', 'therapist'));

CREATE POLICY recap_vital_signs_write ON public.recap_vital_signs
  FOR ALL TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id())
    AND (SELECT public.get_my_role()) IN ('owner', 'super_admin', 'admin', 'clinic_admin'))
  WITH CHECK (clinic_id = (SELECT public.get_my_clinic_id())
    AND (SELECT public.get_my_role()) IN ('owner', 'super_admin', 'admin', 'clinic_admin'));
