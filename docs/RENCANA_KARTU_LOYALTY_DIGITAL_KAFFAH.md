# Rencana: Kartu Loyalty Digital "Kaffah Rewards" (khusus clinic Kaffah)

Status: **RENCANA, belum ada kode.** Menunggu persetujuan sebelum implementasi.
Sumber ide: video Instagram (garryaudie), "aplikasi digital loyalty card" sebagai
pengganti kartu stamp fisik.

---

## 0. REVISI v2 (arahan owner): "Misi Kaffah" dengan reward diskon 100%

Arahan owner menggantikan skema stamp/tier di bagian 2 sebagai **mekanisme reward
utama**. Berlaku untuk **semua pasien, termasuk pasien lama**.

**Reward: diskon 100%** (gratis) bila pasien menuntaskan 3 misi:

| # | Misi | Cara verifikasi |
|---|---|---|
| 1 | Review Google Bisnis Kaffah | Pasien klik tombol menuju halaman review Google, lalu unggah **tangkapan layar** review; admin memverifikasi (centang) |
| 2 | Follow Instagram Kaffah | Pasien klik tombol menuju profil IG, unggah **tangkapan layar** "Mengikuti"; admin memverifikasi |
| 3 | Rekomendasi ke >3 orang (4 orang atau lebih) | Kode referral unik per pasien. Terhitung bila orang yang dirujuk **mendaftar & hadir sesi pertama** (otomatis dari server). Hitungan "3 dari 4" tampil di kartu |

Kartu di portal menjadi **checklist 3 misi + progres**; saat ketiganya selesai,
muncul **voucher diskon 100%** dengan kode sekali pakai yang divalidasi admin di
kasir/resepsionis.

### Dampak ke rancangan teknis
- Tabel diganti/disederhanakan: `loyalty_missions` (per pasien: tipe misi, status
  `belum | menunggu_verifikasi | disetujui | ditolak`, bukti upload, verified_by,
  verified_at), `loyalty_referrals` (pengajak, yang diajak, status sesi pertama),
  `loyalty_vouchers` (kode, nilai 100%, status, kedaluwarsa, dipakai di recap/paket mana).
  Skema stamp/ledger di 3.1 menjadi **opsional (fase lanjut)**.
- Bukti tangkapan layar disimpan di Supabase Storage (bucket privat), hanya bisa
  dibuka staf Kaffah.
- Antrean verifikasi di halaman admin: lihat bukti, setujui/tolak + alasan.
- Pasien lama: kartu tersedia di portal mereka yang sudah ada; broadcast
  WhatsApp "Dapatkan sesi gratis, selesaikan 3 misi" untuk mengajak.
- Voucher dipakai di alur pembayaran/invoice yang ada (`discount` di recap), tercatat
  sebagai kategori promo khusus agar muncul di `PromoDiscountWidget` dan laporan
  akuntansi (tidak "hilang" dari pembukuan).

### Keputusan owner (update)
- Misi Google: **ulasan jujur, rating apa pun** (tidak mensyaratkan bintang 5).
- Misi tambahan: **unggah story Instagram + tag Kaffah** (`ig_story_tag`), diverifikasi lewat tangkapan layar.
- **Fase 1 sudah dikodekan** (migrasi `20261102100000_kaffah_misi_loyalty.sql`, Edge Function
  `portal-loyalty-proof`, tab "Misi" di portal, halaman staf `/admin/misi-kaffah` & `/owner/misi-kaffah`).
  Belum diterapkan ke produksi: migrasi + deploy fungsi + isi tautan lalu aktifkan dari halaman Misi Kaffah.

### Hal yang HARUS diputuskan / diwaspadai
1. **Cakupan "100%"**: gratis apa? Usul: **1 sesi terapi** (nilai jelas), bukan
   paket penuh. Diskon 100% paket dengan syarat semudah ini rawan merugi:
   4 rujukan baru justru menjadi biaya akuisisi yang masuk akal untuk 1 sesi.
2. **Aturan Google (penting)**: Google melarang imbalan atas ulasan, apalagi
   dipersyaratkan **bintang 5**. Ulasan yang terdeteksi diberi insentif/disaring
   dapat dihapus, dan profil bisnis bisa kena penalti atau ditangguhkan, yang
   merugikan SEO Kaffah. **Usul pengaman**: syaratnya "memberi ulasan jujur
   (rating apa pun)", bukan harus bintang 5; atau ulasan dijadikan misi
   opsional bukan syarat reward. Mohon owner memilih.
3. **Instagram**: imbalan atas follow diperbolehkan, tapi verifikasi hanya
   lewat tangkapan layar (IG tidak menyediakan API untuk memeriksa follower).
   Risiko: bukti palsu. Mitigasi: admin cek manual + pasien bisa unfollow
   belakangan (tidak bisa dicegah).
4. **Referral**: hitung hanya orang **berbeda, belum pernah jadi pasien**, dan
   benar-benar hadir sesi pertama, supaya tidak bisa dimanipulasi dengan
   mendaftarkan akun kosong. Satu nomor HP hanya bisa dirujuk sekali.
5. **Batas biaya**: kuota voucher per bulan yang bisa diatur owner, dan satu
   voucher per pasien (atau per 12 bulan).
6. **Iklan kesehatan**: gunakan frasa "program apresiasi pasien", bukan
   menjanjikan terapi gratis secara agresif.

### Fase revisi
| Fase | Isi | Perkiraan |
|---|---|---|
| 1 | Tabel misi/referral/voucher, tab "Misi" di portal, unggah bukti, antrean verifikasi admin | 3-4 hari |
| 2 | Kode referral + hitung otomatis sesi pertama, voucher + validasi kasir + masuk laporan promo | 3-4 hari |
| 3 | Broadcast WhatsApp ke pasien lama, dashboard owner (misi selesai, voucher keluar, biaya vs pasien baru) | 2-3 hari |

---

## 1. Bisa di-adopt? Ya, dan Kaffah lebih diuntungkan dari bisnis biasa

Kartu stamp di kafe/ayam goreng hanya mengejar **repeat order**. Di fisioterapi
masalah utamanya sama tapi lebih mahal akibatnya: pasien **berhenti di tengah
program** (merasa sudah enakan setelah 2-3 sesi), padahal terapi baru efektif
jika tuntas. Jadi stamp digital Kaffah bukan "diskon", melainkan alat
**kepatuhan terapi** (adherence) yang kebetulan memberi reward.

Fondasi yang SUDAH ada di repo, sehingga ini bukan bangun dari nol:

| Kebutuhan | Sudah ada |
|---|---|
| Aplikasi pasien tanpa install | Portal `/p/:token` (`PatientPortalPage.jsx`), verifikasi tgl lahir, PWA |
| Data sesi selesai per pasien | `daily_recaps`, `sessions_done` di RPC portal home |
| Streak & gamifikasi | `streak_days`, `week`, `patient_exercise_logs` di portal home |
| Paket sesi | `package_tracking` |
| Notifikasi | Push (`send-push-notification`), WhatsApp (Watzap / Cloud API) |
| Multi-tenant + gerbang khusus Kaffah | `KAFFAH_CLINIC_ID` (`src/lib/clinicIds.js`) |
| Pola migrasi + RLS | `supabase/migrations` |

---

## 2. Konsep produk

**Nama**: *Kaffah Rewards* (kartu digital "Kaffah Card").

**Sudut positioning**: "Klinik fisioterapi pertama di Balikpapan yang
kemajuan dan komitmen pasiennya dihargai, bukan cuma dibayar." Terapi
dibingkai sebagai perjalanan pulih dengan milestone, bukan transaksi.

### Mekanisme stamp (satu stamp = satu perilaku sehat, bukan sekadar bayar)

| Aksi pasien | Stamp | Dicatat otomatis oleh |
|---|---|---|
| Hadir 1 sesi terapi (recap selesai) | +1 | trigger pada `daily_recaps` |
| Tuntaskan paket (semua sesi terpakai) | +3 bonus | trigger `package_tracking` selesai |
| Latihan mandiri 7 hari berturut (streak) | +1 | data `patient_exercise_logs` |
| Isi feedback / VAS setelah sesi | +1 (maks 1/sesi) | `patient_portal_feedback` |
| Ajak teman, teman selesai sesi pertama | +3 (pengajak) | kode referral |

Aturan anti-curang: stamp hanya lahir dari **event server**, tidak ada tombol
"tambah stamp" di sisi pasien. Admin bisa koreksi manual dengan alasan wajib
(tercatat di ledger).

### Tier & reward (angka awal, bisa diubah owner)

| Tier | Syarat (stamp akumulatif) | Manfaat |
|---|---|---|
| Sahabat | 0 | Akses kartu, pengingat |
| Perak | 10 | Prioritas pilihan jam booking |
| Emas | 25 | Diskon 10% paket berikutnya, 1 sesi konsultasi ulang gratis |
| Platinum | 50 | Home visit prioritas, merchandise, sesi gratis |

Kartu fisik 10-stamp tetap divisualkan di UI (grid 10 lingkaran seperti di
video) supaya mudah dipahami: tiap 10 stamp = 1 reward yang bisa ditukar.

**Catatan etika/regulasi** (penting untuk klinik): reward jangan membuat pasien
datang berlebihan tanpa indikasi medis. Stamp kunjungan dibatasi maksimal sesuai
rencana terapi terapis; tidak ada stamp untuk sesi di luar program. Jangan
iklankan "diskon tindakan medis" secara agresif; fokuskan pada layanan
non-medis (prioritas jadwal, merchandise, edukasi).

---

## 3. Rancangan teknis

### 3.1 Skema database (migrasi baru, semua kolom `clinic_id`, RLS per klinik)

```
loyalty_programs      (clinic_id pk, enabled, stamp_per_reward=10, rules jsonb, tiers jsonb)
loyalty_accounts      (id, clinic_id, patient_id unique, stamps_total, stamps_available, tier, referral_code unique, created_at)
loyalty_ledger        (id, clinic_id, account_id, delta int, reason text, source_type, source_id, created_by, created_at,
                       unique (source_type, source_id, reason))   -- idempotensi: event yang sama tidak bisa dihitung dua kali
loyalty_rewards       (id, clinic_id, name, cost_stamps, tier_min, stock, active)
loyalty_redemptions   (id, clinic_id, account_id, reward_id, status [pending|used|expired], code, redeemed_at, used_at, used_by)
```

- Saldo **diturunkan dari ledger** (append-only), kolom `stamps_*` hanya cache
  yang diperbarui trigger. Selalu bisa diaudit, selaras dengan pendekatan audit
  yang sudah dipakai di repo ini.
- Unique `(source_type, source_id, reason)` mencegah dobel stamp saat recap
  diedit ulang (pelajaran dari kasus recap/paket di `AUDIT_REPORT_*`).

### 3.2 Otomatisasi (server-side, bukan browser)

- Trigger `AFTER INSERT/UPDATE` pada `daily_recaps` -> fungsi `loyalty_award_session()`
  (SECURITY DEFINER, hanya jika `clinic_id = KAFFAH` dan program aktif).
- Trigger pada `package_tracking` saat status berubah ke selesai -> bonus.
- RPC `portal_loyalty(token)` untuk portal: saldo, tier, stamp, reward, riwayat.
- RPC `portal_loyalty_redeem(token, reward_id)` -> hasilkan kode tukar.
- RPC staf `loyalty_redeem_use(code)` agar admin memvalidasi saat pasien datang.
- Cron harian: tier naik -> kirim notifikasi; stamp hampir penuh -> pengingat.

Pola ini sama dengan fitur lain yang sudah dipindah ke server (lihat commit
"status pengiriman ditetapkan server, bukan browser").

### 3.3 Frontend

| Area | Perubahan |
|---|---|
| Portal pasien | Tab baru **"Kartu"** di `PatientPortalPage.jsx`: kartu stamp animasi, progres tier, daftar reward, kode referral, riwayat. Tampil hanya bila `clinic_id === KAFFAH_CLINIC_ID` dan program aktif. |
| Admin | Halaman **Loyalty** (`/admin/loyalty`): scan/ketik kode tukar, koreksi stamp dengan alasan wajib, lihat pasien per tier. |
| Owner | **Pengaturan Rewards** (aturan stamp, tier, katalog reward) + dasbor: pasien aktif, tingkat tuntas paket, redemption, ROI. |
| Wallet/Install | PWA "Tambah ke layar utama" (sudah ada `PWAInstallPrompt`), opsional QR di meja resepsionis menuju portal. |
| Notifikasi | Template WhatsApp baru di `wa_templates`: "Stamp baru", "Tinggal 1 sesi lagi", "Selamat naik tier Emas". |

Gerbang fitur: konstanta `KAFFAH_CLINIC_ID` + flag `loyalty_programs.enabled`
agar bisa dimatikan tanpa deploy, dan klinik lain tidak terpengaruh (tidak ada
perubahan perilaku untuk tenant lain).

### 3.4 Keamanan & privasi

- RLS: pasien hanya baca akunnya lewat RPC token (tidak ada akses tabel langsung dari anon).
- Kode tukar acak, sekali pakai, berkedaluwarsa.
- Data stamp bukan data medis; tidak menampilkan diagnosis di kartu.
- Referral: batasi per nomor/pasien untuk mencegah penyalahgunaan.

---

## 4. Dampak ke brand positioning Kaffah (sisi digitalisasi)

1. **Pembeda kategori**: hampir tidak ada klinik fisio lokal yang punya
   pengalaman pasien digital berkelanjutan; Kaffah tampil sebagai klinik modern & berbasis data.
2. **Retensi terukur**: tingkat tuntas paket, rata-rata sesi per pasien, repeat rate
   -> jadi angka yang bisa dipromosikan ("92% pasien Kaffah menuntaskan program").
3. **Word of mouth terstruktur**: referral berstamp mengubah testimoni menjadi akuisisi.
4. **Aset konten**: milestone ("Sesi ke-10!") mudah dibagikan ke Instagram Story,
   dengan template berlogo Kaffah (kartu bisa di-screenshot / "bagikan").
5. **Data untuk marketing**: segmentasi tier untuk WhatsApp broadcast terarah.
6. **Selaras produk Clinara**: Kaffah jadi *flagship / proof of concept*; kalau
   terbukti, fitur ini bisa dijual sebagai modul untuk klinik lain (tinggal
   mencabut gerbang `KAFFAH_CLINIC_ID`).

KPI: tingkat tuntas paket (+X%), repeat rate 60 hari, jumlah referral,
pasien aktif di portal, redemption rate, biaya reward vs pendapatan tambahan.

---

## 5. Fase pengerjaan

| Fase | Isi | Perkiraan |
|---|---|---|
| 0 | Keputusan produk: aturan stamp, tier, reward, anggaran reward | 1 sesi diskusi |
| 1 (MVP) | Migrasi + trigger stamp sesi & paket + tab "Kartu" di portal (baca saja) + kartu visual | 3-4 hari |
| 2 | Katalog reward, tukar kode, halaman admin validasi, WA notifikasi | 3-4 hari |
| 3 | Referral + tier + dasbor owner + konten "bagikan milestone" | 3-4 hari |
| 4 | Backfill sesi historis pasien (opsional), evaluasi KPI 30 hari, tuning | 1-2 hari |

MVP (Fase 1) sudah bisa dipamerkan ke pasien karena kartu langsung terisi dari
data sesi yang sudah ada.

---

## 6. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Biaya reward menggerus margin | Reward utama non-tunai (prioritas, merchandise); batas diskon di konfigurasi owner |
| Pasien datang berlebihan demi stamp | Stamp hanya untuk sesi sesuai program terapis |
| Dobel stamp akibat edit recap | Ledger idempoten (unique source) |
| Pasien tidak membuka portal | Link otomatis via WhatsApp setelah sesi pertama + QR di klinik |
| Regulasi iklan layanan kesehatan | Fokus pada edukasi/komitmen, bukan promosi tindakan |

---

## 7. Keputusan yang dibutuhkan dari owner

1. Reward apa yang realistis dan aman secara margin?
2. Backfill: apakah pasien lama langsung mendapat stamp dari riwayat sesinya?
3. Apakah referral masuk MVP atau fase 3?
4. Bahasa & gaya visual kartu: ikut warna brand Kaffah (`kaffah-logo.png`) atau tema khusus?
