-- Add nullable sub_category_id (uuid, FK to accounting_subcategories) to
-- admin_expenses so subcategory renames cascade live, mirroring
-- owner_expenditures.sub_category (already uuid + live-joined in
-- getOwnerExpenditures). The existing `sub_category` TEXT column is kept
-- for backward-compat display on historical rows that only have text.
--
-- No backfill of sub_category_id for existing rows: the owner will
-- manually re-pick the correct subcategory per historical transaction via
-- the admin expense edit UI, which sets sub_category_id going forward.

alter table public.admin_expenses
  add column if not exists sub_category_id uuid references public.accounting_subcategories(id) on delete set null;

create index if not exists idx_admin_expenses_sub_category_id on public.admin_expenses(sub_category_id);
