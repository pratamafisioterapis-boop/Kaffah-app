-- Bonus/tunjangan lain di luar jasa insentif & komisi (misal THR, bonus
-- prestasi), nilainya diisi manual oleh owner di slip gaji.
alter table payroll_records
  add column if not exists bonus_amount numeric not null default 0;
