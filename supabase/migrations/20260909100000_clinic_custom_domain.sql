-- Custom domain per klinik: setiap klinik bisa dapat subdomain gratis
-- (mis. kliniksehat.clinara.id) dan opsional menghubungkan domain sendiri
-- (mis. kliniksehat.com). Kolom status/verified_at dipakai untuk melacak
-- proses verifikasi domain kustom di Vercel (lihat edge function
-- manage-clinic-domain).

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS subdomain text,
  ADD COLUMN IF NOT EXISTS custom_domain text,
  ADD COLUMN IF NOT EXISTS custom_domain_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS custom_domain_verified_at timestamptz;

ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_custom_domain_status_check;
ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_custom_domain_status_check
  CHECK (custom_domain_status IN ('none', 'pending', 'verified', 'failed'));

-- Subdomain harus 3-63 karakter, huruf kecil/angka/strip, tidak diawali
-- atau diakhiri strip (aturan label DNS standar).
ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_subdomain_format_check;
ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_subdomain_format_check
  CHECK (subdomain IS NULL OR subdomain ~ '^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$');

ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_custom_domain_format_check;
ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_custom_domain_format_check
  CHECK (custom_domain IS NULL OR custom_domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$');

-- Cegah klinik memakai subdomain yang bentrok dengan domain sistem sendiri.
ALTER TABLE public.clinics
  DROP CONSTRAINT IF EXISTS clinics_subdomain_not_reserved_check;
ALTER TABLE public.clinics
  ADD CONSTRAINT clinics_subdomain_not_reserved_check
  CHECK (subdomain IS NULL OR subdomain NOT IN (
    'www', 'app', 'api', 'admin', 'super-admin', 'mail', 'ftp', 'clinara',
    'kaffahphysio', 'staging', 'preview', 'dev', 'localhost', 'assets', 'cdn'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS clinics_subdomain_unique_idx
  ON public.clinics (lower(subdomain)) WHERE subdomain IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clinics_custom_domain_unique_idx
  ON public.clinics (lower(custom_domain)) WHERE custom_domain IS NOT NULL;

-- Lookup publik (tanpa login) dari hostname pengunjung ke klinik tujuan,
-- dipakai frontend untuk merender landing page klinik saat diakses lewat
-- subdomain atau custom domain miliknya. Hanya kolom aman untuk publik yang
-- dikembalikan (bukan seluruh baris clinics).
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
  custom_domain_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.logo_url, c.phone, c.address, c.design_style,
         c.subdomain, c.custom_domain, c.custom_domain_status
  FROM public.clinics c
  WHERE lower(c.custom_domain) = lower(p_host)
     OR lower(c.subdomain) = lower(split_part(p_host, '.', 1))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_clinic_by_host(text) TO anon, authenticated;

COMMENT ON COLUMN public.clinics.subdomain IS 'Subdomain gratis klinik di bawah clinara.id, mis. "kliniksehat" -> kliniksehat.clinara.id';
COMMENT ON COLUMN public.clinics.custom_domain IS 'Domain kustom milik klinik sendiri, mis. kliniksehat.com. Dikelola lewat edge function manage-clinic-domain (integrasi Vercel Domains API).';
COMMENT ON COLUMN public.clinics.custom_domain_status IS 'none | pending (menunggu verifikasi DNS) | verified | failed';
