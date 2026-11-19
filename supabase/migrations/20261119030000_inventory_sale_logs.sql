-- ---------------------------------------------------------------------------
-- Riwayat penjualan barang gudang (barang yang dibeli pasien).
--
-- Sebelumnya penjualan lewat invoice_items / goods_items rekap harian dan
-- alkes_sales hanya mengurangi inventory_items.current_stock tanpa jejak.
-- Tabel ini adalah buku besar (ledger) yang hanya diisi trigger:
--   qty > 0 : terjual,   qty < 0 : koreksi / pembatalan (qty dikurangi,
--   item dihapus, atau rekap/penjualan dihapus).
-- Sengaja BUKAN inventory_stock_outs: tabel itu mewakili pengambilan manual
-- yang dihitung sebagai biaya (Stok Gudang) di akuntansi dan punya fungsi
-- edit/hapus yang menyesuaikan stok sendiri, sehingga bisa dobel hitung.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_sale_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('daily_recap', 'alkes_sale')),
  source_id uuid NOT NULL,
  patient_id uuid,
  patient_name text,
  sale_date date,
  qty numeric NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_sale_logs_item
  ON public.inventory_sale_logs (item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_sale_logs_clinic
  ON public.inventory_sale_logs (clinic_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sale_logs_source
  ON public.inventory_sale_logs (source_type, source_id);

ALTER TABLE public.inventory_sale_logs ENABLE ROW LEVEL SECURITY;

-- Hanya baca untuk staf klinik; penulisan hanya lewat trigger (SECURITY DEFINER).
DROP POLICY IF EXISTS "Staff read own clinic inventory sale logs" ON public.inventory_sale_logs;
CREATE POLICY "Staff read own clinic inventory sale logs" ON public.inventory_sale_logs
  FOR SELECT
  USING (
    get_my_role() = 'super_admin'
    OR (get_my_role() IN ('owner', 'admin', 'clinic_admin') AND clinic_id = get_my_clinic_id())
  );

-- Selisih (baru - lama) per barang gudang -> baris ledger.
CREATE OR REPLACE FUNCTION public.log_sale_items_delta(
  p_source_type text,
  p_source_id uuid,
  p_clinic_id uuid,
  p_patient_id uuid,
  p_patient_name text,
  p_sale_date date,
  p_old jsonb,
  p_new jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO public.inventory_sale_logs
    (clinic_id, item_id, source_type, source_id, patient_id, patient_name, sale_date, qty, unit_price, amount)
  WITH lines AS (
    SELECT (it->>'catalog_item_id')::uuid AS catalog_id,
           COALESCE((it->>'qty')::numeric, 0) AS qty,
           COALESCE((it->>'qty')::numeric, 0) * COALESCE((it->>'price')::numeric, 0)
             - COALESCE((it->>'discount')::numeric, 0) AS amount
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_new) = 'array' THEN p_new ELSE '[]'::jsonb END) it
     WHERE it ? 'catalog_item_id' AND it->>'catalog_item_id' ~* '^[0-9a-f-]{36}$'
    UNION ALL
    SELECT (it->>'catalog_item_id')::uuid,
           -COALESCE((it->>'qty')::numeric, 0),
           -(COALESCE((it->>'qty')::numeric, 0) * COALESCE((it->>'price')::numeric, 0)
             - COALESCE((it->>'discount')::numeric, 0))
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_old) = 'array' THEN p_old ELSE '[]'::jsonb END) it
     WHERE it ? 'catalog_item_id' AND it->>'catalog_item_id' ~* '^[0-9a-f-]{36}$'
  ), delta AS (
    SELECT pc.inventory_item_id AS item_id, SUM(l.qty) AS qty, SUM(l.amount) AS amount
      FROM lines l
      JOIN public.price_catalog_items pc ON pc.id = l.catalog_id
     WHERE pc.inventory_item_id IS NOT NULL
     GROUP BY pc.inventory_item_id
    HAVING SUM(l.qty) <> 0
  )
  SELECT p_clinic_id, d.item_id, p_source_type, p_source_id, p_patient_id, p_patient_name, p_sale_date,
         d.qty, ROUND(ABS(d.amount / d.qty)), d.amount
    FROM delta d;
END;
$fn$;

-- Trigger: rekap harian (invoice_items & goods_items).
CREATE OR REPLACE FUNCTION public.trg_recap_items_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r public.daily_recaps;
  v_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    r := OLD;
    PERFORM public.apply_sale_items_stock_delta(OLD.invoice_items, NULL);
  ELSIF TG_OP = 'INSERT' THEN
    r := NEW;
    PERFORM public.apply_sale_items_stock_delta(NULL, NEW.invoice_items);
  ELSE
    r := NEW;
    PERFORM public.apply_sale_items_stock_delta(OLD.invoice_items, NEW.invoice_items);
  END IF;
  SELECT COALESCE(p.full_name, to_jsonb(r)->>'guest_name') INTO v_name
    FROM (SELECT 1) x LEFT JOIN public.patients p ON p.id = r.patient_id;
  PERFORM public.log_sale_items_delta(
    'daily_recap', r.id, r.clinic_id, r.patient_id, v_name, r.recap_date,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.invoice_items END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.invoice_items END);
  RETURN NULL;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trg_recap_goods_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r public.daily_recaps;
  v_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    r := OLD;
    PERFORM public.apply_sale_items_stock_delta(OLD.goods_items, NULL);
  ELSIF TG_OP = 'INSERT' THEN
    r := NEW;
    PERFORM public.apply_sale_items_stock_delta(NULL, NEW.goods_items);
  ELSE
    r := NEW;
    PERFORM public.apply_sale_items_stock_delta(OLD.goods_items, NEW.goods_items);
  END IF;
  SELECT COALESCE(p.full_name, to_jsonb(r)->>'guest_name') INTO v_name
    FROM (SELECT 1) x LEFT JOIN public.patients p ON p.id = r.patient_id;
  PERFORM public.log_sale_items_delta(
    'daily_recap', r.id, r.clinic_id, r.patient_id, v_name, r.recap_date,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.goods_items END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.goods_items END);
  RETURN NULL;
END;
$fn$;

-- Trigger: penjualan alkes.
CREATE OR REPLACE FUNCTION public.trg_alkes_items_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r public.alkes_sales;
  v_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    r := OLD;
    PERFORM public.apply_sale_items_stock_delta(OLD.items, NULL);
  ELSIF TG_OP = 'INSERT' THEN
    r := NEW;
    PERFORM public.apply_sale_items_stock_delta(NULL, NEW.items);
  ELSE
    r := NEW;
    PERFORM public.apply_sale_items_stock_delta(OLD.items, NEW.items);
  END IF;
  SELECT p.full_name INTO v_name
    FROM (SELECT 1) x LEFT JOIN public.patients p ON p.id = r.patient_id;
  PERFORM public.log_sale_items_delta(
    'alkes_sale', r.id, r.clinic_id, r.patient_id, v_name, r.sale_date,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.items END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.items END);
  RETURN NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.log_sale_items_delta(text, uuid, uuid, uuid, text, date, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- Isi awal dari penjualan yang sudah ada (stok sudah terpotong, hanya dicatat).
-- Hanya jalan sekali, saat tabel masih kosong.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.inventory_sale_logs) THEN
    RETURN;
  END IF;

  INSERT INTO public.inventory_sale_logs
    (clinic_id, item_id, source_type, source_id, patient_id, patient_name, sale_date, qty, unit_price, amount)
  SELECT r.clinic_id, pc.inventory_item_id, 'daily_recap', r.id, r.patient_id,
         COALESCE(p.full_name, to_jsonb(r)->>'guest_name'), r.recap_date,
         SUM(COALESCE((it->>'qty')::numeric, 0)),
         ROUND(SUM(COALESCE((it->>'qty')::numeric, 0) * COALESCE((it->>'price')::numeric, 0) - COALESCE((it->>'discount')::numeric, 0))
               / NULLIF(SUM(COALESCE((it->>'qty')::numeric, 0)), 0)),
         SUM(COALESCE((it->>'qty')::numeric, 0) * COALESCE((it->>'price')::numeric, 0) - COALESCE((it->>'discount')::numeric, 0))
    FROM public.daily_recaps r
    LEFT JOIN public.patients p ON p.id = r.patient_id
    CROSS JOIN LATERAL jsonb_array_elements(
      (CASE WHEN jsonb_typeof(r.invoice_items) = 'array' THEN r.invoice_items ELSE '[]'::jsonb END)
      || (CASE WHEN jsonb_typeof(r.goods_items) = 'array' THEN r.goods_items ELSE '[]'::jsonb END)
    ) it
    JOIN public.price_catalog_items pc
      ON it ? 'catalog_item_id' AND it->>'catalog_item_id' ~* '^[0-9a-f-]{36}$'
     AND pc.id = (it->>'catalog_item_id')::uuid AND pc.inventory_item_id IS NOT NULL
   GROUP BY r.clinic_id, pc.inventory_item_id, r.id, r.patient_id, p.full_name, to_jsonb(r)->>'guest_name', r.recap_date
  HAVING SUM(COALESCE((it->>'qty')::numeric, 0)) <> 0;

  INSERT INTO public.inventory_sale_logs
    (clinic_id, item_id, source_type, source_id, patient_id, patient_name, sale_date, qty, unit_price, amount)
  SELECT s.clinic_id, pc.inventory_item_id, 'alkes_sale', s.id, s.patient_id, p.full_name, s.sale_date,
         SUM(COALESCE((it->>'qty')::numeric, 0)),
         ROUND(SUM(COALESCE((it->>'qty')::numeric, 0) * COALESCE((it->>'price')::numeric, 0) - COALESCE((it->>'discount')::numeric, 0))
               / NULLIF(SUM(COALESCE((it->>'qty')::numeric, 0)), 0)),
         SUM(COALESCE((it->>'qty')::numeric, 0) * COALESCE((it->>'price')::numeric, 0) - COALESCE((it->>'discount')::numeric, 0))
    FROM public.alkes_sales s
    LEFT JOIN public.patients p ON p.id = s.patient_id
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.items) = 'array' THEN s.items ELSE '[]'::jsonb END) it
    JOIN public.price_catalog_items pc
      ON it ? 'catalog_item_id' AND it->>'catalog_item_id' ~* '^[0-9a-f-]{36}$'
     AND pc.id = (it->>'catalog_item_id')::uuid AND pc.inventory_item_id IS NOT NULL
   GROUP BY s.clinic_id, pc.inventory_item_id, s.id, s.patient_id, p.full_name, s.sale_date
  HAVING SUM(COALESCE((it->>'qty')::numeric, 0)) <> 0;
END $$;
