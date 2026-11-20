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

## Yang belum ada
- Tombol aktif/nonaktif, daftar log, dan penanda "dibalas AI" di antarmuka aplikasi (sementara lewat SQL di atas).
- Pengiriman gambar flyer (endpoint gambar Watzap belum dipastikan); AI membalas harga dalam teks.
- Uji dengan API Claude sungguhan belum dilakukan dari sesi ini (tidak ada kunci di sini).
