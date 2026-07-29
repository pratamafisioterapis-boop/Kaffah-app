-- Merge-subcategory feature: lets an owner move all transactions tagged
-- with one subcategory into another subcategory, then deletes the source
-- subcategory. Used to consolidate legacy subcategory names (e.g. "JASA
-- ADI") into the new finance-framework subcategories (e.g. "Jasa/Fee
-- Fisioterapis (per sesi/insentif)") added in the previous migration.
--
-- Re-tags every transaction table that references a subcategory:
--   - owner_expenditures.sub_category (uuid) -> repointed to target id
--   - admin_expenses.sub_category_id (uuid, new rows) and .sub_category
--     (text, legacy rows matched by name) -> repointed/renamed to target
--   - inventory_items.subcategory_id/category_id -> repointed to target
-- Both category text snapshots are refreshed to the target's parent
-- category name. SECURITY DEFINER, scoped to the caller's clinic via
-- get_my_clinic_id() (or super_admin).

CREATE OR REPLACE FUNCTION public.merge_accounting_subcategory(p_source_id uuid, p_target_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_clinic_id uuid := get_my_clinic_id();
  v_source public.accounting_subcategories;
  v_target public.accounting_subcategories;
  v_target_category_name text;
  v_owner_count int;
  v_admin_count int;
  v_inventory_count int;
BEGIN
  IF p_source_id IS NULL OR p_target_id IS NULL THEN
    RAISE EXCEPTION 'Subkategori sumber dan tujuan wajib diisi';
  END IF;

  IF p_source_id = p_target_id THEN
    RAISE EXCEPTION 'Subkategori sumber dan tujuan tidak boleh sama';
  END IF;

  SELECT * INTO v_source FROM public.accounting_subcategories
    WHERE id = p_source_id AND (clinic_id = v_clinic_id OR get_my_role() = 'super_admin');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subkategori sumber tidak ditemukan';
  END IF;

  SELECT * INTO v_target FROM public.accounting_subcategories
    WHERE id = p_target_id AND clinic_id = v_source.clinic_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subkategori tujuan tidak ditemukan atau beda klinik';
  END IF;

  SELECT category_name INTO v_target_category_name
    FROM public.accounting_categories WHERE id = v_target.category_id;

  -- owner_expenditures: sub_category is a uuid FK-like column
  UPDATE public.owner_expenditures
    SET category = v_target_category_name, sub_category = p_target_id
    WHERE sub_category = p_source_id AND clinic_id = v_source.clinic_id;
  GET DIAGNOSTICS v_owner_count = ROW_COUNT;

  -- admin_expenses: match by sub_category_id (new rows) or legacy text name (old rows)
  UPDATE public.admin_expenses
    SET category = v_target_category_name, sub_category = v_target.subcategory_name, sub_category_id = p_target_id
    WHERE clinic_id = v_source.clinic_id
      AND (sub_category_id = p_source_id OR (sub_category_id IS NULL AND sub_category = v_source.subcategory_name));
  GET DIAGNOSTICS v_admin_count = ROW_COUNT;

  -- inventory_items assigned to the source subcategory follow it to the target
  UPDATE public.inventory_items
    SET category_id = v_target.category_id, subcategory_id = p_target_id
    WHERE subcategory_id = p_source_id AND clinic_id = v_source.clinic_id;
  GET DIAGNOSTICS v_inventory_count = ROW_COUNT;

  DELETE FROM public.accounting_subcategories WHERE id = p_source_id;

  RETURN jsonb_build_object(
    'owner_expenditures_updated', v_owner_count,
    'admin_expenses_updated', v_admin_count,
    'inventory_items_updated', v_inventory_count
  );
END;
$function$;
