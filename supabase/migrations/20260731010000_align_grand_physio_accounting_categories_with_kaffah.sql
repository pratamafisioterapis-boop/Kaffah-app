-- Align Grand Physiocare's accounting categories/subcategories with Kaffah Physiotherapy's structure.
-- Grand Physiocare had only a single "Biaya Operasional" category with 6 subcategories, none of
-- which are referenced by any owner_income/owner_expenditures/inventory_items/admin_expenses/
-- clinic_fixed_costs rows, so it is safe to replace outright with a copy of Kaffah's set.
DO $$
DECLARE
  v_kaffah_clinic uuid := 'bfdc3fd8-a052-4753-a5b7-229930b3237a';
  v_grand_physio_clinic uuid := '61c1dd29-3bab-40df-932f-db6b298f52bb';
BEGIN
  DELETE FROM accounting_subcategories WHERE clinic_id = v_grand_physio_clinic;
  DELETE FROM accounting_categories WHERE clinic_id = v_grand_physio_clinic;

  CREATE TEMP TABLE tmp_cat_map ON COMMIT DROP AS
  SELECT id AS old_id, gen_random_uuid() AS new_id, category_name, type
  FROM accounting_categories
  WHERE clinic_id = v_kaffah_clinic;

  INSERT INTO accounting_categories (id, category_name, type, clinic_id)
  SELECT new_id, category_name, type, v_grand_physio_clinic
  FROM tmp_cat_map;

  INSERT INTO accounting_subcategories (id, category_id, subcategory_name, clinic_id)
  SELECT gen_random_uuid(), m.new_id, s.subcategory_name, v_grand_physio_clinic
  FROM accounting_subcategories s
  JOIN tmp_cat_map m ON m.old_id = s.category_id
  WHERE s.clinic_id = v_kaffah_clinic;
END $$;
