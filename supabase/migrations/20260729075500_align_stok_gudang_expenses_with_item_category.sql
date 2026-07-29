-- admin_expenses rows created by take_inventory_stock previously landed on
-- the hardcoded fallback category ('Operasional Klinik' / 'Stok Gudang'),
-- which is not part of Kaffah Physiotherapy's actual accounting category
-- structure. Every inventory_items row now has a real category_id/
-- subcategory_id assigned, so backfill these historical expenses to the
-- item's real category/subcategory. The 'Ambil barang gudang: ...' prefix
-- in the description remains the marker that these originated from
-- warehouse stock takeout (surfaced as a badge in the UI).
-- Applied directly against the Supabase project via MCP apply_migration on
-- 2026-07-29.

update admin_expenses ae
set category = ac.category_name,
    sub_category = asub.subcategory_name,
    sub_category_id = asub.id
from inventory_stock_outs iso
join inventory_items ii on ii.id = iso.item_id
join accounting_subcategories asub on asub.id = ii.subcategory_id
join accounting_categories ac on ac.id = ii.category_id
where iso.admin_expense_id = ae.id
  and ae.clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
  and ae.sub_category = 'Stok Gudang';
