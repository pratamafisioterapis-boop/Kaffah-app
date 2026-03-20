# Checklist Verifikasi Sinkronisasi Data Pasien

Checklist ini digunakan untuk memverifikasi bahwa semua data pasien ditampilkan dan diproses secara konsisten di seluruh aplikasi, terutama setelah pembaruan pada `patientHelpers.js`.

## 1. Verifikasi Tampilan Data (Patient List)

- [ ] **Usia Ditampilkan dengan Benar**
  - Pastikan kolom "Usia" menampilkan angka diikuti "thn" (contoh: "25 thn").
  - Pastikan TIDAK ADA teks "undefined thn" atau "NaN thn".
  - Untuk tanggal lahir kosong, pastikan tampil tanda "-".

- [ ] **Gender Ditampilkan Lengkap**
  - Pastikan kolom "Gender" menampilkan label penuh: "Laki-laki" atau "Perempuan".
  - Pastikan TIDAK ADA inisial tunggal seperti "L" atau "P".

- [ ] **Format Nomor HP**
  - Pastikan nomor HP tampil (contoh: "08123456789").
  - Pastikan data diambil dari field `phone` (bukan `phone_number` yang mungkin null).
  - Jika kosong, tampilkan "-".

- [ ] **Format Tanggal Lahir**
  - Pastikan ada kolom "Tgl Lahir".
  - Format harus DD/MM/YYYY (contoh: 31/12/1990).
  - Pastikan tidak ada format ISO mentah (YYYY-MM-DD) di tampilan tabel.

- [ ] **Status Kelengkapan Data**
  - Pastikan kolom "Kelengkapan" muncul.
  - Badge Hijau "Lengkap" jika: Nama, Gender, Tgl Lahir, dan No HP terisi.
  - Badge Kuning "Tidak Lengkap" jika salah satu kosong.

## 2. Verifikasi Form Edit (Patient Dialog)

- [ ] **Load Data Existing**
  - Saat tombol Edit diklik, form harus terisi data yang benar.
  - Field Tanggal Lahir (`type="date"`) harus terisi (format input HTML YYYY-MM-DD).
  - Dropdown Gender harus terpilih sesuai data ("Laki-laki" atau "Perempuan").

- [ ] **Validasi Input**
  - Kosongkan Nama Lengkap -> Tombol Simpan disabled atau muncul error merah.
  - Kosongkan Tgl Lahir -> Muncul error.
  - Isi No HP dengan huruf -> Muncul error "No. HP harus angka".

- [ ] **Penyimpanan Data (Save)**
  - Ubah Tanggal Lahir, Simpan.
  - Pastikan di Tabel List, Usia dan Tgl Lahir berubah sesuai inputan baru.
  - Cek Network Tab (DevTools) saat simpan: Payload harus menggunakan key `birth_date`, `gender`, `phone` (bukan `age` atau `phone_number`).

## 3. Verifikasi Tampilan Terapis (Therapist View)

- [ ] **Konsistensi Kartu Pasien**
  - Buka dashboard Terapis -> Pasien Saya.
  - Pastikan data di kartu pasien sama formatnya dengan Admin:
    - Usia (X thn)
    - Tgl Lahir (DD/MM/YYYY)
    - Icon Centang Hijau (Lengkap) atau Seru Kuning (Tidak Lengkap)

## 4. Verifikasi Teknis

- [ ] **Console Log**
  - Buka Developer Tools (F12).
  - Refresh halaman pasien.
  - Pastikan tidak ada Error berwarna merah terkait `normalizePatient` atau `date-fns`.

- [ ] **Supabase Data Match**
  - Bandingkan satu data pasien di Table Dashboard dengan data asli di Supabase Table Editor.
  - Pastikan tidak ada data yang hilang saat round-trip (Read -> Edit -> Save).

---

**Catatan Pengujian Terakhir:**
- Tanggal: ____________________
- Penguji: ____________________
- Status: [ ] Lulus / [ ] Gagal