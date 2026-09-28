-- Kekurangan gaji bulan sebelumnya yang belum terbayar (nilainya diisi
-- manual oleh owner), supaya bisa ditambahkan ke slip gaji periode berjalan.
alter table payroll_records
  add column if not exists prev_month_shortfall numeric not null default 0;
