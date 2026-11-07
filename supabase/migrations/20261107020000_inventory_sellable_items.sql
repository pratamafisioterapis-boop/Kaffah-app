-- ---------------------------------------------------------------------------
-- Barang gudang yang juga dijual.
--
-- * inventory_items.is_sellable  : toggle "barang ini juga dijual".
-- * inventory_items.sell_category: kategori Katalog Harga (consumable / drug).
-- * price_catalog_items.inventory_item_id: tautan item katalog <-> barang gudang.
--   Saat toggle ON, item katalog dibuat/disinkronkan otomatis (harga dasar =
--   harga per satuan gudang, nama mengikuti barang). Saat OFF, item katalog
--   tertaut dihapus (invoice lama aman: nama & harga tersimpan di item invoice).
-- * Penjualan lewat invoice_items rekap harian / alkes_sales.items yang membawa
--   catalog_item_id otomatis mengurangi current_stock gudang (tambah/ubah/hapus
--   ikut menyesuaikan). Stok tidak pernah di bawah 0 dan penjualan tidak ditolak.
-- ---------------------------------------------------------------------------
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS is_sellable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sell_category text NOT NULL DEFAULT 'consumable';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_sell_category_check') THEN
    ALTER TABLE public.inventory_items
      ADD CONSTRAINT inventory_items_sell_category_check
      CHECK (sell_category IN ('consumable', 'drug'));
  END IF;
END $$;

ALTER TABLE public.price_catalog_items
  ADD COLUMN IF NOT EXISTS inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_price_catalog_items_inventory_item
  ON public.price_catalog_items (inventory_item_id) WHERE inventory_item_id IS NOT NULL;

-- Sinkron toggle -> katalog harga.
CREATE OR REPLACE FUNCTION public.sync_inventory_item_to_catalog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.is_sellable THEN
    INSERT INTO public.price_catalog_items
      (clinic_id, category, name, base_price, margin_pct, selling_price, inventory_item_id)
    VALUES
      (NEW.clinic_id, NEW.sell_category, NEW.item_name,
       ROUND(COALESCE(NEW.price_per_unit, 0)), 0, ROUND(COALESCE(NEW.price_per_unit, 0)), NEW.id)
    ON CONFLICT (inventory_item_id) WHERE inventory_item_id IS NOT NULL
    DO UPDATE SET name = EXCLUDED.name,
                  category = EXCLUDED.category,
                  updated_at = now();
  ELSE
    DELETE FROM public.price_catalog_items WHERE inventory_item_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_sync_inventory_item_to_catalog ON public.inventory_items;
CREATE TRIGGER trg_sync_inventory_item_to_catalog
  AFTER INSERT OR UPDATE OF is_sellable, item_name, sell_category ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_inventory_item_to_catalog();

-- Selisih qty terjual per barang gudang (new - old) -> kurangi stok.
CREATE OR REPLACE FUNCTION public.apply_sale_items_stock_delta(p_old jsonb, p_new jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  WITH lines AS (
    SELECT (it->>'catalog_item_id')::uuid AS catalog_id,
           COALESCE((it->>'qty')::numeric, 0) AS qty
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_new) = 'array' THEN p_new ELSE '[]'::jsonb END) it
     WHERE it ? 'catalog_item_id' AND it->>'catalog_item_id' ~* '^[0-9a-f-]{36}$'
    UNION ALL
    SELECT (it->>'catalog_item_id')::uuid, -COALESCE((it->>'qty')::numeric, 0)
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_old) = 'array' THEN p_old ELSE '[]'::jsonb END) it
     WHERE it ? 'catalog_item_id' AND it->>'catalog_item_id' ~* '^[0-9a-f-]{36}$'
  ), delta AS (
    SELECT pc.inventory_item_id AS item_id, SUM(l.qty) AS qty
      FROM lines l
      JOIN public.price_catalog_items pc ON pc.id = l.catalog_id
     WHERE pc.inventory_item_id IS NOT NULL
     GROUP BY pc.inventory_item_id
    HAVING SUM(l.qty) <> 0
  )
  UPDATE public.inventory_items ii
     SET current_stock = GREATEST(0, ii.current_stock - d.qty),
         updated_at = now()
    FROM delta d
   WHERE ii.id = d.item_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trg_recap_items_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.apply_sale_items_stock_delta(NULL, NEW.invoice_items);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.apply_sale_items_stock_delta(OLD.invoice_items, NULL);
  ELSE
    PERFORM public.apply_sale_items_stock_delta(OLD.invoice_items, NEW.invoice_items);
  END IF;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_daily_recaps_items_stock ON public.daily_recaps;
CREATE TRIGGER trg_daily_recaps_items_stock
  AFTER INSERT OR DELETE OR UPDATE OF invoice_items ON public.daily_recaps
  FOR EACH ROW EXECUTE FUNCTION public.trg_recap_items_stock();

CREATE OR REPLACE FUNCTION public.trg_alkes_items_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.apply_sale_items_stock_delta(NULL, NEW.items);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.apply_sale_items_stock_delta(OLD.items, NULL);
  ELSE
    PERFORM public.apply_sale_items_stock_delta(OLD.items, NEW.items);
  END IF;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_alkes_sales_items_stock ON public.alkes_sales;
CREATE TRIGGER trg_alkes_sales_items_stock
  AFTER INSERT OR DELETE OR UPDATE OF items ON public.alkes_sales
  FOR EACH ROW EXECUTE FUNCTION public.trg_alkes_items_stock();

REVOKE ALL ON FUNCTION public.apply_sale_items_stock_delta(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_inventory_item_to_catalog() FROM PUBLIC, anon, authenticated;
