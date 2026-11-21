# Asisten AI balasan WhatsApp (Kaffah)

Status: sudah ditulis, BELUM di-deploy, AI MATI secara default.
Knowledge: `docs/AI_KNOWLEDGE_KAFFAH.md` (sumber tunggal). Setelah mengubahnya jalankan
`node tools/sync-ai-knowledge.js` lalu deploy ulang `wa-ai-reply`.

## Alur
Pesan pasien -> `wa-watzap-webhook` -> inbox -> `wa-ai-reply` (mendaftarkan ke antrean `wa_ai_queue`).
Hanya bila `wa_ai_settings.enabled = true`. Kapan AI bertindak diatur `ai_mode`:
- `both` (bawaan): jam buka -> menunggu admin diam `delay_seconds` (bawaan 300 = 5 menit);
  jam tutup -> membalas langsung (`closed_delay_seconds` = 0).
- `closed_only`: hanya saat jam tutup. `silent_only`: kapan pun, menunggu admin diam.
Jam buka diatur di `business_hours` (WITA, per hari 0=Minggu..6=Sabtu, [buka, tutup]; null = tutup).
Penyapu `pg_cron` ("wa-ai-sweep", tiap menit) memproses antrean yang jatuh tempo. Sebelum membalas, AI memeriksa:
pesan masih yang terbaru, admin belum membalas (di aplikasi DAN lewat Watzap `/conversations`), chat tidak dijeda/diserahkan.
Bila pengecekan ke Watzap gagal, AI TIDAK mengirim (gagal dengan aman) dan mencatat alasannya.
`mode = simulate` hanya mencatat ke `wa_ai_logs`; `mode = live` mengirim dan membuat booking.
`mode = review`: untuk SETIAP pesan pasien (tanpa penyaring jam/nomor uji/balasan admin/jeda) AI menyusun draf lalu mengirim
pesan pasien + draf ke Telegram owner (secret TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID). Tidak ada pesan ke pasien, tidak ada booking.
Butuh migrasi `20261120130000_wa_ai_review_mode.sql` (menambah nilai 'review' pada aturan mode).
Kasus berisiko / home care / reward / komplain / lampiran: `ai_handoff = true`, AI diam sampai admin membersihkannya.

## Urutan penerapan yang aman
1. Jalankan migrasi `20261120090000_wa_ai_assistant.sql` lalu `20261120110000_wa_ai_schedule_queue.sql` (AI tetap mati).
2. Deploy `wa-ai-reply` dengan verify_jwt = false, lalu deploy ulang `wa-watzap-webhook`.
   Pastikan secret `ANTHROPIC_API_KEY` ada (opsional `WA_AI_MODEL`).
3. Uji terbatas, mode simulate, hanya nomor Anda:
   ```sql
   update wa_ai_settings
      set enabled = true, mode = 'simulate', test_phones = array['62812XXXXXXXX']
    where clinic_id = '<clinic_id>';
   ```
   Kirim pesan dari nomor itu, lalu baca hasilnya:
   ```sql
   select created_at, outcome, skip_reason, reply_text, handoff_reason, planned_actions
     from wa_ai_logs order by created_at desc limit 20;
   ```
4. Bila jawaban sudah sesuai: ganti `mode = 'live'` (masih dengan `test_phones`), uji booking sungguhan.
5. Kosongkan `test_phones` (`'{}'`) hanya setelah Anda menyetujui.

## Mematikan seketika
```sql
update wa_ai_settings set enabled = false where clinic_id = '<clinic_id>';
```
Mematikan AI untuk satu percakapan: `update wa_inbox_conversations set ai_paused = true where id = '<id>';`
Membersihkan serah-terima: `update wa_inbox_conversations set ai_handoff = false where id = '<id>';`

Reschedule & cancel: AI memindahkan jadwal yang sudah terbooking (alat `reschedule_booking`, update
`appointments.appointment_date/therapist_id` dan `status = 'rescheduled'`, sama dengan jalur reschedule di aplikasi
sehingga ikut terhitung di laporan reschedule; trigger `handle_reschedule_whatsapp` mengirim konfirmasi ke pasien)
dan membatalkan (`cancel_booking`, status `cancelled`; trigger `notify_booking_cancelled` memberi notifikasi ke
owner/admin/terapis). Keduanya hanya untuk jadwal milik nomor pengirim dan bukan home care; `action_by_name`
diisi "Asisten AI WhatsApp" dan `action_by_role` = `ai` (bisa dipisahkan dari reschedule oleh admin/owner). Saat pasien minta batal, AI menyarankan jadwal ulang dulu.

Serah-terima bersifat DIAM: saat AI menyerahkan chat ke admin (home care, komplain, klaim reward,
kwitansi, pertanyaan pasca-terapi, ubah/batal jadwal, darurat, lampiran), AI tidak mengirim pesan apa pun
ke pasien; chat hanya ditandai "Diserahkan ke admin". Pesan yang tidak perlu dibalas ("ok", "siap",
emoji) juga dilewati tanpa balasan dan tanpa serah-terima.

## Antarmuka di aplikasi
Pengaturan WhatsApp -> tab **Asisten AI**: tombol aktif/mati, mode (simulasi/live), kapan AI membalas, jam operasional,
nomor uji, kontrol per percakapan (diserahkan ke admin / dijeda / cari chat untuk dijeda), dan riwayat balasan AI.
Hanya owner yang dapat mengubah pengaturan; owner dan admin dapat mengelola status per percakapan.
(Tampilan inbox percakapan `/owner/wa-inbox` yang disebut di docs/WHATSAPP_CLOUD_API.md tidak ada di repo ini.)

## Yang belum ada
- Uji dengan API Claude dan Watzap sungguhan belum dilakukan dari sesi ini.

## Memperbarui knowledge AI (tanpa deploy ulang)
Knowledge dibaca dari kolom `wa_ai_settings.knowledge_override`. Sumbernya `docs/AI_KNOWLEDGE_KAFFAH.md`.
Setelah mengubah dokumen: jalankan `node tools/sync-ai-knowledge.js`, lalu jalankan isi
`supabase/.temp-knowledge.sql` di SQL Editor Supabase. Bila kolom kosong, fungsi memakai cadangan singkat
di `supabase/functions/_shared/wa_ai_knowledge.ts`.

## Koreksi owner, skor harian, flyer, terapis langganan
- **Koreksi lewat Telegram**: setiap draf di Telegram bisa di-reply owner. Balasan "ok"/"sip"/👍 = draf tepat;
  teks lain = jawaban yang benar. Bot `telegram-webhook` meneruskan reply & `/skor` ke `wa-ai-reply`
  (`{telegram_update}` dengan bearer service role). Disimpan di `wa_ai_corrections`; 30 koreksi terbaru ikut
  ke prompt AI sebagai "KOREKSI DARI OWNER" sehingga langsung berlaku.
- **Skor harian**: cron `wa-ai-daily-score` (21.40 WITA) memanggil `{daily_report:true}`. Draf mode review
  dibandingkan dengan balasan admin asli di Watzap, dinilai sesuai/sebagian/tidak (kolom `verdict`,
  `admin_reply` di `wa_ai_logs`), lalu ringkasan dikirim ke Telegram. `/skor` di Telegram menjalankannya kapan saja.
- **Flyer**: alat `send_brochure` (paket_reguler, recovery) mengirim gambar dari `https://kaffahphysio.id/flyers/`
  lewat `waba_send_image_url` sebelum balasan teks (mode live). Di mode review hanya ditampilkan rencananya.
- **Terapis langganan**: `lookup_patient` mengembalikan `therapist_history` (terapis aktif yang pernah menangani,
  urut terbanyak lalu terbaru). AI mengecek jadwal terapis urutan pertama, lalu berikutnya; terapis lain hanya
  ditawarkan dengan persetujuan pasien.

## Mengatur AI lewat Telegram (owner)
- **Koreksi**: reply pesan draf (juga draf "tidak dibalas AI"/diserahkan ke admin) dengan jawaban atau arahan yang benar.
  "ok"/👍 = draf tepat. Jika draf tidak tercatat (mis. pengiriman sempat timeout), konteks diambil dari isi pesan yang di-reply.
- **Aturan umum**: tulis langsung tanpa reply (min. 12 karakter), mis. "jangan balas dulu, jeda minimal 2 menit".
  Tersimpan di `wa_ai_corrections` (kind `rule`/`correction`) dan masuk prompt sebagai "ARAHAN DARI OWNER" (40 terbaru).
- **Jeda menjawab**: `/jeda 2 menit` atau tulis di arahan (mis. "beri jeda minimal 2 menit"); disimpan di
  `wa_ai_settings.min_delay_seconds` (bawaan 120 detik) dan berlaku di mode review & live. Di mode review hanya pesan
  pasien terbaru yang dibuatkan draf setelah jeda (pesan beruntun digabung).
- Perintah: `/status`, `/jeda`, `/aturan` (daftar), `/hapus N`, `/skor`.
- Pesan tombol template (`msg_type = button`) diperlakukan seperti teks: "Hadir" dibalas "Terima kasih atas konfirmasinya ya {sapaan} 🙏", "Reschedule"/"Cancel" ditangani AI. Template pengingat hanya ada di Watzap, jadi untuk tombol dan balasan teks singkat (≤40 huruf) AI ikut membaca template 36 jam terakhir dari Watzap untuk mengetahui sapaan (satu nomor banyak pasien: sapa orang tua).

## Waiting list
- Tabel `waiting_list` (migrasi `20261121100000_waiting_list.sql`): nomor pasien, nama, tanggal yang diinginkan, jam (`time_from`/`time_to` atau label pagi/siang/sore/malam/bebas), terapis pria/wanita/bebas, catatan, status (waiting, notified, booked, cancelled), sumber (`ai_whatsapp`/`manual`).
- AI memakai alat `add_to_waiting_list` bila slot yang diinginkan penuh/tidak cocok dan pasien tidak memilih alternatif, lalu membalas "Baik {sapaan}, apabila ada pasien yang cancel {kondisi} maka akan kami infokan secepatnya 🙏". Di mode review hanya tampil sebagai rencana di Telegram. Permintaan sama dari nomor yang sama diperbarui, bukan digandakan.
- Halaman admin/owner **Waiting List** (menu Clinic Management): daftar menunggu / sudah dikabari / selesai, badge "Ada slot cocok" (dicek otomatis dari slot kosong terapis, sesuai jam & jenis kelamin terapis), tombol "Kabari via WA" (membuka WhatsApp dengan pesan siap kirim dan menandai sudah dikabari), tandai sudah booking/batal, dan tambah manual.
- Sapaan pasien yang belum terdaftar mengikuti sapaan yang dipakai admin di riwayat ("ka", "kak", ...). Pesan beruntun dijawab sebagai satu kesimpulan setelah jeda.

## Badge konfirmasi reminder terapi
Kartu reminder di Follow Up Management menampilkan **Hadir** (tombol Hadir atau balasan teks seperti "baik", "insyaallah iya", "siap"),
**Minta ubah jadwal**, **Minta batal**, atau **Belum konfirmasi** (reminder sudah terkirim tetapi belum dibalas). Balasan teks dicatat
oleh `record_reminder_text_reply` (dipanggil `wa-watzap-webhook`); kata penolak/ragu (tidak, batal, reschedule, telat, maaf, ...) tidak dihitung hadir,
dan Reschedule/Cancel dari tombol tidak ditimpa. Satu nomor untuk beberapa pasien: semua reminder hari itu di nomor tersebut ikut ditandai.

## Nomor yang diabaikan AI
Kolom `wa_ai_settings.ignored_phones` (text[], migrasi `20261121130000_wa_ai_ignored_phones.sql`) berisi nomor yang tidak ditanggapi AI sama sekali:
tidak ada balasan dan tidak ada draf ke Telegram (mis. nomor admin sendiri: 6282159018652, 6287872290608). Format bebas (08…/62…/+62…), dinormalkan saat dibandingkan.
```sql
update wa_ai_settings set ignored_phones = array['6282159018652','6287872290608'] where clinic_id = '<clinic_id>';
```

## Uji regresi (soal tetap)
Tabel `wa_ai_eval_cases` berisi soal tetap: transkrip + jawaban/tindakan yang benar (`expected`, jenis `reply`/`silent`/`handoff`/`booking`). Soal berasal dari
daftar tulisan tangan, dari log yang dinilai (sesuai/tidak/koreksi) dan bertambah otomatis dari setiap koreksi owner di Telegram serta draf yang dinilai "tidak".
Transkrip boleh memakai `{{D+1}}`, `{{TGL+1}}`, `{{HARI+1}}` (relatif terhadap hari ini WITA).
- Jalan uji dimulai dengan `/uji` di Telegram, atau OTOMATIS saat `wa_ai_settings.knowledge_override` berubah (jeda minimal 60 menit antar jalan otomatis).
  SQL manual: `select wa_ai_eval_start('<clinic_id>', 'manual')`.
- Penyapu (cron `wa-ai-sweep`, tiap menit) mengerjakan 6 soal per menit di mode simulasi (tanpa menulis apa pun ke pasien/booking), menilai hasilnya
  (handoff/silent dinilai pasti, reply/booking dinilai Claude), lalu mengirim laporan ke Telegram: skor, perbandingan dengan jalan sebelumnya, soal yang MEMBURUK/MEMBAIK dan yang masih salah.
- Hasil: `wa_ai_eval_runs` dan `wa_ai_eval_results` (draf, tindakan, verdict). Selisih kecil bisa karena variasi jawaban AI.

## Waiting list: peringatan slot kosong
Tiap menit penyapu mencocokkan waiting list berstatus `waiting` dengan slot kosong (tanggal, rentang jam/label, jenis kelamin terapis). Slot baru yang cocok dikirim
SEKALI ke Telegram owner beserta draf WA siap salin (tidak dikirim ke pasien); dicatat di `waiting_list_alerts` agar tidak berulang. Hanya aktif pukul 07.00-22.00 WITA.
Admin lalu mengabari pasien dari halaman Waiting List ("Kabari via WA").
