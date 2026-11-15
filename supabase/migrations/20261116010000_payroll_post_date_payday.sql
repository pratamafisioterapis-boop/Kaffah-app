-- Slip gaji periode tengah bulan (mis. 28 -> 27) sebelumnya diposting ke
-- owner_expenditures dengan tanggal period_end (27), padahal gajian tanggal 28.
-- Geser tanggal baris hasil posting payroll yang periodenya TIDAK berakhir di
-- akhir bulan sebanyak +1 hari. Periode 1-31 tidak berubah.
update owner_expenditures oe
set date = pr.payroll_period_end + 1
from payroll_records pr
where oe.payroll_record_id = pr.id
  and oe.date = pr.payroll_period_end
  and pr.payroll_period_end <> (date_trunc('month', pr.payroll_period_end) + interval '1 month - 1 day')::date;
