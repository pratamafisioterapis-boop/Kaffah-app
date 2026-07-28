-- Captures the FULL prior body of take_inventory_stock (previously
-- untracked in the repo — applied ad hoc via Supabase) plus the new
-- behavior: resolve category_name/subcategory_name from the item's
-- assigned category_id/subcategory_id when present, falling back to the
-- exact previous hardcoded literals ('Operasional Klinik' / 'Stok Gudang')
-- when the item has no assignment. Also writes sub_category_id.
-- SECURITY DEFINER preserved. All existing validation/exception logic
-- preserved verbatim. This RPC is shared across all clinics; behavior for
-- any item without an assigned category_id/subcategory_id is unchanged.

CREATE OR REPLACE FUNCTION public.take_inventory_stock(p_item_id uuid, p_quantity numeric, p_taken_date date DEFAULT CURRENT_DATE, p_notes text DEFAULT NULL::text)
 RETURNS inventory_stock_outs
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_clinic_id uuid := get_my_clinic_id();
  v_item public.inventory_items;
  v_total_cost numeric;
  v_expense_id uuid;
  v_stock_out public.inventory_stock_outs;
  v_category_name text;
  v_subcategory_name text;
  v_subcategory_id uuid;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Kuantitas pengambilan harus lebih dari 0';
  END IF;

  SELECT * INTO v_item FROM public.inventory_items
    WHERE id = p_item_id AND (clinic_id = v_clinic_id OR get_my_role() = 'super_admin')
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Barang tidak ditemukan';
  END IF;

  IF v_item.current_stock < p_quantity THEN
    RAISE EXCEPTION 'Stok tidak mencukupi. Sisa stok: % %', v_item.current_stock, v_item.unit;
  END IF;

  v_total_cost := ROUND(p_quantity * v_item.price_per_unit, 2);

  IF v_item.category_id IS NOT NULL AND v_item.subcategory_id IS NOT NULL THEN
    SELECT ac.category_name, asub.subcategory_name, asub.id
      INTO v_category_name, v_subcategory_name, v_subcategory_id
    FROM public.accounting_subcategories asub
    JOIN public.accounting_categories ac ON ac.id = asub.category_id
    WHERE asub.id = v_item.subcategory_id AND ac.id = v_item.category_id;
  END IF;

  IF v_category_name IS NULL THEN
    v_category_name := 'Operasional Klinik';
    v_subcategory_name := 'Stok Gudang';
    v_subcategory_id := NULL;
  END IF;

  INSERT INTO public.admin_expenses (
    clinic_id, transaction_date, input_time, amount, category, sub_category, sub_category_id, description, created_by, created_at
  ) VALUES (
    v_item.clinic_id, p_taken_date, CURRENT_TIME, v_total_cost, v_category_name, v_subcategory_name, v_subcategory_id,
    'Ambil barang gudang: ' || v_item.item_name || ' (' || p_quantity || ' ' || v_item.unit || ')' ||
      CASE WHEN p_notes IS NOT NULL AND p_notes <> '' THEN ' - ' || p_notes ELSE '' END,
    auth.uid(), now()
  ) RETURNING id INTO v_expense_id;

  UPDATE public.inventory_items
    SET current_stock = current_stock - p_quantity,
        updated_at = now()
    WHERE id = p_item_id;

  INSERT INTO public.inventory_stock_outs (
    clinic_id, item_id, quantity, unit, unit_price, total_cost, taken_date, notes, taken_by, admin_expense_id
  ) VALUES (
    v_item.clinic_id, p_item_id, p_quantity, v_item.unit, v_item.price_per_unit, v_total_cost, p_taken_date, p_notes, auth.uid(), v_expense_id
  ) RETURNING * INTO v_stock_out;

  RETURN v_stock_out;
END;
$function$;
