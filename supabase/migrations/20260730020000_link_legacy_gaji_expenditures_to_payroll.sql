-- Before payroll_records existed, the recurring fixed-cost engine
-- (autoPostFixedCosts) posted therapist base salaries under nickname
-- descriptions like "Gaji dilah" / "gaji nisa" / "Gaji Pras" tagged
-- is_auto_fixed_cost = true. Those items later got auto_post = false
-- (see 20260729030000) so payroll would own posting base_salary going
-- forward via "Gaji Karyawan Tetap - <name>" — but for July several
-- payroll records were marked paid the same day the old nickname row had
-- already posted, so no "Gaji Karyawan Tetap" row was ever created and
-- payroll_record_id was left unlinked on the nickname row. Link them so
-- deleting the payroll record also cleans up its base-salary expenditure,
-- same as the other components.
--
-- Applied directly against the Supabase project via MCP apply_migration on
-- 2026-07-30.

update owner_expenditures oe
set payroll_record_id = pr.id
from payroll_records pr
join physiotherapists t on t.id = pr.physiotherapist_id
where oe.payroll_record_id is null
  and oe.is_auto_fixed_cost = true
  and oe.description ilike 'gaji %'
  and oe.description not ilike 'gaji karyawan tetap - %'
  and oe.clinic_id = t.clinic_id
  and oe.date = pr.created_at::date
  and pr.base_salary > 0
  and oe.amount = pr.base_salary;
