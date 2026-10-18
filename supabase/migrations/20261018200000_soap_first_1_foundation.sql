-- SOAP-first (KHUSUS Kaffah Physiotherapy) - tahap 1: fondasi.
-- Semua aturan baru dikendalikan satu sakelar per klinik (soap_first_settings.enabled)
-- dan tanggal mulai (start_date). Selama enabled = false, perilaku lama tidak berubah.
-- Migrasi ini TIDAK memakai DROP.

-- 1. Pengaturan per klinik ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.soap_first_settings (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  start_date date NOT NULL DEFAULT DATE '2026-10-19',
  incentive_grace_minutes integer NOT NULL DEFAULT 20 CHECK (incentive_grace_minutes >= 0),
  reminder_after_minutes integer NOT NULL DEFAULT 40 CHECK (reminder_after_minutes >= 0),
  two_complaint_package_surcharge numeric NOT NULL DEFAULT 25000 CHECK (two_complaint_package_surcharge >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.soap_first_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY soap_first_settings_select ON public.soap_first_settings
  FOR SELECT TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id()));

CREATE POLICY soap_first_settings_owner_write ON public.soap_first_settings
  FOR ALL TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id()) AND (SELECT public.get_my_role()) IN ('owner', 'super_admin'))
  WITH CHECK (clinic_id = (SELECT public.get_my_clinic_id()) AND (SELECT public.get_my_role()) IN ('owner', 'super_admin'));

INSERT INTO public.soap_first_settings (clinic_id, enabled, start_date)
SELECT c.id, false, DATE '2026-10-19'
FROM public.clinics c
WHERE c.id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
ON CONFLICT (clinic_id) DO NOTHING;

-- 2. Kolom baru ----------------------------------------------------------------
ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS soap_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS special_type text,
  ADD COLUMN IF NOT EXISTS free_reason text,
  ADD COLUMN IF NOT EXISTS free_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS xtratime boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS incentive_zero_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS incentive_zero_manual_reason text,
  ADD COLUMN IF NOT EXISTS incentive_zero_manual_by uuid,
  ADD COLUMN IF NOT EXISTS incentive_zero_manual_at timestamptz,
  ADD COLUMN IF NOT EXISTS soap_reminder1_at timestamptz,
  ADD COLUMN IF NOT EXISTS soap_reminder2_at timestamptz,
  ADD COLUMN IF NOT EXISTS soap_first_applied boolean NOT NULL DEFAULT false;

ALTER TABLE public.daily_recaps
  ADD CONSTRAINT daily_recaps_special_type_check CHECK (special_type IS NULL OR special_type IN ('free', 'konsultasi')) NOT VALID;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS homecare_time_type text;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_homecare_time_type_check CHECK (homecare_time_type IS NULL OR homecare_time_type IN ('dalam', 'luar')) NOT VALID;

ALTER TABLE public.operational_options
  ADD COLUMN IF NOT EXISTS price numeric;

-- 3. Harga per tipe pasien --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinic_service_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_type_id uuid NOT NULL REFERENCES public.operational_options(id) ON DELETE CASCADE,
  price numeric NOT NULL CHECK (price >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, patient_type_id)
);

ALTER TABLE public.clinic_service_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_service_prices_select ON public.clinic_service_prices
  FOR SELECT TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id()));

CREATE POLICY clinic_service_prices_owner_write ON public.clinic_service_prices
  FOR ALL TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id()) AND (SELECT public.get_my_role()) IN ('owner', 'super_admin'))
  WITH CHECK (clinic_id = (SELECT public.get_my_clinic_id()) AND (SELECT public.get_my_role()) IN ('owner', 'super_admin'));

-- 4. Pengecualian (override) dengan persetujuan owner ------------------------------
CREATE TABLE IF NOT EXISTS public.soap_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('payment_unlock', 'incentive_restore', 'homecare_discount', 'xtratime', 'package_extend', 'amount_adjust')),
  recap_id uuid REFERENCES public.daily_recaps(id) ON DELETE CASCADE,
  package_tracking_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL CHECK (char_length(btrim(reason)) >= 5),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by uuid,
  requested_by_name text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid,
  decided_by_name text,
  decided_at timestamptz,
  decision_note text
);

CREATE UNIQUE INDEX IF NOT EXISTS soap_overrides_one_pending_per_recap
  ON public.soap_overrides (kind, recap_id) WHERE status = 'pending' AND recap_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS soap_overrides_one_pending_per_package
  ON public.soap_overrides (kind, package_tracking_id) WHERE status = 'pending' AND package_tracking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS soap_overrides_clinic_status_idx ON public.soap_overrides (clinic_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS soap_overrides_recap_idx ON public.soap_overrides (recap_id);

ALTER TABLE public.soap_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY soap_overrides_select ON public.soap_overrides
  FOR SELECT TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id()) AND (SELECT public.get_my_role()) IN ('owner', 'super_admin', 'admin', 'clinic_admin'));

-- 5. Jejak revisi SOAP yang sudah terkunci ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.soap_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  medical_record_id uuid NOT NULL REFERENCES public.medical_records(id) ON DELETE CASCADE,
  revised_by uuid,
  revised_by_name text,
  reason text NOT NULL CHECK (char_length(btrim(reason)) >= 5),
  old_values jsonb NOT NULL,
  new_values jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS soap_revisions_record_idx ON public.soap_revisions (medical_record_id, created_at DESC);

ALTER TABLE public.soap_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY soap_revisions_select ON public.soap_revisions
  FOR SELECT TO authenticated
  USING (clinic_id = (SELECT public.get_my_clinic_id()) AND (SELECT public.get_my_role()) IN ('owner', 'super_admin', 'admin', 'clinic_admin', 'therapist'));

-- 6. Data harga Kaffah (konfigurasi, bukan data pasien) -----------------------------------
INSERT INTO public.clinic_service_prices (clinic_id, patient_type_id, price)
SELECT o.clinic_id, o.id,
  CASE o.label
    WHEN 'NORMAL' THEN 200000
    WHEN 'DUA KELUHAN' THEN 225000
    WHEN 'RECOVERY' THEN 220000
    WHEN 'RECOVERY+TREATMENT' THEN 250000
    WHEN 'HOMECARE (dlm jam kerja)' THEN 300000
    WHEN 'HOMECARE (luar jam kerja)' THEN 300000
    WHEN 'XTRATIME' THEN 225000
    WHEN 'XTRATIME+DUA KELUHAN' THEN 225000
    WHEN 'KONSULTASI' THEN 75000
    WHEN 'FREE' THEN 0
  END
FROM public.operational_options o
WHERE o.clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
  AND o.category = 'patient_type'
  AND o.label IN ('NORMAL', 'DUA KELUHAN', 'RECOVERY', 'RECOVERY+TREATMENT', 'HOMECARE (dlm jam kerja)', 'HOMECARE (luar jam kerja)', 'XTRATIME', 'XTRATIME+DUA KELUHAN', 'KONSULTASI', 'FREE')
ON CONFLICT (clinic_id, patient_type_id) DO NOTHING;

UPDATE public.operational_options o
SET price = CASE o.label WHEN 'Paket 1' THEN 530000 WHEN 'Paket 2' THEN 1000000 WHEN 'Paket 3' THEN 1900000 END
WHERE o.clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
  AND o.category = 'tipe_paket'
  AND o.label IN ('Paket 1', 'Paket 2', 'Paket 3');

-- TIGA KELUHAN dipensiunkan di Kaffah (data lama tidak diubah).
UPDATE public.operational_options o
SET is_active = false
WHERE o.clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
  AND o.category = 'patient_type'
  AND o.label = 'TIGA KELUHAN';
