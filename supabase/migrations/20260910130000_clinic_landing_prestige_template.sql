-- Adds the new "prestige" landing page template (premium navy,
-- photography-driven) to the set of templates a clinic owner can pick from
-- the "Landing Page" tab in Settings. See src/config/landingTemplates.js
-- and src/components/clinic-landing/PremiumClinicLanding.jsx.

ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_landing_template_check;
ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_landing_template_check
  CHECK (landing_template IN ('aurora', 'zen', 'vitality', 'heritage', 'nova', 'prestige'));

COMMENT ON COLUMN public.clinics.landing_template IS 'ID template landing page publik klinik: aurora | zen | vitality | heritage | nova | prestige. Lihat src/config/landingTemplates.js.';
