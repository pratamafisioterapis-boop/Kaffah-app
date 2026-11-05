# Anatomi 3D — Setup Model

Menu **Anatomi 3D** (`/therapist/anatomi-3d`) menampilkan anatomi manusia utuh (tulang, sendi/ligamen/kartilago, otot & tendon, saraf, arteri, vena, organ, kulit) memakai **model open-source hasil scan manusia asli**:

- **Z-Anatomy**: https://www.z-anatomy.com, lisensi CC BY-SA 4.0
- dibangun dari **BodyParts3D** (© DBCLS, Jepang): https://dbarchive.biosciencedbc.jp/en/bodyparts3d, lisensi CC BY-SA 2.1 JP

File model tidak disimpan di repo karena besar. File diunggah **satu kali** ke Supabase Storage.

## 1. Jalankan migrasi

`supabase/migrations/20261105190000_anatomy_3d_bucket.sql` membuat bucket publik `anatomy-3d`. Bucket ini bisa dibaca siapa saja, dan hanya super admin yang bisa menulis.

## 2. Siapkan file `.glb` per lapisan

1. Unduh Z-Anatomy versi Blender (file `.blend`) dari situs atau GitHub Z-Anatomy.
2. Pasang Blender 3.6 atau 4.x.
3. Jalankan skrip ekspor:

```bash
blender Z-Anatomy.blend --background --python tools/anatomy/blender_export_layers.py -- --out ./anatomy-glb --decimate 0.5
```

Hasilnya `skeleton.glb, joints.glb, muscles.glb, nerves.glb, arteries.glb, veins.glb, organs.glb, skin.glb`, sudah dikompres Draco.

- Atur `--decimate` (0–1) supaya tiap file **di bawah ±40 MB** agar cepat dimuat di HP. Nilai 0.3–0.5 biasanya masih detail.
- Skrip mengelompokkan mesh dari namanya (aturannya sama dengan `src/lib/anatomy3d/layers.js`). Periksa log `dilewati (tidak terklasifikasi)`. Jika jumlahnya banyak, tambahkan kata kunci di `RULES`.

> Alternatif: ekspor satu file gabungan bernama `full.glb`. Viewer akan mengelompokkan lapisan sendiri dari nama mesh. Cara ini lebih sederhana, tetapi semua lapisan dimuat sekaligus (lebih berat).

## 3. Unggah ke Supabase

Buka Supabase Dashboard → Storage → bucket `anatomy-3d`, lalu unggah semua file `.glb` ke root bucket. Batas per file di bucket ini 100 MB. Pastikan batas unggah global proyek di *Storage settings* juga cukup.

Setelah itu buka menu **Anatomi 3D** di akun terapis. Lapisan Tulang, Sendi, dan Otot dimuat otomatis. Lapisan lain dimuat saat dinyalakan atau saat dipakai preset diagnosa.

## Uji tanpa upload

Tombol **Buka file .glb** di halaman memuat file dari perangkat. File tidak dikirim ke server. Beri nama file sesuai lapisannya (mis. `muscles.glb`) agar masuk ke lapisan yang benar.

## Fitur

| Fitur | Keterangan |
|---|---|
| Lapisan | Nyalakan atau matikan lapisan dan atur transparansinya (mis. kulit transparan agar otot terlihat). |
| Preset diagnosa | 66 kelompok diagnosa (bahu, siku/tangan, leher, punggung, panggul, lutut, kaki, neuro, kardiorespirasi). Struktur terkait diwarnai merah, struktur lain dibuat transparan, kamera diarahkan ke lokasinya, lalu tampil penjelasan berbahasa awam untuk pasien. Data ada di `src/lib/anatomy3d/diagnosisPresets.js`. |
| Pilih struktur | Klik bagian tubuh untuk melihat namanya, lalu Tandai bermasalah, Fokus, Isolasi, atau Sembunyikan. |
| Tandai nyeri | Mode pin: klik permukaan tubuh untuk menaruh titik bernomor beserta catatan. |
| Unduh gambar | Simpan PNG tampilan saat ini beserta tanda, misalnya untuk dikirim ke pasien. |
| Layar penuh | Mode presentasi ke pasien. Penjelasan diagnosa tetap tampil. |

## Batasan

- Preset diagnosa **menyorot lokasi struktur normal** yang terlibat. Model tidak memperlihatkan kerusakan jaringan (mis. robekan atau pengapuran).
- Tanda dan catatan belum disimpan ke rekam medis. Simpan sebagai gambar lewat tombol Unduh.
- Lisensi CC BY-SA mewajibkan atribusi. Teks atribusi sudah tampil di bawah panel samping, jangan dihapus.
