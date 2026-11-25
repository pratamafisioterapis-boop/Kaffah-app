# Rancangan Modul Tumbuh Kembang Anak (Fisioterapi, Terapi Okupasi, Terapi Wicara)

Status: **rancangan awal, belum ada kode**. Disusun dari kondisi repo saat ini (Kaffah/Clinara: React + Vite + Supabase, multi-klinik).

## 1. Tujuan

1. Satu klinik bisa melayani anak dengan tiga disiplin: **Fisioterapi (PT)**, **Terapi Okupasi (OT)**, **Terapi Wicara (ST)**.
2. Tiap disiplin punya **SOAP sendiri** (isian, istilah, dan alat ukur berbeda).
3. Orang tua menerima **laporan perkembangan** berkala lewat **PDF** (kirim WhatsApp) dan **portal Clinara**.
4. Satu anak bisa ditangani lebih dari satu disiplin, dan laporannya bisa digabung.

## 2. Yang sudah ada dan dipakai ulang

| Kebutuhan | Sudah ada di repo | Rencana |
|---|---|---|
| SOAP | `medical_records` (+ `plan_data` jsonb), form di `components/therapist/MedicalRecordForm.jsx`, template subjektif | Tambah kolom `discipline` dan template per disiplin |
| Assessment berstandar | `lib/icfAssessment.js` + katalog `icf_codes` (1424 kode) | Perluas ke ICF-CY (versi anak) |
| PDF untuk pasien | `lib/soapPatientPdf.js` (jsPDF, gaya awam, kamus istilah) | Jadikan dasar `childProgressReportPdf.js` |
| Portal orang tua | `pages/portal/PatientPortalPage.jsx`, fungsi `portal_*`, tautan + tanggal lahir, hanya tampil nyeri/catatan/latihan, bukan SOAP mentah | Tambah tab "Perkembangan" |
| Program rumah | `plan_exercises`, video latihan di bucket privat, `portal-exercise-video` | Perluas untuk latihan OT/ST |
| Kirim dokumen | `lib/clinicalDocWhatsApp.js`, fungsi WatZap/WA Cloud, `SendClinaraDialog` | Kirim PDF laporan dan tautan portal |
| Fitur per klinik | `clinics.patient_portal_enabled`, `soap_first_settings` | Tambah `clinics.pediatric_enabled` |
| Peran | owner, admin, terapis, super admin | Tambah peran koordinator kasus (opsional) |

Catatan: aturan SOAP-sebelum-bayar (`docs/SOAP_FIRST_KAFFAH.md`) khusus Kaffah. Modul ini **tidak mengubah** aturan itu. Perlu diputuskan apakah sesi tumbuh kembang ikut aturan tersebut (lihat bagian 11).

## 3. Peran

| Peran | Hak |
|---|---|
| Terapis (PT/OT/ST) | Isi SOAP disiplinnya, tetapkan sasaran, input hasil tes, tulis draf laporan |
| Koordinator kasus (terapis senior, 1 per anak) | Gabung laporan antar-disiplin, setujui sebelum terbit |
| Admin | Jadwal, daftar anak, kirim laporan ke orang tua, tidak mengubah isi klinis |
| Owner | Atur template, harga per disiplin, lihat statistik |
| Orang tua/wali | Lihat laporan terbit, program rumah, isi catatan harian. Tanpa login, lewat tautan + tanggal lahir anak (mekanisme portal sekarang) |

## 4. Model data

Prinsip migrasi repo ini dipertahankan: **tanpa DROP/DELETE**, objek baru, fungsi `CREATE OR REPLACE`, RLS berdasarkan `get_my_clinic_id()`.

### 4.1 Perubahan tabel lama
- Tabel terapis: tambah `discipline` (`pt` | `ot` | `st`). Kolom `specialization` yang sudah ada tetap teks bebas.
- `medical_records`: tambah `discipline` dan `form_data jsonb` (isian terstruktur khusus disiplin). Isi teks S/O/A/P lama tetap dipakai agar laporan dan PDF yang ada tidak rusak.
- `clinics`: tambah `pediatric_enabled boolean default false`.

### 4.2 Tabel baru
```
child_profiles          1:1 dengan patients
  patient_id, birth_date, gestational_age_weeks, birth_weight_g, birth_history,
  medical_diagnosis (mis. CP, ASD, GDD, speech delay), school_name, school_level,
  primary_therapist_id, case_coordinator_id, referral_source, notes

guardians               wali/orang tua (bisa >1 per anak)
  patient_id, name, relation, phone, is_primary, consent_data_at, consent_share_at

developmental_assessments   hasil tes/skrining berulang
  patient_id, discipline, instrument_code, assessed_on, assessor_id,
  scores jsonb, summary_text, age_equivalent_months, source_file_url

child_goals             sasaran terapi (SMART)
  patient_id, discipline, domain, description, baseline, target, target_date,
  status (aktif | tercapai | direvisi | dihentikan), parent_friendly_text

goal_progress           capaian per sesi
  goal_id, medical_record_id, level (0-5 atau %), note

home_programs           tugas untuk orang tua
  patient_id, discipline, title, instructions, frequency, exercise_id,
  video_ref, start_on, end_on

parent_logs             catatan dari orang tua lewat portal
  patient_id, logged_on, home_program_id, done boolean, note, photo_url

progress_reports        laporan berkala
  patient_id, period_start, period_end, status (draf | ditinjau | terbit | dicabut),
  summary jsonb, disciplines text[], author_id, reviewed_by, published_at,
  pdf_path, version

progress_report_sections    satu bagian per disiplin
  report_id, discipline, author_id, content jsonb

report_access_log       siapa membuka/mengunduh (staf dan orang tua)
```

Semua tabel punya `clinic_id`. Portal orang tua tidak membaca tabel langsung, hanya lewat fungsi `SECURITY DEFINER` bernama `portal_child_*` (pola yang sama dengan `portal_*` sekarang).

## 5. SOAP per disiplin

Struktur S/O/A/P sama untuk semua. Yang berbeda adalah **blok Objective** dan **template Subjective**. Blok disimpan di `form_data`, ringkasan teksnya digenerate ke kolom teks lama.

**Subjective (semua disiplin)**: keluhan dari orang tua/guru, perkembangan sejak sesi lalu, kepatuhan program rumah, tidur/makan/perilaku, pemicu. Pakai ulang `SubjectiveTemplateBuilder` dan dikte suara (`VoiceDictationButton`).

**Fisioterapi (PT)**
- Milestone motorik kasar, kontrol kepala/trunk, duduk, merangkak, berdiri, jalan
- Tonus (Modified Ashworth/Tardieu), ROM, kekuatan (MMT), refleks primitif, postur
- Keseimbangan, pola jalan, ortosis/alat bantu
- Alat ukur: **GMFM-66/88**, **GMFCS** (level), PEDI-CAT, Pediatric Balance Scale

**Terapi Okupasi (OT)**
- Motorik halus (genggam, pinset, menggunting), koordinasi mata-tangan, menulis
- Pemrosesan sensori (hiper/hiposensitif, regulasi), perhatian, praksis
- ADL (makan, berpakaian, toileting), partisipasi sekolah/bermain
- Alat ukur: **Sensory Profile**, **COPM**, PEDI-CAT, Beery VMI, WeeFIM

**Terapi Wicara (ST)**
- Bahasa reseptif dan ekspresif (jumlah kosakata, panjang tuturan), pragmatik/sosial
- Artikulasi/fonologi (bunyi yang salah), kelancaran, suara
- Oromotor, makan-menelan (feeding), AAC jika dipakai
- Alat ukur: tes bahasa yang dipakai klinik (mis. PLS, CELF), skrining ELM

**Skrining umum (semua disiplin, dipakai berkala)**: KPSP, Denver II, ASQ-3, M-CHAT-R/F.

Catatan penting soal alat ukur:
- Banyak yang **berlisensi** (Bayley, Sensory Profile, Vineland, PLS, Beery). Aplikasi **hanya menyimpan skor dan interpretasi** yang dimasukkan terapis, tidak memuat butir soalnya.
- Daftar alat ukur dibuat sebagai **katalog yang bisa diatur klinik** (`instrument_code`, nama, disiplin, rentang usia, jenis skor), jadi klinik memakai yang memang mereka punya.

**Assessment**: lanjutkan pola ICF yang ada, tetapi untuk anak pakai **ICF-CY**. Kode ICF-CY belum tentu ada di katalog 1424 kode sekarang, perlu dicek dan ditambah (butuh sumber resmi WHO).

**Dasar penentuan usia**: tampilkan **usia kronologis** dan, bila prematur, **usia koreksi** (dihitung dari `gestational_age_weeks`, berlaku sampai sekitar 24 bulan) di header setiap SOAP dan laporan.

## 6. Sasaran terapi dan pengukuran kemajuan

- Terapis menetapkan 3-6 sasaran per disiplin di awal (baseline, target, tenggat), dengan teks versi orang tua.
- Tiap sesi, terapis menandai capaian sasaran yang disentuh (skala 0-5 atau persen). Ini input utama grafik laporan.
- Sasaran ditinjau tiap periode laporan: tercapai, lanjut, direvisi, atau dihentikan, dengan alasan.
- Hasil tes berulang (GMFM, dll) digambar sebagai tren per instrumen.

## 7. Laporan perkembangan

### Alur
```
Sesi + SOAP + capaian sasaran + hasil tes
        ↓  (akhir periode, mis. tiap 1 bulan atau 12 sesi, bisa diatur)
Sistem membuat DRAF per disiplin (otomatis, deterministik, seperti icfAssessment)
        ↓
Terapis tiap disiplin menyunting bagiannya
        ↓
Koordinator kasus menggabung + menulis ringkasan dan rekomendasi
        ↓
Status "ditinjau" → "terbit"
        ↓
PDF dibuat + tautan portal aktif + admin kirim lewat WhatsApp
```
Draf otomatis hanya menyusun data (capaian sasaran, tren skor, jumlah kehadiran, program rumah). **Kesimpulan klinis tetap ditulis terapis**, sama prinsipnya dengan Assessment ICF sekarang. AI boleh dipertimbangkan nanti sebagai bantuan merapikan bahasa, bukan sebagai penentu isi.

### Isi laporan (PDF dan portal)
1. Identitas anak, usia kronologis/koreksi, periode, disiplin dan terapis
2. Ringkasan untuk orang tua (maks 1 paragraf, bahasa awam)
3. Per disiplin: kemajuan tiap sasaran (progres bar), temuan utama, hasil tes dan perbandingan dengan sebelumnya
4. Kehadiran dan kepatuhan program rumah
5. Program rumah untuk periode berikutnya (dengan gambar/video)
6. Rencana dan rekomendasi (frekuensi, rujukan, kebutuhan alat, koordinasi dengan sekolah)
7. Kamus istilah singkat (pakai pola `soapGlossary`)
8. Tanda tangan/ identitas terapis (STR/SIP) dan tanggal terbit

Versi singkat untuk guru sekolah (opsional): hanya saran kelas, tanpa data klinis rinci.

### Teknis PDF
Pakai jsPDF seperti `soapPatientPdf.js`. Perhatikan: font standar jsPDF hanya Latin-1, jadi karakter di luar itu harus dibersihkan (sudah ditangani fungsi `clean`). Grafik tren digambar langsung sebagai vektor di PDF (tanpa html2canvas) agar tajam dan kecil. PDF disimpan di storage privat dengan nomor versi, sehingga revisi tidak menimpa dokumen yang sudah dikirim.

## 8. Portal Clinara untuk orang tua

Memakai mekanisme yang sudah ada: tautan + token ber-hash + verifikasi tanggal lahir anak. Perluasan:

- **Beranda anak**: foto/nama, usia, disiplin aktif, jadwal berikutnya
- **Laporan**: daftar laporan terbit, buka di layar atau unduh PDF
- **Perkembangan**: grafik sasaran dan skor tes, kata-kata awam
- **Program rumah**: daftar tugas + video, tombol "sudah dilakukan hari ini"
- **Catatan orang tua**: tulis pengamatan atau pertanyaan, foto/video singkat, masuk ke inbox terapis (`PatientPortalInbox` sudah ada)
- **Jadwal**: sudah ada (booking portal)

Aturan tampilan: orang tua **hanya melihat laporan berstatus terbit** dan konten yang dibuat ramah awam. SOAP mentah tidak ditampilkan, konsisten dengan portal sekarang.

## 9. Privasi dan keamanan

Data anak dan diagnosis perkembangan termasuk data pribadi **spesifik** menurut UU PDP (UU 27/2022). Rancangan:

- **Persetujuan wali tercatat** (pengolahan data, berbagi dengan sekolah/pihak lain, dokumentasi foto/video), disimpan dengan tanggal dan versi teks.
- Berbagi ke sekolah/dokter lain hanya lewat tautan PDF **berkedaluwarsa**, tercatat di `report_access_log`.
- Akses portal tetap dengan token hash, batasi percobaan salah (sudah ada), tautan bisa dicabut.
- Foto/video anak di bucket privat, URL bertanda tangan berumur pendek.
- Terapis disiplin lain hanya melihat anak yang memang ditugaskan, kecuali koordinator.
- Log audit untuk pembukaan, ekspor, dan perubahan laporan terbit. Laporan terbit tidak diedit, revisi membuat versi baru.
- Pertimbangkan masa retensi rekam medis sesuai aturan yang berlaku untuk klinik (perlu dikonfirmasi ke pihak hukum klinik).

## 10. Tahapan pengerjaan

| Fase | Isi | Hasil yang bisa dicoba |
|---|---|---|
| 0 | Putuskan pertanyaan di bagian 11, kumpulkan contoh form/laporan nyata dari tiap disiplin | Spesifikasi final |
| 1 | `discipline`, `child_profiles`, `guardians`, flag klinik, template SOAP PT/OT/ST, usia koreksi | Terapis bisa SOAP anak sesuai disiplinnya |
| 2 | `child_goals`, `goal_progress`, `developmental_assessments`, katalog alat ukur, grafik tren di dalam aplikasi | Kemajuan anak terlihat oleh terapis |
| 3 | `progress_reports`, draf otomatis, alur tinjau-terbit, PDF, kirim WhatsApp | Laporan PDF sampai ke orang tua |
| 4 | Fungsi `portal_child_*`, tab Perkembangan di portal, program rumah dan catatan orang tua | Orang tua membuka laporan di portal |
| 5 | Laporan gabungan multi-disiplin, rapat kasus, laporan untuk sekolah, statistik owner, harga/paket per disiplin | Operasional penuh |

Saran: mulai fase 1-3 dengan **satu klinik uji** dan satu disiplin lebih dulu (misal fisioterapi anak, karena paling dekat dengan alur sekarang), baru tambah OT dan ST. Portal (fase 4) baru dibuka setelah format PDF disetujui terapis, karena isinya sama.

## 11. Pertanyaan yang perlu dijawab

1. Apakah ini untuk **klinik Kaffah saja** atau fitur Clinara untuk banyak klinik? (menentukan flag dan template per klinik)
2. Apakah ketiga disiplin sudah ada terapisnya sekarang? Siapa yang menyusun template SOAP OT dan ST? Sebaiknya terapis masing-masing yang membuat daftar isiannya.
3. Alat ukur apa yang **benar-benar dipakai** tiap disiplin saat ini?
4. Periode laporan: bulanan, per 12 sesi, atau per 3 bulan? Siapa yang menandatangani?
5. Satu anak sering ditangani **lebih dari satu disiplin sekaligus**? Jika ya, laporan digabung atau terpisah per disiplin?
6. Apakah sesi anak memakai **sistem paket dan SOAP-sebelum-bayar** yang sama dengan pasien dewasa?
7. Kirim laporan: otomatis ke WhatsApp setelah terbit, atau admin yang mengirim manual?
8. Apakah perlu versi untuk **sekolah** atau dokter spesialis anak?

## 12. Risiko

- **Beban pengisian terapis**: form terstruktur yang terlalu panjang akan ditinggalkan. Isian wajib dibuat sedikit, sisanya opsional.
- **Lisensi alat ukur**: jangan memasukkan butir soal tes berlisensi.
- **Bahasa laporan**: istilah klinis ke orang tua bisa menimbulkan salah paham atau cemas. Wajib ada teks awam dan tinjau koordinator sebelum terbit.
- **Skala besar tabel `medical_records`**: kolom baru perlu indeks (`clinic_id, patient_id, discipline, created_at`), mengikuti catatan perf di `supabase/manual`.
- **Data lama**: pasien anak yang sudah ada bisa diberi `child_profiles` belakangan tanpa kehilangan riwayat SOAP.
