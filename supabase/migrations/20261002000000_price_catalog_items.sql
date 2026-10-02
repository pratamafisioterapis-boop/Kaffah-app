-- Katalog harga (Setup owner): 5 kategori dalam satu tabel — procedure,
-- consumable, drug, consultation, administration. Untuk sementara hanya
-- menyimpan data; belum terhubung ke invoice/tarif.
CREATE TABLE IF NOT EXISTS public.price_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  category text NOT NULL
    CHECK (category IN ('procedure', 'consumable', 'drug', 'consultation', 'administration')),
  name text NOT NULL,
  base_price numeric NOT NULL DEFAULT 0,
  margin_pct numeric NOT NULL DEFAULT 0,
  selling_price numeric,
  company_portion_pct numeric NOT NULL DEFAULT 100,
  doctor_portion_pct numeric NOT NULL DEFAULT 0,
  editable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_catalog_items_clinic_category
  ON public.price_catalog_items (clinic_id, category);

ALTER TABLE public.price_catalog_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manage own clinic price catalog" ON public.price_catalog_items;
CREATE POLICY "Owner manage own clinic price catalog" ON public.price_catalog_items
  FOR ALL
  USING (
    get_my_role() IN ('owner', 'super_admin')
    AND (clinic_id = get_my_clinic_id() OR get_my_role() = 'super_admin')
  )
  WITH CHECK (
    get_my_role() IN ('owner', 'super_admin')
    AND (clinic_id = get_my_clinic_id() OR get_my_role() = 'super_admin')
  );

DROP POLICY IF EXISTS "Staff read own clinic price catalog" ON public.price_catalog_items;
CREATE POLICY "Staff read own clinic price catalog" ON public.price_catalog_items
  FOR SELECT
  USING (clinic_id = get_my_clinic_id());
