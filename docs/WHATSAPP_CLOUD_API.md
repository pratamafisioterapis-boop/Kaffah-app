# WhatsApp Cloud API (Meta) langsung

Koneksi resmi ke Meta tanpa vendor perantara (Watzap dsb.). Mencakup kirim
pesan + status, inbox pesan masuk (termasuk nomor baru), manajemen template,
dan broadcast.

> **Status: nonaktif.** Watzap adalah jalur satu-satunya. Kode ini baru hidup bila
> migrasi `20261029200000_wa_cloud_api.sql` diterapkan **dan** `VITE_WA_CLOUD_ENABLED=true`
> diset saat build. Tanpa itu, panel, menu Inbox, dan pengalihan pengirim tidak aktif.

## Arsitektur

| Bagian | Lokasi |
|---|---|
| Tabel + RLS + bucket `wa-media` | `supabase/migrations/20261029200000_wa_cloud_api.sql` |
| Webhook Meta (pesan masuk, status, status template) | `supabase/functions/wa-webhook` |
| Aksi staf (kirim, template, broadcast, akun) | `supabase/functions/wa-cloud` |
| UI Koneksi / Template / Broadcast | Pengaturan → WhatsApp → panel "Cloud API" |
| UI Inbox | menu **WhatsApp Inbox** (`/owner/wa-inbox`, `/admin/wa-inbox`) |

Token akses Meta disimpan di `wa_meta_credentials` (RLS aktif tanpa policy):
hanya Edge Function yang bisa membaca; browser tidak pernah menerimanya.

## Pengaktifan

1. **Meta**: buat App tipe Business, tambahkan produk WhatsApp. Pastikan WABA
   klinik berada di Business Portfolio milik klinik, buat *System User* dengan
   izin `whatsapp_business_management` + `whatsapp_business_messaging`, lalu
   generate token permanen.
2. **Secret Supabase** (Edge Functions → Secrets):
   - `META_APP_SECRET` — App Secret dari Meta App (dipakai verifikasi tanda tangan webhook)
   - `META_WEBHOOK_VERIFY_TOKEN` — string acak buatan sendiri
3. **Migrasi**: `supabase db push` (atau apply file migrasi di atas).
4. **Deploy fungsi**:
   ```
   supabase functions deploy wa-cloud
   supabase functions deploy wa-webhook --no-verify-jwt
   ```
   `wa-webhook` wajib `--no-verify-jwt` karena Meta tidak mengirim JWT Supabase;
   keamanannya dijaga oleh verifikasi `X-Hub-Signature-256`.
5. **Webhook di Meta**: Callback URL `https://<project>.supabase.co/functions/v1/wa-webhook`,
   Verify Token = `META_WEBHOOK_VERIFY_TOKEN`; subscribe `messages`,
   `message_template_status_update`, dan untuk coexistence `smb_message_echoes`,
   `history`, `smb_app_state_sync`.
6. **Aplikasi**: Pengaturan → WhatsApp → Cloud API → isi WABA ID, Phone Number
   ID, Access Token → Hubungkan. Lalu tab Template → Sinkronkan dari Meta.

## Aturan Meta yang berlaku

- **Jendela 24 jam**: teks bebas hanya boleh dalam 24 jam sejak pasien terakhir
  membalas. Di luar itu wajib template berstatus APPROVED. Inbox otomatis
  beralih ke pemilih template; `wa-cloud` menolak teks di luar jendela (HTTP 409).
- **Satu nomor, satu tempat**: nomor yang terdaftar di Cloud API tidak bisa
  dipakai di aplikasi WhatsApp biasa kecuali mode Coexistence (aplikasi
  WhatsApp *Business*). Cek ketersediaannya di Meta Business Manager.
- Batas harian pesan per nomor mengikuti tier Meta (mulai 250 pasien unik/hari).

## Yang belum dialihkan

Pengingat otomatis dari `follow_up_queue` masih berupa teks bebas. Lewat Cloud
API, teks bebas hanya terkirim bila pasien sedang dalam jendela 24 jam; selain
itu butuh template + pemetaan variabel per jenis follow-up. Fungsi SQL pengirim
lama (`net.http_post` ke Watzap) tidak diubah dan cron-nya tetap nonaktif.

## Coexistence (nomor yang tetap dipakai di aplikasi WhatsApp Business)

Webhook sudah menangani tiga event tambahan:

| Field | Isi | Perilaku |
|---|---|---|
| `smb_message_echoes` | Balasan yang diketik dari aplikasi di HP | Masuk inbox sebagai pesan keluar |
| `history` | Riwayat chat hingga 180 hari, sekali saat onboarding | Diimpor tanpa duplikat; media tidak diunduh |
| `smb_app_state_sync` | Kontak dari buku kontak aplikasi | Mengisi nama pada percakapan yang sudah ada |

Syarat dari Meta (sumber pihak ketiga, **konfirmasikan di dokumentasi resmi Meta**):

- Onboarding **hanya lewat Embedded Signup** dengan `featureType = whatsapp_business_app_onboarding`,
  oleh Tech Provider / Solution Partner. Token manual dari System User saja **tidak** cukup untuk
  memulai coexistence. Panel Koneksi di aplikasi hanya menyimpan kredensial setelah onboarding itu ada.
- Nomor harus sudah aktif di aplikasi WhatsApp Business (v2.24.17+) minimal 7 hari.
- WABA yang dibuat lewat aplikasi developer tidak bisa di-onboard sebagai coexistence.
- Aplikasi di HP harus dibuka sekitar tiap 13 hari agar koneksi tidak putus.
- Batas 20 pesan/detik per nomor; riwayat dan kontak hanya sinkron sekali (ulang = offboard lalu onboard).
- Pesan dari perangkat tertaut yang tidak didukung tidak memicu `smb_message_echoes`.
