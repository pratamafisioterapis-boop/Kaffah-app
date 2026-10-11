-- Surat Keputusan (SK) Pimpinan: dokumen keputusan resmi yang diterbitkan
-- owner/pimpinan klinik (saat ini dipakai klinik Kaffah). Draft bisa diedit
-- dan diunduh sebagai PDF; setelah "diterbitkan" isinya dapat dibaca seluruh
-- staf klinik yang sama.
CREATE TABLE IF NOT EXISTS public.clinic_leadership_decrees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  decree_number text NOT NULL,
  title text NOT NULL,
  decree_date date NOT NULL,
  letter_city text NOT NULL DEFAULT 'Balikpapan',
  considerations jsonb NOT NULL DEFAULT '[]'::jsonb,
  decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  closing text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued')),
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_decrees_clinic ON public.clinic_leadership_decrees(clinic_id);

ALTER TABLE public.clinic_leadership_decrees ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_decrees_owner_manage ON public.clinic_leadership_decrees
  FOR ALL
  USING (
    clinic_id IN (
      SELECT u.clinic_id FROM public.users u
      WHERE u.id = auth.uid() AND u.role = ANY (ARRAY['owner', 'super_admin'])
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT u.clinic_id FROM public.users u
      WHERE u.id = auth.uid() AND u.role = ANY (ARRAY['owner', 'super_admin'])
    )
  );

CREATE POLICY clinic_decrees_staff_read_issued ON public.clinic_leadership_decrees
  FOR SELECT
  USING (
    status = 'issued'
    AND clinic_id IN (SELECT u.clinic_id FROM public.users u WHERE u.id = auth.uid())
  );
