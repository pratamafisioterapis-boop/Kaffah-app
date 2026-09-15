-- Lets each payment method (operational_options.category = 'payment_method')
-- optionally link to one of the clinic's bank accounts, so payments taken
-- via that method can be tied to where the money actually lands.
alter table public.operational_options
  add column if not exists bank_account_id uuid references public.bank_accounts(id) on delete set null;

create index if not exists operational_options_bank_account_id_idx
  on public.operational_options (bank_account_id);
