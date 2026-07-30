-- BEP tidak boleh menghitung satu rupiah dua kali. Komponen gaji bisa muncul
-- di beberapa tempat sekaligus:
--   - gaji pokok  -> clinic_fixed_costs (sumber kebenaran untuk BEP)
--   - transport & insentif -> payroll_records (setelah slip gaji dibuat)
--   - keduanya ikut terposting ke owner_expenditures lewat payroll
-- Supaya getBepFinancials() bisa mengenali baris pengeluaran mana yang berasal
-- dari posting payroll (dan karenanya harus dikeluarkan dari "pengeluaran"),
-- setiap baris hasil postPayrollToOwnerExpenditures() ditautkan ke slip gajinya.
--
-- Applied directly against the Supabase project via MCP apply_migration on
-- 2026-07-30.

alter table owner_expenditures
  add column if not exists payroll_record_id uuid references payroll_records(id) on delete set null;

create index if not exists owner_expenditures_payroll_record_id_idx
  on owner_expenditures (payroll_record_id);

-- Backfill baris payroll lama yang terposting sebelum kolom ini dipakai.
-- Dicocokkan ketat: klinik + nama terapis di deskripsi + nominal komponennya
-- persis sama, dengan toleransi tanggal 1 hari (tanggal posting diambil dari
-- created_at slip gaji yang dikonversi dari UTC di sisi aplikasi).
update owner_expenditures oe
set payroll_record_id = m.payroll_id
from (
  select
    pr.id as payroll_id,
    p.clinic_id,
    p.name as therapist_name,
    pr.created_at,
    pr.base_salary,
    pr.transport_per_day,
    pr.incentive_amount,
    pr.custom_commission
  from payroll_records pr
  join physiotherapists p on p.id = pr.physiotherapist_id
) m
where oe.payroll_record_id is null
  and oe.clinic_id = m.clinic_id
  and oe.date between (m.created_at at time zone 'UTC')::date - 1
                  and (m.created_at at time zone 'UTC')::date + 1
  and (
    (oe.description = 'Gaji Karyawan Tetap - ' || m.therapist_name and oe.amount = m.base_salary)
    or (oe.description = 'Uang Transport Harian - ' || m.therapist_name and oe.amount = m.transport_per_day)
    or (oe.description = 'Jasa Insentif per Terapis - ' || m.therapist_name and oe.amount = m.incentive_amount)
    or (oe.description = 'Komisi - ' || m.therapist_name and oe.amount = m.custom_commission)
  );
