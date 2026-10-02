-- Template Subjective (SOAP) per diagnosa.
--
-- Teks template disimpan di kolom operational_options.subjective_template
-- (hanya terisi untuk category = 'diagnosa'). Titik-titik "(.....)" dan
-- pilihan "(a/b)" di dalam teks diubah aplikasi menjadi isian klik-pilih
-- (lihat src/lib/subjectiveTemplate.js); bagian yang tidak diisi tidak
-- ikut tampil. Sumber: "Template Subjective Kaffah Physiotherapy" (329 diagnosa).
--
-- Dicocokkan lewat nama diagnosa (tanpa beda huruf besar/kecil) sehingga
-- berlaku untuk semua klinik yang daftar diagnosanya berasal dari Kaffah.

alter table public.operational_options
  add column if not exists subjective_template text;

comment on column public.operational_options.subjective_template is
  'Template teks Subjective SOAP untuk diagnosa (category = diagnosa). Format: **Judul:** isi, satu bagian per baris.';

with t(names, body) as (
values
(array[$n$Bronchiectasis$n$],$t$**Keluhan Utama:** Batuk produktif kronis dengan dahak banyak sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Volume dahak/hari: (.....). Warna: (.....). Batuk darah (ada/tidak). Infeksi berulang (ada/tidak). Hasil CT thorax: (.....).$t$),
(array[$n$Bronchitis$n$],$t$**Keluhan Utama:** Batuk (berdahak/kering) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Dahak (warna/jumlah): (.....). Demam (ada/tidak). Sesak/mengi (ada/tidak). Merokok (ya/tidak). Paparan debu/polusi: (.....). Obat: (.....).$t$),
(array[$n$Broncho Pneumonia$n$],$t$**Keluhan Utama:** Batuk berdahak, sesak, dan demam sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Dirawat di RS (ada/tidak). Dahak sulit keluar (ada/tidak). Saturasi O2: (.....)%. Antibiotik: (.....). Pada anak: usia (.....), status imunisasi (.....).$t$),
(array[$n$Bronchospasm$n$],$t$**Keluhan Utama:** Sesak napas/mengi mendadak sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Pencetus (alergi/dingin/debu/aktivitas/infeksi). Frekuensi (.....) kali/minggu. Obat inhaler/nebulizer: (.....). Riwayat asma (ada/tidak).$t$),
(array[$n$Chronic obstructive pulmonary disease$n$],$t$**Keluhan Utama:** Sesak napas dan mudah lelah saat aktivitas sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Batuk (ada/tidak), dahak (warna/jumlah): (.....). Merokok (ya/tidak) (.....) bungkus-tahun. Oksigen di rumah (ada/tidak). Eksaserbasi dalam 1 tahun: (.....). Obat inhaler: (.....).$t$),
(array[$n$Pneumonia$n$],$t$**Keluhan Utama:** Batuk berdahak/sesak/lemas pasca pneumonia sejak (.....).
**Riwayat Sekarang:** Dirawat di RS (ada/tidak). Dahak sulit keluar (ada/tidak). Demam (ada/tidak). Saturasi O2: (.....)%. Terapi antibiotik: (.....).$t$),
(array[$n$Post-COVID condition$n$],$t$**Keluhan Utama:** Sesak napas, mudah lelah, atau gejala menetap lainnya pasca COVID-19 sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Tanggal terinfeksi: (.....). Dirawat RS/ICU (ada/tidak). Batuk (ada/tidak). Brain fog (ada/tidak). Nyeri otot/sendi (ada/tidak). Toleransi aktivitas: (.....). Saturasi O2: (.....)%.$t$),
(array[$n$Pulmonary fibrosis$n$],$t$**Keluhan Utama:** Sesak napas progresif dan batuk kering sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Sesak saat (aktivitas ringan/istirahat). Oksigen di rumah (ada/tidak). Penyebab/riwayat (paparan kerja/obat/autoimun/pasca COVID): (.....). Hasil CT thorax/spirometri: (.....).$t$),
(array[$n$Respiratory failure$n$],$t$**Keluhan Utama:** Pasien pasca perawatan ICU/ventilator dengan kelemahan umum dan sulit napas.
**Riwayat Sekarang:** Lama ventilator: (.....) hari. Penyebab: (.....). Trakeostomi (ada/tidak). Gangguan menelan (ada/tidak). Kemampuan duduk/berdiri: (.....).$t$),
(array[$n$Chronic pain syndrome$n$],$t$**Keluhan Utama:** Nyeri di (.....) yang berlangsung lebih dari 3 bulan, sejak (.....).
**Riwayat Sekarang:** VAS: (.....)/10. Gangguan tidur (ada/tidak). Gangguan mood (ada/tidak). Terapi sebelumnya: (.....). Obat nyeri: (.....).$t$),
(array[$n$Frailty$n$,$n$Senility$n$],$t$**Keluhan Utama:** Lansia dengan keluhan lemas, mudah lelah, dan penurunan aktivitas sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Berat badan turun (ada/tidak). Kecepatan jalan melambat (ada/tidak). Penyakit penyerta: (.....). Aktivitas ADL dibantu (ada/tidak).$t$),
(array[$n$Kelemahan Umum$n$],$t$**Keluhan Utama:** Lemas, mudah lelah, dan sulit beraktivitas pasca sakit/rawat inap sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Penyakit sebelumnya: (.....). Lama tirah baring: (.....). Kemampuan sekarang (duduk/berdiri/berjalan): (.....). Sesak saat aktivitas (ada/tidak).$t$),
(array[$n$Malaise dan Fatigue$n$],$t$**Keluhan Utama:** Lemas, mudah lelah, dan tidak bertenaga sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Lelah bertambah setelah (aktivitas ringan/sepanjang hari). Tidur (cukup/kurang). Demam/penurunan berat badan (ada/tidak). Stres/mood: (.....). Penyakit penyerta: (.....).$t$),
(array[$n$Osteoporosis dengan Fraktur$n$],$t$**Keluhan Utama:** Pasien osteoporosis dengan riwayat fraktur pada (.....) datang dengan keluhan (nyeri/keterbatasan gerak/takut jatuh).
**Riwayat Sekarang:** Tanggal fraktur: (.....). Mekanisme (jatuh ringan/spontan). Hasil BMD (T-score): (.....). Terapi osteoporosis: (.....). Jatuh sebelumnya (ada/tidak). Alat bantu: (.....).$t$),
(array[$n$Penurunan Keseimbangan$n$,$n$Repeated Falls$n$,$n$Risiko Jatuh$n$,$n$History of fall$n$,$n$Encounter for balance training$n$],$t$**Keluhan Utama:** Sering goyah/hampir jatuh/takut jatuh sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Jatuh dalam 6 bulan: (.....) kali. Pusing (ada/tidak). Penglihatan terganggu (ada/tidak). Obat yang diminum: (.....). Alat bantu: (.....).$t$),
(array[$n$Polyosteoarthritis$n$],$t$**Keluhan Utama:** Nyeri dan kaku pada beberapa sendi (.....) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Kaku pagi (.....) menit. Bertambah saat aktivitas, membaik saat istirahat (ya/tidak). Bunyi gesek (ada/tidak). Berat badan: (.....).$t$),
(array[$n$Reduced Mobility$n$],$t$**Keluhan Utama:** Mobilitas berkurang/sulit berpindah dan berjalan sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Penyebab (nyeri/kelemahan/penyakit/pasca rawat inap). Kemampuan sekarang (duduk/berdiri/berjalan): (.....). Alat bantu: (.....). Dibantu keluarga (ya/tidak).$t$),
(array[$n$Konsultasi$n$],$t$**Keluhan Utama:** Pasien datang untuk konsultasi mengenai keluhan (.....) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Pertanyaan/tujuan konsultasi: (.....). Diagnosis dokter (jika ada): (.....). Terapi sebelumnya: (.....). Harapan pasien: (.....).$t$),
(array[$n$Abdominal Pain$n$],$t$**Keluhan Utama:** Nyeri pada perut (bagian .....) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Sifat nyeri (.....). Bertambah saat (bergerak/batuk/mengejan/makan). Mual/muntah/demam (ada/tidak). Gangguan BAB/BAK (ada/tidak). Penyebab organ dalam sudah disingkirkan dokter (ya/tidak).$t$),
(array[$n$Achilles tendon rupture$n$],$t$**Keluhan Utama:** Pasien rehabilitasi pasca (ruptur/operasi) tendon Achilles (kanan/kiri).
**Riwayat Sekarang:** Tanggal cedera/operasi: (.....). Penyebab: (.....). Alat fiksasi (boot/cast): (.....). Weight bearing: (.....).$t$),
(array[$n$Acquired absence of arm below elbow$n$,$n$Acquired absence of both legs$n$,$n$Acquired absence of leg below knee$n$,$n$Post Amputation$n$],$t$**Keluhan Utama:** Pasien rehabilitasi pasca amputasi (.....) sisi (kanan/kiri).
**Riwayat Sekarang:** Tanggal amputasi: (.....). Penyebab (trauma/DM/vaskular/lainnya): (.....). Nyeri phantom (ada/tidak). Luka stump sembuh (ya/tidak). Rencana prostesis (ada/tidak).$t$),
(array[$n$Acromioclavicular Sprain$n$],$t$**Keluhan Utama:** Nyeri dan benjolan di ujung bahu sisi (kanan/kiri) setelah (jatuh/benturan) tanggal (.....).
**Riwayat Sekarang:** Nyeri bertambah saat (mengangkat lengan/menyilang dada/tidur).
**Mekanisme:** (.....). Hasil rontgen: (.....).$t$),
(array[$n$Adductor strain$n$,$n$Groin Strain$n$],$t$**Keluhan Utama:** Nyeri selangkangan/paha dalam sisi (kanan/kiri) setelah (olahraga/gerakan mendadak) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bunyi/robek (ada/tidak). Memar (ada/tidak). Olahraga: (.....).$t$),
(array[$n$Ankle instability, chronic$n$],$t$**Keluhan Utama:** Pergelangan kaki (kanan/kiri) sering terkilir/terasa goyah sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Jumlah terkilir: (.....) kali. Cedera awal (.....). Olahraga: (.....). Nyeri saat (berjalan di permukaan tidak rata/berlari).$t$),
(array[$n$Ankle sprain$n$],$t$**Keluhan Utama:** Nyeri pada pergelangan kaki (kanan/kiri) setelah terkilir/terpeleset sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak (ada/tidak). Memar (ada/tidak). Sulit menumpu/berjalan (ya/tidak). Hasil rontgen: (.....).$t$),
(array[$n$Ankylosing spondylitis$n$],$t$**Keluhan Utama:** Nyeri dan kaku pinggang/punggung terutama pagi hari sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Kaku pagi lebih dari 30 menit (ya/tidak). Membaik dengan bergerak, memburuk dengan istirahat (ya/tidak). Nyeri bokong bergantian (ada/tidak). Riwayat keluarga (ada/tidak). Terapi dokter: (.....).$t$),
(array[$n$Anterior Lateral Ligament$n$],$t$**Keluhan Utama:** Nyeri pada sisi luar lutut (anterolateral ligament) sisi (kanan/kiri) setelah terkilir/terpuntir/jatuh sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak (ada/tidak). Memar (ada/tidak). Sendi terasa goyah (ada/tidak). Gerak terbatas (ya/tidak). Hasil rontgen/USG: (.....).$t$),
(array[$n$Anterior pelvic tilt$n$],$t$**Keluhan Utama:** Panggul tampak condong ke depan (anterior pelvic tilt) yang disadari sejak (.....), disertai (nyeri/pegal/mudah lelah) pada (.....).
**Riwayat Sekarang:** Aktivitas/pekerjaan (duduk lama/gadget): (.....) jam/hari. Olahraga: (.....). Riwayat cedera (ada/tidak). Nyeri bertambah saat (.....).$t$),
(array[$n$Anterior shoulder dislocation$n$,$n$Posterior shoulder dislocation$n$,$n$Posterior shoulder instability$n$,$n$Shoulder instability$n$,$n$Shoulder subluxation$n$],$t$**Keluhan Utama:** Bahu (kanan/kiri) terasa lepas/goyah/keluar sendi sejak (.....).
**Riwayat Sekarang:** Jumlah episode dislokasi: (.....).
**Mekanisme:** (.....). Penanganan sebelumnya (reposisi/operasi): (.....). Nyeri saat (abduksi eksternal rotasi) (ada/tidak).$t$),
(array[$n$Anterior tibialis tendinitis$n$],$t$**Keluhan Utama:** Nyeri pada bagian depan pergelangan kaki/tulang kering sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (mengangkat ujung kaki/berlari/menuruni tanjakan). Bengkak (ada/tidak). Nyeri saat memulai aktivitas (ya/tidak). Aktivitas/olahraga: (.....).$t$),
(array[$n$Autoimun$n$],$t$**Keluhan Utama:** Pasien dengan penyakit autoimun (.....) datang dengan keluhan (nyeri sendi/kaku/lemas) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Diagnosis dokter: (.....). Kaku pagi (.....) menit. Sendi terlibat: (.....). Obat (steroid/imunosupresan): (.....). Kelelahan (ada/tidak). Flare terakhir: (.....).$t$),
(array[$n$Avulsion Fracture$n$],$t$**Keluhan Utama:** Nyeri dan keterbatasan fungsi pada (lokasi .....) sisi (kanan/kiri) pasca fraktur.
**Riwayat Sekarang:** Tanggal cedera: (.....).
**Mekanisme:** (.....). Penanganan (konservatif/ORIF/lainnya): (.....). Weight bearing: (.....). Otot/tendon yang melekat: (.....). Hasil rontgen: (.....).$t$),
(array[$n$Baker's cyst$n$],$t$**Keluhan Utama:** Benjolan/rasa penuh di belakang lutut (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri bertambah saat (menekuk/meluruskan lutut penuh). Bengkak betis/kemerahan (ada/tidak) (sudah disingkirkan DVT: ya/tidak). Riwayat OA/meniscus (ada/tidak).$t$),
(array[$n$Biceps Strain$n$],$t$**Keluhan Utama:** Nyeri pada lengan atas bagian depan (biceps) sisi (kanan/kiri) setelah (mengangkat beban/menarik/olahraga) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Nyeri saat otot dikontraksikan/diregangkan (ya/tidak). Olahraga/pekerjaan: (.....).$t$),
(array[$n$Bicipital instability$n$,$n$Bicipital tendinitis$n$],$t$**Keluhan Utama:** Nyeri bahu bagian depan sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri bertambah saat (mengangkat beban/menarik/melempar). Nyeri menjalar ke lengan atas (ada/tidak). Aktivitas: (.....).$t$),
(array[$n$Bipartite patella$n$],$t$**Keluhan Utama:** Nyeri pada sisi luar-atas tempurung lutut (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (olahraga/melompat/berlutut). Bengkak/nyeri tekan (ada/tidak). Temuan bipartit pada rontgen (ya/tidak). Usia: (.....).$t$),
(array[$n$Bunion$n$,$n$Hallux Valgus$n$],$t$**Keluhan Utama:** Nyeri dan jari kaki besar (kanan/kiri) bergeser ke arah luar sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri bertambah saat (memakai sepatu sempit/berjalan lama). Benjolan merah/bengkak (ada/tidak). Riwayat keluarga (ada/tidak).$t$),
(array[$n$Burn of lower limb$n$],$t$**Keluhan Utama:** Pasien rehabilitasi pasca luka bakar pada tungkai sisi (kanan/kiri).
**Riwayat Sekarang:** Tanggal kejadian: (.....). Derajat/luas: (.....). Graft kulit (ada/tidak). Kontraktur/kaku sendi (ada/tidak). Nyeri/gatal bekas luka (ada/tidak). Penggunaan pressure garment (ada/tidak).$t$),
(array[$n$Burn of trunk$n$],$t$**Keluhan Utama:** Pasien rehabilitasi pasca luka bakar pada badan (dada/perut/punggung).
**Riwayat Sekarang:** Tanggal kejadian: (.....). Derajat/luas: (.....). Graft kulit (ada/tidak). Kaku gerak badan/napas terbatas (ada/tidak). Nyeri/gatal bekas luka (ada/tidak).$t$),
(array[$n$Burn of upper limb$n$],$t$**Keluhan Utama:** Pasien rehabilitasi pasca luka bakar pada lengan/tangan sisi (kanan/kiri).
**Riwayat Sekarang:** Tanggal kejadian: (.....). Derajat/luas: (.....). Graft kulit (ada/tidak). Kontraktur jari/siku/bahu (ada/tidak). Kesulitan fungsi tangan: (.....). Pressure garment (ada/tidak).$t$),
(array[$n$Calcaneal apophysitis (Sever's disease)$n$],$t$**Keluhan Utama:** Nyeri pada tumit (kanan/kiri) pada anak/remaja sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Usia: (.....). Bertambah saat (berlari/melompat/olahraga), berkurang saat istirahat. Jenis olahraga dan sepatu: (.....). Pincang (ada/tidak).$t$),
(array[$n$Calcaneus spur$n$],$t$**Keluhan Utama:** Nyeri tumit seperti tertusuk sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (langkah pertama/berdiri lama). Hasil rontgen: (.....). Alas kaki: (.....).$t$),
(array[$n$Calcific tendinitis of shoulder$n$],$t$**Keluhan Utama:** Nyeri bahu hebat/mendadak sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri malam hari (ya/tidak). Gerak sangat terbatas (ya/tidak). Hasil rontgen menunjukkan kalsifikasi (ya/tidak).$t$),
(array[$n$Calf muscle tightness$n$],$t$**Keluhan Utama:** Rasa kencang/tegang pada otot betis sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri/tertarik saat (peregangan/berjalan/berolahraga). Riwayat cedera (ada/tidak). Duduk lama (ya/tidak). Aktivitas/olahraga: (.....).$t$),
(array[$n$Cervical disc displacement$n$,$n$Cervical radiculopathy$n$],$t$**Keluhan Utama:** Nyeri leher menjalar ke lengan/tangan (kanan/kiri) disertai kesemutan/baal sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri bertambah saat (menengadah/menoleh/batuk/bersin). Kelemahan genggaman (ada/tidak). Hasil MRI/CT: (.....).$t$),
(array[$n$Cervicalgia$n$],$t$**Keluhan Utama:** Nyeri di leher sejak (.....) hari/minggu/bulan yang lalu, menjalar ke (bahu/lengan/kepala) sisi (kanan/kiri).
**Riwayat Sekarang:** Nyeri bertambah saat (menoleh/menunduk/duduk lama). Berkurang saat (istirahat/ganti posisi). Kesemutan/baal (ada/tidak). Pekerjaan: (.....).$t$),
(array[$n$Cervicogenic headache$n$],$t$**Keluhan Utama:** Nyeri kepala (belakang/satu sisi) yang diawali nyeri atau kaku leher sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Muncul saat (posisi leher tertentu/duduk lama). Frekuensi (.....) kali/minggu. Pusing/mual (ada/tidak). Riwayat trauma leher (ada/tidak).$t$),
(array[$n$Chondromalacia patella$n$],$t$**Keluhan Utama:** Nyeri lutut depan (kanan/kiri), bunyi gesekan saat bergerak sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (naik turun tangga/jongkok/berdiri dari duduk). Bengkak (ada/tidak). Hasil MRI/rontgen: (.....).$t$),
(array[$n$Chronic fatigue syndrome$n$],$t$**Keluhan Utama:** Kelelahan berat yang tidak membaik dengan istirahat sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Lelah bertambah setelah aktivitas (post-exertional malaise) (ya/tidak). Gangguan tidur/konsentrasi (ada/tidak). Nyeri otot/sendi (ada/tidak). Pencetus (infeksi/stres): (.....). Toleransi aktivitas: (.....).$t$),
(array[$n$Clavicle malunion$n$],$t$**Keluhan Utama:** Nyeri dan keterbatasan fungsi pada bahu/clavicula sisi (kanan/kiri) pasca fraktur.
**Riwayat Sekarang:** Tanggal cedera: (.....).
**Mekanisme:** (.....). Penanganan (konservatif/ORIF/lainnya): (.....). Weight bearing: (.....). Benjolan/deformitas (ada/tidak). Hasil rontgen: (.....).$t$),
(array[$n$Complex regional pain syndrome I$n$],$t$**Keluhan Utama:** Nyeri hebat, bengkak, dan perubahan warna/suhu pada (tangan/kaki/lainnya) sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Dipicu oleh (fraktur/operasi/imobilisasi/cedera ringan). Nyeri berlebihan terhadap sentuhan (ya/tidak). Kulit (merah/pucat/dingin/hangat/berkeringat). Kaku sendi/lemah (ada/tidak). Obat: (.....).$t$),
(array[$n$Congenital musculoskeletal deformities$n$],$t$**Keluhan Utama:** Orang tua/pasien mengeluhkan kelainan bentuk (.....) yang ada sejak lahir.
**Riwayat:** Usia: (.....). Jenis kelainan: (.....). Penanganan sebelumnya (gips/operasi/ortosis): (.....). Keterbatasan fungsi: (.....). Riwayat keluarga (ada/tidak).$t$),
(array[$n$Contracture of muscle$n$,$n$muscle tightness$n$],$t$**Keluhan Utama:** Rasa kencang/tegang pada otot (.....) sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri/tertarik saat (peregangan/berjalan/berolahraga). Riwayat cedera (ada/tidak). Duduk lama (ya/tidak). Aktivitas/olahraga: (.....).$t$),
(array[$n$contusion$n$],$t$**Keluhan Utama:** Nyeri, bengkak, dan memar pada (.....) sisi (kanan/kiri) setelah benturan/tertabrak/jatuh sejak (.....) hari yang lalu.
**Mekanisme:** (.....). Gerak terbatas (ya/tidak). Nyeri/bengkak makin berat setelah beberapa hari (ada/tidak). Olahraga kontak: (.....).$t$),
(array[$n$Contusion adductor$n$],$t$**Keluhan Utama:** Nyeri, bengkak, dan memar pada paha bagian dalam (adduktor) sisi (kanan/kiri) setelah benturan/tertabrak/jatuh sejak (.....) hari yang lalu.
**Mekanisme:** (.....). Gerak terbatas (ya/tidak). Nyeri/bengkak makin berat setelah beberapa hari (ada/tidak). Olahraga kontak: (.....).$t$),
(array[$n$Contusion brachioradialis$n$],$t$**Keluhan Utama:** Nyeri, bengkak, dan memar pada lengan bawah (brachioradialis) sisi (kanan/kiri) setelah benturan/tertabrak/jatuh sejak (.....) hari yang lalu.
**Mekanisme:** (.....). Gerak terbatas (ya/tidak). Nyeri/bengkak makin berat setelah beberapa hari (ada/tidak). Olahraga kontak: (.....).$t$),
(array[$n$Contusion Hamstring$n$],$t$**Keluhan Utama:** Nyeri, bengkak, dan memar pada paha bagian belakang (hamstring) sisi (kanan/kiri) setelah benturan/tertabrak/jatuh sejak (.....) hari yang lalu.
**Mekanisme:** (.....). Gerak terbatas (ya/tidak). Nyeri/bengkak makin berat setelah beberapa hari (ada/tidak). Olahraga kontak: (.....).$t$),
(array[$n$contusion pectoralis$n$],$t$**Keluhan Utama:** Nyeri, bengkak, dan memar pada dada (pectoralis) sisi (kanan/kiri) setelah benturan/tertabrak/jatuh sejak (.....) hari yang lalu.
**Mekanisme:** (.....). Gerak terbatas (ya/tidak). Nyeri/bengkak makin berat setelah beberapa hari (ada/tidak). Olahraga kontak: (.....).$t$),
(array[$n$Costovertebral joint dysfunction$n$,$n$First rib dysfunction$n$,$n$Thoracic hypomobility$n$,$n$Thoracolumbar junction syndrome$n$,$n$Upper cervical dysfunction$n$],$t$**Keluhan Utama:** Nyeri dan kaku pada (punggung atas/tulang rusuk/sambungan thoraco-lumbal/leher atas) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri bertambah saat (menarik napas dalam/memutar badan/menoleh/duduk lama). Menjalar ke (dada/lengan/kepala) (ada/tidak). Sesak napas (ada/tidak). Pekerjaan: (.....).$t$),
(array[$n$Coxytis$n$],$t$**Keluhan Utama:** Nyeri dan kaku pada sendi panggul (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri bertambah saat (berjalan/duduk-berdiri). Demam/bengkak (ada/tidak). Penyebab (infeksi/reaktif/lainnya): (.....). Hasil lab/rontgen: (.....).$t$),
(array[$n$De Quervain disease$n$],$t$**Keluhan Utama:** Nyeri pergelangan tangan sisi ibu jari (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (menggenggam/memeras/mengangkat bayi/memakai HP). Bengkak (ada/tidak). Pasca melahirkan/aktivitas berulang (ada/tidak).$t$),
(array[$n$Deep gluteal syndrome$n$,$n$Piriformis Syndrome$n$],$t$**Keluhan Utama:** Nyeri dalam di bokong menjalar ke paha belakang sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (duduk lama/berlari/naik tangga). Kesemutan/baal tungkai (ada/tidak). Tidak ada gangguan BAK/BAB. Pekerjaan: (.....).$t$),
(array[$n$Degenerative disc disease cervical$n$],$t$**Keluhan Utama:** Nyeri/kaku leher hilang timbul sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Kaku terutama (pagi hari/setelah duduk lama). Menjalar (ada/tidak). Hasil rontgen: (.....). Pekerjaan: (.....).$t$),
(array[$n$Degenerative disc disease lumbar$n$],$t$**Keluhan Utama:** Nyeri pinggang kronis hilang timbul sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (duduk lama/membungkuk/aktivitas berat). Menjalar ke tungkai (ada/tidak). Hasil rontgen/MRI: (.....).$t$),
(array[$n$Dorsal Wrist impingement$n$],$t$**Keluhan Utama:** Nyeri di punggung pergelangan tangan (kanan/kiri) saat tangan ditekuk ke belakang/menumpu sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (push up/yoga/angkat beban/mengetik). Bengkak (ada/tidak). Aktivitas/olahraga: (.....). Hasil USG/MRI: (.....).$t$),
(array[$n$Dupuytren's contracture$n$],$t$**Keluhan Utama:** Jari tangan (kanan/kiri) sulit diluruskan, ada benjolan/tali pada telapak sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Jari terlibat: (.....). Riwayat keluarga (ada/tidak). DM/alkohol (ada/tidak). Dioperasi sebelumnya (ada/tidak).$t$),
(array[$n$Ehlers-Danlos syndrome$n$],$t$**Keluhan Utama:** Sendi sangat lentur, sering nyeri/dislokasi, dan kulit mudah memar sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Sendi terlibat: (.....). Skor Beighton: (.....)/9. Dislokasi berulang (ada/tidak). Kelelahan/nyeri menyebar (ada/tidak). Diagnosis genetik/dokter: (.....). Riwayat keluarga (ada/tidak).$t$),
(array[$n$Encounter for orthopedic aftercare$n$],$t$**Keluhan Utama:** Pasien datang untuk perawatan lanjutan (rehabilitasi) ortopedi pasca (operasi/fraktur/cedera) pada (.....).
**Riwayat Sekarang:** Tanggal tindakan: (.....). Jenis tindakan: (.....). Protokol/precaution dokter: (.....). Nyeri VAS: (.....)/10. Keterbatasan fungsi: (.....).$t$)
)
update public.operational_options o
   set subjective_template = t.body
  from t
 cross join lateral unnest(t.names) as n(name)
 where o.category = 'diagnosa'
   and lower(btrim(o.label)) = lower(btrim(n.name))
   and o.subjective_template is distinct from t.body;

with t(names, body) as (
values
(array[$n$Encounter for training in use of prosthetic device$n$],$t$**Keluhan Utama:** Pasien datang untuk latihan penggunaan prostesis (.....) sisi (kanan/kiri).
**Riwayat Sekarang:** Level amputasi: (.....). Tanggal amputasi: (.....). Tanggal prostesis diterima: (.....). Kondisi stump (nyeri/luka/bengkak) (ada/tidak). Nyeri phantom (ada/tidak). Alat bantu: (.....).$t$),
(array[$n$Facet joint syndrome$n$,$n$Lumbar spondylosis$n$,$n$Spondyloarthrosis$n$,$n$Thoracic spondylosis$n$,$n$Cervical Spondylosis$n$],$t$**Keluhan Utama:** Nyeri (leher/pinggang) dan kaku sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Kaku pagi hari selama (.....) menit. Nyeri bertambah saat (ekstensi/rotasi/berdiri lama). Menjalar ke (.....) (ada/tidak). Hasil rontgen: (.....).$t$),
(array[$n$Fibromyalgia$n$],$t$**Keluhan Utama:** Nyeri di seluruh tubuh disertai kelelahan dan gangguan tidur sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Kaku pagi (ada/tidak). Tidur tidak nyenyak (ya/tidak). Kesemutan/brain fog (ada/tidak). Stres/depresi/cemas (ada/tidak). Obat: (.....).$t$),
(array[$n$Flat Foot$n$],$t$**Keluhan Utama:** Telapak kaki rata, nyeri/cepat lelah pada kaki sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Usia: (.....). Nyeri pada (lengkung kaki/tumit/lutut/pinggang). Alas kaki: (.....). Sepatu aus tidak merata (ada/tidak).$t$),
(array[$n$Fracture$n$],$t$**Keluhan Utama:** Nyeri dan keterbatasan fungsi pada (lokasi .....) sisi (kanan/kiri) pasca fraktur.
**Riwayat Sekarang:** Tanggal cedera: (.....).
**Mekanisme:** (.....). Penanganan (konservatif/ORIF/lainnya): (.....). Weight bearing: (.....). Hasil rontgen: (.....).$t$),
(array[$n$Fracture metatarsal$n$],$t$**Keluhan Utama:** Nyeri dan keterbatasan fungsi pada kaki bagian depan (metatarsal) sisi (kanan/kiri) pasca fraktur.
**Riwayat Sekarang:** Tanggal cedera: (.....).
**Mekanisme:** (.....). Penanganan (konservatif/ORIF/lainnya): (.....). Weight bearing: (.....). Jari/metatarsal ke-(.....). Hasil rontgen: (.....).$t$),
(array[$n$Fracture of neck of femur$n$],$t$**Keluhan Utama:** Nyeri dan keterbatasan berjalan (kanan/kiri) pasca fraktur femur.
**Riwayat Sekarang:** Tanggal cedera/operasi: (.....). Jenis operasi (ORIF/hemiartroplasti/THR): (.....). Weight bearing: (non/partial/full). Alat bantu jalan: (kruk/walker).$t$),
(array[$n$Fracture patella$n$],$t$**Keluhan Utama:** Nyeri dan keterbatasan fungsi pada lutut (patella) sisi (kanan/kiri) pasca fraktur.
**Riwayat Sekarang:** Tanggal cedera: (.....).
**Mekanisme:** (.....). Penanganan (konservatif/ORIF/lainnya): (.....). Weight bearing: (.....). Penanganan (tension band/gips): (.....). Hasil rontgen: (.....).$t$),
(array[$n$Fraktur Ulna$n$,$n$Fracture Wrist$n$],$t$**Keluhan Utama:** Nyeri, kaku, dan kelemahan lengan/pergelangan tangan (kanan/kiri) pasca fraktur.
**Riwayat Sekarang:** Tanggal cedera/operasi: (.....). Penanganan (cast/ORIF/K-wire): (.....). Cast dilepas tanggal (.....). Bengkak jari (ada/tidak).$t$),
(array[$n$Frozen shoulder$n$],$t$**Keluhan Utama:** Nyeri dan kaku pada bahu (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Sulit mengangkat tangan, menyisir rambut, memakai baju, atau mengambil benda di belakang. Nyeri malam hari (ya/tidak). Riwayat DM/tiroid (ada/tidak). Riwayat trauma/operasi (ada/tidak).$t$),
(array[$n$Functional kyphosis$n$,$n$Postural kyphosis$n$,$n$Kyphosis$n$],$t$**Keluhan Utama:** Nyeri/pegal pada (leher/punggung atas) dan postur membungkuk sejak (.....) hari/minggu/bulan yang lalu.
**Aktivitas Harian:** Duduk/menggunakan gadget/komputer selama (.....) jam/hari. Posisi kerja: (.....). Kesemutan (ada/tidak).$t$),
(array[$n$Functional leg length discrepancy$n$],$t$**Keluhan Utama:** Panjang tungkai terasa/terlihat tidak sama, disertai (nyeri pinggang/pinggul/lutut) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Tungkai yang lebih pendek: (kanan/kiri). Selisih: (.....) cm. Pincang (ada/tidak). Panggul miring (ada/tidak).
**Riwayat cedera/operasi:** (.....). Penggunaan ganjal sepatu (ada/tidak).$t$),
(array[$n$Functional lordosis$n$,$n$Lordosis$n$],$t$**Keluhan Utama:** Nyeri pinggang dan perut tampak menonjol/pinggang melengkung berlebih sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (berdiri lama/berjalan lama). Pekerjaan/olahraga: (.....). Hamil/obesitas (ada/tidak).$t$),
(array[$n$Functional scoliosis$n$,$n$Scoliosis$n$],$t$**Keluhan Utama:** Postur tubuh miring/tidak simetris yang disadari sejak (.....).
**Riwayat Sekarang:** Bahu/pinggul tidak sejajar (ada/tidak). Nyeri punggung (ada/tidak). Riwayat keluarga skoliosis (ada/tidak). Sudut Cobb: (.....) derajat. Usia: (.....).$t$),
(array[$n$Genu valgum$n$,$n$Genu varum$n$],$t$**Keluhan Utama:** Bentuk kaki X/O yang disadari sejak (.....).
**Riwayat Sekarang:** Usia: (.....). Nyeri lutut (ada/tidak). Berjalan tidak stabil/mudah jatuh (ada/tidak). Riwayat keluarga/rakhitis (ada/tidak).$t$),
(array[$n$Gluteal tendinopathy$n$],$t$**Keluhan Utama:** Nyeri bokong/pinggul bagian samping sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (berdiri satu kaki/berjalan/berlari/duduk menyilang kaki). Aktivitas/olahraga: (.....).$t$),
(array[$n$Golfer's elbow$n$],$t$**Keluhan Utama:** Nyeri pada siku bagian dalam sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri bertambah saat (menggenggam/menekuk pergelangan/melempar/mengangkat). Kesemutan jari manis/kelingking (ada/tidak). Aktivitas berulang: (.....).$t$),
(array[$n$Gout Arthritis$n$],$t$**Keluhan Utama:** Nyeri hebat, bengkak, merah, dan hangat pada sendi (.....) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Serangan pertama/berulang. Pencetus (makanan purin/alkohol/obat). Kadar asam urat: (.....). Benjolan (tofus) (ada/tidak). Obat: (.....). Gerak sendi terbatas (ya/tidak).$t$),
(array[$n$Greater trochanteric pain syndrome$n$],$t$**Keluhan Utama:** Nyeri pada sisi luar pinggul sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (tidur menindih sisi tersebut/naik tangga/berdiri satu kaki). Nyeri menjalar ke paha luar (ada/tidak).$t$),
(array[$n$Hamstring strain$n$],$t$**Keluhan Utama:** Nyeri paha belakang sisi (kanan/kiri) sejak (.....) hari yang lalu saat (berlari/olahraga).
**Mekanisme Cedera:** (.....). Terdengar bunyi pop (ada/tidak). Memar (ada/tidak). Sulit berjalan/meluruskan lutut (ya/tidak).$t$),
(array[$n$Hamstring Tightness$n$],$t$**Keluhan Utama:** Rasa kencang/tegang pada otot paha belakang (hamstring) sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri/tertarik saat (peregangan/berjalan/berolahraga). Riwayat cedera (ada/tidak). Duduk lama (ya/tidak). Aktivitas/olahraga: (.....).$t$),
(array[$n$Hemifacial spasm$n$],$t$**Keluhan Utama:** Otot wajah sisi (kanan/kiri) berkedut/kejang tanpa disengaja sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Mulai dari (kelopak mata/pipi). Frekuensi (.....). Bertambah saat (stres/lelah). Wajah lemah (ada/tidak). Terapi (botulinum/obat): (.....).$t$),
(array[$n$Hemiplegia unspecified$n$,$n$Stroke with hemiparesis$n$],$t$**Keluhan Utama:** Kelemahan anggota gerak sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Onset stroke tanggal (.....). Gangguan bicara (ada/tidak), gangguan menelan (ada/tidak), gangguan keseimbangan (ada/tidak), kesemutan/baal (ada/tidak). Riwayat HT/DM/jantung/kolesterol (ada/tidak). Kemampuan sekarang (duduk/berdiri/berjalan): (.....).$t$),
(array[$n$Hernia Nucleus Pulposus$n$],$t$**Keluhan Utama:** Nyeri pinggang menjalar ke (bokong/paha/betis/kaki) sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (duduk lama/membungkuk/batuk/bersin/mengangkat beban). Kesemutan/baal/kelemahan tungkai (ada/tidak). Gangguan BAK/BAB (ada/tidak). Hasil MRI: (.....).$t$),
(array[$n$Hip impingement syndrome$n$,$n$Ischiofemoral impingement$n$],$t$**Keluhan Utama:** Nyeri pada pinggul/selangkangan/bokong sisi (kanan/kiri) saat (jongkok/duduk lama/memutar pinggul) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Pinggul terasa mengganjal/terjepit (ya/tidak). Bunyi klik (ada/tidak). Sulit memakai sepatu/kaus kaki (ada/tidak). Olahraga: (.....). Hasil rontgen/MRI: (.....).$t$),
(array[$n$Hip pain$n$],$t$**Keluhan Utama:** Nyeri pada pinggul sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Lokasi (selangkangan/samping/bokong). Bertambah saat (berjalan/duduk-berdiri/tidur miring). Menjalar ke (paha/lutut) (ada/tidak). Pincang (ada/tidak). Hasil rontgen: (.....).$t$),
(array[$n$Hypermobility spectrum disorder$n$],$t$**Keluhan Utama:** Sendi terasa terlalu lentur, sering nyeri/terkilir/subluksasi sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Sendi terlibat: (.....). Skor Beighton: (.....)/9. Mudah memar/dislokasi (ada/tidak). Kelelahan/nyeri menyebar (ada/tidak). Riwayat keluarga (ada/tidak).$t$),
(array[$n$Iliopsoas tendinitis$n$],$t$**Keluhan Utama:** Nyeri selangkangan/pinggul depan sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (mengangkat lutut/berlari/naik tangga). Bunyi klik (ada/tidak). Aktivitas/olahraga: (.....).$t$),
(array[$n$Juvenile arthritis$n$],$t$**Keluhan Utama:** Anak mengeluh nyeri/bengkak/kaku pada sendi (.....) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat:** Usia anak: (.....). Kaku pagi (.....) menit. Sendi terlibat: (.....). Demam/ruam/mata merah (ada/tidak). Pincang (ada/tidak). Obat: (.....). Diagnosis dokter anak/reumatologi: (.....).$t$),
(array[$n$Knee instability$n$],$t$**Keluhan Utama:** Lutut (kanan/kiri) terasa goyah/sering lepas sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat cedera/operasi:** (.....). Episode giving way: (.....) kali/bulan. Bengkak berulang (ada/tidak). Olahraga: (.....).$t$),
(array[$n$Knee osteoarthritis$n$],$t$**Keluhan Utama:** Nyeri pada lutut (kanan/kiri), terutama saat naik turun tangga dan setelah duduk lama sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Kaku pagi (.....) menit. Bunyi gesek (ada/tidak). Bengkak (ada/tidak). Lutut terasa goyah/terkunci (ada/tidak). Hasil rontgen (KL grade): (.....). Berat badan/TB: (.....).$t$),
(array[$n$Knee Pain$n$],$t$**Keluhan Utama:** Nyeri pada lutut (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Lokasi (depan/dalam/luar/belakang). Bertambah saat (naik-turun tangga/jongkok/berjalan). Bengkak (ada/tidak). Terkunci/goyah (ada/tidak).
**Riwayat cedera:** (.....). Hasil rontgen/MRI: (.....).$t$),
(array[$n$Labral tear of hip$n$],$t$**Keluhan Utama:** Nyeri selangkangan/pinggul (kanan/kiri) disertai bunyi klik atau terkunci sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (memutar pinggul/duduk lama/jongkok). Pinggul terasa tersangkut (ada/tidak). Olahraga: (.....). Hasil MRI/MR arthrography: (.....).$t$),
(array[$n$Late effect of burn$n$],$t$**Keluhan Utama:** Keluhan sisa pasca luka bakar berupa (kaku sendi/bekas luka tegang/nyeri/gatal) pada (.....).
**Riwayat Sekarang:** Tanggal luka bakar: (.....). Lokasi/luas: (.....). Kontraktur (ada/tidak). Gerak yang terbatas: (.....). Scar (hipertrofik/keloid) (ada/tidak). Pressure garment (ada/tidak).$t$),
(array[$n$Lateral pelvic tilt$n$],$t$**Keluhan Utama:** Panggul tampak miring ke satu sisi (lateral pelvic tilt) yang disadari sejak (.....), disertai (nyeri/pegal/mudah lelah) pada (.....).
**Riwayat Sekarang:** Aktivitas/pekerjaan (duduk lama/gadget): (.....) jam/hari. Olahraga: (.....). Riwayat cedera (ada/tidak). Nyeri bertambah saat (.....).$t$),
(array[$n$Levator scapulae syndrome$n$],$t$**Keluhan Utama:** Nyeri/tegang pada sisi leher hingga sudut atas tulang belikat (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (menoleh/mengangkat bahu/duduk lama). Titik nyeri tekan (ada/tidak). Pekerjaan/posisi kerja: (.....). Stres (ya/tidak).$t$),
(array[$n$Ligament sprain (general)$n$],$t$**Keluhan Utama:** Nyeri pada sendi (.....) sisi (kanan/kiri) setelah terkilir/terpuntir/jatuh sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak (ada/tidak). Memar (ada/tidak). Sendi terasa goyah (ada/tidak). Gerak terbatas (ya/tidak). Hasil rontgen/USG: (.....).$t$),
(array[$n$Ligamentous laxity$n$],$t$**Keluhan Utama:** Sendi (.....) terasa longgar/goyah sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Riwayat cedera ligamen (ada/tidak). Episode giving way: (.....). Nyeri saat (.....). Hasil MRI/stress test: (.....). Olahraga: (.....).$t$),
(array[$n$Low back pain$n$,$n$Vertebrogenic low back pain$n$],$t$**Keluhan Utama:** Nyeri di punggung bawah sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Onset (mendadak/bertahap), pencetus (mengangkat beban/membungkuk/duduk lama/tidak diketahui). Bertambah saat (.....), berkurang saat (.....). Menjalar ke tungkai (ada/tidak). Kesemutan/baal (ada/tidak). Gangguan BAK/BAB (ada/tidak). Pekerjaan: (.....).$t$),
(array[$n$Lower cross syndrome$n$,$n$Upper cross syndrome$n$],$t$**Keluhan Utama:** Postur tubuh tidak seimbang (punggung bawah melengkung/bahu membulat dan kepala maju) yang disadari sejak (.....), disertai (nyeri/pegal/mudah lelah) pada (.....).
**Riwayat Sekarang:** Aktivitas/pekerjaan (duduk lama/gadget): (.....) jam/hari. Olahraga: (.....). Riwayat cedera (ada/tidak). Nyeri bertambah saat (.....).$t$),
(array[$n$Lumbar fracture$n$],$t$**Keluhan Utama:** Nyeri punggung setelah (jatuh/trauma/tanpa trauma jelas) tanggal (.....).
**Riwayat Sekarang:** Level vertebra: (.....). Osteoporosis (ada/tidak). Penggunaan korset/brace (ada/tidak). Kelemahan tungkai/gangguan BAK/BAB (ada/tidak).$t$),
(array[$n$Lumbosacral strain$n$],$t$**Keluhan Utama:** Nyeri pinggang mendadak setelah (mengangkat beban/memutar badan/jatuh) tanggal (.....).
**Mekanisme Cedera:** (.....). Sulit (berdiri tegak/membungkuk/berjalan) (ya/tidak). Menjalar ke tungkai (ada/tidak). Kelemahan tungkai/gangguan BAK/BAB (ada/tidak).$t$),
(array[$n$Malunion of fracture$n$],$t$**Keluhan Utama:** Keterbatasan gerak/deformitas dan nyeri pada (.....) sisi (kanan/kiri) akibat tulang sembuh tidak lurus.
**Riwayat Sekarang:** Tanggal fraktur: (.....). Penanganan awal: (.....). Rencana koreksi operasi (ada/tidak). Keterbatasan fungsi: (.....). Hasil rontgen: (.....).$t$),
(array[$n$Mechanical thoracic pain$n$],$t$**Keluhan Utama:** Nyeri di punggung atas/antara tulang belikat sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (menarik napas dalam/memutar badan/duduk lama). Menjalar ke (dada/rusuk) (ada/tidak). Sesak napas (ada/tidak). Pekerjaan: (.....).$t$),
(array[$n$Medial plica syndrome$n$],$t$**Keluhan Utama:** Nyeri sisi dalam-depan lutut (kanan/kiri) disertai bunyi klik sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (menekuk-meluruskan lutut/naik tangga/duduk lama). Terasa menyangkut (ada/tidak). Olahraga: (.....). Hasil MRI/USG: (.....).$t$),
(array[$n$Meniere's disease$n$],$t$**Keluhan Utama:** Pusing berputar episodik disertai telinga berdenging dan terasa penuh sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Durasi serangan (.....) menit/jam. Penurunan pendengaran (ada/tidak). Mual/muntah (ada/tidak). Frekuensi serangan: (.....). Obat/diet garam: (.....). Jatuh (ada/tidak).$t$),
(array[$n$Metatarsalgia$n$],$t$**Keluhan Utama:** Nyeri pada telapak kaki bagian depan (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (berjalan/berlari/memakai sepatu hak tinggi). Kapalan (ada/tidak). Alas kaki: (.....).$t$),
(array[$n$Morton's neuroma$n$],$t$**Keluhan Utama:** Nyeri/kesemutan/rasa terbakar di antara jari kaki (3-4) sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Seperti berjalan di atas kerikil (ya/tidak). Membaik saat sepatu dilepas (ya/tidak). Sepatu sempit/hak tinggi (ya/tidak).$t$),
(array[$n$Muscle imbalance$n$],$t$**Keluhan Utama:** Ketidakseimbangan kekuatan/kelenturan otot yang disadari sejak (.....), disertai (nyeri/pegal/mudah lelah) pada (.....).
**Riwayat Sekarang:** Aktivitas/pekerjaan (duduk lama/gadget): (.....) jam/hari. Olahraga: (.....). Riwayat cedera (ada/tidak). Nyeri bertambah saat (.....).$t$),
(array[$n$Muscle weakness$n$],$t$**Keluhan Utama:** Kelemahan otot (.....) sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Penyebab (cedera/pasca operasi/disuse/penyakit saraf): (.....). Sulit (mengangkat/berdiri/berjalan) (ya/tidak). Nyeri (ada/tidak). Atrofi (ada/tidak). Fungsi yang terganggu: (.....).$t$),
(array[$n$Myalgia$n$,$n$Myofascial pain syndrome$n$],$t$**Keluhan Utama:** Nyeri/pegal dan tegang pada otot (.....) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Titik nyeri (trigger point) (ada/tidak). Pencetus (stres/posisi kerja/olahraga/kurang gerak). Nyeri menjalar (ada/tidak). Pekerjaan: (.....).$t$),
(array[$n$Nonunion of fracture$n$],$t$**Keluhan Utama:** Nyeri dan gerakan abnormal/tulang belum menyambung pada (.....) sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Tanggal fraktur: (.....). Penanganan (gips/ORIF/bone graft): (.....). Merokok/DM (ada/tidak). Bone stimulator (ada/tidak). Hasil rontgen/CT: (.....).$t$),
(array[$n$Osgood-Schlatter disease$n$],$t$**Keluhan Utama:** Nyeri dan benjolan di bawah lutut (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu pada anak/remaja.
**Riwayat Sekarang:** Usia: (.....). Bertambah saat (olahraga/berlutut/naik tangga). Jenis olahraga: (.....). Fase pertumbuhan cepat (ya/tidak).$t$),
(array[$n$Osteitis pubis$n$],$t$**Keluhan Utama:** Nyeri di tulang kemaluan/selangkangan bagian tengah sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (menendang/berlari/mengubah arah/bangun dari duduk). Olahraga: (.....). Nyeri saat batuk/bersin (ada/tidak). Hasil MRI/rontgen: (.....).$t$),
(array[$n$Osteoarthritis of hip$n$],$t$**Keluhan Utama:** Nyeri dan kaku pada pinggul/selangkangan sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (berjalan/naik tangga/jongkok/memakai kaus kaki). Kaku pagi (.....) menit. Berjalan pincang (ada/tidak). Alat bantu: (.....). Hasil rontgen: (.....).$t$),
(array[$n$Pain in foot$n$],$t$**Keluhan Utama:** Nyeri pada kaki (kanan/kiri) (bagian .....) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (berdiri lama/berjalan/memakai sepatu tertentu). Bengkak (ada/tidak). Kesemutan (ada/tidak). Alas kaki: (.....). Pekerjaan: (.....).$t$),
(array[$n$Patella alta/baja$n$],$t$**Keluhan Utama:** Nyeri/ketidakstabilan tempurung lutut (kanan/kiri) dengan letak patella terlalu tinggi/rendah sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (naik-turun tangga/berlari/melompat). Patella tergeser/terasa lepas (ada/tidak). Bunyi gesek (ada/tidak). Hasil rontgen (indeks Insall-Salvati): (.....).$t$),
(array[$n$Patellar instability$n$],$t$**Keluhan Utama:** Tempurung lutut (kanan/kiri) bergeser/lepas sejak (.....).
**Riwayat Sekarang:** Jumlah episode: (.....).
**Mekanisme:** (.....). Lutut terasa goyah (ada/tidak). Penanganan sebelumnya: (.....).$t$),
(array[$n$Pathological fracture$n$],$t$**Keluhan Utama:** Nyeri dan keterbatasan fungsi pada (.....) sisi (kanan/kiri) setelah fraktur akibat trauma ringan.
**Riwayat Sekarang:** Tanggal fraktur: (.....). Penyebab dasar (osteoporosis/tumor/infeksi): (.....). Penanganan (konservatif/ORIF): (.....). Weight bearing: (.....). Terapi penyakit dasar: (.....).$t$),
(array[$n$Pectoralis Strain$n$],$t$**Keluhan Utama:** Nyeri pada dada/ketiak bagian depan (pectoralis) sisi (kanan/kiri) setelah (bench press/push-up/menarik beban) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Nyeri saat otot dikontraksikan/diregangkan (ya/tidak). Olahraga/pekerjaan: (.....).$t$),
(array[$n$Pectus Excavatum$n$],$t$**Keluhan Utama:** Dada tampak cekung ke dalam sejak (.....), disertai (sesak/mudah lelah/postur membungkuk).
**Riwayat:** Usia: (.....). Nyeri dada (ada/tidak). Sesak saat aktivitas (ada/tidak). Postur bahu membulat (ada/tidak). Riwayat keluarga (ada/tidak). Rencana operasi/brace: (.....).$t$),
(array[$n$Pelvic girdle pain$n$,$n$Pubic symphysis dysfunction$n$],$t$**Keluhan Utama:** Nyeri (pinggang/panggul/bokong) pada kehamilan usia (.....) minggu.
**Riwayat Sekarang:** Kehamilan ke-(.....). Bertambah saat (berjalan/naik tangga/berbalik di tempat tidur). Menjalar ke tungkai (ada/tidak). Perdarahan/kontraksi (ada/tidak). Izin dokter kandungan (ya/tidak).$t$),
(array[$n$Peroneal tendinitis$n$],$t$**Keluhan Utama:** Nyeri sisi luar pergelangan kaki (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (berjalan di permukaan miring/berlari). Riwayat terkilir (ada/tidak). Bunyi snapping (ada/tidak).$t$),
(array[$n$pes anserinus bursitis$n$],$t$**Keluhan Utama:** Nyeri pada sisi dalam bawah lutut (pes anserinus) sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (naik tangga/berlari/bangun dari duduk). Bengkak (ada/tidak). Nyeri saat memulai aktivitas (ya/tidak). Aktivitas/olahraga: (.....).$t$),
(array[$n$Pes cavus$n$],$t$**Keluhan Utama:** Lengkung telapak kaki terlalu tinggi disertai nyeri kaki/pergelangan kaki sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri pada (tumit/telapak depan/sisi luar kaki). Sering terkilir (ada/tidak). Kapalan (ada/tidak). Alas kaki: (.....). Penyakit saraf penyerta (ada/tidak).$t$),
(array[$n$Plantar fasciitis$n$],$t$**Keluhan Utama:** Nyeri pada tumit/telapak kaki (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri paling terasa saat langkah pertama setelah bangun tidur atau setelah duduk lama. Berdiri/berjalan lama (ya/tidak). Alas kaki: (.....). Berat badan: (.....).$t$),
(array[$n$Plantar plate injury$n$],$t$**Keluhan Utama:** Nyeri dan bengkak di pangkal jari kaki (.....) sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (berjinjit/mendorong ke depan/berjalan tanpa alas). Jari tampak bergeser (ada/tidak). Olahraga: (.....). Hasil USG/MRI: (.....).$t$),
(array[$n$Post-traumatic osteoarthritis$n$],$t$**Keluhan Utama:** Nyeri dan kaku pada sendi (.....) (kanan/kiri) yang pernah cedera/fraktur sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Cedera sebelumnya: (.....) tanggal (.....). Kaku pagi (.....) menit. Bertambah saat aktivitas. Bengkak (ada/tidak). Hasil rontgen: (.....).$t$)
)
update public.operational_options o
   set subjective_template = t.body
  from t
 cross join lateral unnest(t.names) as n(name)
 where o.category = 'diagnosa'
   and lower(btrim(o.label)) = lower(btrim(n.name))
   and o.subjective_template is distinct from t.body;

with t(names, body) as (
values
(array[$n$Posterior pelvic tilt$n$],$t$**Keluhan Utama:** Panggul tampak condong ke belakang (posterior pelvic tilt) yang disadari sejak (.....), disertai (nyeri/pegal/mudah lelah) pada (.....).
**Riwayat Sekarang:** Aktivitas/pekerjaan (duduk lama/gadget): (.....) jam/hari. Olahraga: (.....). Riwayat cedera (ada/tidak). Nyeri bertambah saat (.....).$t$),
(array[$n$Posterior tibial tendon dysfunction$n$],$t$**Keluhan Utama:** Nyeri pada sisi dalam pergelangan kaki/lengkung kaki sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (berjalan/berdiri lama/berjinjit). Bengkak (ada/tidak). Nyeri saat memulai aktivitas (ya/tidak). Aktivitas/olahraga: (.....).$t$),
(array[$n$Postural abnormality$n$],$t$**Keluhan Utama:** Postur tubuh tidak normal yang disadari sejak (.....), disertai (nyeri/pegal/mudah lelah) pada (.....).
**Riwayat Sekarang:** Aktivitas/pekerjaan (duduk lama/gadget): (.....) jam/hari. Olahraga: (.....). Riwayat cedera (ada/tidak). Nyeri bertambah saat (.....).$t$),
(array[$n$Postural orthostatic tachycardia syndrome (POTS)$n$],$t$**Keluhan Utama:** Jantung berdebar, pusing, dan lemas saat berdiri sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Gejala muncul saat (berdiri/aktivitas/air panas). Hampir pingsan/pingsan (ada/tidak). Intoleransi olahraga (ya/tidak). Cairan/garam/kompresi: (.....). Obat: (.....).$t$),
(array[$n$Postural strain$n$],$t$**Keluhan Utama:** Nyeri otot akibat postur kerja/duduk yang salah yang disadari sejak (.....), disertai (nyeri/pegal/mudah lelah) pada (.....).
**Riwayat Sekarang:** Aktivitas/pekerjaan (duduk lama/gadget): (.....) jam/hari. Olahraga: (.....). Riwayat cedera (ada/tidak). Nyeri bertambah saat (.....).$t$),
(array[$n$Psoriatic arthritis$n$],$t$**Keluhan Utama:** Nyeri dan bengkak sendi/jari ('sosis') disertai riwayat psoriasis sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Kaku pagi (.....) menit. Sendi terlibat: (.....). Lesi kulit/kuku (ada/tidak). Nyeri punggung/tumit (ada/tidak). Obat (DMARD/biologik): (.....).$t$),
(array[$n$Quadriceps muscle tightness$n$],$t$**Keluhan Utama:** Rasa kencang/tegang pada otot paha depan (quadriceps) sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri/tertarik saat (peregangan/berjalan/berolahraga). Riwayat cedera (ada/tidak). Duduk lama (ya/tidak). Aktivitas/olahraga: (.....).$t$),
(array[$n$Quadriceps strain$n$],$t$**Keluhan Utama:** Nyeri paha depan sisi (kanan/kiri) sejak (.....) hari yang lalu saat (menendang/berlari/melompat).
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Sulit meluruskan lutut/berjalan (ya/tidak).$t$),
(array[$n$Reactive arthritis$n$],$t$**Keluhan Utama:** Nyeri dan bengkak sendi (lutut/pergelangan kaki) setelah infeksi sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Infeksi pencetus (saluran cerna/kemih/kelamin) tanggal (.....). Mata merah (ada/tidak). Nyeri tumit (ada/tidak). Sendi terlibat: (.....). Obat: (.....).$t$),
(array[$n$Rehabilitation for activities of daily living$n$],$t$**Keluhan Utama:** Pasien datang untuk rehabilitasi kemampuan aktivitas sehari-hari (ADL) karena (.....).
**Riwayat Sekarang:** Diagnosis/penyebab: (.....). ADL yang terganggu (mandi/berpakaian/makan/berpindah/toileting): (.....). Dibantu keluarga (ya/tidak). Alat bantu: (.....). Target pasien: (.....).$t$),
(array[$n$Repetitive strain injury$n$],$t$**Keluhan Utama:** Nyeri/pegal/kesemutan pada (leher/bahu/lengan/tangan) akibat aktivitas berulang sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Pekerjaan/aktivitas: (.....) selama (.....) jam/hari. Ergonomi kerja: (.....). Bertambah saat bekerja, berkurang saat libur (ya/tidak). Kesemutan/kelemahan (ada/tidak).$t$),
(array[$n$Rheumatoid arthritis$n$],$t$**Keluhan Utama:** Nyeri, bengkak, dan kaku pada sendi-sendi (tangan/kaki/lainnya) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Kaku pagi lebih dari 1 jam (ya/tidak). Sendi terlibat: (.....). Simetris (ya/tidak). Obat (DMARD/steroid): (.....). Deformitas (ada/tidak).$t$),
(array[$n$rhomboid strain$n$],$t$**Keluhan Utama:** Nyeri pada punggung atas/sisi tulang belikat (rhomboid) sisi (kanan/kiri) setelah (mengangkat beban/menarik/gerakan mendadak) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Nyeri saat otot dikontraksikan/diregangkan (ya/tidak). Olahraga/pekerjaan: (.....).$t$),
(array[$n$Rotator cuff syndrome$n$,$n$Tendinitis Supraspinatus$n$],$t$**Keluhan Utama:** Nyeri bahu (kanan/kiri) terutama saat mengangkat lengan sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri bertambah saat (mengangkat tangan/overhead/tidur menindih sisi bahu). Kelemahan tangan (ada/tidak). Hasil USG/MRI: (.....).$t$),
(array[$n$Sacral stress fracture$n$],$t$**Keluhan Utama:** Nyeri bokong/pinggang bawah sisi (kanan/kiri) yang bertambah saat aktivitas sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Olahraga/beban latihan meningkat (ya/tidak). Nyeri saat berdiri satu kaki/berlari (ya/tidak). Densitas tulang rendah/amenore (ada/tidak). Hasil MRI: (.....).$t$),
(array[$n$Sacroiliac joint sprain$n$,$n$SI joint dysfunction$n$],$t$**Keluhan Utama:** Nyeri di bokong/pinggang bawah sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (bangun dari duduk/naik tangga/berbalik di tempat tidur/berdiri satu kaki). Menjalar ke (paha/selangkangan) (ada/tidak). Riwayat (melahirkan/jatuh) (ada/tidak).$t$),
(array[$n$Sarcopenia$n$],$t$**Keluhan Utama:** Otot mengecil dan kekuatan menurun sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Penyebab (tirah baring/usia/penyakit kronis/nutrisi). Sulit bangun dari kursi (ya/tidak). Berat badan turun (ada/tidak).$t$),
(array[$n$Scalenus syndrome$n$,$n$Thoracic outlet syndrome$n$],$t$**Keluhan Utama:** Kesemutan/baal/nyeri pada lengan dan tangan sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (tangan di atas kepala/membawa beban/tidur). Tangan dingin/pucat/bengkak (ada/tidak). Pekerjaan: (.....). Rusuk tambahan (ada/tidak).$t$),
(array[$n$Scapular dyskinesis$n$],$t$**Keluhan Utama:** Nyeri/lemah di bahu (kanan/kiri) dengan gerakan tulang belikat tidak normal sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Tulang belikat menonjol/tidak ikut bergerak saat mengangkat lengan (ya/tidak). Nyeri saat (overhead/mendorong/menarik). Olahraga/pekerjaan: (.....).
**Riwayat cedera bahu:** (.....).$t$),
(array[$n$Scapular winging$n$],$t$**Keluhan Utama:** Tulang belikat menonjol seperti sayap di sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Penyebab (cedera saraf/otot lemah/tidak diketahui). Sulit mengangkat lengan ke depan/atas (ya/tidak). Nyeri bahu (ada/tidak). Hasil EMG: (.....).$t$),
(array[$n$Scheuermann's disease$n$],$t$**Keluhan Utama:** Punggung terlihat membungkuk/nyeri punggung atas sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Usia: (.....). Nyeri bertambah saat (duduk lama/aktivitas olahraga). Postur kaku tidak bisa diluruskan (ya/tidak). Hasil rontgen: (.....).$t$),
(array[$n$Sesamoiditis$n$],$t$**Keluhan Utama:** Nyeri di bawah pangkal ibu jari kaki (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (berjinjit/berlari/menumpu). Bengkak (ada/tidak). Alas kaki/olahraga (balet/lari): (.....). Hasil rontgen: (.....).$t$),
(array[$n$Shoulder girdle weakness$n$],$t$**Keluhan Utama:** Kelemahan pada bahu/tulang belikat sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Penyebab (cedera/pasca operasi/disuse/saraf): (.....). Sulit mengangkat lengan/membawa beban (ya/tidak). Nyeri (ada/tidak). Atrofi (ada/tidak).$t$),
(array[$n$Shoulder Impingement$n$],$t$**Keluhan Utama:** Nyeri bahu (kanan/kiri) saat mengangkat lengan ke samping/atas sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri pada rentang (60-120) derajat saat abduksi. Aktivitas berulang di atas kepala (olahraga/pekerjaan): (.....). Nyeri malam (ya/tidak).$t$),
(array[$n$shoulder pain$n$],$t$**Keluhan Utama:** Nyeri pada bahu (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Lokasi (depan/samping/belakang/atas). Bertambah saat (mengangkat lengan/tidur menindih/overhead). Menjalar ke lengan (ada/tidak). Riwayat trauma (ada/tidak). Hasil rontgen/USG: (.....).$t$),
(array[$n$Sinding-Larsen-Johansson syndrome$n$],$t$**Keluhan Utama:** Nyeri di ujung bawah tempurung lutut (kanan/kiri) pada anak/remaja sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Usia: (.....). Bertambah saat (melompat/berlari/olahraga). Nyeri tekan di patella bawah (ada/tidak). Jenis olahraga: (.....). Hasil rontgen: (.....).$t$),
(array[$n$Sinus tarsi syndrome$n$],$t$**Keluhan Utama:** Nyeri di sisi luar depan pergelangan kaki (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Riwayat terkilir (ada/tidak). Bertambah saat (berjalan di permukaan tidak rata/berdiri lama). Pergelangan terasa goyah (ada/tidak). Hasil MRI: (.....).$t$),
(array[$n$SLAP Tear Shoulder$n$],$t$**Keluhan Utama:** Nyeri dalam di bahu (kanan/kiri) disertai bunyi klik/terasa mengganjal sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri bertambah saat (overhead/melempar/mengangkat beban). Bahu terasa goyah/lepas (ada/tidak). Mekanisme cedera: (.....). Hasil MRI/MR arthrography: (.....).$t$),
(array[$n$Snapping hip syndrome$n$],$t$**Keluhan Utama:** Bunyi klik/terasa menyentak pada pinggul (kanan/kiri) saat bergerak sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bunyi pada saat (mengangkat tungkai/berdiri dari duduk/berjalan). Nyeri (ada/tidak). Olahraga (balet/lari/lainnya): (.....). Terasa pinggul lepas (ada/tidak).$t$),
(array[$n$Snapping scapula syndrome$n$],$t$**Keluhan Utama:** Bunyi/rasa gesekan di bawah tulang belikat (kanan/kiri) saat bahu bergerak sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri (ada/tidak). Bertambah saat (mengangkat lengan/mendorong/menarik). Postur membungkuk (ada/tidak). Pekerjaan/olahraga: (.....).$t$),
(array[$n$Spondylolisthesis$n$],$t$**Keluhan Utama:** Nyeri pinggang bawah, kadang menjalar ke bokong/tungkai sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (ekstensi/berdiri lama/olahraga). Riwayat olahraga (senam/angkat beban/lainnya): (.....). Hasil rontgen: (grade .....).$t$),
(array[$n$Spondylolysis$n$],$t$**Keluhan Utama:** Nyeri pinggang bawah saat aktivitas/olahraga sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri bertambah saat (ekstensi/rotasi). Jenis olahraga: (.....). Usia: (.....). Hasil rontgen/CT: (.....).$t$),
(array[$n$Sprain Finger$n$,$n$Sprain Thumb$n$],$t$**Keluhan Utama:** Nyeri pada jari/ibu jari tangan sisi (kanan/kiri) setelah terkilir/terpuntir/jatuh sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak (ada/tidak). Memar (ada/tidak). Sendi terasa goyah (ada/tidak). Gerak terbatas (ya/tidak). Hasil rontgen/USG: (.....).$t$),
(array[$n$Sprain Ligament Genu Dextra PFPS$n$,$n$Patellofemoral pain syndrome$n$],$t$**Keluhan Utama:** Nyeri di sekitar/belakang tempurung lutut (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (naik turun tangga/jongkok/duduk lama lutut ditekuk). Olahraga: (.....). Bunyi gesek (ada/tidak).$t$),
(array[$n$Sprain of foot$n$],$t$**Keluhan Utama:** Nyeri pada kaki sisi (kanan/kiri) setelah terkilir/terpuntir/jatuh sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak (ada/tidak). Memar (ada/tidak). Sendi terasa goyah (ada/tidak). Gerak terbatas (ya/tidak). Hasil rontgen/USG: (.....).$t$),
(array[$n$Sprain Toe$n$,$n$Turf toe$n$],$t$**Keluhan Utama:** Nyeri pada jari kaki (ibu jari kaki pada turf toe) sisi (kanan/kiri) setelah terkilir/terpuntir/jatuh sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak (ada/tidak). Memar (ada/tidak). Sendi terasa goyah (ada/tidak). Gerak terbatas (ya/tidak). Hasil rontgen/USG: (.....).$t$),
(array[$n$Stiffness Ankle$n$],$t$**Keluhan Utama:** Pergelangan kaki (kanan/kiri) terasa kaku dan sulit digerakkan sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Penyebab (pasca cedera/gips/operasi/lainnya): (.....). Sulit (jongkok/naik tangga/berjalan) (ya/tidak). Nyeri (ada/tidak). Bengkak (ada/tidak).$t$),
(array[$n$stiffness elbow$n$],$t$**Keluhan Utama:** Siku (kanan/kiri) terasa kaku dan sulit ditekuk/diluruskan sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Penyebab (pasca fraktur/gips/operasi/lainnya): (.....). Sulit (makan/menyisir/berpakaian) (ya/tidak). Nyeri (ada/tidak). Bengkak (ada/tidak).$t$),
(array[$n$Stiffness Lumbal$n$],$t$**Keluhan Utama:** Pinggang terasa kaku terutama (pagi hari/setelah duduk lama) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Kaku membaik setelah bergerak (ya/tidak). Nyeri (ada/tidak). Menjalar (ada/tidak). Pekerjaan: (.....). Riwayat spondylosis/AS (ada/tidak).$t$),
(array[$n$Strain$n$],$t$**Keluhan Utama:** Nyeri pada otot (.....) sisi (kanan/kiri) setelah (olahraga/gerakan mendadak/mengangkat beban) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Nyeri saat otot dikontraksikan/diregangkan (ya/tidak). Olahraga/pekerjaan: (.....).$t$),
(array[$n$Strain Achilles$n$,$n$Achilles tendinitis$n$],$t$**Keluhan Utama:** Nyeri dan kaku pada tendon tumit (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri terutama (pagi hari/saat memulai lari/setelah aktivitas). Benjolan/bengkak (ada/tidak). Olahraga: (.....). Alas kaki: (.....).$t$),
(array[$n$Strain Brachioradialis$n$],$t$**Keluhan Utama:** Nyeri pada lengan bawah (brachioradialis) sisi (kanan/kiri) setelah (mengangkat/menarik/olahraga) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Nyeri saat otot dikontraksikan/diregangkan (ya/tidak). Olahraga/pekerjaan: (.....).$t$),
(array[$n$Strain Deltoid$n$],$t$**Keluhan Utama:** Nyeri pada bahu (deltoid) sisi (kanan/kiri) setelah (mengangkat beban/overhead/olahraga) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Nyeri saat otot dikontraksikan/diregangkan (ya/tidak). Olahraga/pekerjaan: (.....).$t$),
(array[$n$Strain Digiti Minimi$n$],$t$**Keluhan Utama:** Nyeri pada sisi kelingking tangan (abductor digiti minimi) sisi (kanan/kiri) setelah (mencengkeram/jatuh/olahraga) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Nyeri saat otot dikontraksikan/diregangkan (ya/tidak). Olahraga/pekerjaan: (.....).$t$),
(array[$n$strain flexor pollicis longus$n$],$t$**Keluhan Utama:** Nyeri pada pangkal ibu jari bagian telapak (flexor pollicis longus) sisi (kanan/kiri) setelah (mencengkeram/menarik/olahraga) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Nyeri saat otot dikontraksikan/diregangkan (ya/tidak). Olahraga/pekerjaan: (.....).$t$),
(array[$n$Strain Latissimus Dorsi$n$],$t$**Keluhan Utama:** Nyeri pada punggung samping (latissimus dorsi) sisi (kanan/kiri) setelah (menarik/memanjat/olahraga) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Nyeri saat otot dikontraksikan/diregangkan (ya/tidak). Olahraga/pekerjaan: (.....).$t$),
(array[$n$Strain Serratus Anterior$n$],$t$**Keluhan Utama:** Nyeri pada rusuk samping (serratus anterior) sisi (kanan/kiri) setelah (mendorong/olahraga/batuk keras) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Nyeri saat otot dikontraksikan/diregangkan (ya/tidak). Olahraga/pekerjaan: (.....).$t$),
(array[$n$Strain Sternocleidomastoideus$n$],$t$**Keluhan Utama:** Nyeri pada leher samping (sternocleidomastoid) sisi (kanan/kiri) setelah (gerakan leher mendadak/trauma/olahraga) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Nyeri saat otot dikontraksikan/diregangkan (ya/tidak). Olahraga/pekerjaan: (.....).$t$),
(array[$n$Strain tendon digitorum$n$],$t$**Keluhan Utama:** Nyeri pada tendon jari tangan/kaki (digitorum) sisi (kanan/kiri) setelah (mencengkeram/menarik/olahraga) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Nyeri saat otot dikontraksikan/diregangkan (ya/tidak). Olahraga/pekerjaan: (.....).$t$),
(array[$n$Strain Teres Major$n$],$t$**Keluhan Utama:** Nyeri pada belakang ketiak/tulang belikat (teres major) sisi (kanan/kiri) setelah (menarik/mendayung/olahraga) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Nyeri saat otot dikontraksikan/diregangkan (ya/tidak). Olahraga/pekerjaan: (.....).$t$),
(array[$n$Strain Teres Minor$n$],$t$**Keluhan Utama:** Nyeri pada belakang bahu (teres minor) sisi (kanan/kiri) setelah (overhead/melempar/olahraga) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Nyeri saat otot dikontraksikan/diregangkan (ya/tidak). Olahraga/pekerjaan: (.....).$t$),
(array[$n$Subacromial bursitis$n$],$t$**Keluhan Utama:** Nyeri dan nyeri tekan di bahu bagian luar/atas sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (mengangkat lengan/tidur menindih bahu). Bengkak (ada/tidak). Aktivitas berulang: (.....).$t$),
(array[$n$Suboccipital strain$n$],$t$**Keluhan Utama:** Nyeri pada leher bagian atas/dasar kepala (suboccipital) sisi (kanan/kiri) setelah (posisi menunduk lama/gerakan mendadak) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Nyeri saat otot dikontraksikan/diregangkan (ya/tidak). Olahraga/pekerjaan: (.....).$t$),
(array[$n$Tailbone pain$n$],$t$**Keluhan Utama:** Nyeri di tulang ekor sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (duduk lama/bangun dari duduk/BAB). Riwayat (jatuh terduduk/melahirkan) (ada/tidak).$t$),
(array[$n$Temporomandibular joint disorder$n$],$t$**Keluhan Utama:** Nyeri/bunyi klik pada rahang sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Sulit membuka mulut lebar (ya/tidak). Nyeri saat (mengunyah/menguap/bicara lama). Rahang terkunci (ada/tidak). Kebiasaan menggertakkan gigi (ada/tidak).$t$),
(array[$n$Tendinitis Triceps$n$],$t$**Keluhan Utama:** Nyeri pada belakang lengan atas/siku (triceps) sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (mendorong/push-up/meluruskan siku dengan beban). Bengkak (ada/tidak). Nyeri saat memulai aktivitas (ya/tidak). Aktivitas/olahraga: (.....).$t$),
(array[$n$Tendinitis, foot and ankle$n$],$t$**Keluhan Utama:** Nyeri pada kaki/pergelangan kaki sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (berjalan/berlari/berdiri lama). Bengkak (ada/tidak). Nyeri saat memulai aktivitas (ya/tidak). Aktivitas/olahraga: (.....).$t$),
(array[$n$Tennis elbow$n$],$t$**Keluhan Utama:** Nyeri pada siku bagian luar sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri bertambah saat (menggenggam/memutar pergelangan/mengangkat benda/berjabat tangan). Aktivitas berulang: (.....). Pekerjaan/olahraga: (.....).$t$),
(array[$n$Tension-type headache$n$],$t$**Keluhan Utama:** Nyeri kepala seperti diikat/ditekan pada kedua sisi sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Frekuensi (.....) kali/minggu, durasi (.....) jam. Pencetus: (stres/kurang tidur/posisi kerja/layar). Mual/muntah (ada/tidak). Gangguan penglihatan (ada/tidak).$t$),
(array[$n$TFCC injury$n$],$t$**Keluhan Utama:** Nyeri di sisi kelingking pergelangan tangan (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (memutar pergelangan/menumpu/memutar kunci). Bunyi klik (ada/tidak). Mekanisme cedera (jatuh bertumpu tangan/olahraga raket): (.....). Hasil MRI: (.....).$t$),
(array[$n$Thumb Tendonitis$n$],$t$**Keluhan Utama:** Nyeri pada ibu jari/pangkal ibu jari sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (mencubit/menggenggam/mengetik/menggunakan HP). Bengkak (ada/tidak). Nyeri saat memulai aktivitas (ya/tidak). Aktivitas/olahraga: (.....).$t$),
(array[$n$Toe walking$n$],$t$**Keluhan Utama:** Anak berjalan berjinjit sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat:** Usia anak: (.....). Selalu berjinjit/kadang (ya/tidak). Tumit/betis kaku (ada/tidak). Terlambat bicara/perkembangan (ada/tidak). Riwayat prematur/keluarga (ada/tidak).$t$),
(array[$n$Torticollis$n$],$t$**Keluhan Utama:** Nyeri dan kaku leher dengan kepala miring ke sisi (kanan/kiri) sejak (.....) hari yang lalu.
**Riwayat Sekarang:** Muncul setelah (bangun tidur/posisi tidur salah/aktivitas tertentu). Sulit menoleh ke sisi (kanan/kiri).$t$),
(array[$n$Trapezius strain$n$],$t$**Keluhan Utama:** Nyeri pada leher-bahu (trapezius) sisi (kanan/kiri) setelah (mengangkat beban/duduk lama dengan postur salah/gerakan mendadak) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Nyeri saat otot dikontraksikan/diregangkan (ya/tidak). Olahraga/pekerjaan: (.....).$t$),
(array[$n$Trigger finger$n$],$t$**Keluhan Utama:** Jari (.....) tangan (kanan/kiri) tersangkut/terkunci saat menekuk sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Terutama (pagi hari/saat menggenggam). Nyeri pada telapak pangkal jari (ada/tidak). Riwayat DM (ada/tidak). Pekerjaan: (.....).$t$),
(array[$n$Tumor Tulang$n$],$t$**Keluhan Utama:** Pasien rehabilitasi dengan tumor tulang di (.....) dengan keluhan (nyeri/lemah/keterbatasan gerak) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Jenis tumor (jinak/ganas): (.....). Operasi/kemoterapi/radioterapi: (.....). Tanggal tindakan: (.....). Fraktur patologis (ada/tidak). Weight bearing: (.....). Izin onkolog/dokter (ya/tidak).$t$),
(array[$n$Whiplash injury$n$],$t$**Keluhan Utama:** Nyeri dan kaku leher setelah (kecelakaan lalu lintas/jatuh/trauma) tanggal (.....).
**Mekanisme Cedera:** (.....). Pusing/mual (ada/tidak). Kesemutan/baal lengan (ada/tidak). Hasil rontgen/MRI: (.....).$t$),
(array[$n$wrist pain$n$],$t$**Keluhan Utama:** Nyeri pada pergelangan tangan (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Lokasi (ibu jari/kelingking/punggung/telapak). Bertambah saat (menggenggam/menumpu/mengetik). Bengkak (ada/tidak). Kesemutan (ada/tidak).
**Riwayat cedera:** (.....).$t$)
)
update public.operational_options o
   set subjective_template = t.body
  from t
 cross join lateral unnest(t.names) as n(name)
 where o.category = 'diagnosa'
   and lower(btrim(o.label)) = lower(btrim(n.name))
   and o.subjective_template is distinct from t.body;

with t(names, body) as (
values
(array[$n$wrist sprain$n$],$t$**Keluhan Utama:** Nyeri pergelangan tangan setelah (jatuh bertumpu tangan/terpuntir) tanggal (.....).
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Genggaman lemah (ada/tidak). Hasil rontgen: (.....).$t$),
(array[$n$Wrist Strain$n$],$t$**Keluhan Utama:** Nyeri pada pergelangan tangan sisi (kanan/kiri) setelah (mengangkat/menggenggam/olahraga) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Nyeri saat otot dikontraksikan/diregangkan (ya/tidak). Olahraga/pekerjaan: (.....).$t$),
(array[$n$Ataxia$n$],$t$**Keluhan Utama:** Gerakan tidak terkoordinasi, berjalan limbung/lebar, dan tremor saat bergerak sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Penyebab (stroke/cerebellar/lainnya): (.....). Jatuh (ada/tidak). Bicara cadel (ada/tidak). Sulit (menulis/mengancingkan baju) (ya/tidak). Alat bantu: (.....).$t$),
(array[$n$Axillary nerve lesion$n$],$t$**Keluhan Utama:** Kelemahan dan baal pada bahu sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (mengangkat lengan ke samping). Kelemahan otot (ada/tidak). Otot mengecil (ada/tidak). Penyebab/pencetus: (.....). Hasil EMG/NCV: (.....).$t$),
(array[$n$Bell's palsy$n$],$t$**Keluhan Utama:** Wajah terasa kaku/mencong/tidak bisa digerakkan di sisi (kanan/kiri) sejak (.....) hari/minggu yang lalu.
**Riwayat Sekarang:** Onset (mendadak/bertahap). Mata sulit menutup (ada/tidak). Nyeri telinga (ada/tidak). Pengecap berubah (ada/tidak). Riwayat (kena angin/infeksi/DM/HT). Obat dokter: (.....).$t$),
(array[$n$Brachial plexus injury$n$],$t$**Keluhan Utama:** Kelemahan/baal pada lengan (kanan/kiri) setelah (trauma/kecelakaan/operasi) tanggal (.....).
**Mekanisme:** (.....). Gerakan bahu/siku/tangan yang hilang: (.....). Nyeri saraf (ada/tidak). Hasil EMG/MRI: (.....).$t$),
(array[$n$Carpal tunnel syndrome$n$],$t$**Keluhan Utama:** Kesemutan/baal/nyeri pada jari (1,2,3) tangan (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (malam hari/bangun tidur/memakai HP/mouse). Berkurang saat tangan dikibaskan. Pekerjaan: (.....). Hamil/DM/hipotiroid (ada/tidak).$t$),
(array[$n$Cluneal nerve entrapment$n$],$t$**Keluhan Utama:** Nyeri tajam di pinggang bawah/pantat atas sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri bertambah saat (membungkuk/memutar/duduk lama). Titik nyeri tekan di krista iliaka (ada/tidak). Menjalar ke paha (ada/tidak). Riwayat (pengambilan graft/trauma/operasi): (.....).$t$),
(array[$n$Critical illness polyneuropathy$n$],$t$**Keluhan Utama:** Kelemahan dan baal pada tungkai/lengan setelah perawatan ICU sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Lama perawatan ICU/ventilator: (.....) hari. Penyebab (sepsis/lainnya): (.....). Sulit duduk/berdiri/berjalan (ya/tidak). Gangguan menelan/napas (ada/tidak). Hasil EMG: (.....).$t$),
(array[$n$CRPS II$n$],$t$**Keluhan Utama:** Nyeri terbakar hebat, bengkak, dan perubahan kulit pada (tangan/lengan) sisi (kanan/kiri) setelah cedera saraf sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Saraf yang cedera: (.....). Penyebab (trauma/operasi): (.....). Nyeri berlebihan terhadap sentuhan (ya/tidak). Kaku/lemah (ada/tidak). Obat: (.....).$t$),
(array[$n$Cubital tunnel syndrome$n$,$n$Ulnar nerve lesion$n$],$t$**Keluhan Utama:** Kesemutan/baal pada jari manis dan kelingking sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (siku ditekuk lama/telepon/tidur). Kelemahan genggaman/jepit (ada/tidak). Otot tangan mengecil (ada/tidak). Hasil EMG/NCV: (.....).$t$),
(array[$n$Diabetic Neuropathy$n$],$t$**Keluhan Utama:** Kesemutan/baal/rasa terbakar pada (jari tangan/telapak kaki) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Penyakit:** DM sejak (.....) tahun. Kontrol gula darah (rutin/tidak). HbA1c: (.....). Luka kaki (ada/tidak). Gangguan keseimbangan (ada/tidak). Obat DM: (.....).$t$),
(array[$n$Dizziness and giddiness$n$,$n$Vertigo$n$,$n$Vestibular dysfunction, unspecified$n$],$t$**Keluhan Utama:** Pusing/melayang/tidak stabil sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Pola (terus menerus/episodik). Pencetus: (.....). Mual (ada/tidak). Pendengaran berkurang (ada/tidak). Jatuh (ada/tidak). Diagnosis dokter: (.....).$t$),
(array[$n$Encounter for gait training$n$],$t$**Keluhan Utama:** Pasien datang untuk latihan berjalan (gait training) karena (.....).
**Riwayat Sekarang:** Penyebab gangguan jalan: (.....). Kemampuan berjalan sekarang: (.....) meter. Alat bantu (tongkat/walker/kruk). Jatuh (ada/tidak). Nyeri saat berjalan (ada/tidak). Target: (.....).$t$),
(array[$n$Facial asymmetry$n$],$t$**Keluhan Utama:** Wajah tampak tidak simetris sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Onset (mendadak/bertahap/sejak lahir). Penyebab (Bell's palsy/stroke/trauma/operasi): (.....). Mata sulit menutup (ada/tidak). Gangguan bicara/mengunyah (ada/tidak).$t$),
(array[$n$Foot drop (peroneal nerve palsy)$n$],$t$**Keluhan Utama:** Ujung kaki (kanan/kiri) jatuh/tersangkut saat berjalan sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Penyebab (HNP/trauma lutut/bidai/tidak diketahui). Baal punggung kaki (ada/tidak). Sering tersandung (ya/tidak). Hasil EMG: (.....).$t$),
(array[$n$Functional quadriplegia$n$],$t$**Keluhan Utama:** Tidak mampu bergerak/berpindah secara mandiri akibat kelemahan berat sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Penyebab (penyakit kronis/demensia/imobilisasi lama): (.....). Dapat duduk/berdiri (ya/tidak). Ulkus tekan (ada/tidak). Dibantu penuh (ya/tidak). Kontraktur (ada/tidak).$t$),
(array[$n$Gait abnormality$n$],$t$**Keluhan Utama:** Cara berjalan tidak normal (pincang/melangkah pendek/menyeret/goyah) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Penyebab (nyeri/kelemahan/cedera/penyakit saraf): (.....). Jatuh (ada/tidak). Alat bantu: (.....). Jarak berjalan: (.....). Nyeri saat berjalan (ada/tidak).$t$),
(array[$n$Genitofemoral neuralgia$n$],$t$**Keluhan Utama:** Nyeri/rasa terbakar di selangkangan dan paha atas sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Riwayat (operasi hernia/usus buntu/panggul): (.....). Bertambah saat (meluruskan pinggul/berdiri lama). Nyeri buah zakar/labia (ada/tidak).$t$),
(array[$n$Hypotonia$n$],$t$**Keluhan Utama:** Otot terasa lemas/lembek dan perkembangan motorik lambat sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat:** Usia: (.....). Lahir (aterm/prematur). Kontrol kepala/duduk/berdiri usia (.....). Kesulitan menyusu/menelan (ada/tidak). Diagnosis (Down syndrome/lainnya): (.....).$t$),
(array[$n$Intercostal neuralgia$n$],$t$**Keluhan Utama:** Nyeri tajam/terbakar menjalar di sela rusuk sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (tarik napas dalam/batuk/memutar badan). Riwayat (herpes zoster/operasi dada/trauma): (.....). Nyeri jantung/paru sudah disingkirkan (ya/tidak).$t$),
(array[$n$Ischialgia$n$],$t$**Keluhan Utama:** Nyeri menjalar dari (pinggang/bokong) ke (paha/betis/kaki) sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri bertambah saat (duduk lama/membungkuk/batuk/bersin). Kesemutan/baal/kelemahan tungkai (ada/tidak). Gangguan BAK/BAB (ada/tidak).$t$),
(array[$n$Labyrinthitis$n$],$t$**Keluhan Utama:** Pusing berputar disertai gangguan pendengaran/telinga berdenging sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Didahului infeksi (flu/telinga) (ya/tidak). Mual/muntah (ada/tidak). Penurunan pendengaran (ada/tidak). Gangguan keseimbangan saat berjalan (ya/tidak). Obat: (.....).$t$),
(array[$n$Long thoracic nerve palsy$n$],$t$**Keluhan Utama:** Kelemahan dan tulang belikat menonjol (winging) pada bahu/tulang belikat sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (mendorong/mengangkat lengan ke depan). Kelemahan otot (ada/tidak). Otot mengecil (ada/tidak). Penyebab/pencetus: (.....). Hasil EMG/NCV: (.....).$t$),
(array[$n$Lumbal Disc Bulging$n$],$t$**Keluhan Utama:** Nyeri pinggang berulang sejak (.....) hari/minggu/bulan yang lalu, tanpa/dengan nyeri menjalar.
**Riwayat Sekarang:** Bertambah saat (membungkuk/duduk lama/bangun dari duduk). Hasil MRI: (.....). Riwayat angkat beban berat (ada/tidak).$t$),
(array[$n$Multiple sclerosis$n$],$t$**Keluhan Utama:** Kelemahan/baal/gangguan keseimbangan dan mudah lelah sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Jumlah relaps: (.....). Gangguan penglihatan (ada/tidak). Gangguan BAK (ada/tidak). Spastisitas (ada/tidak). Obat DMT: (.....).$t$),
(array[$n$Nerve root compression$n$],$t$**Keluhan Utama:** Nyeri tajam/seperti tersetrum menjalar sesuai area saraf (.....) sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Kesemutan/baal pada (.....). Kelemahan otot (ada/tidak). Bertambah saat (batuk/bersin/menunduk). Hasil MRI/EMG: (.....).$t$),
(array[$n$Obturator nerve entrapment$n$],$t$**Keluhan Utama:** Nyeri/baal paha bagian dalam sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (olahraga/mengayun kaki). Kelemahan adduktor (ada/tidak). Riwayat (operasi panggul/hernia/trauma): (.....). Hasil EMG: (.....).$t$),
(array[$n$Paraparesis Leg$n$,$n$Paraplegia$n$,$n$Quadriplegia$n$],$t$**Keluhan Utama:** Kelemahan/lumpuh kedua (tungkai/seluruh anggota gerak) pasca cedera medula spinalis.
**Riwayat Sekarang:** Tanggal cedera: (.....). Penyebab: (.....). Level (ASIA): (.....). Operasi stabilisasi (ada/tidak). BAK/BAB: (.....). Ulkus tekan (ada/tidak). Spastisitas (ada/tidak).$t$),
(array[$n$Parkinson's disease$n$],$t$**Keluhan Utama:** Tremor/kaku/gerakan lambat dan sulit berjalan sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Tremor saat (istirahat). Langkah kecil/membeku (ada/tidak). Jatuh (ada/tidak). Obat (levodopa/lainnya): (.....). Lama sakit: (.....) tahun. Hoehn-Yahr: (.....).$t$),
(array[$n$Peripheral neuropathy$n$],$t$**Keluhan Utama:** Kesemutan/baal/rasa terbakar pada kedua (tangan/kaki) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Distribusi (stocking-glove). Kelemahan (ada/tidak). Sering tersandung (ada/tidak). Penyebab (DM/alkohol/obat/tidak diketahui). Hasil EMG: (.....).$t$),
(array[$n$Pudendal neuralgia$n$],$t$**Keluhan Utama:** Nyeri/rasa terbakar di area panggul bawah/kemaluan/anus sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat duduk lama dan membaik saat berdiri/duduk di toilet (ya/tidak). Gangguan BAB/BAK (ada/tidak). Nyeri saat hubungan intim (ada/tidak). Riwayat (bersepeda/melahirkan/operasi): (.....).$t$),
(array[$n$Radial nerve lesion$n$,$n$Radial tunnel syndrome$n$],$t$**Keluhan Utama:** Pergelangan tangan (kanan/kiri) terkulai/tidak bisa diangkat sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Penyebab (tekanan saat tidur/fraktur humerus/trauma/tidak diketahui). Baal punggung tangan (ada/tidak). Hasil EMG: (.....).$t$),
(array[$n$Sciatic neuropathy$n$],$t$**Keluhan Utama:** Nyeri/baal/kelemahan pada tungkai (dari bokong ke kaki) sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (duduk lama/menyilang kaki/menekuk lutut). Kelemahan otot (ada/tidak). Otot mengecil (ada/tidak). Penyebab/pencetus: (.....). Hasil EMG/NCV: (.....).$t$),
(array[$n$Spasticity$n$],$t$**Keluhan Utama:** Otot terasa kaku/tegang dan sulit digerakkan pada (lengan/tungkai) sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Penyebab (stroke/CP/cedera medula/MS): (.....). Kaku bertambah saat (cemas/dingin/bergerak cepat). Kejang otot (ada/tidak). Obat (baclofen/botulinum): (.....). Skala Ashworth: (.....).$t$),
(array[$n$Spinal stenosis cervical region$n$,$n$Spinal stenosis lumbar region$n$],$t$**Keluhan Utama:** Nyeri pinggang/tungkai, berat atau kesemutan saat berjalan sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Jarak berjalan sebelum nyeri: (.....) meter. Membaik saat (duduk/membungkuk). Memburuk saat (berdiri tegak/berjalan menurun). Kelemahan tungkai (ada/tidak).$t$),
(array[$n$Stress incontinence$n$,$n$Urinary incontinence$n$],$t$**Keluhan Utama:** Mengompol/urin bocor saat (batuk/bersin/tertawa/olahraga/sebelum sampai toilet) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Frekuensi BAK: (.....) kali/hari. Malam hari: (.....) kali. Jumlah pembalut/hari: (.....).
**Riwayat melahirkan:** (.....). Nyeri BAK (ada/tidak).$t$),
(array[$n$Suprascapular nerve entrapment$n$],$t$**Keluhan Utama:** Nyeri tumpul dan kelemahan pada bahu bagian belakang/atas sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (mengangkat lengan/overhead/menyilang dada). Kelemahan otot (ada/tidak). Otot mengecil (ada/tidak). Penyebab/pencetus: (.....). Hasil EMG/NCV: (.....).$t$),
(array[$n$Trigeminal neuralgia$n$],$t$**Keluhan Utama:** Nyeri tajam seperti tersetrum di wajah sisi (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Dipicu oleh (mengunyah/bicara/sentuhan/angin). Durasi serangan: (.....) detik. Frekuensi (.....) kali/hari. Obat (carbamazepine/lainnya): (.....). Riwayat operasi/MS (ada/tidak).$t$),
(array[$n$Vestibular neuritis$n$],$t$**Keluhan Utama:** Pusing berputar hebat mendadak disertai mual dan tidak stabil saat berjalan sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Didahului infeksi virus (ya/tidak). Pendengaran normal (ya/tidak). Muntah (ada/tidak). Jatuh (ada/tidak). Obat (anti-vertigo/steroid): (.....). Pusing bertambah saat menoleh cepat (ya/tidak).$t$),
(array[$n$Diastasis recti$n$],$t$**Keluhan Utama:** Perut tampak menonjol/ada celah di garis tengah perut pasca melahirkan sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Persalinan terakhir tanggal (.....). Nyeri pinggang (ada/tidak). Lebar celah: (.....) jari. Benjolan saat mengejan (ada/tidak).$t$),
(array[$n$Pelvic organ prolapse$n$],$t$**Keluhan Utama:** Rasa mengganjal/turun di vagina sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Bertambah saat (berdiri lama/mengangkat beban/mengejan). Kesulitan BAK/BAB (ada/tidak).
**Riwayat melahirkan:** (.....). Menopause (ya/tidak). Penanganan dokter: (.....).$t$),
(array[$n$Postpartum muscle strain$n$],$t$**Keluhan Utama:** Pasien pasca melahirkan dengan keluhan (nyeri punggung/panggul/perut/luka SC) sejak (.....).
**Riwayat Persalinan:** (normal/SC), tanggal (.....). Anak ke-(.....). Luka jahitan nyeri (ada/tidak). Menyusui (ya/tidak). Rasa turun/bocor urin (ada/tidak).$t$),
(array[$n$Craniotomy$n$],$t$**Keluhan Utama:** Pasien rehabilitasi pasca kraniotomi dengan keluhan (kelemahan/gangguan keseimbangan/gangguan bicara/menelan).
**Riwayat Sekarang:** Tanggal operasi: (.....). Indikasi (tumor/perdarahan/trauma): (.....). Kejang (ada/tidak). Kelemahan sisi (kanan/kiri). Kemampuan sekarang (duduk/berdiri/berjalan): (.....). Izin dokter bedah saraf (ya/tidak).$t$),
(array[$n$Malignant neoplasm of breast$n$],$t$**Keluhan Utama:** Pasien kanker payudara datang untuk rehabilitasi pasca (mastektomi/operasi/kemoterapi/radioterapi) dengan keluhan (nyeri/kaku bahu/bengkak lengan/lemas).
**Riwayat Sekarang:** Tanggal operasi: (.....). Tindakan (mastektomi/BCS/pengangkatan kelenjar getah bening): (.....). Kemoterapi/radioterapi: (.....). Bengkak lengan (limfedema) (ada/tidak). Gerak bahu terbatas (ada/tidak). Drain (ada/tidak). Kelelahan (ada/tidak).$t$),
(array[$n$Post Arthroscopy$n$,$n$Post op meniscus repair$n$],$t$**Keluhan Utama:** Pasien rehabilitasi pasca arthroscopy lutut (kanan/kiri).
**Riwayat Sekarang:** Tanggal operasi: (.....). Tindakan (meniscectomy/repair/chondroplasty): (.....). Weight bearing: (.....). Bengkak (ada/tidak).$t$),
(array[$n$Post joint replacement (hip)$n$,$n$Post joint replacement (knee)$n$],$t$**Keluhan Utama:** Pasien rehabilitasi pasca penggantian sendi (panggul/lutut) sisi (kanan/kiri).
**Riwayat Sekarang:** Tanggal operasi: (.....). Indikasi (OA/fraktur/lainnya): (.....). Pendekatan operasi: (.....). Precaution: (.....). Alat bantu: (walker/kruk). VAS: (.....)/10.$t$),
(array[$n$Post op ACL and meniscus$n$],$t$**Keluhan Utama:** Pasien rehabilitasi pasca rekonstruksi ACL dan tindakan meniscus lutut (kanan/kiri).
**Riwayat Sekarang:** Tanggal operasi: (.....). Graft: (.....). Tindakan meniscus (repair/meniscectomy): (.....). Weight bearing: (.....). Brace/alat bantu: (.....). Bengkak (ada/tidak). Target olahraga: (.....).$t$),
(array[$n$Post op ACL reconstruction$n$],$t$**Keluhan Utama:** Pasien rehabilitasi pasca rekonstruksi ACL lutut (kanan/kiri).
**Riwayat Sekarang:** Tanggal operasi: (.....). Graft (hamstring/BPTB/lainnya): (.....). Cedera disertai meniscus (ada/tidak). Bengkak (ada/tidak). Brace/alat bantu: (.....). Target olahraga: (.....).$t$),
(array[$n$Post op ATFL repair$n$],$t$**Keluhan Utama:** Pasien rehabilitasi pasca perbaikan ligamen ATFL pergelangan kaki sisi (kanan/kiri).
**Riwayat Sekarang:** Tanggal operasi: (.....). Indikasi/penyebab: (.....). Protokol dan precaution dari dokter: (.....). Weight bearing: (.....). VAS: (.....)/10. Alat bantu: (.....).$t$),
(array[$n$Post op debridement$n$],$t$**Keluhan Utama:** Pasien rehabilitasi pasca debridement pada (.....) sisi (kanan/kiri).
**Riwayat Sekarang:** Tanggal tindakan: (.....). Indikasi (infeksi/jaringan rusak/lainnya): (.....). Kondisi luka (.....). Nyeri VAS: (.....)/10. Keterbatasan gerak: (.....). Protokol dokter: (.....).$t$),
(array[$n$Post op fracture$n$],$t$**Keluhan Utama:** Pasien rehabilitasi pasca operasi fraktur pada (.....).
**Riwayat Sekarang:** Tanggal operasi: (.....). Indikasi/penyebab: (.....). Protokol dan precaution dari dokter: (.....). Weight bearing: (.....). VAS: (.....)/10. Alat bantu: (.....).$t$),
(array[$n$Post Op Fracture Femur$n$],$t$**Keluhan Utama:** Pasien rehabilitasi pasca operasi fraktur femur sisi (kanan/kiri).
**Riwayat Sekarang:** Tanggal operasi: (.....). Indikasi/penyebab: (.....). Protokol dan precaution dari dokter: (.....). Weight bearing: (.....). VAS: (.....)/10. Alat bantu: (.....).$t$),
(array[$n$Post Op Fracture Humerus$n$],$t$**Keluhan Utama:** Pasien rehabilitasi pasca operasi fraktur humerus sisi (kanan/kiri).
**Riwayat Sekarang:** Tanggal operasi: (.....). Indikasi/penyebab: (.....). Protokol dan precaution dari dokter: (.....). Weight bearing: (.....). VAS: (.....)/10. Alat bantu: (.....).$t$),
(array[$n$Post op lumbar$n$],$t$**Keluhan Utama:** Pasien rehabilitasi pasca operasi tulang belakang.
**Riwayat Sekarang:** Tanggal operasi: (.....). Tindakan (laminectomy/discectomy/fusi level .....): (.....). Nyeri tungkai (ada/tidak). Kelemahan/kesemutan (ada/tidak). Korset: (.....). Precaution: (.....).$t$),
(array[$n$Post Op Tendon Repair$n$],$t$**Keluhan Utama:** Pasien rehabilitasi tangan pasca cedera/operasi tendon (fleksor/ekstensor) jari (.....) sisi (kanan/kiri).
**Riwayat Sekarang:** Tanggal cedera/operasi: (.....). Protokol bidai/splint: (.....). Kekakuan jari (ada/tidak). Dominasi tangan: (kanan/kiri).$t$),
(array[$n$Recovery Treatment$n$],$t$**Keluhan Utama:** Pasien datang untuk perawatan pemulihan (recovery) setelah (aktivitas berat/olahraga/cedera/sakit) dengan keluhan (pegal/kaku/lelah).
**Riwayat Sekarang:** Aktivitas pencetus: (.....) tanggal (.....). Area yang terasa tegang: (.....). Nyeri (ada/tidak). Jadwal pertandingan/latihan berikutnya: (.....). Terapi sebelumnya: (.....).$t$),
(array[$n$ACL injury$n$,$n$PCL injury$n$],$t$**Keluhan Utama:** Nyeri dan lutut terasa goyah setelah (jatuh/terpuntir/benturan) tanggal (.....).
**Mekanisme Cedera:** (.....). Bunyi pop (ada/tidak). Bengkak cepat (ada/tidak). Lutut terasa giving way (ada/tidak). Hasil MRI: (.....).$t$),
(array[$n$Ankle Dislocation$n$],$t$**Keluhan Utama:** Nyeri dan keterbatasan fungsi pada pergelangan kaki sisi (kanan/kiri) pasca fraktur.
**Riwayat Sekarang:** Tanggal cedera: (.....).
**Mekanisme:** (.....). Penanganan (konservatif/ORIF/lainnya): (.....). Weight bearing: (.....). Reposisi/tindakan: (.....). Hasil rontgen: (.....).$t$),
(array[$n$Cuboid Syndrome$n$],$t$**Keluhan Utama:** Nyeri di sisi luar kaki bagian tengah (kanan/kiri) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Muncul setelah (terkilir/lari/lompat). Nyeri saat (berjinjit/menumpu/langkah). Bengkak (ada/tidak). Olahraga/sepatu: (.....).$t$),
(array[$n$DOMS$n$],$t$**Keluhan Utama:** Nyeri dan kaku otot (.....) 1-3 hari setelah olahraga/latihan berat.
**Riwayat Sekarang:** Aktivitas pencetus: (.....) tanggal (.....). Nyeri bertambah saat (menggerakkan/menekan otot). Bengkak/memar (ada/tidak). Urin gelap/lemah berat (ada/tidak). Latihan berikutnya: (.....).$t$),
(array[$n$Iliotibial band syndrome$n$],$t$**Keluhan Utama:** Nyeri sisi luar lutut (kanan/kiri) saat (berlari/bersepeda/turun tangga) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri muncul setelah jarak/waktu (.....). Bunyi klik (ada/tidak). Jenis olahraga dan sepatu: (.....).$t$),
(array[$n$Jumper's knee$n$,$n$Patellar tendinitis$n$],$t$**Keluhan Utama:** Nyeri di bawah tempurung lutut (kanan/kiri) saat (melompat/berlari/naik tangga) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Olahraga: (.....). Frekuensi latihan: (.....). Nyeri saat memulai aktivitas (ya/tidak). Bengkak (ada/tidak).$t$),
(array[$n$MCL/LCL sprain$n$],$t$**Keluhan Utama:** Nyeri sisi dalam/luar lutut setelah (benturan/terpuntir) tanggal (.....).
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Lutut terasa goyah ke samping (ada/tidak). Hasil MRI: (.....).$t$),
(array[$n$Meniscus lesion$n$],$t$**Keluhan Utama:** Nyeri lutut (kanan/kiri) setelah cedera/terpuntir tanggal (.....) atau nyeri lutut berulang sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Lutut terkunci/tersangkut (ada/tidak). Bunyi klik (ada/tidak). Bengkak (ada/tidak). Lutut terasa goyah (ada/tidak). Hasil MRI: (.....).$t$),
(array[$n$Shin splint$n$],$t$**Keluhan Utama:** Nyeri sepanjang tulang kering bagian dalam (kanan/kiri) saat (berlari/olahraga) sejak (.....) hari/minggu/bulan yang lalu.
**Riwayat Sekarang:** Nyeri muncul saat (mulai latihan/setelah latihan). Peningkatan intensitas latihan (ya/tidak). Permukaan lari/sepatu: (.....).$t$),
(array[$n$Strain Gastroc$n$],$t$**Keluhan Utama:** Nyeri pada otot betis (gastrocnemius) sisi (kanan/kiri) setelah (berlari/melompat/akselerasi mendadak) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Nyeri saat otot dikontraksikan/diregangkan (ya/tidak). Olahraga/pekerjaan: (.....).$t$),
(array[$n$Strain Popliteal$n$],$t$**Keluhan Utama:** Nyeri pada belakang lutut (popliteus) sisi (kanan/kiri) setelah (berlari/turun tanjakan/memutar lutut) sejak (.....) hari yang lalu.
**Mekanisme Cedera:** (.....). Bengkak/memar (ada/tidak). Nyeri saat otot dikontraksikan/diregangkan (ya/tidak). Olahraga/pekerjaan: (.....).$t$)
)
update public.operational_options o
   set subjective_template = t.body
  from t
 cross join lateral unnest(t.names) as n(name)
 where o.category = 'diagnosa'
   and lower(btrim(o.label)) = lower(btrim(n.name))
   and o.subjective_template is distinct from t.body;
