-- ---------------------------------------------------------------------------
-- Penjualan alat kesehatan (alkes) ke pasien - dicatat TERPISAH dari rekap
-- harian. Dipakai saat pasien paket membeli alkes di tengah paket (mis. sesi
-- ke-3/4): tidak mengubah kuota paket, tidak masuk perhitungan insentif
-- terapis, dan tidak memicu aturan SOAP-sebelum-bayar. Punya invoice sendiri
-- (cetak / unduh PDF) lewat template kwitansi klinik.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alkes_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL DEFAULT get_my_clinic_id() REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  sale_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Makassar')::date),
  -- [{category, name, qty, price, discount}] - format sama dengan daily_recaps.invoice_items
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'Cash',
  invoice_number text,
  notes text,
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alkes_sales_items_is_array CHECK (jsonb_typeof(items) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_alkes_sales_clinic_date ON public.alkes_sales (clinic_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_alkes_sales_patient ON public.alkes_sales (patient_id);
CREATE INDEX IF NOT EXISTS idx_alkes_sales_created_by ON public.alkes_sales (created_by);

-- Total & nomor invoice dihitung server supaya tidak bisa dipalsukan dari klien.
CREATE OR REPLACE FUNCTION public.alkes_sales_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  SELECT COALESCE(SUM(
           COALESCE((it->>'qty')::numeric, 0) * COALESCE((it->>'price')::numeric, 0)
           - COALESCE((it->>'discount')::numeric, 0)
         ), 0)
    INTO NEW.total
    FROM jsonb_array_elements(NEW.items) AS it;

  IF NEW.total < 0 THEN
    RAISE EXCEPTION 'Total penjualan alkes tidak boleh negatif';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'INV/ALKES/' || to_char(NEW.sale_date, 'YYYYMMDD') || '/'
      || upper(substr(NEW.id::text, 1, 6));
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS alkes_sales_before_write ON public.alkes_sales;
CREATE TRIGGER alkes_sales_before_write
  BEFORE INSERT OR UPDATE ON public.alkes_sales
  FOR EACH ROW EXECUTE FUNCTION public.alkes_sales_before_write();

ALTER TABLE public.alkes_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage own clinic alkes sales" ON public.alkes_sales;
CREATE POLICY "Staff manage own clinic alkes sales" ON public.alkes_sales
  FOR ALL
  USING (
    get_my_role() = 'super_admin'
    OR (get_my_role() IN ('owner', 'admin', 'clinic_admin') AND clinic_id = get_my_clinic_id())
  )
  WITH CHECK (
    get_my_role() = 'super_admin'
    OR (get_my_role() IN ('owner', 'admin', 'clinic_admin') AND clinic_id = get_my_clinic_id())
  );
