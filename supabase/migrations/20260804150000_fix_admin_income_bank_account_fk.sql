-- admin_income.bank_account_id had no foreign key to bank_accounts(id), unlike
-- the equivalent column on admin_expenses. PostgREST resource embedding
-- (`bank_accounts (...)` inside a `.select()`) requires a declared FK to resolve,
-- so every read of admin_income via getAdminAccountingReport/getAdminIncome
-- failed with a PGRST200 "no relationship found" error. Admin-side income
-- entries were being saved correctly but never rendered in the income list.
ALTER TABLE public.admin_income
  ADD CONSTRAINT admin_income_bank_account_id_fkey
  FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id);
