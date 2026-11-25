# CS Clinara untuk klinik Praxis

Staf Praxis (owner/admin) mengajukan permintaan perubahan lewat menu **Hubungi CS Clinara**. Owner Clinara menyetujui lewat Telegram.

## Alur (versi routine, hemat kuota)
Tiket masuk Telegram tanpa Claude. Hanya setelah owner membalas "ok", `clinara-cs` memanggil routine "Pekerja Cs Clinara"
(pemicu API, id `trig_013s83KsoM6LDKMmqBXuLc9C`, konektor Supabase) dengan isi tiket. Routine mengerjakan jalur A/B,
lalu trigger database `trg_cs_ticket_changed` melapor ke Telegram saat `pr_url` terisi atau tiket selesai.
Secrets fungsi: `CS_ROUTINE_TOKEN` (wajib), opsional `CS_ROUTINE_URL`, `CS_ROUTINE_ID`, `CS_ROUTINE_BETA`.
Bagian alur di bawah adalah rancangan awal (pekerja berkala) dan sudah digantikan.

## Alur awal
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

## Jenis tiket dan aturan
- **perubahan**: jalur A/B seperti biasa. **bug**: hanya kode Praxis yang boleh berubah; bila akarnya di kode bersama, buat
  perilaku khusus Praxis (guard `PRAXIS_CLINIC_ID`), jangan ubah perilaku klinik lain.
- **data** (ubah data yang sudah terisi): hanya bisa diajukan **owner** (admin ditolak di fungsi dan database). Dikerjakan routine lewat
  `clinara_cs_data_update(ticket_id, tabel, ids[], set jsonb)` untuk tabel di `clinara_cs_data_tables`
  (`appointments`, `daily_recaps`, `medical_records`), hanya baris klinik tiket, maksimal 200 baris, nilai lama dicatat di `clinara_cs_data_log`.
  `/cs batal N` mengembalikan semua baris. Setelah selesai routine mengisi status `selesai`.
- Admin boleh mengajukan jenis perubahan dan bug.

## Bahasa untuk staf Praxis
- Balasan pertama otomatis (trigger `trg_cs_auto_ack`, tanpa AI) menurut jenis tiket.
- Pembaruan berikutnya ditulis routine dalam bahasa awam (tanpa istilah teknis) lewat `clinara_cs_messages` (sender 'cs'):
  saat mulai diperiksa, saat penyebab ditemukan, dan saat selesai.
