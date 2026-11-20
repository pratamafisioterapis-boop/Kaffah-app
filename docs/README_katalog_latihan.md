# Katalog latihan usulan (tahap 2)

File utama: `katalog_latihan_usulan.csv` (236 baris, UTF-8). Peta penyatuan video: `peta_penyatuan_latihan_tahap1.csv`. Database belum diubah.

## Isi
- 213 latihan lama yang dipakai rencana diagnosa, ditulis ulang.
- 23 konsep baru (`BARU` 14, `BARU-KEPUTUSAN` 9) untuk latihan baru tanpa padanan lama.
- 6 latihan lama bervideo yang duplikat (ST01, IL01, IS01, IR01, RM01, RM02) tidak punya baris sendiri; videonya masuk ke CX06, CX08, CX03.
- 221 video semuanya ditempatkan (`video_sendiri_sekarang` + `video_dipindah_pasti` + `video_dipindah_perlu_tinjau`).

## Cara membaca kolom bukti
- `tingkat_bukti`: 1 pedoman klinis, 2 tinjauan sistematis/Cochrane, 3 RCT/studi tunggal, 4 bukti lemah/campuran/bertentangan, 5 konsensus/praktik klinis.
- `cakupan_bukti`: apakah bukti menguji latihan itu langsung, hanya kategori latihan, tidak langsung, atau tidak ada sumber yang saya baca. Banyak latihan bertingkat 1-2 hanya karena kategorinya didukung.
- `dasar_dosis`: dari mana angka dosis berasal. Kalau tertulis konsensus/praktik klinis, literatur yang saya baca tidak menetapkan dosis.
- `sumber`: judul, PMID, dan bentuk yang benar-benar saya baca (abstrak, teks PMC, atau PDF).

## Batasan yang perlu Anda tahu
- 103 dari 236 baris tidak punya sumber yang saya baca (tingkat 5).
- Dosis hampir semuanya konsensus; pedoman jarang menetapkan angka. Yang punya angka dari sumber terbaca: vestibular (VS02), OA panggul (GN03), ACSM/WHO (aerobik, penguatan, peregangan), Copenhagen (HP19), program latihan lansia/Tai chi.
- Beberapa pedoman JOSPT (bahu, lutut, pergelangan kaki, plantar heel pain 2023, patelofemoral 2019) tidak bisa dibuka teks lengkapnya (jospt.org menolak akses otomatis), jadi rekomendasinya tidak dikutip.
- Pedoman nyeri leher 2017 dibaca dari terjemahan Mandarin resmi di orthopt.org.
- Teknik per latihan ("cara_melakukan") adalah deskripsi praktik klinis standar, bukan kutipan.
- Ada 9 baris `BARU-KEPUTUSAN` dan banyak video `perlu_tinjau` yang menunggu keputusan klinis Anda.

## Perubahan penting dibanding isi lama
- VS02 dosis diganti sesuai pedoman vestibular 2016.
- VS01 (Brandt-Daroff), RS07 (incentive spirometry), RS04 (ACBT), RS08 (IMT), EW08-EW11 dan CX15 (gliding/neural glide), NR11 (treadmill BWS): tingkat bukti diturunkan.
- VS05: pedoman menyatakan gerak sakadik/smooth pursuit sukarela tidak boleh dipakai sendirian.
- GN08 (Tai chi): studi memakai sesi 60 menit; isi lama 20-30 menit.
