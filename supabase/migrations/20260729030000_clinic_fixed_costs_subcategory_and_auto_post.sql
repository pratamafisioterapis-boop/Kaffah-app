-- Recurring monthly items (clinic_fixed_costs) aren't all "Fixed Cost" in the
-- accounting sense (some are variable/HR items), so let owners pick a real
-- subcategory instead of always posting under the literal "FIXED COST" text.
-- Salary-like items ("gaji ...") should stop auto-posting here: payroll will
-- post them once a payroll record is marked paid, so double-posting must stop.
--
-- Applied directly against the Supabase project via MCP apply_migration on
-- 2026-07-29.

alter table clinic_fixed_costs
  add column if not exists subcategory_id uuid references accounting_subcategories(id) on delete set null,
  add column if not exists auto_post boolean not null default true;

update clinic_fixed_costs
set auto_post = false
where item_name ilike '%gaji%';

-- Tag owner_expenditures rows that were auto-posted by the fixed-cost engine
-- so BEP math (getBepFinancials) can exclude them without depending on the
-- posted category text matching a hardcoded 'FIXED COST' string.
alter table owner_expenditures
  add column if not exists is_auto_fixed_cost boolean not null default false;

update owner_expenditures
set is_auto_fixed_cost = true
where category = 'FIXED COST';
