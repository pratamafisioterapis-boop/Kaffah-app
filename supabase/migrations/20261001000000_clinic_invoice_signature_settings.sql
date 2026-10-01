-- Pengaturan tanda tangan invoice per klinik (hanya diubah super admin).
-- invoice_signer: 'therapist' (default, perilaku lama) atau 'admin'.
-- invoice_admin_name / invoice_admin_signature_url: identitas admin penanda tangan.
-- invoice_show_patient_signature: false = kolom tanda tangan pasien disembunyikan.
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS invoice_signer text NOT NULL DEFAULT 'therapist',
  ADD COLUMN IF NOT EXISTS invoice_admin_name text,
  ADD COLUMN IF NOT EXISTS invoice_admin_signature_url text,
  ADD COLUMN IF NOT EXISTS invoice_show_patient_signature boolean NOT NULL DEFAULT true;

ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_invoice_signer_check;
ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_invoice_signer_check
  CHECK (invoice_signer IN ('therapist', 'admin'));
