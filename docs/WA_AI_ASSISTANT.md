# Asisten AI balasan WhatsApp (Kaffah)

Status: sudah ditulis, BELUM di-deploy, AI MATI secara default.
Knowledge: `docs/AI_KNOWLEDGE_KAFFAH.md` (sumber tunggal). Setelah mengubahnya jalankan
`node tools/sync-ai-knowledge.js` lalu deploy ulang `wa-ai-reply`.

## Alur
Pesan pasien -> `wa-watzap-webhook` -> menyimpan ke inbox -> memanggil `wa-ai-reply`.
`wa-ai-reply` hanya bekerja bila `wa_ai_settings.enabled = true`:
1. Di jam kerja menunggu `delay_seconds` (default 120, maks 150 oleh batas edge function;
   Batal bila admin sudah membalas atau ada pesan pasien yang lebih baru.
   Di luar jam kerja (Sen-Jum 09-21, Sab-Min 09-17 WITA) langsung membalas.
2. Claude memakai alat: data pasien dari nomor, jadwal kosong, hitung harga, buat booking, serahkan ke admin.
3. `mode = simulate`: hanya mencatat rencana ke `wa_ai_logs` (tidak mengirim, tidak membuat booking).
   `mode = live`: mengirim balasan lewat Watzap dan membuat booking di aplikasi.
4. Kasus berisiko / home care / reward / komplain / lampiran: `ai_handoff = true` pada percakapan,
   AI diam sampai admin membersihkan penanda itu.

## Urutan penerapan yang aman
1. Jalankan migrasi `20261120090000_wa_ai_assistant.sql` (tidak mengubah perilaku apa pun).
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
