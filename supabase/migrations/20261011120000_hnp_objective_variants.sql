-- Template Objective HNP dengan dua varian. Nama varian sama dengan Subjective, sehingga
-- memilih varian di Subjective otomatis mengganti varian Objective (lihat variantSel di MedicalRecordForm).
update public.operational_options
   set objective_template = $fn$@@VARIAN: Menjalar
Inspeksi
- Postur lumbal tampak (lordosis normal/hiperlordosis/hipolordosis).
- (Ditemukan/Tidak ditemukan) skoliosis atau lateral shift ke arah (kanan/kiri).
- Gaya jalan tampak (normal/antalgik/lainnya).
- (Ditemukan/Tidak ditemukan) pembengkakan maupun perubahan warna kulit.
Palpasi
- (Ditemukan/Tidak ditemukan) peningkatan ketegangan pada otot paraspinal lumbal, gluteus, serta otot-otot sekitar pinggang (kanan/kiri).
- Nyeri tekan pada area (L..../paraspinal/SIJ/gluteus) (kanan/kiri).
- (Ditemukan/Tidak ditemukan) peningkatan suhu lokal.
Pemeriksaan Gerak
Fleksi lumbal : (penuh/terbatas), nyeri (Ada/Tidak ada)
Ekstensi lumbal : (penuh/terbatas), nyeri (Ada/Tidak ada)
Lateral fleksi kanan : (penuh/terbatas), nyeri (Ada/Tidak ada)
Lateral fleksi kiri : (penuh/terbatas), nyeri (Ada/Tidak ada)
Rotasi kanan : (penuh/terbatas), nyeri (Ada/Tidak ada)
Rotasi kiri : (penuh/terbatas), nyeri (Ada/Tidak ada)
Gerakan yang memprovokasi nyeri : (.....)
Pemeriksaan Neurologi
Sensasi dermatom L4-S1 : (normal/menurun)
Kekuatan dorsofleksi (0-5) : (.....)
Kekuatan ekstensor ibu jari (0-5) : (.....)
Kekuatan plantarfleksi (0-5) : (.....)
Refleks patella : (.....)
Refleks Achilles : (.....)
Tes Spesifik
SLR kanan : (Positif/Negatif) pada (.....) derajat
SLR kiri : (Positif/Negatif) pada (.....) derajat
Crossed SLR : (Positif/Negatif)
Bragard : (Positif/Negatif)
Slump : (Positif/Negatif)
Femoral nerve stretch : (Positif/Negatif)
Respons gerak berulang : (sentralisasi/perifer/tidak berubah)
Pengukuran
NPRS : (.....)/10
Oswestry Disability Index : (.....)%
@@VARIAN: Tidak menjalar
Inspeksi
- Postur lumbal tampak (lordosis normal/hiperlordosis/hipolordosis).
- (Ditemukan/Tidak ditemukan) skoliosis atau lateral shift ke arah (kanan/kiri).
- Gaya jalan tampak (normal/antalgik/lainnya).
- (Ditemukan/Tidak ditemukan) pembengkakan maupun perubahan warna kulit.
Palpasi
- (Ditemukan/Tidak ditemukan) peningkatan ketegangan pada otot paraspinal lumbal, gluteus, serta otot-otot sekitar pinggang (kanan/kiri).
- Nyeri tekan pada area (L..../paraspinal/SIJ/gluteus) (kanan/kiri).
- (Ditemukan/Tidak ditemukan) peningkatan suhu lokal.
Pemeriksaan Gerak
Fleksi lumbal : (penuh/terbatas), nyeri (Ada/Tidak ada)
Ekstensi lumbal : (penuh/terbatas), nyeri (Ada/Tidak ada)
Lateral fleksi kanan : (penuh/terbatas), nyeri (Ada/Tidak ada)
Lateral fleksi kiri : (penuh/terbatas), nyeri (Ada/Tidak ada)
Rotasi kanan : (penuh/terbatas), nyeri (Ada/Tidak ada)
Rotasi kiri : (penuh/terbatas), nyeri (Ada/Tidak ada)
Gerakan yang memprovokasi nyeri : (.....)
Pemeriksaan Neurologi
Sensasi dermatom L2-S1 : (normal/menurun)
Kekuatan tungkai (miotom L2-S1) : (normal/menurun)
Refleks patella : (normal/menurun)
Refleks Achilles : (normal/menurun)
Tes Spesifik
SLR kanan : (Positif/Negatif) pada (.....) derajat
SLR kiri : (Positif/Negatif) pada (.....) derajat
Slump : (Positif/Negatif)
Femoral nerve stretch : (Positif/Negatif)
Fleksi lumbal berulang : (memprovokasi nyeri/tidak memprovokasi nyeri)
Respons gerak berulang : (sentralisasi/perifer/tidak berubah)
Pengukuran
NPRS : (.....)/10
Oswestry Disability Index : (.....)%$fn$
 where category = 'diagnosa'
   and lower(btrim(label)) = 'hernia nucleus pulposus';
