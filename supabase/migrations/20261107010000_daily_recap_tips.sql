-- Tips pasien untuk terapis, diinput manual di modal Edit Recap Harian.
--
-- Sengaja kolom terpisah dari daily_recaps.amount supaya:
--  * invoice/kwitansi (yang memakai amount) tidak memuat tips,
--  * validasi split pembayaran (total split <= amount) tidak terganggu,
--  * perhitungan komisi/insentif terapis (berbasis amount) tidak ikut membesar.
--
-- Metode pembayaran tips tidak punya kolom sendiri: mengikuti
-- daily_recaps.payment_method (metode nominal terapi; pada split pembayaran =
-- metode dengan nominal terbesar).
--
-- Tips tetap dihitung sebagai pemasukan di sistem akuntansi
-- (getPatientIncomeFromPackages) dan otomatis menjadi komponen "Tips" di
-- payroll terapis (jumlah tips_amount recap terapis pada periode gaji).
alter table public.daily_recaps
  add column if not exists tips_amount numeric not null default 0;

alter table public.daily_recaps
  drop constraint if exists chk_daily_recaps_tips_amount_nonneg;
alter table public.daily_recaps
  add constraint chk_daily_recaps_tips_amount_nonneg check (tips_amount >= 0);
