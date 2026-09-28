-- Catatan/keterangan bebas untuk slip gaji (misal alasan potongan atau
-- kekurangan bulan lalu), diisi manual oleh owner dan ikut tampil di PDF.
alter table payroll_records
  add column if not exists notes text;
