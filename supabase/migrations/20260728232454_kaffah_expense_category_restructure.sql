-- Restructure expense categories for clinic "Kaffah Physiotherapy" only.
-- clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
-- Other clinics (Griya Fisioterapi Cepu, Sentosa Medika, Grand Physiocare,
-- Wonosobo Therapy Center) are untouched.
--
-- New structure: COST OF SERVICE, FIXED COST, VARIABLE COST, MARKETING,
-- DIGITAL APPS, ENTERTAINMENT, CAPITAL EXPENDITURE (CapEx),
-- BANK & FINANCE CHARGES, HR & PAYROLL, TAX & LEGAL,
-- UNCATEGORIZED / PERLU REVIEW (for legacy stray entries).
--
-- Applied directly against the Supabase project via MCP execute_sql on
-- 2026-07-28; this file documents the change since the repo previously had
-- no migrations folder tracking data changes.

begin;

-- 1) Rename existing categories, add new ones
update accounting_categories set category_name = 'CAPITAL EXPENDITURE (CapEx)'
  where id = 'd7069d0f-fa1e-47a1-a3c6-e89bff2bddf2' and clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a';

update accounting_categories set category_name = 'BANK & FINANCE CHARGES'
  where id = 'a9ee9eaa-eeed-446c-bc3f-6c0484b5db9c' and clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a';

insert into accounting_categories (id, category_name, type, clinic_id) values
  (gen_random_uuid(), 'COST OF SERVICE', 'expense', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
  (gen_random_uuid(), 'HR & PAYROLL', 'expense', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
  (gen_random_uuid(), 'TAX & LEGAL', 'expense', 'bfdc3fd8-a052-4753-a5b7-229930b3237a'),
  (gen_random_uuid(), 'UNCATEGORIZED / PERLU REVIEW', 'expense', 'bfdc3fd8-a052-4753-a5b7-229930b3237a');

commit;

-- 2) Move subcategories under their new parent category
begin;

update accounting_subcategories set category_id = (
  select id from accounting_categories
  where clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a' and category_name = 'COST OF SERVICE'
)
where clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
  and category_id = '5a4e0845-11f9-43a6-86c1-0e1a85694e16' -- old VARIABLE COST
  and subcategory_name in ('JASA ADI','JASA AZHAR','ABHP','KOMISI','HARIAN ANNISA','HARIAN DILAH','HARIAN CITRA','JASA ANNISA','JASA DILAH','JASA CITRA');

update accounting_subcategories set category_id = 'ac5e6c59-24c1-47d9-b789-a8e4d0f31930' -- FIXED COST
where clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
  and category_id = '5a4e0845-11f9-43a6-86c1-0e1a85694e16' -- old VARIABLE COST
  and subcategory_name = 'LISTRIK';

update accounting_subcategories set category_id = '5a4e0845-11f9-43a6-86c1-0e1a85694e16' -- VARIABLE COST
where clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
  and category_id = 'd7069d0f-fa1e-47a1-a3c6-e89bff2bddf2' -- CAPITAL EXPENDITURE (CapEx)
  and subcategory_name = 'ATK';

update accounting_subcategories set category_id = (
  select id from accounting_categories
  where clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a' and category_name = 'HR & PAYROLL'
)
where clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
  and category_id = 'ac5e6c59-24c1-47d9-b789-a8e4d0f31930' -- FIXED COST
  and subcategory_name in ('THR','SHARING PROFIT MAMA');

commit;

-- 3) Backfill historical transactions so their denormalized category text
--    matches the new structure (owner_expenditures.category / admin_expenses.category
--    are plain text copied at write time, not foreign keys).
begin;

update owner_expenditures oe
set category = ac.category_name
from accounting_subcategories asub
join accounting_categories ac on ac.id = asub.category_id
where oe.sub_category = asub.id
  and oe.clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
  and asub.clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
  and oe.category is distinct from ac.category_name;

update owner_expenditures
set category = 'CAPITAL EXPENDITURE (CapEx)'
where clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a' and category = 'CAPITAL EXPENSION';

update owner_expenditures
set category = 'BANK & FINANCE CHARGES'
where clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a' and category = 'BANK';

update owner_expenditures
set category = 'UNCATEGORIZED / PERLU REVIEW'
where clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a' and category = 'Fixed Cost Bulanan';

update admin_expenses
set category = 'COST OF SERVICE'
where clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
  and category = 'VARIABLE COST'
  and sub_category in ('JASA ADI','JASA AZHAR','ABHP','KOMISI','HARIAN ANNISA','HARIAN DILAH','HARIAN CITRA','JASA ANNISA','JASA DILAH','JASA CITRA');

update admin_expenses
set category = 'FIXED COST'
where clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
  and category = 'VARIABLE COST'
  and sub_category = 'LISTRIK';

update admin_expenses
set category = 'VARIABLE COST'
where clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
  and category = 'CAPITAL EXPENSION'
  and sub_category = 'ATK';

update admin_expenses
set category = 'HR & PAYROLL'
where clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a'
  and category = 'FIXED COST'
  and sub_category in ('THR','SHARING PROFIT MAMA');

update admin_expenses
set category = 'CAPITAL EXPENDITURE (CapEx)'
where clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a' and category = 'CAPITAL EXPENSION';

update admin_expenses
set category = 'BANK & FINANCE CHARGES'
where clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a' and category = 'BANK';

update admin_expenses
set category = 'UNCATEGORIZED / PERLU REVIEW'
where clinic_id = 'bfdc3fd8-a052-4753-a5b7-229930b3237a' and category = 'Operasional Klinik';

commit;
