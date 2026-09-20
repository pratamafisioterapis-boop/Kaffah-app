-- Adds edit/delete support for "Riwayat Pembelian" (inventory_stock_ins) rows
-- on the owner Stok Gudang page, mirroring update_inventory_stock_out /
-- delete_inventory_stock_out. restock_inventory_item blends each batch into
-- inventory_items.current_stock and price_per_unit (a running weighted
-- average), so correcting a batch reverses that blend first, then re-applies
-- it with the corrected numbers using the same averaging formula.

CREATE OR REPLACE FUNCTION public.update_inventory_stock_in(
  p_id uuid,
  p_quantity numeric,
  p_total_price numeric,
  p_purchase_date date,
  p_notes text DEFAULT NULL::text
)
 RETURNS inventory_stock_ins
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_clinic_id uuid := get_my_clinic_id();
  v_stock_in public.inventory_stock_ins;
  v_item public.inventory_items;
  v_reverted_stock numeric;
  v_reverted_price numeric;
  v_new_stock numeric;
  v_new_avg_price numeric;
  v_batch_unit_price numeric;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Kuantitas pembelian harus lebih dari 0';
  END IF;
  IF p_total_price IS NULL OR p_total_price < 0 THEN
    RAISE EXCEPTION 'Harga total tidak valid';
  END IF;

  SELECT * INTO v_stock_in FROM public.inventory_stock_ins
    WHERE id = p_id AND (clinic_id = v_clinic_id OR get_my_role() = 'super_admin')
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Riwayat pembelian tidak ditemukan';
  END IF;

  SELECT * INTO v_item FROM public.inventory_items
    WHERE id = v_stock_in.item_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Barang tidak ditemukan';
  END IF;

  v_reverted_stock := v_item.current_stock - v_stock_in.quantity;

  IF v_reverted_stock < 0 THEN
    RAISE EXCEPTION 'Stok saat ini tidak cukup untuk membatalkan riwayat ini (sudah terpakai). Sisa stok saat ini: % %', v_item.current_stock, v_item.unit;
  END IF;

  IF v_reverted_stock > 0 THEN
    v_reverted_price := ((v_item.current_stock * v_item.price_per_unit) - v_stock_in.total_price) / v_reverted_stock;
  ELSE
    v_reverted_price := 0;
  END IF;

  v_batch_unit_price := p_total_price / p_quantity;
  v_new_stock := v_reverted_stock + p_quantity;

  IF v_new_stock > 0 THEN
    v_new_avg_price := ((v_reverted_stock * v_reverted_price) + p_total_price) / v_new_stock;
  ELSE
    v_new_avg_price := v_batch_unit_price;
  END IF;

  UPDATE public.inventory_items
    SET current_stock = v_new_stock,
        price_per_unit = v_new_avg_price,
        updated_at = now()
    WHERE id = v_item.id;

  UPDATE public.inventory_stock_ins
    SET quantity = p_quantity,
        total_price = p_total_price,
        unit_price = v_batch_unit_price,
        purchase_date = COALESCE(p_purchase_date, v_stock_in.purchase_date),
        notes = p_notes
    WHERE id = p_id
    RETURNING * INTO v_stock_in;

  RETURN v_stock_in;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_inventory_stock_in(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_clinic_id uuid := get_my_clinic_id();
  v_stock_in public.inventory_stock_ins;
  v_item public.inventory_items;
  v_reverted_stock numeric;
  v_reverted_price numeric;
BEGIN
  SELECT * INTO v_stock_in FROM public.inventory_stock_ins
    WHERE id = p_id AND (clinic_id = v_clinic_id OR get_my_role() = 'super_admin')
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Riwayat pembelian tidak ditemukan';
  END IF;

  SELECT * INTO v_item FROM public.inventory_items
    WHERE id = v_stock_in.item_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Barang tidak ditemukan';
  END IF;

  v_reverted_stock := v_item.current_stock - v_stock_in.quantity;

  IF v_reverted_stock < 0 THEN
    RAISE EXCEPTION 'Stok saat ini tidak cukup untuk menghapus riwayat ini (sudah terpakai). Sisa stok saat ini: % %', v_item.current_stock, v_item.unit;
  END IF;

  IF v_reverted_stock > 0 THEN
    v_reverted_price := ((v_item.current_stock * v_item.price_per_unit) - v_stock_in.total_price) / v_reverted_stock;
  ELSE
    v_reverted_price := 0;
  END IF;

  UPDATE public.inventory_items
    SET current_stock = v_reverted_stock,
        price_per_unit = v_reverted_price,
        updated_at = now()
    WHERE id = v_item.id;

  DELETE FROM public.inventory_stock_ins WHERE id = p_id;
END;
$function$;
