-- Adds edit/delete support for "Riwayat Pengambilan" (inventory_stock_outs)
-- rows on the admin Ambil Barang Gudang page. Both RPCs mirror
-- take_inventory_stock's clinic scoping (clinic_id match or super_admin)
-- and keep inventory_items.current_stock and the linked admin_expenses
-- row in sync with the stock-out record, the same invariant
-- take_inventory_stock establishes on insert.

CREATE OR REPLACE FUNCTION public.update_inventory_stock_out(
  p_id uuid,
  p_quantity numeric,
  p_taken_date date,
  p_notes text DEFAULT NULL::text
)
 RETURNS inventory_stock_outs
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_clinic_id uuid := get_my_clinic_id();
  v_stock_out public.inventory_stock_outs;
  v_item public.inventory_items;
  v_new_stock numeric;
  v_new_total_cost numeric;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Kuantitas pengambilan harus lebih dari 0';
  END IF;

  SELECT * INTO v_stock_out FROM public.inventory_stock_outs
    WHERE id = p_id AND (clinic_id = v_clinic_id OR get_my_role() = 'super_admin')
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Riwayat pengambilan tidak ditemukan';
  END IF;

  SELECT * INTO v_item FROM public.inventory_items
    WHERE id = v_stock_out.item_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Barang tidak ditemukan';
  END IF;

  v_new_stock := v_item.current_stock + v_stock_out.quantity - p_quantity;

  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Stok tidak mencukupi untuk perubahan ini. Sisa stok saat ini: % %', v_item.current_stock, v_item.unit;
  END IF;

  v_new_total_cost := ROUND(p_quantity * v_stock_out.unit_price, 2);

  UPDATE public.inventory_items
    SET current_stock = v_new_stock,
        updated_at = now()
    WHERE id = v_item.id;

  IF v_stock_out.admin_expense_id IS NOT NULL THEN
    UPDATE public.admin_expenses
      SET amount = v_new_total_cost,
          transaction_date = COALESCE(p_taken_date, v_stock_out.taken_date),
          description = 'Ambil barang gudang: ' || v_item.item_name || ' (' || p_quantity || ' ' || v_item.unit || ')' ||
            CASE WHEN p_notes IS NOT NULL AND p_notes <> '' THEN ' - ' || p_notes ELSE '' END
      WHERE id = v_stock_out.admin_expense_id;
  END IF;

  UPDATE public.inventory_stock_outs
    SET quantity = p_quantity,
        total_cost = v_new_total_cost,
        taken_date = COALESCE(p_taken_date, v_stock_out.taken_date),
        notes = p_notes
    WHERE id = p_id
    RETURNING * INTO v_stock_out;

  RETURN v_stock_out;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_inventory_stock_out(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_clinic_id uuid := get_my_clinic_id();
  v_stock_out public.inventory_stock_outs;
BEGIN
  SELECT * INTO v_stock_out FROM public.inventory_stock_outs
    WHERE id = p_id AND (clinic_id = v_clinic_id OR get_my_role() = 'super_admin')
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Riwayat pengambilan tidak ditemukan';
  END IF;

  UPDATE public.inventory_items
    SET current_stock = current_stock + v_stock_out.quantity,
        updated_at = now()
    WHERE id = v_stock_out.item_id;

  IF v_stock_out.admin_expense_id IS NOT NULL THEN
    DELETE FROM public.admin_expenses WHERE id = v_stock_out.admin_expense_id;
  END IF;

  DELETE FROM public.inventory_stock_outs WHERE id = p_id;
END;
$function$;
