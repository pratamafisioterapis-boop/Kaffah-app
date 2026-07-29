-- Backfill: owner_expenditures rows that were auto-posted by the fixed-cost
-- engine (is_auto_fixed_cost = true) before clinic_fixed_costs.subcategory_id
-- existed (or before the owner had picked a subkategori) were left with
-- sub_category = null, which the Owner Accounting "Pengeluaran" list renders
-- as "—". The auto-post logic itself was already fixed in
-- 20260729030000_clinic_fixed_costs_subcategory_and_auto_post.sql to copy
-- the item's subcategory going forward; this migration catches up existing
-- rows whose recurring item now has a subcategory configured, matching on
-- clinic_id + item_name/description (auto-posted rows always use the item
-- name verbatim as their description).
--
-- Applied directly against the Supabase project via MCP apply_migration on
-- 2026-07-29.

update owner_expenditures oe
set sub_category = cfc.subcategory_id,
    category = coalesce(ac.category_name, oe.category)
from clinic_fixed_costs cfc
left join accounting_subcategories asub on asub.id = cfc.subcategory_id
left join accounting_categories ac on ac.id = asub.category_id
where oe.is_auto_fixed_cost = true
  and oe.sub_category is null
  and cfc.subcategory_id is not null
  and cfc.clinic_id = oe.clinic_id
  and cfc.item_name = oe.description;
