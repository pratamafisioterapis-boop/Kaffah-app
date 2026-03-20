# ANALISA STRUKTUR DATABASE - DAILY RECAPS

## 1. TABEL daily_recaps
### Struktur Kolom:
- id: uuid (PRIMARY KEY)
- patient_id: uuid (FK to patients.id)
- recap_date: date
- diagnosis: jsonb
- patient_type: text
- therapist_name: text (snapshot/manual entry)
- service_type: text
- amount: numeric
- payment_method: text
- created_at: timestamp with time zone
- updated_at: timestamp with time zone
- package_type: text
- start_time: timestamp with time zone
- end_time: timestamp with time zone
- invoice_url: text
- is_auto_filled: jsonb
- appointment_id: uuid (FK to appointments.id)
- session_info: text
- package_deleted_flag: boolean
- is_auto_filled_pkg: boolean
- actual_patient_id: uuid (FK to patients.id, self-referencing relationship `daily_recaps_actual_patient_id_fkey`)
- therapist_id: uuid (FK to physiotherapists.id)
- evaluation_daily: text
- discount_type: text
- discount_value: numeric
- guest_name: text
- guest_phone: text
- package_tracking_id: uuid (FK to package_tracking.id)
- is_package_purchase: boolean
- status: text
- display_time: text

### Contoh Data (Inferensi berdasarkan skema dan penggunaan umum):
| id | therapist_name | therapist_id | patient_id | actual_patient_id |
|---|---|---|---|---|
| UUID-1 | "Terapis A" | UUID-T-A | UUID-P-1 | UUID-P-1 |
| UUID-2 | "Terapis B" | UUID-T-B | UUID-P-2 | UUID-P-3 |
| UUID-3 | NULL | UUID-T-C | UUID-P-4 | NULL |
| UUID-4 | "Terapis D" | UUID-T-D | UUID-P-5 | UUID-P-5 |
| UUID-5 | "Terapis E" | UUID-T-E | UUID-P-6 | NULL |

**Catatan:**
- `therapist_name` dan `therapist_id` bisa berisi data, `therapist_name` kemungkinan juga bisa `NULL` atau string kosong jika terapis dihapus atau tidak diisi.
- `actual_patient_id` bisa `NULL` jika pasien aktual sama dengan `patient_id` (pemilik paket) atau jika tidak ada pasien aktual yang berbeda.

## 2. TABEL physiotherapists
### Struktur Kolom:
- id: uuid (PRIMARY KEY)
- user_id: uuid
- clinic_id: uuid (FK to clinics.id)
- specialization: text
- license_number: text
- bio: text
- created_at: timestamp with time zone
- phone: text
- email: text
- avatar_url: text
- is_active: boolean
- working_days: jsonb
- working_hours: jsonb
- session_schedule: jsonb
- name: text
- salary_scheme: text
- base_salary: numeric
- transport_per_day: numeric
- payroll_start_date: date
- payroll_end_date: date
- services: jsonb
- is_head: boolean

### Contoh Data (Inferensi):
| id | name | user_id |
|---|---|---|
| UUID-T-A | "Dr. Sarah" | UUID-U-A |
| UUID-T-B | "Terapis Budi" | UUID-U-B |
| UUID-T-C | "Terapis Clara" | UUID-U-C |

## 3. TABEL patients
### Struktur Kolom:
- id: uuid (PRIMARY KEY)
- medical_record_number: character varying
- full_name: text
- nickname: text
- nickname_custom: boolean
- gender: character varying
- birth_date: date
- nik: character varying
- address: text
- phone: character varying (DITEMUKAN: kolom `phone` ada di tabel `patients`)
- additional_info_option_id: uuid
- status: character varying
- created_at: timestamp with time zone
- updated_at: timestamp with time zone
- source_option_id: uuid

### Contoh Data (Inferensi):
| id | full_name | phone |
|---|---|---|
| UUID-P-1 | "Pasien Satu" | "08123456789" |
| UUID-P-2 | "Pasien Dua" | "08765432101" |
| UUID-P-3 | "Pasien Tiga" | "08509876543" |

## 4. RELASI FOREIGN KEY
- daily_recaps.therapist_id → physiotherapists.id? **YES**
- daily_recaps.patient_id → patients.id? **YES** (Nama relasi: `daily_recaps_patient_id_fkey`)
- daily_recaps.actual_patient_id → patients.id? **YES** (Nama relasi: `daily_recaps_actual_patient_id_fkey`)

## 5. MASALAH YANG DITEMUKAN (Berdasarkan skema dan dugaan kasus):
- Kolom `therapist_name` di `daily_recaps` adalah kolom `text`. Ini bisa berupa snapshot atau manual input. `therapist_id` adalah FK ke `physiotherapists.id`. Idealnya, `therapist_name` hanya digunakan sebagai fallback atau jika terapis tidak ditemukan di tabel `physiotherapists`.
- Kolom `therapist_id` di `daily_recaps` memiliki relasi FK yang jelas ke `physiotherapists.id`.
- Kolom `actual_patient_id` di `daily_recaps` memiliki relasi FK yang jelas ke `patients.id`. Ini mengindikasikan bahwa "pemilik paket" (patient_id) dan "pasien aktual" (actual_patient_id) disimpan secara terpisah di tabel `daily_recaps` dan keduanya merujuk ke tabel `patients`.
- Kolom `phone` di `patients`: **ADA** (`phone character varying`). Jadi, informasi nomor HP dapat diambil langsung dari tabel `patients`.
- Relasi `physiotherapists`: Bekerja dengan baik (`therapist_id` di `daily_recaps` merujuk ke `id` di `physiotherapists`).

## 6. REKOMENDASI MAPPING (Berdasarkan analisa di atas):
- **Kolom Terapis:**
    1.  Prioritaskan pengambilan nama terapis dari relasi `physiotherapists.name` menggunakan `therapist_id`.
    2.  Jika `physiotherapists.name` tidak tersedia (misal: terapis dihapus atau relasi putus), gunakan nilai `daily_recaps.therapist_name` sebagai fallback.
    3.  Jika keduanya tidak ada, tampilkan `'-'` atau placeholder lain.
- **Kolom Pasien:**
    1.  Untuk menampilkan nama pasien utama, gunakan `actual_patients.full_name` jika `actual_patient_id` tidak `NULL`.
    2.  Jika `actual_patient_id` `NULL`, gunakan `patients.full_name` (pemilik paket) sebagai nama pasien utama.
    3.  Tampilkan subtext "(Paket: [Nama Pemilik Paket])" HANYA jika `actual_patient_id` **tidak sama dengan** `patient_id` DAN `patient_id` tidak `NULL`. Nama pemilik paket diambil dari `patients.full_name` melalui `daily_recaps_patient_id_fkey`.
- **Nomor HP Pasien:**
    1.  Saat pasien dipilih di modal (baik `patient_id` maupun `actual_patient_id`), ambil `phone` dari tabel `patients` yang terkait.
    2.  Prioritaskan nomor HP dari `actual_patient_id` jika diisi, jika tidak, gunakan dari `patient_id`.
    3.  Tampilkan di kolom read-only di modal.
- **Query Fetching Data:**
    1.  Pastikan query untuk `daily_recaps` menyertakan relasi (JOIN/embedding) ke `patients` (untuk `patient_id`) dan `actual_patients` (untuk `actual_patient_id`), serta `physiotherapists` (untuk `therapist_id`).
    2.  Sertakan kolom `phone` saat mengambil data `patients` untuk kebutuhan auto-fill nomor HP.
- **Console Logging:** Sertakan `console.log` di setiap tahap resolusi nama terapis dan perbandingan ID pasien untuk debugging yang efektif.