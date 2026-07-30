-- Deleting a payroll record used to leave its auto-posted accounting rows
-- (Gaji Karyawan Tetap / Uang Transport Harian / Jasa Insentif per Terapis /
-- Komisi) orphaned in owner_expenditures, because there was no link back to
-- the payroll_records row that created them. Add that link so deleting a
-- payroll record also removes what it posted.
--
-- Applied directly against the Supabase project via MCP apply_migration on
-- 2026-07-30.

alter table owner_expenditures
  add column if not exists payroll_record_id uuid references payroll_records(id) on delete cascade;

-- Backfill existing rows posted before this column existed by matching on
-- clinic, posting date, description ("<label> - <therapist name>") and the
-- exact component amount — the same shape postPayrollToOwnerExpenditures
-- (src/lib/api.js) has always inserted.
update owner_expenditures oe
set payroll_record_id = pr.id
from payroll_records pr
join physiotherapists t on t.id = pr.physiotherapist_id
where oe.payroll_record_id is null
  and oe.clinic_id = t.clinic_id
  and oe.date = pr.created_at::date
  and (
    (pr.base_salary > 0 and oe.description = 'Gaji Karyawan Tetap - ' || t.name and oe.amount = pr.base_salary)
    or (pr.transport_per_day > 0 and oe.description = 'Uang Transport Harian - ' || t.name and oe.amount = pr.transport_per_day)
    or (pr.incentive_amount > 0 and oe.description = 'Jasa Insentif per Terapis - ' || t.name and oe.amount = pr.incentive_amount)
    or (pr.custom_commission > 0 and oe.description = 'Komisi - ' || t.name and oe.amount = pr.custom_commission)
  );
