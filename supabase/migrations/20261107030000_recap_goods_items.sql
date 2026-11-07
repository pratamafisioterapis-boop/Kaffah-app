-- ---------------------------------------------------------------------------
-- Penjualan barang gudang di Edit Recap Harian (klinik non-Kwitansi, mis. Kaffah).
--
-- Sengaja kolom terpisah dari daily_recaps.amount (sama seperti tips_amount):
--  * nominal terapi tetap dihitung server (SOAP-first) & terkunci setelah invoice;
--  * akuntansi memisahkan pendapatan terapi (amount) dan penjualan barang;
--  * insentif terapis (berbasis amount) tidak ikut membesar.
-- Total yang dibayar pasien = amount + goods_amount (metode bayar mengikuti
-- metode recap, sama seperti tips).
--
-- goods_items : [{catalog_item_id, category, name, qty, price, discount}]
-- goods_amount: dihitung server dari goods_items (tidak bisa dipalsukan klien).
-- Stok gudang otomatis berkurang lewat apply_sale_items_stock_delta (migrasi
-- 20261107020000), termasuk saat qty diubah / recap dihapus.
-- ---------------------------------------------------------------------------
ALTER TABLE public.daily_recaps
  ADD COLUMN IF NOT EXISTS goods_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS goods_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE public.daily_recaps DROP CONSTRAINT IF EXISTS chk_daily_recaps_goods_items_array;
ALTER TABLE public.daily_recaps
  ADD CONSTRAINT chk_daily_recaps_goods_items_array CHECK (jsonb_typeof(goods_items) = 'array');

ALTER TABLE public.daily_recaps DROP CONSTRAINT IF EXISTS chk_daily_recaps_goods_amount_nonneg;
ALTER TABLE public.daily_recaps
  ADD CONSTRAINT chk_daily_recaps_goods_amount_nonneg CHECK (goods_amount >= 0);

CREATE OR REPLACE FUNCTION public.trg_recap_goods_amount()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW.goods_items IS NULL OR jsonb_typeof(NEW.goods_items) <> 'array' THEN
    NEW.goods_items := '[]'::jsonb;
  END IF;
  SELECT COALESCE(SUM(
           COALESCE((it->>'qty')::numeric, 0) * COALESCE((it->>'price')::numeric, 0)
           - COALESCE((it->>'discount')::numeric, 0)
         ), 0)
    INTO NEW.goods_amount
    FROM jsonb_array_elements(NEW.goods_items) AS it;
  IF NEW.goods_amount < 0 THEN
    RAISE EXCEPTION 'Total penjualan barang tidak boleh negatif';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_daily_recaps_goods_amount ON public.daily_recaps;
CREATE TRIGGER trg_daily_recaps_goods_amount
  BEFORE INSERT OR UPDATE OF goods_items ON public.daily_recaps
  FOR EACH ROW EXECUTE FUNCTION public.trg_recap_goods_amount();

-- Stok gudang mengikuti goods_items.
CREATE OR REPLACE FUNCTION public.trg_recap_goods_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.apply_sale_items_stock_delta(NULL, NEW.goods_items);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.apply_sale_items_stock_delta(OLD.goods_items, NULL);
  ELSE
    PERFORM public.apply_sale_items_stock_delta(OLD.goods_items, NEW.goods_items);
  END IF;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_daily_recaps_goods_stock ON public.daily_recaps;
CREATE TRIGGER trg_daily_recaps_goods_stock
  AFTER INSERT OR DELETE OR UPDATE OF goods_items ON public.daily_recaps
  FOR EACH ROW EXECUTE FUNCTION public.trg_recap_goods_stock();

REVOKE ALL ON FUNCTION public.trg_recap_goods_stock() FROM PUBLIC, anon, authenticated;
