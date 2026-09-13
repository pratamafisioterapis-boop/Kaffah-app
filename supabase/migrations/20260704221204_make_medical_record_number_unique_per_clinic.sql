ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_medical_record_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS patients_clinic_id_medical_record_number_key ON public.patients (clinic_id, medical_record_number);
