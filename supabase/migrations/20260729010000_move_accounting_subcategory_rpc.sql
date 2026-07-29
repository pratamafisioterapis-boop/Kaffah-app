-- Move-subcategory feature: lets an owner change a subcategory's parent
-- category (and rename it) from the Manajemen Kategori Akuntansi UI,
-- backfilling every transaction table that snapshots the parent category
-- name so historical data stays consistent with the new grouping.
--
-- Unlike merge_accounting_subcategory (which consolidates two
-- subcategories into one and deletes the source), this keeps the
-- subcategory's identity and its existing transaction history intact —
-- it only moves which top-level category it rolls up under.

CREATE OR REPLACE FUNCTION public.move_accounting_subcategory(p_id uuid, p_name text, p_category_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_clinic_id uuid := get_my_clinic_id();
  v_sub public.accounting_subcategories;
  v_old_name text;
  v_new_category_name text;
  v_owner_count int;
  v_admin_count int;
  v_inventory_count int;
BEGIN
  IF p_id IS NULL OR p_name IS NULL OR trim(p_name) = '' OR p_category_id IS NULL THEN
    RAISE EXCEPTION 'Nama sub-kategori dan kategori tujuan wajib diisi';
  END IF;

  SELECT * INTO v_sub FROM public.accounting_subcategories
    WHERE id = p_id AND (clinic_id = v_clinic_id OR get_my_role() = 'super_admin');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sub-kategori tidak ditemukan';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.accounting_categories WHERE id = p_category_id AND clinic_id = v_sub.clinic_id) THEN
    RAISE EXCEPTION 'Kategori tujuan tidak ditemukan atau beda klinik';
  END IF;

  v_old_name := v_sub.subcategory_name;

  SELECT category_name INTO v_new_category_name FROM public.accounting_categories WHERE id = p_category_id;

  UPDATE public.accounting_subcategories
    SET subcategory_name = p_name, category_id = p_category_id, updated_at = now()
    WHERE id = p_id;

  -- owner_expenditures: sub_category is a uuid FK-like column, only the parent category text snapshot needs refreshing
  UPDATE public.owner_expenditures
    SET category = v_new_category_name
    WHERE sub_category = p_id AND clinic_id = v_sub.clinic_id;
  GET DIAGNOSTICS v_owner_count = ROW_COUNT;

  -- admin_expenses: match new-style rows by id, legacy rows by the subcategory's old name
  UPDATE public.admin_expenses
    SET category = v_new_category_name, sub_category = p_name
    WHERE clinic_id = v_sub.clinic_id
      AND (sub_category_id = p_id OR (sub_category_id IS NULL AND sub_category = v_old_name));
  GET DIAGNOSTICS v_admin_count = ROW_COUNT;

  -- inventory items assigned to this subcategory follow it to the new parent category
  UPDATE public.inventory_items
    SET category_id = p_category_id
    WHERE subcategory_id = p_id AND clinic_id = v_sub.clinic_id;
  GET DIAGNOSTICS v_inventory_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'owner_expenditures_updated', v_owner_count,
    'admin_expenses_updated', v_admin_count,
    'inventory_items_updated', v_inventory_count
  );
END;
$function$;
