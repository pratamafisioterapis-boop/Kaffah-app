# SOAP sebelum pembayaran (khusus Kaffah Physiotherapy)

Berlaku untuk klinik yang punya baris di `soap_first_settings` dengan `enabled = true`
(saat ini hanya Kaffah, mulai `start_date`). Klinik lain tidak terpengaruh.

## Aturan ringkas
- Non-paket (termasuk sesi 1 paket dan paket 1 sesi): pembayaran terkunci sampai SOAP lengkap (S, O, A, P) dan diagnosa terisi.
- Paket sesi 2+ dan homecare: pembayaran tidak dikunci; SOAP boleh menyusul sampai 23.59 WITA.
- Tipe pasien dihitung server (prioritas: Free > Konsultasi > Homecare > Xtratime > DOMS > jumlah diagnosa). Diagnosa maksimal 2.
- Nominal dari daftar harga (`clinic_service_prices`, harga paket di `operational_options.price`), diskon hanya dari daftar owner (jenis diskon tanpa nilai, mis. "Keluarga", diisi manual oleh admin dan wajib disetujui owner). Paket tidak bisa diskon; diskon homecare butuh persetujuan owner. Tambahan paket 2 keluhan = Rp25.000 × jumlah sesi, dibayar di awal. Paket RU (label berakhiran " RU") boleh untuk diagnosa apa pun dan tanpa tambahan.
- Insentif terapis nol bila SOAP selesai lewat batas (non-paket: akhir slot + 20 menit; paket 2+/homecare: 23.59 WITA) atau ditandai owner. Terapis hanya melihat label netral.
- SOAP terkunci setelah invoice terbit; revisi lewat `soap_first_revise_soap` (tercatat di `soap_revisions`).
- Pengecualian (buka kunci bayar, Xtratime, diskon homecare, ubah nominal, pulihkan insentif, perpanjang paket) diajukan admin, diputuskan owner (`soap_overrides`).
- Pengingat SOAP: menit ke-40 sejak slot mulai (terapis + admin) dan saat slot berakhir (terapis), lewat cron `soap-first-reminders`.

## Mengaktifkan / mematikan
Owner: Setup > Keuangan > "SOAP & Harga" > centang "Aktifkan" dan atur tanggal mulai.
SQL: `update soap_first_settings set enabled = true where clinic_id = '<id>'` (matikan dengan `false` untuk kembali ke perilaku lama; data tidak berubah).

## Objek database
Tabel: `soap_first_settings`, `clinic_service_prices`, `soap_overrides`, `soap_revisions`.
Kolom baru: `daily_recaps` (soap_completed_at, invoice_created_at, special_type, free_reason, xtratime, incentive_zero_manual*, soap_reminder*_at, soap_first_applied), `appointments.homecare_time_type`, `operational_options.price`.
Trigger: `ab_soap_first_prepare`, `bz_soap_first_final` (urutan penting: sebelum trigger fee bank), `trg_soap_first_free_notify` (daily_recaps); `aa_soap_first_mr_guard`, `trg_soap_first_mr_touch` (medical_records); `aa_soap_first_package_guard` (package_tracking).
Migrasi tidak memakai DROP.
