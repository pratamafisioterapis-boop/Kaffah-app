# Analisis Logika Package Recap (Admin vs Owner)

Dokumen ini menjelaskan perbedaan mendasar antara implementasi Package Recap pada dashboard Admin dan Owner, serta analisis teknis terkait keamanan dan konsistensi data.

## BAGIAN 1: ADMIN PACKAGE RECAP (`src/components/admin/PackageRecap.jsx`)

### Data yang Ditampilkan
Halaman ini menampilkan ringkasan status paket pasien yang tersimpan di tabel database `package_tracking`. Data bersifat **agregat** (nilai tersimpan), artinya komponen ini mempercayai angka yang ada di database tanpa menghitung ulang dari transaksi harian.

### Scope & Filtering
- **Scope Data:** Menampilkan **SEMUA** data paket yang dikembalikan oleh API.
- **Filtering (Client-Side):**
  - **Search:** Filter berdasarkan Nama Pasien atau Nama Paket.
  - **Status:** Filter berdasarkan status hasil komputasi (`aktif`, `selesai`, `expired`, `diperpanjang`).
  - **Status Logic:** Status ditentukan secara dinamis di frontend (`calculateStatus`) membandingkan `end_date`/`extended_until` dengan tanggal hari ini.

### API Calls
- **Primary Function:** `getAllPackageTrackings()` dari `src/lib/api.js`.
- **Query:** `supabase.from('package_tracking').select('*, patient:patients(full_name, rm_number)').order(...)`
- **Dependency:** Hanya bergantung pada tabel `package_tracking` dan relasi ke `patients`.

---

## BAGIAN 2: OWNER PACKAGE RECAP (`src/components/owner/OwnerPackageRecap.jsx`)

### Data yang Ditampilkan
Halaman ini menampilkan data paket pasien, namun dengan nilai penggunaan (sessions used/remaining) yang **dihitung ulang secara real-time** (on-the-fly) berdasarkan riwayat kunjungan harian (`daily_recaps`).

### Scope & Filtering
- **Scope Data:** Menampilkan **SEMUA** paket (sama dengan Admin).
- **Filtering (Client-Side):** Filter berdasarkan pencarian nama pasien/paket.
- **Logika Kalkulasi (Unik):** 
  - Menggunakan fungsi utilitas `calculatePackageSessionsFromRecaps`.
  - Mengabaikan nilai `sessions_used` yang tersimpan di tabel `package_tracking` untuk tampilan.
  - Menghitung manual: `Total Transaksi di daily_recaps` yang cocok dengan nama pasien dan nama paket sejak tanggal mulai paket.

### API Calls
- **Primary Function 1:** `getAllPackageTrackings()` (Mengambil daftar paket).
- **Primary Function 2:** `getDailyRecaps()` (Mengambil seluruh riwayat transaksi).
- **Logic:** Menggabungkan kedua data tersebut di frontend untuk audit penggunaan sesi.

---

## BAGIAN 3: PERBANDINGAN API CALLS

| Fitur | Admin (`PackageRecap.jsx`) | Owner (`OwnerPackageRecap.jsx`) |
| :--- | :--- | :--- |
| **Sumber Data Utama** | `package_tracking` | `package_tracking` + `daily_recaps` |
| **Penentuan Sisa Sesi** | Menggunakan kolom DB: `sessions_remaining` | Kalkulasi frontend: `Total - Count(daily_recaps)` |
| **API Load** | Ringan (1 request) | Berat (2 requests + heavy processing) |
| **Akurasi Data** | Bergantung pada trigger database update | Akurat berdasarkan transaksi aktual (audit proof) |
| **Filter Server-Side** | Tidak ada (ambil semua) | Tidak ada (ambil semua) |

---

## BAGIAN 4: LOGIKA BISNIS & REKOMENDASI

### 1. Konsistensi Data (Inconsistency Risk)
- **Isu:** Terdapat risiko inkonsistensi antara apa yang dilihat Admin dan Owner. Jika trigger database gagal mengupdate `package_tracking` saat ada transaksi baru, Admin akan melihat data lama, sedangkan Owner melihat data aktual (karena dihitung ulang).
- **Rekomendasi:** Gunakan pendekatan "Single Source of Truth". Idealnya, perbaiki Database Trigger (`handle_daily_recap_trigger`) untuk menjamin `package_tracking` selalu 100% akurat, sehingga Owner tidak perlu melakukan kalkulasi berat di frontend. Kedua dashboard harusnya menampilkan data dari sumber yang sama.

### 2. Kinerja (Performance)
- **Isu:** `OwnerPackageRecap` mengambil **seluruh** `daily_recaps`. Seiring berjalannya waktu, data ini akan menjadi sangat besar (ribuan baris), yang akan memperlambat loading halaman Owner secara signifikan.
- **Rekomendasi:** Hindari `getDailyRecaps()` tanpa filter di frontend. Jika audit diperlukan, lakukan kalkulasi via Supabase Edge Function atau RPC (Remote Procedure Call) di database, bukan di browser client.

### 3. Keamanan & Multi-Tenancy (Data Leak Risk)
- **Isu:** Fungsi `getAllPackageTrackings()` saat ini mengambil semua data tanpa memfilter berdasarkan `clinic_id`.
  - Query: `supabase.from('package_tracking').select(...)`
  - RLS Policy: `auth.role() = 'authenticated'` (Terbuka untuk semua user login).
- **Dampak:** Jika aplikasi digunakan oleh lebih dari satu klinik, Admin Klinik A bisa melihat data pasien Klinik B.
- **Rekomendasi:** 
  1. **Update API:** Ubah `getAllPackageTrackings` untuk memfilter berdasarkan klinik user yang login.
  2. **Update RLS:** Perketat Row Level Security di Supabase agar hanya mengembalikan baris dimana `patient.clinic_id` cocok dengan `user.clinic_id`.