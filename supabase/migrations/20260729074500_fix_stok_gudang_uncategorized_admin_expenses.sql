-- The 20260728232454 restructure migration bulk-renamed every admin_expenses
-- row with category = 'Operasional Klinik' to 'UNCATEGORIZED / PERLU REVIEW'.
-- That swept up legitimate warehouse-takeout entries (sub_category =
-- 'Stok Gudang', written by take_inventory_stock) along with real stray
-- legacy entries. Restore 'Operasional Klinik' for the Stok Gudang rows;
-- sub_category 'Stok Gudang' already marks these as warehouse-origin.
-- Applied directly against the Supabase project via MCP apply_migration on
-- 2026-07-29.

update admin_expenses
set category = 'Operasional Klinik'
where clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
  and sub_category = 'Stok Gudang'
  and category = 'UNCATEGORIZED / PERLU REVIEW';
