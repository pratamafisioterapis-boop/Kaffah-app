-- Landing page builder per klinik: setiap klinik (yang tampil lewat
-- subdomain/custom domain miliknya, lihat get_clinic_by_host) bisa memilih
-- salah satu dari 5 template landing page siap pakai, mengganti warna utama,
-- dan menimpa (override) isi tiap bagian (hero, tentang, layanan,
-- keunggulan, testimoni, CTA) tanpa harus menulis ulang dari nol -- template
-- sudah berisi contoh konten lengkap sebagai default. Kolom-kolom ini hanya
-- dipakai oleh ClinicTenantSitePage (situs tenant), TIDAK memengaruhi
-- landing page utama kaffahphysio.id yang tetap statis di src/components/landing.

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS landing_template text NOT NULL DEFAULT 'aurora',
  ADD COLUMN IF NOT EXISTS landing_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS landing_primary_color text,
  ADD COLUMN IF NOT EXISTS landing_accent_color text;

ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_landing_template_check;
ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_landing_template_check
  CHECK (landing_template IN ('aurora', 'zen', 'vitality', 'heritage', 'nova'));

ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_landing_primary_color_check;
ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_landing_primary_color_check
  CHECK (landing_primary_color IS NULL OR landing_primary_color ~ '^#[0-9a-fA-F]{6}$');

ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_landing_accent_color_check;
ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_landing_accent_color_check
  CHECK (landing_accent_color IS NULL OR landing_accent_color ~ '^#[0-9a-fA-F]{6}$');

COMMENT ON COLUMN public.clinics.landing_template IS 'ID template landing page publik klinik: aurora | zen | vitality | heritage | nova. Lihat src/config/landingTemplates.js.';
COMMENT ON COLUMN public.clinics.landing_content IS 'Override konten per-bagian landing page (hero, about, services, advantages, testimonials, cta, dll). Field yang tidak diisi memakai contoh bawaan template.';
COMMENT ON COLUMN public.clinics.landing_primary_color IS 'Warna utama (hex) landing page publik klinik, menimpa warna bawaan template.';
COMMENT ON COLUMN public.clinics.landing_accent_color IS 'Warna aksen (hex) landing page publik klinik, menimpa warna bawaan template.';

-- Price list publik per klinik (mis. "Fisioterapi Umum - Rp150.000/sesi"),
-- ditampilkan di bagian harga pada landing page tenant. Terpisah dari
-- operational_options (yang dipakai untuk konfigurasi booking internal dan
-- tidak punya kolom harga).
CREATE TABLE IF NOT EXISTS public.clinic_pricelist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  category text,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  price_unit text NOT NULL DEFAULT 'sesi',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_pricelist_clinic_id
  ON public.clinic_pricelist (clinic_id, sort_order);

DROP TRIGGER IF EXISTS trg_clinic_pricelist_updated_at ON public.clinic_pricelist;
CREATE TRIGGER trg_clinic_pricelist_updated_at
  BEFORE UPDATE ON public.clinic_pricelist
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.clinic_pricelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access clinic_pricelist"
  ON public.clinic_pricelist
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Owner manage own clinic_pricelist"
  ON public.clinic_pricelist
  FOR ALL
  USING (
    get_my_role() = 'super_admin'
    OR (get_my_role() = ANY (ARRAY['owner', 'admin']) AND clinic_id = get_my_clinic_id())
  )
  WITH CHECK (
    get_my_role() = 'super_admin'
    OR (get_my_role() = ANY (ARRAY['owner', 'admin']) AND clinic_id = get_my_clinic_id())
  );

-- Lookup publik (tanpa login) dari harga aktif sebuah klinik, dipakai
-- landing page tenant. Sama pola dengan get_clinic_by_host: SECURITY
-- DEFINER supaya pengunjung anonim bisa baca tanpa RLS terbuka ke publik.
CREATE OR REPLACE FUNCTION public.get_clinic_pricelist(p_clinic_id uuid)
RETURNS TABLE (
  id uuid,
  category text,
  name text,
  description text,
  price numeric,
  price_unit text,
  sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cp.id, cp.category, cp.name, cp.description, cp.price, cp.price_unit, cp.sort_order
  FROM public.clinic_pricelist cp
  WHERE cp.clinic_id = p_clinic_id AND cp.is_active = true
  ORDER BY cp.sort_order, cp.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_clinic_pricelist(uuid) TO anon, authenticated;

-- Perluas get_clinic_by_host supaya landing page tenant bisa membaca
-- template + override konten + warna yang dipilih owner klinik.
CREATE OR REPLACE FUNCTION public.get_clinic_by_host(p_host text)
RETURNS TABLE (
  id uuid,
  name text,
  logo_url text,
  phone text,
  address text,
  design_style text,
  subdomain text,
  custom_domain text,
  custom_domain_status text,
  landing_template text,
  landing_content jsonb,
  landing_primary_color text,
  landing_accent_color text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.logo_url, c.phone, c.address, c.design_style,
         c.subdomain, c.custom_domain, c.custom_domain_status,
         c.landing_template, c.landing_content, c.landing_primary_color, c.landing_accent_color
  FROM public.clinics c
  WHERE lower(c.custom_domain) = lower(p_host)
     OR lower(c.subdomain) = lower(split_part(p_host, '.', 1))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_clinic_by_host(text) TO anon, authenticated;
