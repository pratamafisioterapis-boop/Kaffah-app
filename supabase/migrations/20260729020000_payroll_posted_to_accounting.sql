-- Add a dedupe flag so a payroll record only ever posts its salary
-- components (base_salary, transport_per_day, incentive_amount,
-- custom_commission) into owner_expenditures once, even if the record is
-- re-saved after being marked "paid".
--
-- Applied directly against the Supabase project via MCP apply_migration on
-- 2026-07-29.

alter table payroll_records
  add column if not exists posted_to_accounting boolean not null default false;
