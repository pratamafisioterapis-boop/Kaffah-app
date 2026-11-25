# CS Clinara untuk klinik Praxis

Staf Praxis (owner/admin) mengajukan permintaan perubahan lewat menu **Hubungi CS Clinara**. Owner Clinara menyetujui lewat Telegram.

## Alur
1. Staf membuat tiket -> fungsi `clinara-cs` menyimpan dan mengirim notifikasi Telegram.
2. Pekerja (sesi Claude Code terjadwal, tanpa API Claude) membaca tiket berstatus `baru`, memilih jalur, lalu:
   - **Jalur A (pengaturan)**: isi `proposed_changes` (`[{"key":"kwitansi.footer_text","value":"..."}]`, key harus ada di
     `clinic_setting_keys`), set `category='A'`, `status='menunggu_persetujuan'`, kirim ringkasan ke Telegram (`action:"notify"`).
     Owner membalas "ok" -> `clinara_cs_apply_settings` menerapkan seketika. `/cs batal N` mengembalikan nilai lama.
   - **Jalur B (kode khusus Praxis)**: tulis `plan`, `category='B'`, `status='menunggu_persetujuan'`, kirim rencana ke Telegram.
     Setelah "ok" (status `disetujui`) pekerja membuat cabang, mengerjakan, build, membuka PR, mengisi `pr_url`/`preview_url`
     dan memberi tahu Telegram. Merge tetap oleh owner; setelah live: `/cs selesai N`. Migrasi database selalu ditampilkan dulu di PR.
3. Staf melihat status dan pesan CS di aplikasi.

## Perintah Telegram
`/cs` (daftar terbuka) · `/cs ok N` · `/cs tolak N` · `/cs batal N` · `/cs selesai N` · atau reply "ok"/"ga" pada notifikasi tiket.

## Penerapan
1. Jalankan migrasi `20261125100000_clinara_cs.sql`.
2. Deploy `clinara-cs` (verify_jwt = true) dan deploy ulang `telegram-webhook`; jalankan action `setup` webhook agar perintah `/cs` terdaftar.
3. Secrets yang dipakai sudah ada: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

## Pagar pengaman
- Hanya klinik Praxis; staf lain ditolak di fungsi dan RLS. Batas tiket harian `clinara_cs_config.max_per_day` (bawaan 10).
- Mematikan fitur: `update clinara_cs_config set enabled = false where clinic_id = 'b25e8c29-6977-4e1b-b500-7629ec3aeb8a';`
- Jalur A hanya key daftar putih; tiap perubahan tercatat di `clinara_cs_audit`. Menambah key baru = migrasi + dukungan di UI.
- Jalur B selalu lewat PR + persetujuan owner. Tidak menyentuh data pasien.

## Key pengaturan yang sudah terpasang di UI
- `kwitansi.footer_text` (kaki kwitansi Praxis; hanya terlihat oleh pengguna yang login di klinik itu)
- `menu.hidden` (daftar path menu yang disembunyikan, mis. `["/admin/attendance"]`)
Pengaturan dibaca saat aplikasi dimuat; muat ulang untuk melihat perubahan.

## Pekerja terjadwal (prompt)
"Periksa tiket CS Clinara Praxis: `select * from clinara_cs_tickets where status in ('baru','disetujui') order by id`.
Untuk `baru`: klasifikasi jalur A/B, isi rencana/perubahan, status `menunggu_persetujuan`, kirim notifikasi ke Telegram
(`clinara-cs` action notify). Untuk `disetujui` jalur B: kerjakan di cabang baru, build, buka PR, isi `pr_url`, kirim Telegram.
Jangan merge, jangan jalankan migrasi tanpa persetujuan, hanya klinik Praxis."
