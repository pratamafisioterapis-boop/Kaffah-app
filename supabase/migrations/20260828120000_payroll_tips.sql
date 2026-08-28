-- Tips non-cash (transfer) yang pasien berikan ke terapis tapi masuk ke
-- rekening Kaffah, jadi perlu dicatat terpisah di slip gaji supaya
-- diteruskan balik ke terapis sebagai bagian dari take home pay.
alter table payroll_records
  add column if not exists tips numeric not null default 0;
